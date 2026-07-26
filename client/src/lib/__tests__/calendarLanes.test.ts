/**
 * @file calendarLanes.test.ts
 * @description Unit tests for assignLanes() — the greedy earliest-available-
 * lane interval scheduler behind FocusCalendarView's swimlane rendering.
 * Covers no-overlap, full-overlap, the classic "chain" case (A-B overlap,
 * B-C overlap, A-C don't — optimal is 2 lanes, not 3), touching spans
 * counting as free (not overlapping), and index-order preservation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { assignLanes } from "../calendarLanes";

function span(startMs: number, endMs: number) {
  return { startMs, endMs };
}

describe("assignLanes", () => {
  it("returns an empty assignment for no items", () => {
    expect(assignLanes([])).toEqual({ items: [], laneCount: 0 });
  });

  it("puts non-overlapping items all in lane 0", () => {
    const { items, laneCount } = assignLanes([span(0, 10), span(10, 20), span(30, 40)]);
    expect(items.map((i) => i.lane)).toEqual([0, 0, 0]);
    expect(laneCount).toBe(1);
  });

  it("puts fully overlapping items in separate lanes", () => {
    const { items, laneCount } = assignLanes([span(0, 30), span(0, 30), span(0, 30)]);
    expect(items.map((i) => i.lane).sort()).toEqual([0, 1, 2]);
    expect(laneCount).toBe(3);
  });

  it("treats a touching boundary (end === next start) as free, not overlapping", () => {
    const { items, laneCount } = assignLanes([span(0, 10), span(10, 20)]);
    expect(items.map((i) => i.lane)).toEqual([0, 0]);
    expect(laneCount).toBe(1);
  });

  it("uses the theoretical minimum lanes for a chain (A-B overlap, B-C overlap, A-C don't)", () => {
    // A(0-10) overlaps B(5-15); B overlaps C(12-20); A and C don't overlap.
    // Max simultaneous overlap at any instant is 2 -> optimal is 2 lanes,
    // with C free to reuse A's lane once it ends.
    const a = span(0, 10);
    const b = span(5, 15);
    const c = span(12, 20);
    const { items, laneCount } = assignLanes([a, b, c]);
    expect(laneCount).toBe(2);
    const [itemA, itemB, itemC] = items;
    expect(itemA!.lane).toBe(itemC!.lane); // C reuses A's now-free lane
    expect(itemB!.lane).not.toBe(itemA!.lane); // B needed its own lane
  });

  it("keeps output in the original array order and index alignment, not sorted order", () => {
    // Deliberately out-of-time-order input.
    const late = span(50, 60);
    const early = span(0, 10);
    const { items } = assignLanes([late, early]);
    const [first, second] = items;
    // `first` must still be `late`'s assignment, `second` `early`'s -
    // sorting internally must not reorder the returned array.
    expect(first!.startMs).toBe(50);
    expect(second!.startMs).toBe(0);
    // Neither overlaps the other, so both land in lane 0 regardless of order.
    expect(first!.lane).toBe(0);
    expect(second!.lane).toBe(0);
  });

  it("preserves extra fields on each item alongside the assigned lane", () => {
    const { items } = assignLanes([{ ...span(0, 10), label: "Item 6", kind: "item" as const }]);
    expect(items[0]).toEqual({ startMs: 0, endMs: 10, label: "Item 6", kind: "item", lane: 0 });
  });

  it("breaks equal-start ties by keeping input order (stable sort)", () => {
    const x = span(0, 5);
    const y = span(0, 20);
    const { items } = assignLanes([x, y]);
    const [itemX, itemY] = items;
    // x sorts before y (equal start, stable), so x gets lane 0 first, then
    // y - which overlaps x - is pushed to lane 1.
    expect(itemX!.lane).toBe(0);
    expect(itemY!.lane).toBe(1);
  });
});
