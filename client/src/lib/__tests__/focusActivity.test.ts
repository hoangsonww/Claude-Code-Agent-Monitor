/**
 * @file focusActivity.test.ts
 * @description Unit tests for `groupFocusActivity()` — the per-key rollup
 * behind the Focus report page's activity card. Covers: a single segment
 * per key; multiple segments merging into one entry (reason/label taken from
 * the dominant, largest-`wall_ms` contributor); the same item number in two
 * different projects/cwds staying distinct; `"none"`-kind (unclassified)
 * grouping — reason-less per cwd, reason-bearing one row per session — and
 * the per-session `contributors` rollup (segments merged per session,
 * sorted largest-share-first, window-clipped);
 * chronological (most-recent-`lastEnd`-first) sort,
 * independent of total wall time; an empty report;
 * `projectLabel` resolution via the optional `projectLabelForCwd` callback;
 * and the optional `window` param's clipping (segment fully outside excluded,
 * partial overlap recomputed to its clipped share, dominance re-decided off
 * clipped wall time) — the hour-window zoom support `FocusPage.tsx` uses.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { groupFocusActivity } from "../focusActivity";
import type { FocusReport, FocusReportSegment, FocusReportSessionEntry } from "../types";

const BASE = Date.UTC(2026, 0, 1, 0, 0, 0);
const MIN = 60_000;
function iso(msFromBase: number): string {
  return new Date(BASE + msFromBase).toISOString();
}

function segment(
  kind: FocusReportSegment["kind"],
  startMin: number,
  endMin: number,
  opts: {
    itemNumber?: number | null;
    label?: string | null;
    inferred?: boolean;
    inferredReason?: string | null;
  } = {}
): FocusReportSegment {
  const wallMs = (endMin - startMin) * MIN;
  return {
    kind,
    item_number: opts.itemNumber ?? null,
    label: opts.label ?? null,
    start: iso(startMin * MIN),
    end: iso(endMin * MIN),
    wall_ms: wallMs,
    active_ms: wallMs,
    idle_ms: 0,
    inferred: opts.inferred ?? false,
    inferred_reason: opts.inferredReason ?? null,
  };
}

function session(
  id: string,
  cwd: string | null,
  segments: FocusReportSegment[]
): FocusReportSessionEntry {
  return { session_id: id, name: id, cwd, ended_at: null, segments };
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

describe("groupFocusActivity", () => {
  it("returns one entry per segment when nothing shares a key", () => {
    const r = report([
      session("s1", "/repo", [
        segment("item", 0, 60, { itemNumber: 8, label: "Quality Pass" }),
        segment("detour", 60, 90, { label: "Disk Space Monitoring" }),
      ]),
    ]);
    const entries = groupFocusActivity(r);
    expect(entries).toHaveLength(2);
    const item = entries.find((e) => e.kind === "item");
    expect(item).toMatchObject({
      key: "/repo:item:8",
      itemNumber: 8,
      label: "Quality Pass",
      wallMs: 60 * MIN,
      activeMs: 60 * MIN,
      contributions: 1,
      firstStart: iso(0),
      lastEnd: iso(60 * MIN),
    });
    const detour = entries.find((e) => e.kind === "detour");
    expect(detour).toMatchObject({
      key: "/repo:detour:Disk Space Monitoring",
      label: "Disk Space Monitoring",
      wallMs: 30 * MIN,
      contributions: 1,
      firstStart: iso(60 * MIN),
      lastEnd: iso(90 * MIN),
    });
  });

  it("merges multiple segments on the same key across sessions, summing time", () => {
    const r = report([
      session("s1", "/repo", [segment("item", 0, 60, { itemNumber: 8, label: "Quality Pass" })]),
      session("s2", "/repo", [segment("item", 0, 30, { itemNumber: 8, label: "Quality Pass" })]),
    ]);
    const [entry] = groupFocusActivity(r);
    expect(entry).toMatchObject({
      key: "/repo:item:8",
      wallMs: 90 * MIN,
      activeMs: 90 * MIN,
      contributions: 2,
    });
  });

  it("tracks the earliest start and latest end across every contributing segment, not just the dominant one", () => {
    const r = report([
      // The dominant (largest-wall_ms) contributor starts later than this
      // smaller, earlier one — firstStart/lastEnd should still span both.
      session("s1", "/repo", [segment("detour", 0, 10, { label: "Investigation" })]),
      session("s2", "/repo", [segment("detour", 20, 100, { label: "Investigation" })]),
    ]);
    const [entry] = groupFocusActivity(r);
    expect(entry).toMatchObject({
      firstStart: iso(0),
      lastEnd: iso(100 * MIN),
    });
  });

  it("picks label/inferred/reason from the dominant (largest wall_ms) contributor", () => {
    const r = report([
      session("s1", "/repo", [
        segment("detour", 0, 10, {
          label: "Small early guess",
          inferred: true,
          inferredReason: "weak signal",
        }),
      ]),
      session("s2", "/repo", [
        segment("detour", 0, 100, {
          label: "Small early guess", // same key, so it merges
          inferred: true,
          inferredReason: "strong signal — this is the real story",
        }),
      ]),
    ]);
    const [entry] = groupFocusActivity(r);
    expect(entry?.contributions).toBe(2);
    expect(entry?.reason).toBe("strong signal — this is the real story");
    expect(entry?.wallMs).toBe(110 * MIN);
  });

  it("keeps the same item number in two different cwds as distinct entries", () => {
    const r = report([
      session("s1", "/repo-a", [segment("item", 0, 60, { itemNumber: 1, label: "A" })]),
      session("s2", "/repo-b", [segment("item", 0, 60, { itemNumber: 1, label: "B" })]),
    ]);
    const entries = groupFocusActivity(r);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.key).sort()).toEqual(["/repo-a:item:1", "/repo-b:item:1"]);
  });

  it("groups reason-less 'none' (unclassified) segments per cwd, with no label", () => {
    const r = report([
      session("s1", "/repo", [segment("none", 0, 30)]),
      session("s2", "/repo", [segment("none", 0, 30)]),
    ]);
    const entries = groupFocusActivity(r);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: "/repo:none", kind: "none", wallMs: 60 * MIN });
  });

  it("keeps 'none' segments WITH an inferred reason as one row per session, never merged across sessions", () => {
    const r = report([
      session("s1", "/repo", [
        segment("none", 0, 60, { inferred: true, inferredReason: "built the intake docs" }),
      ]),
      session("s2", "/repo", [
        segment("none", 60, 120, { inferred: true, inferredReason: "found the IDOR vuln" }),
      ]),
      // Reason-less tail still collapses separately.
      session("s3", "/repo", [segment("none", 120, 125)]),
      session("s4", "/repo", [segment("none", 125, 130)]),
    ]);
    const entries = groupFocusActivity(r);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.key).sort()).toEqual([
      "/repo:none",
      "/repo:none:s1",
      "/repo:none:s2",
    ]);
    const s1Row = entries.find((e) => e.key === "/repo:none:s1");
    const s2Row = entries.find((e) => e.key === "/repo:none:s2");
    const tail = entries.find((e) => e.key === "/repo:none");
    expect(s1Row?.reason).toBe("built the intake docs");
    expect(s2Row?.reason).toBe("found the IDOR vuln");
    expect(tail).toMatchObject({ wallMs: 10 * MIN, contributions: 2, reason: null });
  });

  it("records per-session contributors (one per session, segments merged) sorted largest wall share first", () => {
    const r = report([
      // Two segments from the SAME session on the same item key merge into
      // one contribution; a second session adds another.
      session("s1", "/repo", [
        segment("item", 0, 30, { itemNumber: 8, label: "Quality Pass" }),
        segment("item", 40, 50, { itemNumber: 8, label: "Quality Pass" }),
      ]),
      session("s2", "/repo", [
        segment("item", 100, 200, {
          itemNumber: 8,
          label: "Quality Pass",
          inferred: true,
          inferredReason: "matched by classifier",
        }),
      ]),
    ]);
    const [entry] = groupFocusActivity(r);
    expect(entry?.contributions).toBe(2); // sessions, not segments
    expect(entry?.contributors).toHaveLength(2);
    // s2 (100min) outweighs s1 (40min total across its two segments).
    expect(entry?.contributors[0]).toMatchObject({
      sessionId: "s2",
      wallMs: 100 * MIN,
      inferred: true,
      reason: "matched by classifier",
      firstStart: iso(100 * MIN),
      lastEnd: iso(200 * MIN),
    });
    expect(entry?.contributors[1]).toMatchObject({
      sessionId: "s1",
      wallMs: 40 * MIN,
      firstStart: iso(0),
      lastEnd: iso(50 * MIN), // spans both of s1's segments
      reason: null,
    });
  });

  it("clips contributor time/ranges to the window like the entry itself", () => {
    const r = report([
      session("s1", "/repo", [segment("item", 0, 60, { itemNumber: 1, label: "Straddles" })]),
    ]);
    const entries = groupFocusActivity(r, undefined, {
      startMs: BASE + 30 * MIN,
      endMs: BASE + 90 * MIN,
    });
    expect(entries[0]?.contributors[0]).toMatchObject({
      sessionId: "s1",
      wallMs: 30 * MIN,
      firstStart: iso(30 * MIN),
      lastEnd: iso(60 * MIN),
    });
  });

  it("sorts entries chronologically (most-recent lastEnd first), not by total wallMs", () => {
    const r = report([
      session("s1", "/repo", [
        // Far more total time, but it ended earlier.
        segment("detour", 0, 100, { label: "big-but-earlier" }),
        // Far less total time, but it's the most recently active thing.
        segment("item", 150, 160, { itemNumber: 1, label: "small-but-later" }),
      ]),
    ]);
    const entries = groupFocusActivity(r);
    expect(entries.map((e) => e.label)).toEqual(["small-but-later", "big-but-earlier"]);
  });

  it("returns an empty array for a report with no sessions", () => {
    expect(groupFocusActivity(report([]))).toEqual([]);
  });

  it("resolves projectLabel via the optional callback, undefined when omitted", () => {
    const r = report([session("s1", "/repo", [segment("item", 0, 10, { itemNumber: 1 })])]);
    const withResolver = groupFocusActivity(r, (cwd) =>
      cwd === "/repo" ? "My Project" : undefined
    );
    expect(withResolver[0]?.projectLabel).toBe("My Project");

    const withoutResolver = groupFocusActivity(r);
    expect(withoutResolver[0]?.projectLabel).toBeUndefined();
  });

  describe("optional window clipping", () => {
    it("excludes a segment that doesn't overlap the window at all", () => {
      const r = report([
        session("s1", "/repo", [segment("item", 0, 60, { itemNumber: 1, label: "Early" })]),
      ]);
      const entries = groupFocusActivity(r, undefined, {
        startMs: BASE + 120 * MIN,
        endMs: BASE + 180 * MIN,
      });
      expect(entries).toEqual([]);
    });

    it("recomputes wall/active time to only the clipped share of a partially-overlapping segment", () => {
      const r = report([
        session("s1", "/repo", [segment("item", 0, 60, { itemNumber: 1, label: "Straddles" })]),
      ]);
      // Window is [30, 90) - only the second half (30 real minutes) of the
      // segment's [0, 60) span falls inside it.
      const entries = groupFocusActivity(r, undefined, {
        startMs: BASE + 30 * MIN,
        endMs: BASE + 90 * MIN,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        wallMs: 30 * MIN,
        activeMs: 30 * MIN,
        firstStart: iso(30 * MIN), // clipped to the window start, not the raw segment start (0)
        lastEnd: iso(60 * MIN),
      });
    });

    it("re-decides which contributing segment is dominant off its CLIPPED wall time, not raw wall_ms", () => {
      const r = report([
        // Same key as the segment below (same kind+label) so both merge into
        // ONE entry. Raw wall_ms 100min (the bigger of the two unwindowed),
        // but only [90,100) - 10 real minutes - falls inside the window.
        session("s1", "/repo", [
          segment("detour", 0, 100, {
            label: "Shared Detour",
            inferred: true,
            inferredReason: "mostly-outside contributor",
          }),
        ]),
        // Raw wall_ms 20min (smaller unwindowed), fully inside the window -
        // its full 20 real minutes all count, more than s1's clipped 10min.
        session("s2", "/repo", [
          segment("detour", 90, 110, {
            label: "Shared Detour",
            inferred: true,
            inferredReason: "fully-inside contributor",
          }),
        ]),
      ]);
      const windowed = groupFocusActivity(r, undefined, {
        startMs: BASE + 90 * MIN,
        endMs: BASE + 110 * MIN,
      });
      expect(windowed).toHaveLength(1); // same key -> merged into one entry
      expect(windowed[0]).toMatchObject({
        wallMs: 30 * MIN, // 10 (s1 clipped) + 20 (s2 clipped)
        contributions: 2,
        reason: "fully-inside contributor", // s2's clipped 20min > s1's clipped 10min
      });

      // Unwindowed, the SAME two segments pick the OTHER contributor as
      // dominant (raw wall_ms: s1's 100min > s2's 20min) - proving the
      // window genuinely changed the dominance decision, not just the total.
      const unwindowed = groupFocusActivity(r);
      expect(unwindowed[0]).toMatchObject({
        wallMs: 120 * MIN,
        reason: "mostly-outside contributor",
      });
    });

    it("behaves identically to omitting `window` when it isn't passed at all vs. explicitly undefined", () => {
      const r = report([
        session("s1", "/repo", [segment("item", 0, 60, { itemNumber: 1, label: "X" })]),
      ]);
      const omitted = groupFocusActivity(r, undefined);
      const explicit = groupFocusActivity(r, undefined, undefined);
      expect(omitted).toEqual(explicit);
      expect(omitted[0]).toMatchObject({ wallMs: 60 * MIN });
    });
  });
});
