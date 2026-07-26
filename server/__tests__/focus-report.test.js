/**
 * Tests for server/lib/focus-report.js — segment reconstruction from a
 * session's Focus event history (set/push/pop/done, nested detours, ignored
 * no-ops), the idle-grace-window activity discount, and the project-scoped
 * per-item rollup + totals aggregation.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-report-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  buildFocusSegments,
  buildSessionFocusReport,
  buildProjectFocusReport,
} = require("../lib/focus-report");

const CWD = "/tmp/focus-report-test-project";
const CWD2 = "/tmp/focus-report-test-project-2";
let seq = 0;

after(() => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${TEST_DB}${suffix}`, { force: true });
    } catch {
      /* best effort */
    }
  }
});

before(() => {
  stmts.upsertPlan.run(CWD, "Test plan", `${CWD}/AGENT-PLAN.md`, "hash", 2);
  stmts.upsertPlanItem.run(CWD, "item-1", 1, null, "First item", null, null, 0, 0);
  stmts.upsertPlanItem.run(CWD, "item-4", 4, null, "Migrate auth", "SSO works", null, 0, 1);
  stmts.upsertPlan.run(CWD2, "Other plan", `${CWD2}/AGENT-PLAN.md`, "hash2", 1);
  stmts.upsertPlanItem.run(CWD2, "item-1", 1, null, "Other item", null, null, 0, 0);
});

const insertFocusEventRaw = db.prepare(
  "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, NULL, 'Focus', NULL, ?, ?, ?)"
);
const insertPlainEventRaw = db.prepare(
  "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, NULL, ?, NULL, NULL, NULL, ?)"
);

/** ISO timestamp `minutes` after a fixed epoch, distinct per call site by
 *  the caller passing increasing minute offsets - keeps segment boundaries
 *  exact and independent of real wall-clock time. */
function t(minutesFromStart) {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + minutesFromStart * 60_000).toISOString();
}

function seedSession(id, cwd) {
  stmts.insertSession.run(id, "Report Test", "active", cwd, null, null);
}

function focus(sessionId, minute, summary, data) {
  insertFocusEventRaw.run(sessionId, summary, JSON.stringify(data), t(minute));
}

function activity(sessionId, minute) {
  insertPlainEventRaw.run(sessionId, "PostToolUse", t(minute));
}

function nextId(prefix) {
  seq += 1;
  return `${prefix}-${seq}`;
}

describe("buildFocusSegments", () => {
  it("returns one open segment from set to endAt when nothing else happens", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "Focus set: item 4", {
      verb: "set",
      item_number: 4,
      item_text_snapshot: "Migrate auth",
    });

    const segments = buildFocusSegments(dbModule, id, t(30));
    assert.equal(segments.length, 1);
    assert.deepEqual(segments[0], {
      kind: "item",
      item_number: 4,
      label: "Migrate auth",
      start: t(0),
      end: t(30),
    });
  });

  it("splits into item -> detour -> item across a push/pop, attributing the detour to the item that was current", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 10, "push", {
      verb: "bug",
      kind: "bug",
      title: "npm conflict",
      description: "npm conflict full",
    });
    focus(id, 25, "pop", { verb: "pop", description: "npm conflict full" });

    const segments = buildFocusSegments(dbModule, id, t(60));
    assert.equal(segments.length, 3);
    assert.equal(segments[0].kind, "item");
    assert.equal(segments[0].start, t(0));
    assert.equal(segments[0].end, t(10));

    assert.equal(segments[1].kind, "bug");
    assert.equal(segments[1].item_number, 4); // rolled up under the item that was current
    assert.equal(segments[1].label, "npm conflict");
    assert.equal(segments[1].start, t(10));
    assert.equal(segments[1].end, t(25));

    assert.equal(segments[2].kind, "item");
    assert.equal(segments[2].start, t(25));
    assert.equal(segments[2].end, t(60));
  });

  it("resumes the outer detour's kind after a nested detour pops", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    focus(id, 5, "push", { verb: "push", description: "plain detour" });
    focus(id, 8, "push", {
      verb: "feature",
      kind: "feature",
      title: "small feature",
      description: "...",
    });
    focus(id, 12, "pop", { verb: "pop", description: "..." });
    focus(id, 20, "pop", { verb: "pop", description: "plain detour" });

    const segments = buildFocusSegments(dbModule, id, t(30));
    assert.deepEqual(
      segments.map((s) => s.kind),
      ["item", "detour", "feature", "detour", "item"]
    );
    assert.equal(segments[2].start, t(8));
    assert.equal(segments[2].end, t(12));
    assert.equal(segments[3].start, t(12));
    assert.equal(segments[3].end, t(20));
  });

  it("closes the segment (no further segment) when done clears the current item", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 15, "done", { verb: "done", item_number: 4, item_text_snapshot: "Migrate auth" });

    const segments = buildFocusSegments(dbModule, id, t(30));
    assert.equal(segments.length, 1);
    assert.equal(segments[0].end, t(15)); // nothing recorded for the post-done gap
  });

  it("does not treat done on a DIFFERENT item as clearing the current pointer", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 10, "done", { verb: "done", item_number: 1, item_text_snapshot: "First item" });

    const segments = buildFocusSegments(dbModule, id, t(20));
    // `done 1` while on item 4 doesn't clear anything -> still one continuous
    // item-4 segment (matches applyFocusCommand's own existing.item_number
    // === parsed.itemNumber guard).
    assert.equal(segments.length, 1);
    assert.equal(segments[0].item_number, 4);
    assert.equal(segments[0].end, t(20));
  });

  it("ignores stack-full / empty-stack no-op events without creating a spurious transition", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 5, "pop ignored", { verb: "pop", ignored: "empty_stack" });

    const segments = buildFocusSegments(dbModule, id, t(20));
    assert.equal(segments.length, 1);
    assert.equal(segments[0].start, t(0));
    assert.equal(segments[0].end, t(20));
  });

  it("returns no segments for a session that never declared focus", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    assert.deepEqual(buildFocusSegments(dbModule, id, t(10)), []);
  });
});

describe("buildSessionFocusReport - idle grace window", () => {
  let originalGrace;
  beforeEach(() => {
    originalGrace = process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS;
  });
  after(() => {
    if (originalGrace === undefined) delete process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS;
    else process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = originalGrace;
  });

  it("counts a gap under the grace window as fully active, with no activity needed inside it", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = String(10 * 60); // 10 min
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // No activity events at all - the whole 8-minute segment is one gap,
    // which is still under the 10-minute grace window.

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(8),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.wall_ms, 8 * 60_000);
    assert.equal(seg.active_ms, 8 * 60_000);
    assert.equal(seg.idle_ms, 0);
  });

  it("keeps a long span fully active when frequent events (e.g. a still-working subagent) keep every individual gap under grace", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = String(10 * 60); // 10 min
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // Events every 5 minutes for an hour - no single gap exceeds the 10-min
    // grace, so this is fully active even though the span is far longer
    // than the grace window itself.
    for (let m = 5; m < 60; m += 5) activity(id, m);

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(60),
    });
    const seg = report.segments[0];
    assert.equal(seg.wall_ms, 60 * 60_000);
    assert.equal(seg.active_ms, 60 * 60_000);
    assert.equal(seg.idle_ms, 0);
  });

  it("discounts only the portion of a gap beyond the grace window", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = String(5 * 60); // 5 min
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // Nothing happens for two hours after minute 0, then the segment closes
    // via a "done" at minute 120.
    focus(id, 120, "done", { verb: "done", item_number: 4, item_text_snapshot: "Migrate auth" });

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(120),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.wall_ms, 120 * 60_000);
    assert.equal(seg.active_ms, 5 * 60_000); // grace-window credit only
    assert.equal(seg.idle_ms, 115 * 60_000);
  });

  it("<= 0 disables discounting entirely - full wall-clock counts as active", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 120, "done", { verb: "done", item_number: 4, item_text_snapshot: "Migrate auth" });

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(120),
    });
    const seg = report.segments[0];
    assert.equal(seg.active_ms, 120 * 60_000);
    assert.equal(seg.idle_ms, 0);
  });
});

describe("buildProjectFocusReport", () => {
  it("rolls detours up per (cwd, item_number), sums project totals, and attaches current plan text", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"; // isolate rollup math from idle discounting
    const idA = nextId("sess");
    const idB = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idB, CWD2);

    // Session A: item 4 (30m), bug detour under item 4 (10m).
    focus(idA, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "stale text" });
    focus(idA, 30, "push", { verb: "bug", kind: "bug", title: "bug", description: "bug" });
    focus(idA, 40, "pop", { verb: "pop", description: "bug" });

    // Session B: a different project's item 1 (15m) - must not merge with
    // session A's item 4 just because both happen to number their items.
    focus(idB, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "Other item" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(40) }, // ends right at the pop - no trailing item segment
      { id: idB, name: "B", cwd: CWD2, ended_at: t(15) },
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    assert.equal(report.sessions.length, 2);
    assert.equal(report.items.length, 2);

    const item4 = report.items.find((i) => i.cwd === CWD && i.item_number === 4);
    assert.ok(item4, "expected item 4 in the rollup");
    assert.equal(item4.text, "Migrate auth"); // current plan text, not the stale snapshot
    assert.equal(item4.totals.by_kind.item.wall_ms, 30 * 60_000);
    assert.equal(item4.totals.by_kind.bug.wall_ms, 10 * 60_000);
    assert.equal(item4.totals.wall_ms, 40 * 60_000);

    const otherItem = report.items.find((i) => i.cwd === CWD2 && i.item_number === 1);
    assert.ok(otherItem);
    assert.equal(otherItem.totals.wall_ms, 15 * 60_000);

    assert.equal(report.totals.wall_ms, 55 * 60_000);
    assert.equal(report.totals.by_kind.item.wall_ms, 45 * 60_000);
    assert.equal(report.totals.by_kind.bug.wall_ms, 10 * 60_000);
  });

  it("sorts items by active time descending and skips sessions with no focus history", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const idA = nextId("sess");
    const idNoFocus = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idNoFocus, CWD);

    focus(idA, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    focus(idA, 5, "done", { verb: "done", item_number: 1, item_text_snapshot: "First item" });
    focus(idA, 5, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(65) },
      { id: idNoFocus, name: "No focus", cwd: CWD, ended_at: t(10) },
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    assert.equal(report.sessions.length, 1); // the no-focus session contributes nothing
    assert.equal(report.items[0].item_number, 4); // 60 min, sorts before item 1's 5 min
    assert.equal(report.items[1].item_number, 1);
  });
});
