/**
 * Tests for server/lib/focus-report.js — segment reconstruction from a
 * session's Focus event history (set/push/pop/done, nested detours, ignored
 * no-ops), the idle-grace-window activity discount, and the project-scoped
 * per-item rollup + totals aggregation.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
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
  buildActivityChunks,
  clipSegmentToWindow,
  mergeIntervals,
  CHUNK_MS,
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
  // Captured ONCE (before(), not beforeEach()) - a couple of this
  // describe's own tests below mutate the env var and never reset it
  // between tests within the block, so a beforeEach() re-capture here
  // would pick up the PREVIOUS test's leftover value instead of this
  // describe's true pre-suite state, leaking a stale override (observed:
  // "0", from the "<= 0 disables discounting" case) into every describe
  // that runs later in this same file.
  let originalGrace;
  before(() => {
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

  it("carries ended_at through unchanged - null for a still-active session", () => {
    const idActive = nextId("sess");
    const idDone = nextId("sess");
    seedSession(idActive, CWD);
    seedSession(idDone, CWD);
    focus(idActive, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(idDone, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });

    const active = buildSessionFocusReport(dbModule, {
      id: idActive,
      name: "Still running",
      cwd: CWD,
      ended_at: null,
    });
    const done = buildSessionFocusReport(dbModule, {
      id: idDone,
      name: "Finished",
      cwd: CWD,
      ended_at: t(30),
    });

    assert.equal(active.ended_at, null);
    assert.equal(done.ended_at, t(30));
  });

  it("carries ended_at through even when the session has no segments at all", () => {
    const id = nextId("sess");
    seedSession(id, CWD); // never declares focus, never gets inferred -> zero segments
    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Blank",
      cwd: CWD,
      ended_at: null,
    });
    assert.deepEqual(report.segments, []);
    assert.equal(report.ended_at, null);
  });
});

describe("buildSessionFocusReport - out-of-order event insertion", () => {
  // A session with heavy subagent/Workflow-tool activity bulk-ingests many
  // events after the fact (workflow-ingest.js), landing them at whatever row
  // id was next regardless of their own created_at - `ORDER BY id ASC` is
  // NOT reliably chronological for such a session. activeIntervals()'s
  // gap-credit walk requires a chronologically sorted timestamp list; fed an unsorted
  // one, positive-looking "gaps" from scrambled ordering can each contribute
  // up to a full grace window, summing past the segment's real span
  // (observed live: active_ms > wall_ms, negative idle_ms).
  let originalGrace;
  before(() => {
    originalGrace = process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS;
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = String(5 * 60); // 5 min
  });
  after(() => {
    if (originalGrace === undefined) delete process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS;
    else process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = originalGrace;
  });

  it("never lets active_ms exceed wall_ms (or idle_ms go negative) when events land out of chronological order", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // Real timestamps are 2/4/6/8/12/14/16/18 minutes in - every consecutive
    // gap is <= 4 min, comfortably under the 5-min grace, so a CORRECTLY
    // sorted walk counts the whole 20-minute span as fully active. Inserted
    // here in a scrambled (non-chronological) row order to reproduce a
    // bulk-ingest landing them out of sequence.
    for (const minute of [18, 2, 16, 4, 14, 6, 12, 8]) activity(id, minute);

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(20),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.wall_ms, 20 * 60_000);
    // Exact values, not just an inequality - the unsorted bug produced
    // active_ms = 1_500_000 (5 spurious "forward" gaps x 5-min grace cap)
    // against a true wall_ms of 1_200_000; sorted, every real gap is fully
    // active and nothing is left over.
    assert.equal(seg.active_ms, 20 * 60_000);
    assert.equal(seg.idle_ms, 0);
  });
});

describe("buildActivityChunks", () => {
  it("returns no chunks for a malformed or zero-length span", () => {
    assert.deepEqual(buildActivityChunks([], 1000, 1000), []);
    assert.deepEqual(buildActivityChunks([], 2000, 1000), []);
  });

  it("flags a chunk active when a timestamp falls inside it, idle otherwise", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const chunkMs = 10 * 60_000;
    // One event 2 minutes into the first chunk; nothing in the second.
    const timestamps = [start + 2 * 60_000];
    const chunks = buildActivityChunks(timestamps, start, start + 2 * chunkMs, chunkMs);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].active, true);
    assert.equal(chunks[1].active, false);
    assert.equal(chunks[0].start, new Date(start).toISOString());
    assert.equal(chunks[0].end, new Date(start + chunkMs).toISOString());
  });

  it("shortens the last chunk to end exactly at endMs instead of overshooting", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const chunkMs = 10 * 60_000;
    const end = start + 15 * 60_000; // 1.5 chunks' worth
    const chunks = buildActivityChunks([], start, end, chunkMs);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[1].end, new Date(end).toISOString());
    assert.equal(
      new Date(chunks[1].end).getTime() - new Date(chunks[1].start).getTime(),
      5 * 60_000
    );
  });

  it("grants no grace credit - a chunk with zero events is idle even right after a burst", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const chunkMs = 10 * 60_000;
    // Event lands 1 second before the first chunk ends; the whole second
    // chunk that immediately follows has nothing in it and must read idle,
    // unlike active_ms/idle_ms's grace-window credit.
    const timestamps = [start + chunkMs - 1000];
    const chunks = buildActivityChunks(timestamps, start, start + 2 * chunkMs, chunkMs);
    assert.equal(chunks[0].active, true);
    assert.equal(chunks[1].active, false);
  });
});

describe("clipSegmentToWindow", () => {
  const seg = { kind: "item", start: t(10), end: t(40) };

  it("returns the same object unchanged when both bounds fully contain the segment", () => {
    const result = clipSegmentToWindow(seg, new Date(t(0)).getTime(), new Date(t(60)).getTime());
    assert.equal(result, seg); // reference equality - no clone when nothing narrows
  });

  it("returns the same object when both bounds are omitted", () => {
    const result = clipSegmentToWindow(seg, undefined, undefined);
    assert.equal(result, seg);
  });

  it("clips only the start when just windowStartMs narrows the segment", () => {
    const result = clipSegmentToWindow(seg, new Date(t(20)).getTime(), undefined);
    assert.equal(result.start, t(20));
    assert.equal(result.end, t(40));
  });

  it("clips only the end when just windowEndMs narrows the segment", () => {
    const result = clipSegmentToWindow(seg, undefined, new Date(t(30)).getTime());
    assert.equal(result.start, t(10));
    assert.equal(result.end, t(30));
  });

  it("clips both sides when the window is a strict subset", () => {
    const result = clipSegmentToWindow(seg, new Date(t(20)).getTime(), new Date(t(30)).getTime());
    assert.equal(result.start, t(20));
    assert.equal(result.end, t(30));
  });

  it("returns null when the window is entirely outside the segment", () => {
    assert.equal(
      clipSegmentToWindow(seg, new Date(t(50)).getTime(), new Date(t(60)).getTime()),
      null
    );
    assert.equal(
      clipSegmentToWindow(seg, new Date(t(0)).getTime(), new Date(t(5)).getTime()),
      null
    );
  });

  it("returns null when the window merely touches the segment's edge (zero-length overlap)", () => {
    assert.equal(
      clipSegmentToWindow(seg, new Date(t(40)).getTime(), new Date(t(50)).getTime()),
      null
    );
  });
});

describe("buildSessionFocusReport - activity chunks", () => {
  it("marks only the chunks with real activity as active on a long idle-tailed segment", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // A burst of activity in the first 10 minutes, then nothing for two
    // hours before the segment closes at ended_at - the same shape as an
    // inferred whole-session segment riding a long gap to ended_at.
    activity(id, 1);
    activity(id, 4);
    activity(id, 8);

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(130),
    });
    assert.equal(report.segments.length, 1);
    const { chunks } = report.segments[0];
    assert.equal(chunks.length, Math.ceil((130 * 60_000) / CHUNK_MS));
    assert.equal(chunks[0].active, true);
    assert.ok(
      chunks.slice(1).every((c) => c.active === false),
      "every chunk after the first burst should read idle"
    );
  });
});

// Coverage-only (no behavior change): inferredSegment() is the exact
// fallback path behind the round-3 data-fidelity bug and had zero dedicated
// tests before this block. Each case documents which of the two branches
// (declared vs. inferred) it exercises, so a future contributor adding
// another declared-only test doesn't believe the fallback path is covered
// by proxy. Every case is expected to pass immediately against unmodified
// `inferredSegment()` code - if any case fails on first run, that is a
// real, previously-hidden bug surfacing, not a test to adjust.
describe("inferredSegment / buildSessionFocusReport - inferred fallback", () => {
  it("resolves an item-kind inference to the plan item's CURRENT item_number/text via getPlanItemById", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    activity(id, 0);
    stmts.upsertFocusInference.run(
      id,
      CWD,
      "item",
      "item-4",
      null,
      0.9,
      "llm",
      "matched auth work"
    );

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(30),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.item_number, 4);
    assert.equal(seg.label, "Migrate auth");
    assert.equal(seg.inferred, true);
    assert.equal(seg.inferred_reason, "matched auth work");
  });

  it("resolves a detour-kind inference using the inference row's own label, with a null item_number", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    activity(id, 0);
    stmts.upsertFocusInference.run(
      id,
      CWD,
      "detour",
      null,
      "CI pipeline fix",
      0.8,
      "llm",
      "no item covers CI"
    );

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(30),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.kind, "detour");
    assert.equal(seg.item_number, null);
    assert.equal(seg.label, "CI pipeline fix");
  });

  it("falls back to a NONE_KIND segment when the inferred item has since been deleted (item_id doesn't resolve)", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    activity(id, 0);
    stmts.upsertFocusInference.run(
      id,
      CWD,
      "item",
      "item-does-not-exist",
      null,
      0.9,
      "llm",
      "matched something"
    );

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(30),
    });
    assert.equal(report.segments.length, 1);
    assert.equal(report.segments[0].kind, "none");
    assert.equal(report.segments[0].inferred, false);
    assert.equal(report.segments[0].start, t(0));
    assert.equal(report.segments[0].end, t(30));
  });

  it("falls back to a NONE_KIND segment for an unclassified verdict, even with a real inference row present", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    activity(id, 0);
    stmts.upsertFocusInference.run(id, CWD, "unclassified", null, null, 0, "llm", null);

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(30),
    });
    assert.equal(report.segments.length, 1);
    assert.equal(report.segments[0].kind, "none");
    assert.equal(report.segments[0].inferred, false);
  });

  it("falls back to a NONE_KIND segment for a session with no declared focus and no inference row at all (e.g. still running, not yet quiet long enough to classify)", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    activity(id, 0);
    activity(id, 5);

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: null,
    });
    assert.equal(report.segments.length, 1);
    const [seg] = report.segments;
    assert.equal(seg.kind, "none");
    assert.equal(seg.item_number, null);
    assert.equal(seg.label, null);
    assert.equal(seg.inferred, false);
    assert.equal(seg.inferred_reason, null);
    assert.equal(seg.start, t(0));
  });

  it("highest-value: a round-3-shaped idle tail reached via the inference path still discounts active_ms and produces chunks", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    // A burst of activity in the first ~10 minutes, then nothing until the
    // whole-session inferred segment closes at ended_at - the exact shape
    // that made round 3's un-idle-aware duration misleading.
    activity(id, 1);
    activity(id, 4);
    activity(id, 8);
    stmts.upsertFocusInference.run(
      id,
      CWD,
      "item",
      "item-4",
      null,
      0.9,
      "llm",
      "matched auth work"
    );

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(130),
      // Explicit started_at - the inference fallback prefers this over
      // querying the earliest event when present, keeping the segment's
      // start pinned exactly to t(0) regardless of when the seeded
      // activity() bursts landed.
      started_at: t(0),
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.wall_ms, 130 * 60_000);
    assert.ok(seg.active_ms < seg.wall_ms, "active_ms should be discounted below wall_ms");
    assert.equal(seg.chunks.length, Math.ceil((130 * 60_000) / CHUNK_MS));
    assert.equal(seg.chunks[0].active, true);
    assert.ok(
      seg.chunks.slice(1).every((c) => c.active === false),
      "every chunk after the first burst should read idle"
    );
  });
});

describe("buildSessionFocusReport / buildProjectFocusReport — time-window clipping", () => {
  it("clips a single declared segment's wall/active/idle math and chunks to the window, not the segment's real span", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"; // isolate from idle discounting
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    // Real segment spans the full 0-120m; only 30-90m should end up reported.

    const report = buildSessionFocusReport(
      dbModule,
      { id, name: "Report Test", cwd: CWD, ended_at: t(120) },
      new Date(t(30)).getTime(),
      new Date(t(90)).getTime()
    );
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.start, t(30));
    assert.equal(seg.end, t(90));
    assert.equal(seg.wall_ms, 60 * 60_000); // 90-30, not the real 0-120 span
    assert.equal(seg.active_ms, 60 * 60_000);
    assert.equal(seg.chunks.length, Math.ceil((60 * 60_000) / CHUNK_MS));
  });

  it("drops a segment entirely, returning zero segments, when it doesn't overlap the window at all", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });
    focus(id, 10, "done", { verb: "done", item_number: 4, item_text_snapshot: "Migrate auth" });

    const report = buildSessionFocusReport(
      dbModule,
      { id, name: "Report Test", cwd: CWD, ended_at: t(10) },
      new Date(t(50)).getTime(),
      new Date(t(60)).getTime()
    );
    assert.deepEqual(report.segments, []);
  });

  it("with no window bounds supplied, behaves exactly as before (full unclipped history)", () => {
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Report Test",
      cwd: CWD,
      ended_at: t(45),
    });
    assert.equal(report.segments[0].start, t(0));
    assert.equal(report.segments[0].end, t(45));
  });

  it("buildProjectFocusReport clips a long-running session's contribution to totals/wall_clock_ms/concurrency_ratio to only the windowed slice", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const id = nextId("sess");
    seedSession(id, CWD);
    // Session "started yesterday" (minute 0) and is still running at minute
    // 180 - a long-running session whose full history would otherwise bleed
    // into whichever window it's viewed from.
    focus(id, 0, "set", { verb: "set", item_number: 4, item_text_snapshot: "Migrate auth" });

    const sessions = [{ id, name: "Long runner", cwd: CWD, ended_at: t(180) }];
    // Window covers only minute 100-130 (30m) of the session's 180m span.
    const report = buildProjectFocusReport(
      dbModule,
      sessions,
      new Date(t(100)).getTime(),
      new Date(t(130)).getTime()
    );

    assert.equal(report.sessions.length, 1);
    assert.equal(report.sessions[0].segments[0].start, t(100));
    assert.equal(report.sessions[0].segments[0].end, t(130));
    assert.equal(report.totals.wall_ms, 30 * 60_000); // not the full 180m
    assert.equal(report.totals.active_ms, 30 * 60_000);
    assert.equal(report.totals.by_kind.item.wall_ms, 30 * 60_000);
    assert.equal(report.wall_clock_ms, 30 * 60_000); // not the full 180m
    assert.equal(report.concurrency_ratio, 1);
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

  it("includes a session with no declared focus and no usable inference as a NONE_KIND segment - counted in aggregate totals, not in any by_kind bucket or the item rollup", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const idA = nextId("sess");
    const idNoFocus = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idNoFocus, CWD);
    activity(idNoFocus, 0); // gives resolveSessionStart something to anchor on

    focus(idA, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(20) }, // 20m declared
      { id: idNoFocus, name: "Undeclared", cwd: CWD, ended_at: t(10) }, // 10m no-focus
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    assert.equal(report.sessions.length, 2); // the no-focus session is no longer dropped
    const noFocusReport = report.sessions.find((r) => r.session_id === idNoFocus);
    assert.equal(noFocusReport.segments.length, 1);
    assert.equal(noFocusReport.segments[0].kind, "none");

    // Aggregate totals include its 10m; by_kind buckets don't (it has no
    // real kind), and it never surfaces in the item rollup (item_number null).
    assert.equal(report.totals.wall_ms, 30 * 60_000); // 20m declared + 10m no-focus
    assert.equal(report.totals.by_kind.item.wall_ms, 20 * 60_000);
    const byKindSum = Object.values(report.totals.by_kind).reduce((sum, k) => sum + k.wall_ms, 0);
    assert.equal(byKindSum, 20 * 60_000); // the 10m no-focus segment isn't in any bucket
    assert.equal(report.items.length, 1);
    assert.equal(report.items[0].item_number, 1);

    // Its span still counts toward wall-clock/concurrency, unlike before.
    assert.equal(report.wall_clock_ms, 20 * 60_000); // [0,20] fully covers [0,10]
  });

  it("collapses fully concurrent sessions to one wall-clock span while summing their effort", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const idA = nextId("sess");
    const idB = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idB, CWD);

    // Both sessions on item 1, both running the exact same 0-30m window.
    focus(idA, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    focus(idB, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(30) },
      { id: idB, name: "B", cwd: CWD, ended_at: t(30) },
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    // Effort: two 30m sessions summed = 60m of agent-labor.
    assert.equal(report.totals.active_ms, 60 * 60_000);
    // Wall-clock: fully overlapping spans merge into a single 30m interval.
    assert.equal(report.wall_clock_ms, 30 * 60_000);
    // 60m effort inside a 30m window reads as 2x parallelism.
    assert.equal(report.concurrency_ratio, 2);
    // Grace disabled: every segment is wholly active, so the active
    // wall-clock union equals the span union and both ratios agree.
    assert.equal(report.active_wall_clock_ms, 30 * 60_000);
    assert.equal(report.active_concurrency_ratio, 2);
  });

  it("sums disjoint (non-overlapping) session spans as plain wall-clock time, ratio ~1", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const idA = nextId("sess");
    const idB = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idB, CWD);

    focus(idA, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    focus(idB, 40, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(30) }, // 0-30m
      { id: idB, name: "B", cwd: CWD, ended_at: t(70) }, // 40-70m, 10m gap after A
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    assert.equal(report.totals.active_ms, 60 * 60_000); // 30m + 30m effort
    assert.equal(report.wall_clock_ms, 60 * 60_000); // no overlap: spans just add up
    assert.equal(report.concurrency_ratio, 1); // no idle within either session, no overlap
  });

  it("merges partially overlapping session spans to their union", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const idA = nextId("sess");
    const idB = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idB, CWD);

    focus(idA, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    focus(idB, 20, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });

    const sessions = [
      { id: idA, name: "A", cwd: CWD, ended_at: t(30) }, // 0-30m
      { id: idB, name: "B", cwd: CWD, ended_at: t(50) }, // 20-50m, overlaps A by 10m
    ];
    const report = buildProjectFocusReport(dbModule, sessions);

    assert.equal(report.totals.active_ms, 60 * 60_000); // 30m + 30m effort
    assert.equal(report.wall_clock_ms, 50 * 60_000); // union of [0,30] and [20,50] = [0,50]
    assert.equal(report.concurrency_ratio, 60 / 50);
  });

  it("reports a null concurrency_ratio when there is no wall-clock time to divide by", () => {
    const report = buildProjectFocusReport(dbModule, []);
    assert.equal(report.wall_clock_ms, 0);
    assert.equal(report.concurrency_ratio, null);
    assert.equal(report.active_wall_clock_ms, 0);
    assert.equal(report.active_concurrency_ratio, null);
  });

  it("excludes open-but-silent stretches from active_wall_clock_ms while wall_clock_ms still counts them (sessions left open overnight)", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "300"; // 5m grace
    const id = nextId("sess");
    seedSession(id, CWD);

    // Events at 0/5/10, then total silence until the session ends at 70m —
    // the "left the session open and walked away" shape. Grace credits 5m
    // after each event: active [0,5]+[5,10]+[10,15] = 15m, idle 55m.
    focus(id, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    activity(id, 5);
    activity(id, 10);

    const report = buildProjectFocusReport(dbModule, [
      { id, name: "A", cwd: CWD, ended_at: t(70) },
    ]);

    assert.equal(report.totals.active_ms, 15 * 60_000);
    // Span-based wall clock counts the whole open session, silence included.
    assert.equal(report.wall_clock_ms, 70 * 60_000);
    assert.equal(report.concurrency_ratio, 15 / 70); // diluted by the silence
    // Active wall clock is only the graced-active union - the silence is out.
    assert.equal(report.active_wall_clock_ms, 15 * 60_000);
    assert.equal(report.active_concurrency_ratio, 1); // one session working alone
  });

  it("unions concurrent sessions' active intervals: overlapping activity doubles the active ratio, staggered activity doesn't", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "300";

    // Overlapping: A and B both active over the same [0,15] window, both
    // sessions open until 40m.
    const idA = nextId("sess");
    const idB = nextId("sess");
    seedSession(idA, CWD);
    seedSession(idB, CWD);
    for (const id of [idA, idB]) {
      focus(id, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
      activity(id, 5);
      activity(id, 10);
    }
    const overlapping = buildProjectFocusReport(dbModule, [
      { id: idA, name: "A", cwd: CWD, ended_at: t(40) },
      { id: idB, name: "B", cwd: CWD, ended_at: t(40) },
    ]);
    assert.equal(overlapping.totals.active_ms, 30 * 60_000); // 15m + 15m effort
    assert.equal(overlapping.active_wall_clock_ms, 15 * 60_000); // same [0,15] union
    assert.equal(overlapping.active_concurrency_ratio, 2); // genuinely parallel work
    assert.equal(overlapping.concurrency_ratio, 30 / 40); // diluted by idle tails

    // Staggered: C active [0,15], D active [20,35] - no overlap, ratio 1.
    const idC = nextId("sess");
    const idD = nextId("sess");
    seedSession(idC, CWD);
    seedSession(idD, CWD);
    focus(idC, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    activity(idC, 5);
    activity(idC, 10);
    focus(idD, 20, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });
    activity(idD, 25);
    activity(idD, 30);
    const staggered = buildProjectFocusReport(dbModule, [
      { id: idC, name: "C", cwd: CWD, ended_at: t(40) },
      { id: idD, name: "D", cwd: CWD, ended_at: t(60) },
    ]);
    assert.equal(staggered.totals.active_ms, 30 * 60_000);
    assert.equal(staggered.active_wall_clock_ms, 30 * 60_000); // [0,15] + [20,35]
    assert.equal(staggered.active_concurrency_ratio, 1); // never actually parallel
  });

  it("never serializes the internal per-session active-interval plumbing into the response", () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";
    const id = nextId("sess");
    seedSession(id, CWD);
    focus(id, 0, "set", { verb: "set", item_number: 1, item_text_snapshot: "First item" });

    const report = buildProjectFocusReport(dbModule, [
      { id, name: "A", cwd: CWD, ended_at: t(10) },
    ]);
    const roundTripped = JSON.parse(JSON.stringify(report));
    assert.equal("activeIntervalsMs" in roundTripped.sessions[0], false);
    // ...while the aggregate figures derived from it ARE part of the shape.
    assert.equal(typeof roundTripped.active_wall_clock_ms, "number");
  });
});

describe("mergeIntervals", () => {
  it("merges overlapping intervals and sums the covered duration", () => {
    const { merged, totalMs } = mergeIntervals([
      [0, 30],
      [20, 50],
    ]);
    assert.deepEqual(merged, [[0, 50]]);
    assert.equal(totalMs, 50);
  });

  it("merges touching intervals (end of one equals start of the next) into one", () => {
    const { merged, totalMs } = mergeIntervals([
      [0, 30],
      [30, 60],
    ]);
    assert.deepEqual(merged, [[0, 60]]);
    assert.equal(totalMs, 60);
  });

  it("keeps disjoint intervals separate and sums their durations", () => {
    const { merged, totalMs } = mergeIntervals([
      [0, 10],
      [20, 25],
    ]);
    assert.deepEqual(merged, [
      [0, 10],
      [20, 25],
    ]);
    assert.equal(totalMs, 15);
  });

  it("is order-independent - unsorted input merges the same as sorted input", () => {
    const { merged, totalMs } = mergeIntervals([
      [20, 25],
      [0, 10],
      [5, 22],
    ]);
    assert.deepEqual(merged, [[0, 25]]);
    assert.equal(totalMs, 25);
  });

  it("drops malformed intervals (end <= start) instead of erroring", () => {
    const { merged, totalMs } = mergeIntervals([
      [10, 10],
      [10, 5],
      [0, 10],
    ]);
    assert.deepEqual(merged, [[0, 10]]);
    assert.equal(totalMs, 10);
  });

  it("returns an empty union for no intervals", () => {
    const { merged, totalMs } = mergeIntervals([]);
    assert.deepEqual(merged, []);
    assert.equal(totalMs, 0);
  });
});
