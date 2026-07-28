/**
 * @file focusActivity.ts
 * @description Groups a `FocusReport`'s per-session segments into one row per
 * distinct thing that happened — a plan item, a detour/bug/feature (by
 * title), or unclassified ("none") activity — for the Focus report page
 * (`FocusPage.tsx`) and its `FocusActivityCard`. The report it's given is
 * already server-clipped to the caller's requested `from`/`to` (see
 * `GET /api/focus-report`'s file header), so grouping/summing alone is
 * enough by default.
 *
 * An optional third `window` param additionally clips each segment to a
 * `[startMs, endMs)` sub-window before grouping (via `windowedTotals.ts`'s
 * `clipSegment`, the same per-segment clip its own `computeWindowedTotals`
 * uses) — `FocusPage.tsx`'s hour-window zoom (`useHourWindowZoom`) passes
 * this so the activity list stays honest with whatever the zoom's stat
 * tiles are showing, rather than the list silently still reflecting the
 * full unzoomed day while the tiles above it read a narrower window.
 *
 * There is no existing server-side rollup for detour/bug/feature time by
 * title (only plan items get one, in `FocusReport.items`) — grouping those
 * across sessions by `(cwd, kind, label)` is the one genuinely new
 * aggregation this file adds.
 *
 * Unclassified (`"none"`) segments are NOT all collapsed into one per-cwd
 * bucket: a segment that carries an `inferred_reason` is a distinct
 * narrative (the classifier's one-sentence story of what that session did),
 * so those stay one row per session (`cwd:none:sessionId`) — two sessions
 * that did genuinely different un-planned work read as two rows, not one
 * row wearing only the bigger session's story. Only reason-less `"none"`
 * segments (nothing to say) still collapse into the shared `cwd:none` tail
 * bucket.
 *
 * When more than one segment lands on the same key (e.g. two different
 * sessions both landed on the same plan item), the displayed `label`/
 * `inferred`/`reason` come from whichever contributing segment has the
 * largest wall-time share (the clipped share, when a `window` was given) —
 * and `contributors` records each contributing SESSION's own time range,
 * wall/active split, and reason, so a consumer can expand "+N more
 * sessions" into the full per-session detail rather than only ever showing
 * the dominant story. `contributions` (their count) is kept alongside for
 * the collapsed label.
 *
 * Each entry also tracks `firstStart`/`lastEnd` — the earliest contributing
 * segment's start and the latest one's end (clipped to `window` when given) —
 * so `FocusActivityCard` can show a human-friendly start/stop time per row.
 * For a merged entry these two timestamps span every contribution, not just
 * the dominant one, and aren't necessarily contiguous.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { parseDate } from "./format";
import { clipSegment } from "./windowedTotals";
import type { FocusReport, FocusReportSegment, FocusSegmentKind } from "./types";

/** One contributing session's share of a grouped {@link FocusActivityEntry} —
 *  its own summed time, clipped range, and (when inferred) one-sentence
 *  reason. Multiple segments from the same session on the same key merge
 *  into ONE contribution, so "+N more sessions" counts sessions, and an
 *  expanded row never repeats a session. */
export interface FocusActivityContribution {
  sessionId: string;
  /** The session's display name, `null` when it was never named. */
  sessionName: string | null;
  /** Earliest contributing segment's start / latest one's end for THIS
   *  session (clipped to `window` when given), ISO strings. */
  firstStart: string;
  lastEnd: string;
  wallMs: number;
  activeMs: number;
  idleMs: number;
  inferred: boolean;
  reason: string | null;
}

/** One grouped row of activity — a plan item, a detour/bug/feature (by
 *  title), or unclassified time — summed across every session/segment that
 *  landed on the same key within the given report. */
export interface FocusActivityEntry {
  /** `${cwd}:item:${item_number}` | `${cwd}:${kind}:${label}` |
   *  `${cwd}:none:${session_id}` (unclassified WITH a reason — one narrative
   *  row per session) | `${cwd}:none` (reason-less unclassified tail) */
  key: string;
  kind: FocusSegmentKind;
  itemNumber: number | null;
  /** The plan item's text snapshot, or the detour/bug/feature's title —
   *  `null` for `"none"` (unclassified) or when the dominant contributing
   *  segment carried no label. Callers apply their own i18n fallback for
   *  `null`, mirroring `FocusReportBody`'s `ListView` (`focus.unknownItem`). */
  label: string | null;
  /** Resolved via the caller's `projectLabelForCwd`, `undefined` when the
   *  caller didn't pass one or the cwd doesn't resolve to a known project —
   *  meaningful only in a cross-project ("all projects") scope. */
  projectLabel: string | undefined;
  wallMs: number;
  activeMs: number;
  idleMs: number;
  /** ISO timestamp of the earliest contributing segment's start (clipped to
   *  `window` when given) - the human-friendly "start time" shown per row.
   *  When several segments roll into one entry, this is the first one's
   *  start, not necessarily contiguous with `lastEnd`. */
  firstStart: string;
  /** ISO timestamp of the latest contributing segment's end (clipped to
   *  `window` when given) - the human-friendly "stop time" shown per row. */
  lastEnd: string;
  /** From the dominant (largest `wall_ms`) contributing segment. */
  inferred: boolean;
  /** The dominant contributing segment's `inferred_reason`, or `null` when
   *  it wasn't inferred (a live declaration has no separate reason distinct
   *  from its label — see FocusPage's known-gap note) or carried none. */
  reason: string | null;
  /** How many SESSIONS rolled into this row (`contributors.length`). */
  contributions: number;
  /** Per-session detail behind this row — see {@link FocusActivityContribution}. */
  contributors: FocusActivityContribution[];
}

function keyFor(cwd: string, sessionId: string, seg: FocusReportSegment): string {
  if (seg.kind === "item") return `${cwd}:item:${seg.item_number}`;
  if (seg.kind === "none") {
    // A reasoned unclassified segment is its session's own distinct
    // narrative — never merged with another session's different story (see
    // file header). Reason-less ones share the per-cwd tail bucket.
    return seg.inferred_reason ? `${cwd}:none:${sessionId}` : `${cwd}:none`;
  }
  return `${cwd}:${seg.kind}:${seg.label ?? ""}`;
}

/**
 * Groups every segment across `report.sessions` into one {@link FocusActivityEntry}
 * per distinct plan item / detour-bug-feature title / unclassified bucket
 * (scoped per-cwd, so the same item number in two different projects never
 * merges), summing wall/active/idle time. Returned sorted **chronologically,
 * most-recent-first** by `lastEnd` — the latest contributing segment's end
 * time — so the activity list reads like a normal reverse-chronological
 * feed (most recently active thing on top) rather than ranked by how much
 * time it took.
 *
 * When `window` is given, each segment is first clipped to
 * `[window.startMs, window.endMs)` via `clipSegment`; a segment that doesn't
 * overlap the window at all contributes nothing, and one that does
 * contributes only its clipped wall/active/idle time — so the returned
 * entries agree with whatever sub-window a caller (e.g. `FocusPage.tsx`'s
 * hour-window zoom) is actually showing, the same way `computeWindowedTotals`
 * already does for the stat tiles.
 */
export function groupFocusActivity(
  report: FocusReport,
  projectLabelForCwd?: (cwd: string | null) => string | undefined,
  window?: { startMs: number; endMs: number }
): FocusActivityEntry[] {
  const byKey = new Map<string, FocusActivityEntry>();
  const dominantWallMs = new Map<string, number>();
  const firstStartMs = new Map<string, number>();
  const lastEndMs = new Map<string, number>();
  // Per (key, session) contribution rollup - `${key} ${sessionId}`.
  const contributionByKeySession = new Map<string, FocusActivityContribution>();

  for (const session of report.sessions) {
    const cwd = session.cwd ?? "";
    for (const seg of session.segments) {
      const clipped = window ? clipSegment(seg, window.startMs, window.endMs) : null;
      if (window && !clipped) continue; // doesn't overlap the window at all
      const wallMs = clipped ? clipped.wall_ms : seg.wall_ms;
      const activeMs = clipped ? clipped.active_ms : seg.active_ms;
      const idleMs = clipped ? clipped.idle_ms : seg.idle_ms;
      const segStartMs = clipped ? clipped.startMs : parseDate(seg.start).getTime();
      const segEndMs = clipped ? clipped.endMs : parseDate(seg.end).getTime();

      const key = keyFor(cwd, session.session_id, seg);
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          kind: seg.kind,
          itemNumber: seg.item_number,
          label: seg.label,
          projectLabel: projectLabelForCwd?.(session.cwd),
          wallMs: 0,
          activeMs: 0,
          idleMs: 0,
          firstStart: seg.start,
          lastEnd: seg.end,
          inferred: seg.inferred,
          reason: seg.inferred_reason,
          contributions: 0,
          contributors: [],
        };
        byKey.set(key, entry);
        dominantWallMs.set(key, 0);
        firstStartMs.set(key, Infinity);
        lastEndMs.set(key, -Infinity);
      }
      entry.wallMs += wallMs;
      entry.activeMs += activeMs;
      entry.idleMs += idleMs;

      const contributionKey = `${key} ${session.session_id}`;
      let contribution = contributionByKeySession.get(contributionKey);
      if (!contribution) {
        contribution = {
          sessionId: session.session_id,
          sessionName: session.name ?? null,
          firstStart: new Date(segStartMs).toISOString(),
          lastEnd: new Date(segEndMs).toISOString(),
          wallMs: 0,
          activeMs: 0,
          idleMs: 0,
          inferred: seg.inferred,
          reason: seg.inferred_reason,
        };
        contributionByKeySession.set(contributionKey, contribution);
        entry.contributors.push(contribution);
        entry.contributions = entry.contributors.length;
      }
      contribution.wallMs += wallMs;
      contribution.activeMs += activeMs;
      contribution.idleMs += idleMs;
      if (segStartMs < parseDate(contribution.firstStart).getTime()) {
        contribution.firstStart = new Date(segStartMs).toISOString();
      }
      if (segEndMs > parseDate(contribution.lastEnd).getTime()) {
        contribution.lastEnd = new Date(segEndMs).toISOString();
      }
      if (seg.inferred_reason && !contribution.reason) {
        // A session's later reasoned segment fills a reason its earlier
        // reason-less segment left null - never the other way around.
        contribution.reason = seg.inferred_reason;
        contribution.inferred = seg.inferred;
      }

      if (segStartMs < (firstStartMs.get(key) ?? Infinity)) {
        firstStartMs.set(key, segStartMs);
        entry.firstStart = new Date(segStartMs).toISOString();
      }
      if (segEndMs > (lastEndMs.get(key) ?? -Infinity)) {
        lastEndMs.set(key, segEndMs);
        entry.lastEnd = new Date(segEndMs).toISOString();
      }

      const currentDominant = dominantWallMs.get(key) ?? 0;
      if (wallMs > currentDominant) {
        dominantWallMs.set(key, wallMs);
        entry.label = seg.label;
        entry.itemNumber = seg.item_number;
        entry.inferred = seg.inferred;
        entry.reason = seg.inferred_reason;
      }
    }
  }

  for (const entry of byKey.values()) {
    // Largest share first, so an expanded row leads with the main story.
    entry.contributors.sort((a, b) => b.wallMs - a.wallMs);
  }

  return Array.from(byKey.values()).sort(
    (a, b) => parseDate(b.lastEnd).getTime() - parseDate(a.lastEnd).getTime()
  );
}
