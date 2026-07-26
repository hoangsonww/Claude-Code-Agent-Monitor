/**
 * Tests for server/lib/focus-inference.js — activity digest building, the
 * conservative heuristic item matcher, LLM output parsing, candidate
 * selection (plan-bearing cwd, zero Focus events, ended-or-quiet, stale
 * inference), verdict persistence, and the focus-report fallback that turns
 * an inference row into a whole-session `inferred: true` segment while
 * declared Focus history always wins.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-inference-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  inferSession,
  listCandidates,
  buildActivityDigest,
  heuristicClassify,
  parseLlmOutput,
  __injectSpawnForTest,
} = require("../lib/focus-inference");
const { buildSessionFocusReport } = require("../lib/focus-report");

const CWD = "/tmp/focus-inference-test-project";
let seq = 0;

const ITEMS = [
  {
    item_id: "item-1",
    item_number: 1,
    text: "Migrate authentication to SSO",
    acceptance: "login works via SSO",
  },
  {
    item_id: "item-2",
    item_number: 2,
    text: "Kanban board drag and drop",
    acceptance: "cards move between columns",
  },
];

/** Fake ChildProcess factory: exits with the given stdout after a tick. */
function fakeSpawn({ exitCode = 0, stdout = "" } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stderr.resume = () => {};
    child.kill = () => {};
    setImmediate(() => {
      if (stdout) child.stdout.emit("data", stdout);
      child.emit("exit", exitCode);
    });
    return child;
  };
}

/** LLM envelope the `claude -p --output-format json` spawn would print. */
function envelope(result) {
  return JSON.stringify({ result: JSON.stringify(result) });
}

function nextId(prefix) {
  seq += 1;
  return `${prefix}-${seq}`;
}

/** Insert a session with full control of its timestamps. */
function seedSession(id, { cwd = CWD, startedAt, updatedAt, endedAt = null } = {}) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, started_at, updated_at, ended_at) VALUES (?, 'Infer Test', 'active', ?, ?, ?, ?)"
  ).run(id, cwd, startedAt || now, updatedAt || now, endedAt);
}

function addEvent(sessionId, eventType, toolName, data) {
  stmts.insertEvent.run(
    sessionId,
    null,
    eventType,
    toolName,
    null,
    data ? JSON.stringify(data) : null
  );
}

function addPrompt(sessionId, prompt) {
  addEvent(sessionId, "UserPromptSubmit", null, { prompt });
}

function addFileEdit(sessionId, filePath) {
  addEvent(sessionId, "PreToolUse", "Edit", {
    tool_name: "Edit",
    tool_input: { file_path: filePath },
  });
}

function addBash(sessionId, command) {
  addEvent(sessionId, "PreToolUse", "Bash", { tool_name: "Bash", tool_input: { command } });
}

const HOUR_AGO = () => new Date(Date.now() - 60 * 60_000).toISOString();

db.exec("DELETE FROM plans");
stmts.upsertPlan.run(CWD, "Infer plan", `${CWD}/AGENT-PLAN.md`, "h", 2);
for (const [i, item] of ITEMS.entries()) {
  stmts.upsertPlanItem.run(
    CWD,
    item.item_id,
    item.item_number,
    null,
    item.text,
    item.acceptance,
    null,
    0,
    i
  );
}

beforeEach(() => {
  __injectSpawnForTest(null);
});

after(() => {
  __injectSpawnForTest(null);
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

describe("buildActivityDigest", () => {
  it("collects prompts, most-touched files, and distinct commands", () => {
    const id = nextId("sess");
    seedSession(id);
    addPrompt(id, "please migrate the login flow to SSO");
    addFileEdit(id, "/repo/src/auth/sso.ts");
    addFileEdit(id, "/repo/src/auth/sso.ts");
    addFileEdit(id, "/repo/src/other.ts");
    addBash(id, "npm test");
    addBash(id, "npm test"); // duplicate collapses

    const digest = buildActivityDigest(dbModule, id);
    assert.equal(digest.prompts.length, 1);
    assert.match(digest.prompts[0], /SSO/);
    assert.deepEqual(digest.files, ["/repo/src/auth/sso.ts", "/repo/src/other.ts"]);
    assert.deepEqual(digest.commands, ["npm test"]);
  });

  it("returns null for a session with no judgeable activity", () => {
    const id = nextId("sess");
    seedSession(id);
    addEvent(id, "PreToolUse", "Read", { tool_name: "Read", tool_input: {} });
    assert.equal(buildActivityDigest(dbModule, id), null);
  });
});

describe("heuristicClassify", () => {
  it("claims a clear single-item match", () => {
    const digest = {
      prompts: ["migrate authentication login to SSO provider"],
      files: ["/repo/src/auth/sso-migration.ts"],
      commands: [],
    };
    const result = heuristicClassify(digest, ITEMS);
    assert.equal(result.kind, "item");
    assert.equal(result.item_id, "item-1");
    assert.equal(result.method, "heuristic");
  });

  it("returns null when nothing clearly matches", () => {
    const digest = { prompts: ["update the README badges"], files: [], commands: [] };
    assert.equal(heuristicClassify(digest, ITEMS), null);
  });

  it("returns null when two items both match (ambiguous)", () => {
    const digest = {
      prompts: ["authentication SSO login kanban board drag drop cards columns migrate move"],
      files: [],
      commands: [],
    };
    assert.equal(heuristicClassify(digest, ITEMS), null);
  });
});

describe("parseLlmOutput", () => {
  it("maps a confident item_number to the item's stable id", () => {
    const out = parseLlmOutput(
      envelope({ item_number: 2, detour_title: null, confidence: 0.9, reason: "kanban work" }),
      ITEMS
    );
    assert.equal(out.kind, "item");
    assert.equal(out.item_id, "item-2");
    assert.equal(out.method, "llm");
  });

  it("maps a null item_number with a title to a detour", () => {
    const out = parseLlmOutput(
      envelope({
        item_number: null,
        detour_title: "CI pipeline fix",
        confidence: 0.8,
        reason: "r",
      }),
      ITEMS
    );
    assert.equal(out.kind, "detour");
    assert.equal(out.label, "CI pipeline fix");
  });

  it("degrades low confidence to unclassified", () => {
    const out = parseLlmOutput(
      envelope({ item_number: 1, detour_title: null, confidence: 0.3, reason: "unsure" }),
      ITEMS
    );
    assert.equal(out.kind, "unclassified");
  });

  it("degrades an unknown item_number to unclassified", () => {
    const out = parseLlmOutput(
      envelope({ item_number: 99, detour_title: null, confidence: 0.9, reason: "r" }),
      ITEMS
    );
    assert.equal(out.kind, "unclassified");
  });

  it("returns null on garbage output", () => {
    assert.equal(parseLlmOutput("not json", ITEMS), null);
  });
});

describe("listCandidates", () => {
  it("selects an ended, never-inferred session with activity and no Focus events", () => {
    const id = nextId("cand");
    seedSession(id, { endedAt: new Date().toISOString() });
    addPrompt(id, "hello");
    const ids = listCandidates(dbModule, 50).map((r) => r.id);
    assert.ok(ids.includes(id));
  });

  it("excludes sessions with declared Focus events", () => {
    const id = nextId("cand");
    seedSession(id, { endedAt: new Date().toISOString() });
    addPrompt(id, "hello");
    addEvent(id, "Focus", null, { verb: "set", item_number: 1 });
    const ids = listCandidates(dbModule, 50).map((r) => r.id);
    assert.ok(!ids.includes(id));
  });

  it("excludes live sessions that are not yet quiet", () => {
    const id = nextId("cand");
    seedSession(id, { updatedAt: new Date().toISOString() });
    addPrompt(id, "hello");
    const ids = listCandidates(dbModule, 50).map((r) => r.id);
    assert.ok(!ids.includes(id));
  });

  it("includes quiet live sessions, and re-selects after new activity postdates the inference", () => {
    const id = nextId("cand");
    seedSession(id, { updatedAt: HOUR_AGO() });
    addPrompt(id, "hello");
    assert.ok(
      listCandidates(dbModule, 50)
        .map((r) => r.id)
        .includes(id)
    );

    stmts.upsertFocusInference.run(id, CWD, "unclassified", null, null, null, "heuristic", "r");
    assert.ok(
      !listCandidates(dbModule, 50)
        .map((r) => r.id)
        .includes(id)
    );

    // Session becomes active again AFTER the inference (updated_at newer
    // than inferred_at): eligible once more — but only once quiet again.
    db.prepare("UPDATE focus_inferences SET inferred_at = ? WHERE session_id = ?").run(
      HOUR_AGO(),
      id
    );
    db.prepare(
      "UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    ).run(id);
    assert.ok(
      !listCandidates(dbModule, 50)
        .map((r) => r.id)
        .includes(id)
    ); // not quiet yet
    db.prepare("UPDATE sessions SET updated_at = ?, ended_at = ? WHERE id = ?").run(
      new Date(Date.now() - 20 * 60_000).toISOString(),
      new Date().toISOString(),
      id
    );
    assert.ok(
      listCandidates(dbModule, 50)
        .map((r) => r.id)
        .includes(id)
    );
  });

  it("excludes sessions in a cwd with no ingested plan", () => {
    const id = nextId("cand");
    seedSession(id, { cwd: "/tmp/no-plan-here", endedAt: new Date().toISOString() });
    addPrompt(id, "hello");
    const ids = listCandidates(dbModule, 50).map((r) => r.id);
    assert.ok(!ids.includes(id));
  });
});

describe("inferSession", () => {
  it("persists a heuristic item verdict without spawning", async () => {
    const id = nextId("infer");
    seedSession(id, { endedAt: new Date().toISOString() });
    addPrompt(id, "migrate authentication login to SSO");
    addFileEdit(id, "/repo/src/auth/sso-migration.ts");
    __injectSpawnForTest(() => {
      throw new Error("should not spawn for a confident heuristic match");
    });

    await inferSession(dbModule, { id, cwd: CWD }, "llm");
    const row = stmts.getFocusInference.get(id);
    assert.equal(row.kind, "item");
    assert.equal(row.item_id, "item-1");
    assert.equal(row.method, "heuristic");
  });

  it("falls through to the LLM and stores its detour verdict", async () => {
    const id = nextId("infer");
    seedSession(id, { endedAt: new Date().toISOString() });
    addPrompt(id, "fix the flaky CI pipeline");
    __injectSpawnForTest(
      fakeSpawn({
        stdout: envelope({
          item_number: null,
          detour_title: "CI pipeline fix",
          confidence: 0.85,
          reason: "no item covers CI",
        }),
      })
    );

    await inferSession(dbModule, { id, cwd: CWD }, "llm");
    const row = stmts.getFocusInference.get(id);
    assert.equal(row.kind, "detour");
    assert.equal(row.label, "CI pipeline fix");
    assert.equal(row.method, "llm");
  });

  it("stores unclassified in heuristic mode when nothing matches", async () => {
    const id = nextId("infer");
    seedSession(id, { endedAt: new Date().toISOString() });
    addPrompt(id, "tidy some docs");
    await inferSession(dbModule, { id, cwd: CWD }, "heuristic");
    const row = stmts.getFocusInference.get(id);
    assert.equal(row.kind, "unclassified");
  });
});

describe("focus-report inference fallback", () => {
  it("renders an inferred whole-session item segment for a silent session", () => {
    const id = nextId("report");
    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const endedAt = new Date().toISOString();
    seedSession(id, { startedAt, endedAt });
    addPrompt(id, "work happened");
    stmts.upsertFocusInference.run(
      id,
      CWD,
      "item",
      "item-2",
      null,
      0.9,
      "llm",
      "matched kanban card-drag activity"
    );

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Infer Test",
      cwd: CWD,
      started_at: startedAt,
      ended_at: endedAt,
    });
    assert.equal(report.segments.length, 1);
    const seg = report.segments[0];
    assert.equal(seg.kind, "item");
    assert.equal(seg.inferred, true);
    // Resolved to the item's CURRENT display number via its stable id.
    assert.equal(seg.item_number, 2);
    assert.equal(seg.label, "Kanban board drag and drop");
    assert.equal(seg.start, startedAt);
    assert.equal(seg.end, endedAt);
    // The classifier's one-sentence justification survives to the report —
    // this is the "simple description" the report's ≈ inferred chip surfaces.
    assert.equal(seg.inferred_reason, "matched kanban card-drag activity");
  });

  it("renders an inferred detour segment, reason included", () => {
    const id = nextId("report");
    const startedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    seedSession(id, { startedAt, endedAt: new Date().toISOString() });
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
      name: "Infer Test",
      cwd: CWD,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
    });
    assert.equal(report.segments.length, 1);
    assert.equal(report.segments[0].kind, "detour");
    assert.equal(report.segments[0].label, "CI pipeline fix");
    assert.equal(report.segments[0].inferred, true);
    assert.equal(report.segments[0].inferred_reason, "no item covers CI");
  });

  it("keeps unclassified sessions an honest hole (no segments)", () => {
    const id = nextId("report");
    seedSession(id, { endedAt: new Date().toISOString() });
    stmts.upsertFocusInference.run(id, CWD, "unclassified", null, null, null, "heuristic", "r");
    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Infer Test",
      cwd: CWD,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    });
    assert.deepEqual(report.segments, []);
  });

  it("never consults inference when declared Focus history exists", () => {
    const id = nextId("report");
    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    seedSession(id, { startedAt, endedAt: new Date().toISOString() });
    db.prepare(
      "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, NULL, 'Focus', NULL, 'set', ?, ?)"
    ).run(
      id,
      JSON.stringify({
        verb: "set",
        item_number: 1,
        item_text_snapshot: "Migrate authentication to SSO",
      }),
      startedAt
    );
    // A stale/conflicting inference row must be ignored entirely.
    stmts.upsertFocusInference.run(id, CWD, "item", "item-2", null, 0.9, "llm", "r");

    const report = buildSessionFocusReport(dbModule, {
      id,
      name: "Infer Test",
      cwd: CWD,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
    });
    assert.equal(report.segments.length, 1);
    assert.equal(report.segments[0].item_number, 1);
    assert.equal(report.segments[0].inferred, false);
    assert.equal(report.segments[0].inferred_reason, null);
  });
});
