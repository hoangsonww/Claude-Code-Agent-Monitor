/**
 * @file focusActivity.ts
 * @description Groups a `FocusReport`'s per-session segments into one row per
 * distinct thing that happened — a plan item, a detour/bug/feature (by
 * title), or unclassified ("none") activity — for the new Focus report page
 * (`FocusPage.tsx`) and its `FocusActivityCard`. Unlike `windowedTotals.ts`,
 * this does NOT clip segments to a sub-window: the report it's given is
 * already server-clipped to the caller's requested `from`/`to` (see
 * `GET /api/focus-report`'s file header), so this only needs to group and
 * sum, never re-derive a window.
 *
 * There is no existing server-side rollup for detour/bug/feature time by
 * title (only plan items get one, in `FocusReport.items`) — grouping those
 * across sessions by `(cwd, kind, label)` is the one genuinely new
 * aggregation this file adds.
 *
 * When more than one segment lands on the same key (e.g. two different
 * sessions both landed on the same plan item), the displayed `label`/
 * `inferred`/`reason` come from whichever contributing segment has the
 * largest `wall_ms` share — `contributions` records how many segments rolled
 * in, so a consumer can note "+N more sessions" without needing to show
 * every underlying reason.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
 */
export function groupFocusActivity(
  report: FocusReport,
  projectLabelForCwd?: (cwd: string | null) => string | undefined
): FocusActivityEntry[] {
  const byKey = new Map<string, FocusActivityEntry>();
  const dominantWallMs = new Map<string, number>();

  for (const session of report.sessions) {
    const cwd = session.cwd ?? "";
    for (const seg of session.segments) {
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
      entry.wallMs += seg.wall_ms;
      entry.activeMs += seg.active_ms;
      entry.idleMs += seg.idle_ms;
      entry.contributions += 1;

      const currentDominant = dominantWallMs.get(key) ?? 0;
      if (seg.wall_ms > currentDominant) {
        dominantWallMs.set(key, seg.wall_ms);
        entry.label = seg.label;
        entry.itemNumber = seg.item_number;
        entry.inferred = seg.inferred;
        entry.reason = seg.inferred_reason;
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.wallMs - a.wallMs);
}
