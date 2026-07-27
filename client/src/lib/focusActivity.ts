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
 * When more than one segment lands on the same key (e.g. two different
 * sessions both landed on the same plan item), the displayed `label`/
 * `inferred`/`reason` come from whichever contributing segment has the
 * largest wall-time share (the clipped share, when a `window` was given) —
 * `contributions` records how many segments rolled in, so a consumer can
 * note "+N more sessions" without needing to show every underlying reason.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { clipSegment } from "./windowedTotals";
import type { FocusReport, FocusReportSegment, FocusSegmentKind } from "./types";

/** One grouped row of activity — a plan item, a detour/bug/feature (by
 *  title), or unclassified time — summed across every session/segment that
 *  landed on the same key within the given report. */
export interface FocusActivityEntry {
  /** `${cwd}:item:${item_number}` | `${cwd}:${kind}:${label}` | `${cwd}:none` */
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
  /** From the dominant (largest `wall_ms`) contributing segment. */
  inferred: boolean;
  /** The dominant contributing segment's `inferred_reason`, or `null` when
   *  it wasn't inferred (a live declaration has no separate reason distinct
   *  from its label — see FocusPage's known-gap note) or carried none. */
  reason: string | null;
  /** How many segments (across one or more sessions) rolled into this row. */
  contributions: number;
}

function keyFor(cwd: string, seg: FocusReportSegment): string {
  if (seg.kind === "item") return `${cwd}:item:${seg.item_number}`;
  if (seg.kind === "none") return `${cwd}:none`;
  return `${cwd}:${seg.kind}:${seg.label ?? ""}`;
}

/**
 * Groups every segment across `report.sessions` into one {@link FocusActivityEntry}
 * per distinct plan item / detour-bug-feature title / unclassified bucket
 * (scoped per-cwd, so the same item number in two different projects never
 * merges), summing wall/active/idle time. Returned sorted by `wallMs`
 * descending — the same ordering used throughout this project's manual
 * focus-time breakdowns.
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

  for (const session of report.sessions) {
    const cwd = session.cwd ?? "";
    for (const seg of session.segments) {
      const clipped = window ? clipSegment(seg, window.startMs, window.endMs) : null;
      if (window && !clipped) continue; // doesn't overlap the window at all
      const wallMs = clipped ? clipped.wall_ms : seg.wall_ms;
      const activeMs = clipped ? clipped.active_ms : seg.active_ms;
      const idleMs = clipped ? clipped.idle_ms : seg.idle_ms;

      const key = keyFor(cwd, seg);
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
          inferred: seg.inferred,
          reason: seg.inferred_reason,
          contributions: 0,
        };
        byKey.set(key, entry);
        dominantWallMs.set(key, 0);
      }
      entry.wallMs += wallMs;
      entry.activeMs += activeMs;
      entry.idleMs += idleMs;
      entry.contributions += 1;

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

  return Array.from(byKey.values()).sort((a, b) => b.wallMs - a.wallMs);
}
