/**
 * @file windowedTotals.ts
 * @description Client-side recompute of a `FocusReport`'s aggregate stat-tile
 * numbers (active/idle/wall totals, `wall_clock_ms`, `concurrency_ratio`),
 * restricted to an arbitrary `[startMs, endMs)` sub-window of an
 * already-fetched report. Exists so `FocusCalendarView`'s hour-window "zoom"
 * (see its file header) can make `FocusReportBody`'s stat tiles agree with
 * what the zoomed calendar is actually showing, instead of the tiles always
 * reflecting the full fetched report (today's whole day, or an even wider
 * custom range) regardless of the calendar's own zoom.
 *
 * Deliberately built from each segment's `chunks` (the 10-minute active/idle
 * grid `SegmentedBar`/`FocusCalendarView` already render idle stripes from —
 * see `idleStripes.ts`) rather than re-deriving grace-window `active_ms` math
 * client-side: the server's grace-window computation needs raw per-session
 * event timestamps a `FocusReport` never carries to the client, so an exact
 * client-side re-derivation isn't possible without a second network request
 * per zoom tick. Sizing windowed active/idle off the same chunk grid the
 * calendar already paints from keeps these numbers honest with what's
 * literally on screen (same granularity, same source), rather than a second,
 * differently-precise estimate a user could never reconcile by eye.
 *
 * Mirrors two small pieces of server/lib/focus-report.js's own aggregation
 * (`addToTotals`, `mergeIntervals`) client-side — unavoidable given the two
 * run in different languages/runtimes over different source data (raw event
 * timestamps server-side vs. a chunk grid here), not a maintained-in-two-
 * places duplication of the same logic.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { parseDate } from "./format";
import type { FocusKind, FocusKindTotals, FocusReport, FocusReportSegment } from "./types";

const ALL_KINDS: FocusKind[] = ["item", "detour", "feature", "bug"];

/** Report-only sentinel kind (see server/lib/focus-report.js's `NONE_KIND`)
 *  — counts toward the aggregate totals below but never a `by_kind` bucket. */
const NONE_KIND = "none";

export interface WindowedTotals {
  totals: FocusKindTotals;
  wallClockMs: number;
  concurrencyRatio: number | null;
}

function emptyKindTotals(): FocusKindTotals {
  const byKind = {} as FocusKindTotals["by_kind"];
  for (const kind of ALL_KINDS) byKind[kind] = { wall_ms: 0, active_ms: 0, idle_ms: 0 };
  return { wall_ms: 0, active_ms: 0, idle_ms: 0, by_kind: byKind };
}

function addToTotals(
  totals: FocusKindTotals,
  seg: { kind: string; wall_ms: number; active_ms: number; idle_ms: number }
) {
  totals.wall_ms += seg.wall_ms;
  totals.active_ms += seg.active_ms;
  totals.idle_ms += seg.idle_ms;
  if (seg.kind === NONE_KIND) return;
  const bucket = totals.by_kind[seg.kind as FocusKind];
  if (!bucket) return;
  bucket.wall_ms += seg.wall_ms;
  bucket.active_ms += seg.active_ms;
  bucket.idle_ms += seg.idle_ms;
}

/** Clips one segment's chunk grid to `[startMs, endMs)` and sums active vs.
 *  idle milliseconds within that clip. Returns `null` when the segment
 *  doesn't overlap the window at all. A segment with no `chunks` (shouldn't
 *  happen for a report the server produced, but the field is optional in the
 *  type) falls back to treating its whole clipped span as active, matching
 *  `wall_ms === active_ms` for a segment with no idle breakdown at all.
 *  Exported for `focusActivity.ts`'s own optional window-clipping support -
 *  the same per-segment clip, reused rather than re-derived. */
export function clipSegment(seg: FocusReportSegment, startMs: number, endMs: number) {
  const segStart = parseDate(seg.start).getTime();
  const segEnd = parseDate(seg.end).getTime();
  const clipStart = Math.max(segStart, startMs);
  const clipEnd = Math.min(segEnd, endMs);
  if (clipEnd <= clipStart) return null;

  const wallMs = clipEnd - clipStart;
  if (!seg.chunks || seg.chunks.length === 0) {
    return { startMs: clipStart, endMs: clipEnd, wall_ms: wallMs, active_ms: wallMs, idle_ms: 0 };
  }
  let activeMs = 0;
  for (const chunk of seg.chunks) {
    if (!chunk.active) continue;
    const chunkStart = parseDate(chunk.start).getTime();
    const chunkEnd = parseDate(chunk.end).getTime();
    const visStart = Math.max(chunkStart, clipStart);
    const visEnd = Math.min(chunkEnd, clipEnd);
    if (visEnd > visStart) activeMs += visEnd - visStart;
  }
  return {
    startMs: clipStart,
    endMs: clipEnd,
    wall_ms: wallMs,
    active_ms: activeMs,
    idle_ms: wallMs - activeMs,
  };
}

/** Union-of-intervals + total covered duration — the client counterpart to
 *  server/lib/focus-report.js's `mergeIntervals`, over each session's own
 *  windowed span rather than raw event timestamps. */
function mergedDurationMs(spans: Array<[number, number]>): number {
  const sorted = spans.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const [s, e] of sorted) {
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/**
 * Recomputes `report`'s aggregate totals/wall-clock/concurrency restricted
 * to `[startMs, endMs)`. A session that doesn't overlap the window at all
 * contributes nothing; one that does contributes only its clipped span's
 * chunk-derived active/idle time, same as the server's own window-clipping
 * does for a bounded `GET /api/focus-report` request (see
 * server/lib/focus-report.js's `clipSegmentToWindow`) — just computed here,
 * client-side, off data already in hand instead of a second fetch.
 */
export function computeWindowedTotals(
  report: FocusReport,
  startMs: number,
  endMs: number
): WindowedTotals {
  const totals = emptyKindTotals();
  const sessionSpans: Array<[number, number]> = [];

  for (const session of report.sessions) {
    let sessionStart = Infinity;
    let sessionEnd = -Infinity;
    for (const seg of session.segments) {
      const clipped = clipSegment(seg, startMs, endMs);
      if (!clipped) continue;
      addToTotals(totals, { kind: seg.kind, ...clipped });
      sessionStart = Math.min(sessionStart, clipped.startMs);
      sessionEnd = Math.max(sessionEnd, clipped.endMs);
    }
    if (sessionEnd > sessionStart) sessionSpans.push([sessionStart, sessionEnd]);
  }

  const wallClockMs = mergedDurationMs(sessionSpans);
  const concurrencyRatio = wallClockMs > 0 ? totals.active_ms / wallClockMs : null;
  return { totals, wallClockMs, concurrencyRatio };
}
