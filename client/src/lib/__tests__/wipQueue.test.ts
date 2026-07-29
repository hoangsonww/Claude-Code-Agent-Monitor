/**
 * @file wipQueue.test.ts
 * @description Unit tests for the WIP queue's pure sort/column-fill module
 * (`client/src/lib/wipQueue.ts`) — not yet built as of this test's authoring;
 * see `supporting/red-evidence.md`. Covers `isWipMember` (membership is
 * `status === "active"` only; the awaiting flag never affects it),
 * `sortWipQueue` (awaiting-first ordering, the primary-awaiting-reason
 * carve-out derived from `AWAITING_REASON_CONFIG` rather than hand-typed,
 * the priority-ascending secondary key with a named "0 beats 1" example, the
 * unmapped-cwd-falls-back-to-0-not-Infinity guard, and the `last_activity`
 * descending tertiary key with a `started_at` fallback — corrected per
 * build-task-list.md Task 1/test-plan.md Implementation step 2, NOT the
 * technical-plan.md's original, incorrect `session.updated_at` citation), and
 * `assignToColumns`'s exact contiguous-chunk boundary table.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { isWipMember, sortWipQueue, assignToColumns } from "../wipQueue";
import { AWAITING_REASON_CONFIG } from "../types";
import type { AwaitingReason, Project, Session } from "../types";

// ── Fixture builders (modeled on SessionCard.test.tsx's makeSession) ────────

let sessionSeq = 0;
function makeSession(overrides: Partial<Session> = {}): Session {
  sessionSeq += 1;
  return {
    id: `sess-${sessionSeq}`,
    name: null,
    status: "active",
    cwd: "/repo/default",
    model: null,
    started_at: "2026-06-10T10:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

let projectSeq = 0;
function makeProject(cwd: string, priority: number): Project {
  projectSeq += 1;
  return {
    id: `proj-${projectSeq}`,
    name: `Project ${projectSeq}`,
    paths: [{ id: projectSeq, cwd }],
    session_count: 0,
    active_count: 0,
    last_activity: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    // `priority` is new as of this feature (build-task-list.md Task 9) —
    // not yet on the `Project` interface as of this test's authoring.
    priority,
  } as Project;
}

/** Builds the `Map<cwd, Project>` `sortWipQueue` expects, straight from a
 *  project list's own mapped paths — deliberately NOT importing
 *  `projectLookup.ts` here, so this file's RED/GREEN status depends only on
 *  `wipQueue.ts` existing, per the test-plan's fixture note ("local
 *  makeSession/makeProject builders", not a cross-module dependency). */
function indexOf(projects: Project[]): Map<string, Project> {
  const map = new Map<string, Project>();
  for (const p of projects) for (const path of p.paths) map.set(path.cwd, p);
  return map;
}

// ───────────────────────────── isWipMember ─────────────────────────────────

describe("isWipMember", () => {
  it("an active session is a member", () => {
    expect(isWipMember(makeSession({ status: "active" }))).toBe(true);
  });

  for (const status of ["completed", "error", "abandoned"] as const) {
    it(`a "${status}" session is NOT a member`, () => {
      expect(isWipMember(makeSession({ status }))).toBe(false);
    });
  }

  it("the awaiting flag does not affect membership — an awaiting active session is still a member", () => {
    const session = makeSession({
      status: "active",
      awaiting_input_since: "2026-06-10T10:05:00.000Z",
      awaiting_reason: "stop",
    } as Partial<Session>);
    expect(isWipMember(session)).toBe(true);
  });

  it("the awaiting flag does not affect membership — a stale awaiting flag on a non-active session still excludes it", () => {
    const session = makeSession({
      status: "completed",
      awaiting_input_since: "2026-06-10T10:05:00.000Z",
      awaiting_reason: "stop",
    } as Partial<Session>);
    expect(isWipMember(session)).toBe(false);
  });
});

// ───────────────────────────── sortWipQueue ────────────────────────────────

describe("sortWipQueue — awaiting-first ordering", () => {
  it("an awaiting session always sorts above a non-awaiting session, even with a much worse project priority", () => {
    const worseProject = makeProject("/repo/worse", 9);
    const betterProject = makeProject("/repo/better", 0);
    const awaiting = makeSession({
      id: "awaiting-1",
      cwd: "/repo/worse",
      awaiting_input_since: "2026-06-10T10:05:00.000Z",
      awaiting_reason: "stop",
    } as Partial<Session>);
    const plain = makeSession({ id: "plain-1", cwd: "/repo/better" });
    const idx = indexOf([worseProject, betterProject]);

    const sorted = sortWipQueue([plain, awaiting], idx);
    expect(sorted.map((s) => s.id)).toEqual(["awaiting-1", "plain-1"]);
  });
});

const ALL_REASONS = Object.keys(AWAITING_REASON_CONFIG) as AwaitingReason[];
const PRIMARY_REASONS = ALL_REASONS.filter((r) => AWAITING_REASON_CONFIG[r].primary === true);
const NON_PRIMARY_REASONS = ALL_REASONS.filter((r) => AWAITING_REASON_CONFIG[r].primary !== true);

describe("sortWipQueue — primary-awaiting-reason carve-out (derived from AWAITING_REASON_CONFIG, not hand-typed)", () => {
  // Sanity on the fixture derivation itself — if this ever fails, the two
  // lists below stopped covering AWAITING_REASON_CONFIG's real keys.
  it("the derived reason lists partition every AWAITING_REASON_CONFIG key exactly once", () => {
    expect(PRIMARY_REASONS.length + NON_PRIMARY_REASONS.length).toBe(ALL_REASONS.length);
    expect(PRIMARY_REASONS.length).toBeGreaterThan(0);
    expect(NON_PRIMARY_REASONS.length).toBeGreaterThan(0);
  });

  for (const reason of NON_PRIMARY_REASONS) {
    it(`keeps a "${reason}" awaiting session in the awaiting bucket — it outranks a better-priority plain active session`, () => {
      const goodProject = makeProject("/repo/good", 0);
      const badProject = makeProject("/repo/bad", 9);
      const plain = makeSession({ id: "plain", cwd: "/repo/good" });
      const waiting = makeSession({
        id: "waiting",
        cwd: "/repo/bad",
        awaiting_input_since: "2026-06-10T10:05:00.000Z",
        awaiting_reason: reason,
      } as Partial<Session>);
      const idx = indexOf([goodProject, badProject]);

      const sorted = sortWipQueue([plain, waiting], idx);
      expect(sorted.map((s) => s.id)).toEqual(["waiting", "plain"]);
    });
  }

  for (const reason of PRIMARY_REASONS) {
    it(`excludes a "${reason}" primary-reason session from the awaiting bucket — it sorts by priority alongside plain actives, not bumped to the front`, () => {
      const goodProject = makeProject("/repo/good", 0);
      const badProject = makeProject("/repo/bad", 9);
      const plain = makeSession({ id: "plain", cwd: "/repo/good" });
      const primary = makeSession({
        id: "primary",
        cwd: "/repo/bad",
        awaiting_input_since: "2026-06-10T10:05:00.000Z",
        awaiting_reason: reason,
      } as Partial<Session>);
      const idx = indexOf([goodProject, badProject]);

      const sorted = sortWipQueue([primary, plain], idx);
      expect(sorted.map((s) => s.id)).toEqual(["plain", "primary"]);
    });
  }
});

describe("sortWipQueue — secondary key: project priority ascending (lower = higher priority)", () => {
  it('named example: "project priority 0 must rank above project priority 1"', () => {
    const p0 = makeProject("/repo/p0", 0);
    const p1 = makeProject("/repo/p1", 1);
    const s0 = makeSession({ id: "s0", cwd: "/repo/p0" });
    const s1 = makeSession({ id: "s1", cwd: "/repo/p1" });
    const idx = indexOf([p0, p1]);

    // Fed in reverse array order, so a correct comparator (not incoming
    // array order) has to do the actual work.
    expect(sortWipQueue([s1, s0], idx).map((s) => s.id)).toEqual(["s0", "s1"]);
  });

  it("an unmapped cwd falls back to priority 0, not Infinity — it does not sink to the bottom", () => {
    const mappedWorse = makeProject("/repo/mapped", 1);
    const unmapped = makeSession({ id: "unmapped", cwd: "/repo/nowhere" });
    const mapped = makeSession({ id: "mapped", cwd: "/repo/mapped" });
    const idx = indexOf([mappedWorse]);

    // A naive `?? Infinity` fallback would sink `unmapped` to the very end
    // regardless of the mapped project's own (worse) priority value; the
    // correct `?? 0` fallback instead ranks it ahead of a priority-1 project.
    expect(sortWipQueue([mapped, unmapped], idx).map((s) => s.id)).toEqual(["unmapped", "mapped"]);
  });
});

describe("sortWipQueue — tertiary key: last_activity descending, fallback started_at (corrected field, per Task 1 — NOT updated_at)", () => {
  it("breaks a same-priority tie among awaiting sessions by more-recent last_activity first", () => {
    const proj = makeProject("/repo/same", 0);
    const older = makeSession({
      id: "older",
      cwd: "/repo/same",
      awaiting_input_since: "2026-06-10T10:05:00.000Z",
      awaiting_reason: "stop",
      last_activity: "2026-06-10T09:30:00.000Z",
    } as Partial<Session>);
    const newer = makeSession({
      id: "newer",
      cwd: "/repo/same",
      awaiting_input_since: "2026-06-10T10:05:00.000Z",
      awaiting_reason: "stop",
      last_activity: "2026-06-10T11:00:00.000Z",
    } as Partial<Session>);
    const idx = indexOf([proj]);

    expect(sortWipQueue([older, newer], idx).map((s) => s.id)).toEqual(["newer", "older"]);
  });

  it("uses the same recency tertiary key among non-awaiting sessions too, not just awaiting ties", () => {
    const proj = makeProject("/repo/same", 0);
    const older = makeSession({
      id: "older-plain",
      cwd: "/repo/same",
      last_activity: "2026-06-10T09:00:00.000Z",
    } as Partial<Session>);
    const newer = makeSession({
      id: "newer-plain",
      cwd: "/repo/same",
      last_activity: "2026-06-10T12:00:00.000Z",
    } as Partial<Session>);
    const idx = indexOf([proj]);

    expect(sortWipQueue([older, newer], idx).map((s) => s.id)).toEqual([
      "newer-plain",
      "older-plain",
    ]);
  });

  it("falls back to started_at when last_activity is absent on both sides", () => {
    const proj = makeProject("/repo/same", 0);
    const olderStart = makeSession({
      id: "older-start",
      cwd: "/repo/same",
      started_at: "2026-06-10T09:00:00.000Z",
    });
    const newerStart = makeSession({
      id: "newer-start",
      cwd: "/repo/same",
      started_at: "2026-06-10T10:00:00.000Z",
    });
    const idx = indexOf([proj]);

    expect(sortWipQueue([olderStart, newerStart], idx).map((s) => s.id)).toEqual([
      "newer-start",
      "older-start",
    ]);
  });
});

describe("sortWipQueue — membership integration", () => {
  it("sortWipQueue(sessions.filter(isWipMember), idx) never surfaces a non-active session", () => {
    const proj = makeProject("/repo/mix", 0);
    const idx = indexOf([proj]);
    const active = makeSession({ id: "active-1", cwd: "/repo/mix" });
    const completed = makeSession({ id: "completed-1", cwd: "/repo/mix", status: "completed" });
    const errored = makeSession({ id: "error-1", cwd: "/repo/mix", status: "error" });
    const abandoned = makeSession({ id: "abandoned-1", cwd: "/repo/mix", status: "abandoned" });

    const result = sortWipQueue([active, completed, errored, abandoned].filter(isWipMember), idx);
    expect(result.map((s) => s.id)).toEqual(["active-1"]);
  });
});

// ─────────────────────────── assignToColumns ───────────────────────────────

describe("assignToColumns — exact contiguous-chunk boundary table", () => {
  function items(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  function expectedColumns(n: number, columnCount: number): number[][] {
    const all = items(n);
    const chunk = n === 0 ? 0 : Math.ceil(n / columnCount);
    const cols: number[][] = [];
    for (let i = 0; i < columnCount; i++) cols.push(all.slice(i * chunk, (i + 1) * chunk));
    return cols;
  }

  const cases: Array<[number, 1 | 2 | 3]> = [
    [0, 3],
    [1, 1],
    [1, 3],
    [2, 3],
    [4, 1],
    [4, 2],
    [5, 2],
    [5, 3],
    [6, 3],
    [7, 3],
  ];

  for (const [n, columnCount] of cases) {
    it(`${n} item(s) into ${columnCount} column(s) fills contiguous top-to-bottom chunks`, () => {
      const result = assignToColumns(items(n), columnCount);
      expect(result).toEqual(expectedColumns(n, columnCount));
    });
  }

  it("column 1's first item is always the top-sorted item (rejects a plausible-but-wrong round-robin implementation)", () => {
    // Contiguous fill of 6 items into 3 columns: col 1 = [0,1], col 2 = [2,3],
    // col 3 = [4,5]. A round-robin dealer would instead produce
    // col 1 = [0,3], col 2 = [1,4], col 3 = [2,5] — same "first item" for
    // column 1 (0) but a different item for every other column's first slot,
    // which the assertions below catch.
    const result = assignToColumns(items(6), 3);
    expect(result[0]?.[0]).toBe(0);
    expect(result[1]?.[0]).toBe(2);
    expect(result[2]?.[0]).toBe(4);
  });
});
