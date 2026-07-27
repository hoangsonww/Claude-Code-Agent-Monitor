/**
 * Focus-time report: reconstructs how long a session actually spent on each
 * declared focus state (item / detour / feature / bug) by replaying its
 * ordered `Focus` events into timestamped segments, then discounts each
 * segment's wall-clock span for stretches with no hook activity at all past
 * a configurable grace window — so a session sitting idle for hours doesn't
 * inflate its "time on item" figure.
 *
 * Two independent replays over the same `events` table:
 *   1. Focus segments — walk `Focus` rows only, tracking the declared item
 *      pointer plus a detour stack (mirrors the client's own `focusKind()`
 *      classification: top-of-stack wins, falls back to the base item).
 *   2. Activity gaps — walk EVERY event for the session (any hook, any
 *      agent). A gap between two consecutive events longer than the grace
 *      window only counts the grace window's worth as "active"; the rest is
 *      "idle". This deliberately does not replay the Waiting/Active status
 *      machine (which has real fleet-drain guards baked into hooks.js) —
 *      the event-gap proxy reaches the same practical answer (a still-working
 *      subagent keeps emitting events, so its time stays counted) without
 *      duplicating that guarded logic outside the code that owns it.
 *
 * Env knob: DASHBOARD_FOCUS_IDLE_GRACE_SECONDS — default 300 (5 min); <= 0
 * disables idle discounting entirely (100% of wall-clock counts as active).
 *
 * A segment also carries a `chunks` breakdown — its span sliced into fixed
 * CHUNK_MS (10 min) windows, each flagged `active` if any real event landed
 * inside it. This is deliberately a plainer fact than active_ms/idle_ms
 * above (no grace-window credit, just "did anything happen here") — it
 * exists so a calendar rendering can color a segment's actually-quiet
 * stretches differently from its actually-worked ones, which a single
 * wall_ms-sized block can't show on its own. A whole-session inferred
 * segment (see {@link inferredSegment}) is exactly the case this matters
 * most for: its span runs session-start to session-ended_at regardless of
 * how much of that was silence, so without chunks a long idle tail reads
 * indistinguishably from real work.
 *
 * Sessions with NO declared Focus history fall back to the background
 * classifier's verdict (focus_inferences, written by focus-inference.js) as
 * one whole-session segment flagged `inferred: true` — declared history is
 * ground truth and is never mixed with or overwritten by inference.
 *
 * A session with neither — no declared Focus events AND no usable inference
 * yet (never classified, its cwd has no plan, or the classifier came back
 * 'unclassified') — still gets one whole-session segment, kind `NONE_KIND`
 * ("none"), rather than being dropped from the report (see
 * {@link noFocusSegment}). This matters most for a session that's currently
 * running: the background classifier only classifies a session once it's
 * ended or quiet for QUIET_MS (focus-inference.js), so a live, undeclared
 * session would otherwise be invisible on the calendar/list until it goes
 * quiet or ends. `NONE_KIND` segments carry no real kind to attribute time
 * to, so they're excluded from `totals.by_kind`/the per-item rollup (see
 * {@link addToTotals}) but DO count toward the aggregate `totals.wall_ms`/
 * `active_ms`/`idle_ms` and the project's wall-clock/concurrency figures,
 * same as any other segment.
 *
 * The project-level report also separates EFFORT time (the sum across every
 * session — agent-labor invested, inflates when sessions run concurrently)
 * from WALL-CLOCK time (the union of each session's own span, via
 * {@link mergeIntervals} — the calendar time at least one session was
 * running). See {@link buildProjectFocusReport} for the full rationale.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const DEFAULT_GRACE_SECONDS = 300;
const FOCUS_KINDS = new Set(["item", "detour", "feature", "bug"]);
/** Report-only sentinel kind for {@link noFocusSegment} - never a value a
 *  declared Focus event or the classifier can produce, so it can't collide
 *  with a real kind. Deliberately excluded from `FOCUS_KINDS` above (which
 *  gates what a real `ccam focus push/bug/feature` declaration may claim). */
const NONE_KIND = "none";
/** Fixed chunk width for {@link buildActivityChunks} - matches the client's
 *  SegmentEventsModal event-bucket size (client/src/lib/eventBuckets.ts) so
 *  a segment's calendar stripes and its events-modal rows agree on the same
 *  10-minute granularity. */
const CHUNK_MS = 10 * 60 * 1000;

/** Reads the configured idle-grace window in milliseconds. `<= 0` disables
 *  discounting (every gap counts as fully active). */
function graceMs() {
  const raw = process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS;
  const seconds = raw === undefined || raw === "" ? DEFAULT_GRACE_SECONDS : Number(raw);
  if (!Number.isFinite(seconds)) return DEFAULT_GRACE_SECONDS * 1000;
  return seconds * 1000;
}

/** Parses one Focus event's JSON `data` column, tolerating junk. */
function parseData(row) {
  try {
    return row.data ? JSON.parse(row.data) : {};
  } catch {
    return {};
  }
}

/**
 * Replays a session's full, chronologically-ordered `Focus` event history
 * into a flat list of segments — one per interval where a single FocusKind
 * was continuously current. A detour's `item_number` is the item that was
 * current when it started (the same "prior_item" concept the client's
 * PlanModal buckets detours under), not necessarily the item current when it
 * ends, since `set`/`done` close and reopen segments on their own.
 *
 * `endAt` (ISO string) closes the final open segment — pass the session's
 * `ended_at` for a finished session, or the current time for one still open.
 */
function buildFocusSegments(dbModule, sessionId, endAt) {
  const rows = dbModule.db
    .prepare(
      `SELECT summary, data, created_at FROM events
       WHERE session_id = ? AND event_type = 'Focus' ORDER BY id ASC`
    )
    .all(sessionId);

  const segments = [];
  const stack = []; // detour frames: { kind, label }
  let itemNumber = null;
  let itemText = null;
  let open = null; // { kind, label, item_number, start }

  function currentState() {
    const top = stack[stack.length - 1];
    if (top) return { kind: top.kind, label: top.label, item_number: itemNumber };
    if (itemNumber != null) return { kind: "item", label: itemText, item_number: itemNumber };
    return null;
  }

  function transitionTo(next, at) {
    const changed =
      (open?.kind ?? null) !== (next?.kind ?? null) ||
      (open?.item_number ?? null) !== (next?.item_number ?? null) ||
      (open?.label ?? null) !== (next?.label ?? null);
    if (!changed) return;
    if (open) segments.push({ ...open, end: at });
    open = next
      ? { kind: next.kind, label: next.label, item_number: next.item_number, start: at }
      : null;
  }

  for (const row of rows) {
    const data = parseData(row);
    if (data.ignored) continue; // stack-full push / empty-stack pop: no real state change
    switch (data.verb) {
      case "set":
        itemNumber = data.item_number ?? null;
        itemText = data.item_text_snapshot ?? null;
        break;
      case "push":
      case "bug":
      case "feature": {
        const kind = data.kind && FOCUS_KINDS.has(data.kind) ? data.kind : "detour";
        stack.push({ kind, label: data.title || data.description || null });
        break;
      }
      case "pop":
        stack.pop();
        break;
      case "done":
        if (data.item_number === itemNumber) {
          itemNumber = null;
          itemText = null;
        }
        break;
      default:
        continue;
    }
    transitionTo(currentState(), row.created_at);
  }
  if (open) segments.push({ ...open, end: endAt });
  return segments;
}

/**
 * Sums active/idle milliseconds within [start, end) from a sorted list of
 * event timestamps (ms epoch) that fall anywhere in the session's timeline —
 * callers pass the FULL per-session list once and this slices per segment,
 * rather than re-querying per segment. Bookends the window with its own
 * start/end so a segment that opens or closes mid-silence is graced from its
 * own edges too, not just between two real events.
 */
function activeIdleMs(allTimestampsMs, startMs, endMs, grace) {
  if (endMs <= startMs) return { active_ms: 0, idle_ms: 0 };
  if (grace <= 0) return { active_ms: endMs - startMs, idle_ms: 0 };

  // Binary-search-free: allTimestampsMs is short enough per session (hook
  // volume, not raw transcript volume) that a linear filter is simpler and
  // fast enough; segments are built from the same table so this never runs
  // on more than a session's total event count.
  const inWindow = allTimestampsMs.filter((t) => t > startMs && t < endMs);
  const points = [startMs, ...inWindow, endMs];

  let activeMs = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const gap = points[i + 1] - points[i];
    if (gap <= 0) continue;
    activeMs += Math.min(gap, grace);
  }
  return { active_ms: activeMs, idle_ms: endMs - startMs - activeMs };
}

/**
 * Slices [startMs, endMs) into fixed CHUNK_MS windows and flags each one
 * `active: true` if at least one real event timestamp falls inside it, else
 * `active: false`. The last chunk is shortened to end exactly at `endMs`
 * rather than overshooting the segment. Unlike {@link activeIdleMs}, this
 * carries no grace-window credit — a chunk with zero events is idle, full
 * stop — since the point is an honest per-window fact for coloring a
 * calendar block, not another aggregate figure.
 */
function buildActivityChunks(allTimestampsMs, startMs, endMs, chunkMs = CHUNK_MS) {
  if (endMs <= startMs) return [];
  const chunks = [];
  for (let chunkStart = startMs; chunkStart < endMs; chunkStart += chunkMs) {
    const chunkEnd = Math.min(chunkStart + chunkMs, endMs);
    const active = allTimestampsMs.some((ts) => ts >= chunkStart && ts < chunkEnd);
    chunks.push({
      start: new Date(chunkStart).toISOString(),
      end: new Date(chunkEnd).toISOString(),
      active,
    });
  }
  return chunks;
}

/**
 * Clips a segment's `[start, end)` span to an explicit `[windowStartMs,
 * windowEndMs)` window, dropping it entirely (returns `null`) when it
 * doesn't overlap the window at all. Either bound may be omitted
 * independently (an omitted bound leaves that side unclipped) so a caller
 * with only a lower or only an upper bound still gets a partial clip instead
 * of an all-or-nothing skip. Returns the SAME object (no clone) when neither
 * bound actually narrows the segment, so the common unbounded-report case
 * (see {@link buildSessionFocusReport}'s own `windowStartMs`/`windowEndMs ==
 * null` guard) never pays for a needless copy.
 */
function clipSegmentToWindow(seg, windowStartMs, windowEndMs) {
  const segStartMs = new Date(seg.start).getTime();
  const segEndMs = new Date(seg.end).getTime();
  const clippedStartMs = windowStartMs != null ? Math.max(segStartMs, windowStartMs) : segStartMs;
  const clippedEndMs = windowEndMs != null ? Math.min(segEndMs, windowEndMs) : segEndMs;
  if (clippedEndMs <= clippedStartMs) return null;
  if (clippedStartMs === segStartMs && clippedEndMs === segEndMs) return seg;
  return {
    ...seg,
    start: new Date(clippedStartMs).toISOString(),
    end: new Date(clippedEndMs).toISOString(),
  };
}

/** A session's own `started_at` if set, else its earliest recorded event's
 *  timestamp — shared by {@link inferredSegment} and {@link noFocusSegment}
 *  since both need to bookend a whole-session synthetic segment. Returns
 *  undefined in the (practically never happens) case neither exists. */
function resolveSessionStart(dbModule, session) {
  return (
    session.started_at ||
    dbModule.db
      .prepare("SELECT created_at FROM events WHERE session_id = ? ORDER BY id ASC LIMIT 1")
      .get(session.id)?.created_at
  );
}

/**
 * Fallback for a session with ZERO declared segments: turn its
 * focus_inferences row (written by the background classifier in
 * focus-inference.js) into one synthetic segment spanning the session. The
 * inference stores the plan item's stable item_id; it resolves to the item's
 * CURRENT display number here, at read time, so a plan reorder between
 * inference and report can't mis-bucket the time. Returns null when there is
 * no usable inference ('unclassified' rows, or none recorded yet, fall
 * through to {@link noFocusSegment} instead of staying an honest hole in the
 * report). Declared Focus events always win — this is only consulted when
 * there are none.
 */
function inferredSegment(dbModule, session, endAt) {
  let row;
  try {
    row = dbModule.stmts.getFocusInference.get(session.id);
  } catch {
    return null;
  }
  if (!row || row.kind === "unclassified") return null;

  const start = resolveSessionStart(dbModule, session);
  if (!start) return null;

  if (row.kind === "item" && row.item_id) {
    const item = dbModule.stmts.getPlanItemById.get(session.cwd, row.item_id);
    if (!item || item.item_number == null) return null; // item since deleted
    return {
      kind: "item",
      label: item.text,
      item_number: item.item_number,
      start,
      end: endAt,
      inferred: true,
      inferredReason: row.reason || null,
    };
  }
  if (row.kind === "detour") {
    return {
      kind: "detour",
      label: row.label,
      item_number: null,
      start,
      end: endAt,
      inferred: true,
      inferredReason: row.reason || null,
    };
  }
  return null;
}

/**
 * Last-resort fallback for a session with ZERO declared segments AND no
 * usable inference ({@link inferredSegment} returned null - never
 * classified, no plan in its cwd, or the classifier itself came back
 * 'unclassified'/no confident match): one whole-session segment flagged
 * `NONE_KIND` so the session still shows up on the calendar/list instead of
 * silently vanishing from the report. Returns null only when even a start
 * time can't be resolved (no `started_at` and no recorded events) - that
 * session genuinely has nothing to draw a block from.
 */
function noFocusSegment(dbModule, session, endAt) {
  const start = resolveSessionStart(dbModule, session);
  if (!start) return null;
  return {
    kind: NONE_KIND,
    label: null,
    item_number: null,
    start,
    end: endAt,
    inferred: false,
    inferredReason: null,
  };
}

/**
 * Full focus-time report for one session: Focus-derived segments, each
 * annotated with wall-clock, active, and idle milliseconds. A session with
 * no declared Focus history at all falls back to its inferred classification
 * (one whole-session segment flagged `inferred: true`) — see
 * {@link inferredSegment} — and, failing that, to one `NONE_KIND` segment
 * (see {@link noFocusSegment}) so it's never simply dropped. Carries
 * `ended_at` straight through from the input session row (`null` for one
 * still active) so a client rendering a calendar/timeline can tell
 * "genuinely still running" apart from "just happened to end near when the
 * report was fetched" — both look identical from segment timestamps alone.
 *
 * `windowStartMs`/`windowEndMs` (both optional, each independently) clip
 * every segment — declared, inferred, or the `NONE_KIND` fallback alike — to
 * that window via {@link clipSegmentToWindow} before any wall/active/idle
 * math or chunking runs, and drop segments that fall entirely outside it.
 * Omitting both (the default, used by the unbounded per-project route) keeps
 * this producing a session's full, unclipped history exactly as before. This
 * is what makes a caller-supplied time window (e.g. "today", a date range)
 * actually bound the reported metrics instead of merely deciding which
 * sessions are included while still summing each one's whole span.
 */
function buildSessionFocusReport(dbModule, session, windowStartMs, windowEndMs) {
  const nowIso = new Date().toISOString();
  const endAt = session.ended_at || nowIso;
  let segments = buildFocusSegments(dbModule, session.id, endAt);
  if (segments.length === 0) {
    const inferred = inferredSegment(dbModule, session, endAt);
    if (inferred) segments = [inferred];
  }
  if (segments.length === 0) {
    const fallback = noFocusSegment(dbModule, session, endAt);
    if (fallback) segments = [fallback];
  }
  if (windowStartMs != null || windowEndMs != null) {
    segments = segments
      .map((seg) => clipSegmentToWindow(seg, windowStartMs, windowEndMs))
      .filter((seg) => seg != null);
  }
  if (segments.length === 0) {
    return {
      session_id: session.id,
      name: session.name,
      cwd: session.cwd,
      ended_at: session.ended_at || null,
      segments: [],
    };
  }

  const allEvents = dbModule.db
    .prepare("SELECT created_at FROM events WHERE session_id = ? ORDER BY id ASC")
    .all(session.id);
  const allTimestampsMs = allEvents.map((r) => new Date(r.created_at).getTime());
  const grace = graceMs();

  const enriched = segments.map((seg) => {
    const startMs = new Date(seg.start).getTime();
    const endMs = new Date(seg.end).getTime();
    const { active_ms, idle_ms } = activeIdleMs(allTimestampsMs, startMs, endMs, grace);
    return {
      kind: seg.kind,
      item_number: seg.item_number,
      label: seg.label,
      start: seg.start,
      end: seg.end,
      wall_ms: Math.max(0, endMs - startMs),
      active_ms,
      idle_ms,
      inferred: Boolean(seg.inferred),
      inferred_reason: seg.inferred ? seg.inferredReason || null : null,
      chunks: buildActivityChunks(allTimestampsMs, startMs, endMs),
    };
  });

  return {
    session_id: session.id,
    name: session.name,
    cwd: session.cwd,
    ended_at: session.ended_at || null,
    segments: enriched,
  };
}

/** Empty-but-well-shaped totals, so a project with no tracked focus time
 *  still renders the report UI instead of a special-cased blank state. */
function emptyKindTotals() {
  const byKind = {};
  for (const kind of FOCUS_KINDS) byKind[kind] = { wall_ms: 0, active_ms: 0, idle_ms: 0 };
  return { wall_ms: 0, active_ms: 0, idle_ms: 0, by_kind: byKind };
}

function addToTotals(totals, seg) {
  totals.wall_ms += seg.wall_ms;
  totals.active_ms += seg.active_ms;
  totals.idle_ms += seg.idle_ms;
  // NONE_KIND (see noFocusSegment) has no real kind to attribute per-kind
  // time to - it still counts toward the aggregate totals above, just not
  // toward any by_kind bucket.
  if (seg.kind === NONE_KIND) return;
  const bucket = totals.by_kind[seg.kind];
  bucket.wall_ms += seg.wall_ms;
  bucket.active_ms += seg.active_ms;
  bucket.idle_ms += seg.idle_ms;
}

/**
 * Merges a list of `[startMs, endMs]` intervals into their union — sorted,
 * non-overlapping, touching intervals joined — and the total duration they
 * cover. This is the calendar-time counterpart to summing effort across
 * sessions: three sessions running concurrently for an hour sum to 3h of
 * effort but merge to 1h of wall-clock coverage, since their intervals
 * fully overlap. Malformed intervals (`end <= start`) are dropped rather
 * than treated as errors — a defensive session with no real span shouldn't
 * blow up the whole report.
 */
function mergeIntervals(intervals) {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  const totalMs = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
  return { merged, totalMs };
}

/**
 * Builds a project-scoped focus-time report: per-session segments (as
 * returned by {@link buildSessionFocusReport}), a per-item rollup bucketing
 * each detour segment under the item that was current when it started
 * (`item_number`), and project-wide totals by kind. `sessions` must already
 * be scoped to the project's mapped folders by the caller.
 *
 * Also distinguishes EFFORT time from WALL-CLOCK time, since this dashboard
 * exists to watch multiple sessions run concurrently: `totals.active_ms` is
 * the sum across every session (agent-labor invested — the same number a
 * timesheet would report for N people working in parallel), while
 * `wall_clock_ms` is the union of each session's own span (first segment
 * start to last segment end), merged via {@link mergeIntervals} — the
 * calendar time during which at least one session was running. Concurrency
 * is measured at the session level (not per-segment/per-item), matching
 * what's actually running in parallel. `concurrency_ratio` (effort ÷
 * wall-clock) turns "9h effort in a 3h window" into a legible "3x
 * parallelism" instead of looking like the numbers don't add up; it's
 * `null` when there's no wall-clock time to divide by.
 *
 * `windowStartMs`/`windowEndMs` (both optional, each independently) are
 * threaded straight through to {@link buildSessionFocusReport}, which clips
 * every session's segments to that window before any of the totals/rollup/
 * wall-clock math below runs. Without them (the unbounded per-project
 * route's case), a session contributes its full history, same as always.
 * With them (the explicitly time-windowed route), a session that merely
 * OVERLAPS the window — e.g. one still running from a prior day, or
 * spanning midnight into the window — only contributes the slice of its
 * active/idle time that actually falls inside `[windowStartMs, windowEndMs)`,
 * so picking "today" can no longer pull in yesterday's accumulated time for
 * a long-running session.
 */
function buildProjectFocusReport(dbModule, sessions, windowStartMs, windowEndMs) {
  const sessionReports = sessions
    .map((s) => buildSessionFocusReport(dbModule, s, windowStartMs, windowEndMs))
    .filter((r) => r.segments.length > 0);

  const totals = emptyKindTotals();
  const itemsByKey = new Map(); // `${cwd} ${item_number}` -> { cwd, item_number, totals }

  for (const report of sessionReports) {
    for (const seg of report.segments) {
      addToTotals(totals, seg);
      if (seg.item_number == null) continue;
      const key = `${report.cwd} ${seg.item_number}`;
      let entry = itemsByKey.get(key);
      if (!entry) {
        entry = { cwd: report.cwd, item_number: seg.item_number, totals: emptyKindTotals() };
        itemsByKey.set(key, entry);
      }
      addToTotals(entry.totals, seg);
    }
  }

  // Attach each item's current plan text (not the historical snapshot on the
  // segment) so the rollup reads correctly even after the plan file changed.
  const items = Array.from(itemsByKey.values()).map((entry) => {
    const planItem = dbModule.stmts.getPlanItem.get(entry.cwd, entry.item_number);
    return { ...entry, text: planItem ? planItem.text : null };
  });
  items.sort((a, b) => b.totals.active_ms - a.totals.active_ms);

  // A session's own span is gapless by construction (buildFocusSegments /
  // the inference fallback both produce back-to-back or single segments),
  // so its first segment's start and last segment's end bookend the whole
  // session — no need to inspect every segment in between.
  const sessionSpans = sessionReports.map((report) => [
    new Date(report.segments[0].start).getTime(),
    new Date(report.segments[report.segments.length - 1].end).getTime(),
  ]);
  const { totalMs: wallClockMs } = mergeIntervals(sessionSpans);
  const concurrencyRatio = wallClockMs > 0 ? totals.active_ms / wallClockMs : null;

  return {
    sessions: sessionReports,
    items,
    totals,
    idle_grace_seconds: Math.round(graceMs() / 1000),
    wall_clock_ms: wallClockMs,
    concurrency_ratio: concurrencyRatio,
  };
}

module.exports = {
  buildFocusSegments,
  buildSessionFocusReport,
  buildProjectFocusReport,
  buildActivityChunks,
  clipSegmentToWindow,
  mergeIntervals,
  emptyKindTotals,
  noFocusSegment,
  DEFAULT_GRACE_SECONDS,
  CHUNK_MS,
  NONE_KIND,
};
