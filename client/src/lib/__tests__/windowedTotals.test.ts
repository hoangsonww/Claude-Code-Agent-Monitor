/**
 * @file windowedTotals.test.ts
 * @description Unit tests for `computeWindowedTotals()` — the client-side
 * recompute that scopes a `FocusReport`'s aggregate stat-tile numbers to an
 * arbitrary sub-window, used by `FocusReportBody` so the stat tiles agree
 * with what `FocusCalendarView`'s hour-window zoom is actually showing
 * instead of always reflecting the full fetched report. Covers: a session
 * entirely outside the window contributes nothing; a session entirely inside
 * contributes its full active/idle split; a session straddling the window
 * boundary is clipped to only its overlapping chunks; two concurrent
 * sessions both fully inside the window sum their active time (effort) but
 * collapse to their overlapping span for wall-clock (matching the server's
 * own effort-vs-wall-clock distinction in server/lib/focus-report.js, just
 * computed here client-side from chunk data); and a `"none"`-kind segment
 * counts toward the aggregate totals but not any `by_kind` bucket.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { computeWindowedTotals } from "../windowedTotals";
import type {
  FocusReport,
  FocusReportChunk,
  FocusReportSegment,
  FocusReportSessionEntry,
} from "../types";

const BASE = Date.UTC(2026, 0, 1, 0, 0, 0);
const HOUR = 60 * 60_000;
function iso(msFromBase: number): string {
  return new Date(BASE + msFromBase).toISOString();
}

/** One 1-hour segment, split into two 30-minute chunks so half its span is
 *  active and half idle by default - callers override via `activeHalf`. */
function segment(
  kind: FocusReportSegment["kind"],
  startHour: number,
  endHour: number,
  opts: { itemNumber?: number | null; allActive?: boolean } = {}
): FocusReportSegment {
  const startMs = startHour * HOUR;
  const endMs = endHour * HOUR;
  const midMs = startMs + (endMs - startMs) / 2;
  const chunks: FocusReportChunk[] = opts.allActive
    ? [{ start: iso(startMs), end: iso(endMs), active: true }]
    : [
        { start: iso(startMs), end: iso(midMs), active: true },
        { start: iso(midMs), end: iso(endMs), active: false },
      ];
  const activeMs = chunks
    .filter((c) => c.active)
    .reduce((sum, c) => sum + (new Date(c.end).getTime() - new Date(c.start).getTime()), 0);
  const wallMs = endMs - startMs;
  return {
    kind,
    item_number: opts.itemNumber ?? null,
    label: null,
    start: iso(startMs),
    end: iso(endMs),
    wall_ms: wallMs,
    active_ms: activeMs,
    idle_ms: wallMs - activeMs,
    inferred: false,
    inferred_reason: null,
    chunks,
  };
}

function session(id: string, segments: FocusReportSegment[]): FocusReportSessionEntry {
  return { session_id: id, name: id, cwd: "/repo", ended_at: null, segments };
}

function report(sessions: FocusReportSessionEntry[]): FocusReport {
  return {
    project_id: null,
    sessions,
    items: [],
    totals: {
      wall_ms: 0,
      active_ms: 0,
      idle_ms: 0,
      by_kind: {} as FocusReport["totals"]["by_kind"],
    },
    idle_grace_seconds: 300,
    wall_clock_ms: 0,
    concurrency_ratio: null,
  };
}

describe("computeWindowedTotals", () => {
  it("returns empty totals and null concurrency for an empty session list", () => {
    const r = report([]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.wall_ms).toBe(0);
    expect(w.totals.active_ms).toBe(0);
    expect(w.wallClockMs).toBe(0);
    expect(w.concurrencyRatio).toBeNull();
  });

  it("excludes a session entirely outside the window", () => {
    const r = report([session("outside", [segment("item", -3, -1, { itemNumber: 1 })])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.wall_ms).toBe(0);
    expect(w.wallClockMs).toBe(0);
  });

  it("includes a session entirely inside the window with its full active/idle split", () => {
    const r = report([session("s1", [segment("item", 0, 1, { itemNumber: 1 })])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.wall_ms).toBe(HOUR);
    expect(w.totals.active_ms).toBe(HOUR / 2); // half-active chunk split
    expect(w.totals.idle_ms).toBe(HOUR / 2);
    expect(w.totals.by_kind.item.active_ms).toBe(HOUR / 2);
    expect(w.wallClockMs).toBe(HOUR);
    expect(w.concurrencyRatio).toBeCloseTo(0.5);
  });

  it("clips a segment straddling the window boundary to only its overlapping chunk time", () => {
    // Segment runs -2h..+2h (all-active), window is [0h, 4h) - only the
    // [0h, 2h) half of the segment falls inside the window.
    const seg = segment("item", -2, 2, { itemNumber: 1, allActive: true });
    const r = report([session("s1", [seg])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.wall_ms).toBe(2 * HOUR);
    expect(w.totals.active_ms).toBe(2 * HOUR);
    expect(w.wallClockMs).toBe(2 * HOUR);
  });

  it("sums active time (effort) across concurrent sessions but collapses wall-clock to their overlapping span", () => {
    const r = report([
      session("s1", [segment("item", 0, 4, { itemNumber: 1, allActive: true })]),
      session("s2", [segment("detour", 0, 4, { allActive: true })]),
    ]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.active_ms).toBe(2 * 4 * HOUR); // effort: both sessions' full 4h
    expect(w.wallClockMs).toBe(4 * HOUR); // wall-clock: fully overlapping, so just 4h
    expect(w.concurrencyRatio).toBeCloseTo(2);
  });

  it("counts a 'none'-kind segment toward aggregate totals but no by_kind bucket", () => {
    const r = report([session("s1", [segment("none", 0, 1, { allActive: true })])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.active_ms).toBe(HOUR);
    const byKindSum = Object.values(w.totals.by_kind).reduce((sum, k) => sum + k.active_ms, 0);
    expect(byKindSum).toBe(0);
  });

  it("excludes idle chunk time from activeWallClockMs so an open-but-idle stretch doesn't dilute the active concurrency ratio", () => {
    // One session: active [0h,0.5h), idle [0.5h,1h) - the walked-away shape.
    const r = report([session("s1", [segment("item", 0, 1, { itemNumber: 1 })])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.wallClockMs).toBe(HOUR); // span counts the idle tail
    expect(w.concurrencyRatio).toBeCloseTo(0.5); // diluted by it
    expect(w.activeWallClockMs).toBe(HOUR / 2); // active union does not
    expect(w.activeConcurrencyRatio).toBeCloseTo(1); // one session, working alone
  });

  it("unions concurrent sessions' active chunks: overlapping activity doubles activeConcurrencyRatio", () => {
    const r = report([
      session("s1", [segment("item", 0, 4, { itemNumber: 1, allActive: true })]),
      session("s2", [segment("detour", 0, 4, { allActive: true })]),
    ]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.activeWallClockMs).toBe(4 * HOUR); // same [0,4h) union
    expect(w.activeConcurrencyRatio).toBeCloseTo(2);
  });

  it("reports zero activeWallClockMs and a null activeConcurrencyRatio for an empty window", () => {
    const w = computeWindowedTotals(report([]), BASE, BASE + 4 * HOUR);
    expect(w.activeWallClockMs).toBe(0);
    expect(w.activeConcurrencyRatio).toBeNull();
  });

  it("falls back to treating the whole clipped span as active when a segment has no chunks", () => {
    const seg: FocusReportSegment = {
      kind: "item",
      item_number: 1,
      label: null,
      start: iso(0),
      end: iso(HOUR),
      wall_ms: HOUR,
      active_ms: HOUR,
      idle_ms: 0,
      inferred: false,
      inferred_reason: null,
      // chunks intentionally omitted
    };
    const r = report([session("s1", [seg])]);
    const w = computeWindowedTotals(r, BASE, BASE + 4 * HOUR);
    expect(w.totals.active_ms).toBe(HOUR);
    expect(w.totals.idle_ms).toBe(0);
  });
});
