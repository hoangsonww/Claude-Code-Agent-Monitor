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
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const DEFAULT_GRACE_SECONDS = 300;
const FOCUS_KINDS = new Set(["item", "detour", "feature", "bug"]);

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
 * Full focus-time report for one session: Focus-derived segments, each
 * annotated with wall-clock, active, and idle milliseconds.
 */
function buildSessionFocusReport(dbModule, session) {
  const nowIso = new Date().toISOString();
  const endAt = session.ended_at || nowIso;
  const segments = buildFocusSegments(dbModule, session.id, endAt);
  if (segments.length === 0) {
    return { session_id: session.id, name: session.name, cwd: session.cwd, segments: [] };
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
    };
  });

  return { session_id: session.id, name: session.name, cwd: session.cwd, segments: enriched };
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
  const bucket = totals.by_kind[seg.kind];
  bucket.wall_ms += seg.wall_ms;
  bucket.active_ms += seg.active_ms;
  bucket.idle_ms += seg.idle_ms;
}

/**
 * Builds a project-scoped focus-time report: per-session segments (as
 * returned by {@link buildSessionFocusReport}), a per-item rollup bucketing
 * each detour segment under the item that was current when it started
 * (`item_number`), and project-wide totals by kind. `sessions` must already
 * be scoped to the project's mapped folders by the caller.
 */
function buildProjectFocusReport(dbModule, sessions) {
  const sessionReports = sessions
    .map((s) => buildSessionFocusReport(dbModule, s))
    .filter((r) => r.segments.length > 0);

  const totals = emptyKindTotals();
  const itemsByKey = new Map(); // `${cwd} ${item_number}` -> { cwd, item_number, totals }

  for (const report of sessionReports) {
    for (const seg of report.segments) {
      addToTotals(totals, seg);
      if (seg.item_number == null) continue;
      const key = `${report.cwd} ${seg.item_number}`;
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

  return {
    sessions: sessionReports,
    items,
    totals,
    idle_grace_seconds: Math.round(graceMs() / 1000),
  };
}

module.exports = {
  buildFocusSegments,
  buildSessionFocusReport,
  buildProjectFocusReport,
  emptyKindTotals,
  DEFAULT_GRACE_SECONDS,
};
