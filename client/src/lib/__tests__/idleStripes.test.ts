/**
 * @file idleStripes.test.ts
 * @description Unit tests for `idleStripesInRange()` — the shared idle-chunk
 * geometry helper extracted from FocusCalendarView's `idleStripesForBlock`
 * (client/src/lib/idleStripes.ts), now also consumed by FocusReportModal's
 * List-view `SegmentedBar`. Covers the undefined/empty-chunks and
 * zero-length/inverted-range guards, the `{offsetPct, spanPct}` output shape
 * (guards against a silent field-name revert to the old `topPct`/`heightPct`
 * pair), clipping a partially-overlapping chunk to its visible portion,
 * dropping a fully-outside chunk, orientation-independence (the same
 * relative chunks at two different absolute epochs produce identical
 * fractions), and two fixtures ported byte-for-byte from
 * `FocusCalendarView.test.tsx`'s own idle-stripe tests (its 50/50 split and
 * its all-active/no-stripe cases) as a same-input/same-output pin that the
 * extraction didn't change the math.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { idleStripesInRange } from "../idleStripes";
import type { FocusReportChunk } from "../types";

// Base epoch used by most cases below - arbitrary, chosen only so the ISO
// strings are readable; the math itself doesn't care what epoch it is
// (see the "orientation-agnostic" case, which asserts exactly that).
const BASE = Date.UTC(2026, 0, 1, 9, 0, 0);
function iso(msFromBase: number): string {
  return new Date(BASE + msFromBase).toISOString();
}

const TEN_MIN = 10 * 60_000;
const TWENTY_MIN = 20 * 60_000;

describe("idleStripesInRange", () => {
  it("returns [] for undefined chunks", () => {
    expect(idleStripesInRange(undefined, BASE, BASE + TWENTY_MIN)).toEqual([]);
  });

  it("returns [] for an empty chunks array", () => {
    expect(idleStripesInRange([], BASE, BASE + TWENTY_MIN)).toEqual([]);
  });

  it("returns [] for a zero-length range", () => {
    const chunks: FocusReportChunk[] = [{ start: iso(0), end: iso(TEN_MIN), active: false }];
    expect(idleStripesInRange(chunks, BASE, BASE)).toEqual([]);
  });

  it("returns [] for an inverted range (start >= end)", () => {
    const chunks: FocusReportChunk[] = [{ start: iso(0), end: iso(TEN_MIN), active: false }];
    expect(idleStripesInRange(chunks, BASE + TWENTY_MIN, BASE)).toEqual([]);
  });

  it("returns one stripe per idle chunk in {offsetPct, spanPct} percent-of-range coordinates, skipping active chunks", () => {
    const chunks: FocusReportChunk[] = [
      { start: iso(0), end: iso(TEN_MIN), active: true },
      { start: iso(TEN_MIN), end: iso(TWENTY_MIN), active: false },
    ];
    const stripes = idleStripesInRange(chunks, BASE, BASE + TWENTY_MIN);
    expect(stripes).toHaveLength(1);
    // Exact key set - guards against a silent revert to the old
    // topPct/heightPct field names from FocusCalendarView's pre-extraction
    // local IdleStripe interface.
    expect(Object.keys(stripes[0]!).sort()).toEqual(["offsetPct", "spanPct"]);
    expect(stripes[0]!.offsetPct).toBeCloseTo(50);
    expect(stripes[0]!.spanPct).toBeCloseTo(50);
  });

  it("clips a chunk that only partially overlaps the range to the visible portion", () => {
    // Idle chunk spans -10min..0 (half before the range starts); the range
    // is [0, 10min). Only the second half of the chunk (0..10min, i.e. the
    // whole range) is visible, so it should render as if it started right
    // at the range's own start and spans the entire visible range.
    const chunks: FocusReportChunk[] = [
      { start: iso(-TEN_MIN), end: iso(TEN_MIN / 2), active: false },
    ];
    const stripes = idleStripesInRange(chunks, BASE, BASE + TEN_MIN);
    expect(stripes).toHaveLength(1);
    expect(stripes[0]!.offsetPct).toBeCloseTo(0);
    expect(stripes[0]!.spanPct).toBeCloseTo(50);
  });

  it("drops an idle chunk entirely outside the range", () => {
    const chunks: FocusReportChunk[] = [
      { start: iso(TWENTY_MIN), end: iso(TWENTY_MIN + TEN_MIN), active: false },
    ];
    expect(idleStripesInRange(chunks, BASE, BASE + TEN_MIN)).toEqual([]);
  });

  it("is orientation-agnostic - the same relative chunks at two different epochs produce identical fractions", () => {
    const chunksAt = (base: number): FocusReportChunk[] => [
      {
        start: new Date(base).toISOString(),
        end: new Date(base + TEN_MIN).toISOString(),
        active: true,
      },
      {
        start: new Date(base + TEN_MIN).toISOString(),
        end: new Date(base + TWENTY_MIN).toISOString(),
        active: false,
      },
    ];
    const stripesA = idleStripesInRange(chunksAt(BASE), BASE, BASE + TWENTY_MIN);
    const otherBase = Date.UTC(2031, 6, 15, 3, 30, 0); // a wholly different epoch
    const stripesB = idleStripesInRange(chunksAt(otherBase), otherBase, otherBase + TWENTY_MIN);
    expect(stripesB).toEqual(stripesA);
  });

  // The two cases below are ported byte-for-byte (same relative chunk
  // shapes, same expected output values) from
  // FocusCalendarView.test.tsx's "overlays an idle stripe only for the
  // chunk with no activity, none for the active one" and "renders no idle
  // stripe when every chunk in the segment is active" tests - this is what
  // actually proves the extraction is behavior-preserving, independent of
  // whether the component test happens to still pass for an unrelated
  // reason.
  it("[ported from FocusCalendarView.test.tsx] overlays an idle stripe only for the chunk with no activity, none for the active one", () => {
    const rangeStart = BASE; // todayAt(9, 0)
    const rangeEnd = BASE + TWENTY_MIN; // todayAt(9, 20)
    const chunks: FocusReportChunk[] = [
      { start: iso(0), end: iso(TEN_MIN), active: true }, // todayAt(9,0)-todayAt(9,10)
      { start: iso(TEN_MIN), end: iso(TWENTY_MIN), active: false }, // todayAt(9,10)-todayAt(9,20)
    ];
    const stripes = idleStripesInRange(chunks, rangeStart, rangeEnd);
    expect(stripes).toHaveLength(1);
    expect(stripes[0]!.offsetPct).toBeCloseTo(50);
    expect(stripes[0]!.spanPct).toBeCloseTo(50);
  });

  it("[ported from FocusCalendarView.test.tsx] renders no idle stripe when every chunk in the segment is active", () => {
    const rangeStart = BASE; // todayAt(9, 0)
    const rangeEnd = BASE + TEN_MIN; // todayAt(9, 10)
    const chunks: FocusReportChunk[] = [{ start: iso(0), end: iso(TEN_MIN), active: true }];
    expect(idleStripesInRange(chunks, rangeStart, rangeEnd)).toEqual([]);
  });
});
