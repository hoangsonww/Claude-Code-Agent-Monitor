/**
 * @file calendarLanes.ts
 * @description Lane assignment for a swimlane/calendar-day timeline
 * (FocusCalendarView): given a flat list of time-boxed items, decides which
 * side-by-side column ("lane") each one renders in so that overlapping
 * items never share a lane — the same problem a day-view calendar (Google
 * Calendar, Outlook) solves when two meetings overlap.
 *
 * Uses greedy earliest-available-lane interval scheduling: sort by start
 * time, place each item in the first lane whose last-placed item already
 * ended (`<=` the new item's start — touching, not just non-overlapping,
 * counts as free, matching `mergeIntervals()` in server/lib/focus-report.js
 * treating touching spans as contiguous). This is the classical "minimum
 * platforms" algorithm and is provably optimal for interval graphs: the
 * lane count it produces always equals the maximum number of items
 * overlapping at any single instant, which is the theoretical minimum.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Anything with a real time span, in epoch milliseconds. */
export interface LaneAssignable {
  startMs: number;
  endMs: number;
}

/** One input item annotated with its assigned lane (0-indexed). */
export type LaneAssigned<T extends LaneAssignable> = T & { lane: number };

/** Result of {@link assignLanes}. */
export interface LaneAssignment<T extends LaneAssignable> {
  /** Same items, same order as the input array — every item keeps its
   *  original index, just with a `lane` field added, so callers can zip
   *  the result back against parallel data (e.g. render props) by index. */
  items: LaneAssigned<T>[];
  /** How many side-by-side lanes the busiest instant in this list needs.
   *  `0` for an empty input. */
  laneCount: number;
}

/**
 * Assigns each item a lane such that no two items sharing a lane overlap in
 * time. Does not validate input — a malformed span (`endMs <= startMs`) is
 * assumed not to occur for real segment data (unlike `mergeIntervals`,
 * which unions many independent session spans and needs to be defensive,
 * this consumes already-validated focus-report segments).
 */
export function assignLanes<T extends LaneAssignable>(items: T[]): LaneAssignment<T> {
  if (items.length === 0) return { items: [], laneCount: 0 };

  // Pair each item with its original position, then sort THAT (not the
  // items array itself) by start time - the returned array stays in the
  // caller's original order. Array.sort is a stable sort in every engine
  // this app targets, so equal-start items keep their relative input order.
  const withIndex = items.map((item, index) => ({ item, index }));
  const byStart = [...withIndex].sort((a, b) => a.item.startMs - b.item.startMs);

  const laneOf = new Array<number>(items.length).fill(0);
  const laneEndTimes: number[] = [];

  for (const { item, index } of byStart) {
    let placed = -1;
    for (let l = 0; l < laneEndTimes.length; l++) {
      const endTime = laneEndTimes[l];
      if (endTime !== undefined && endTime <= item.startMs) {
        placed = l;
        break;
      }
    }
    if (placed === -1) {
      placed = laneEndTimes.length;
      laneEndTimes.push(item.endMs);
    } else {
      laneEndTimes[placed] = item.endMs;
    }
    laneOf[index] = placed;
  }

  return {
    items: items.map((item, index) => ({ ...item, lane: laneOf[index] ?? 0 })),
    laneCount: laneEndTimes.length,
  };
}
