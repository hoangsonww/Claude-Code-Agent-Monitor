/**
 * @file Tests for the focus drift auditor: the conservative keyword-overlap
 * heuristic, LLM envelope parsing (fence stripping, confidence gating,
 * malformed output), and auditSession end-to-end with an injected fake
 * `claude` spawn — verdict written to session_focus, unknown never
 * overwriting a real verdict, and unavailable-CLI falling back to the
 * heuristic.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("path");
const os = require("os");
const fs = require("fs");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-audit-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  auditSession,
  heuristicVerdict,
  parseLlmOutput,
  __injectSpawnForTest,
} = require("../lib/focus-audit");

const CWD = "/tmp/focus-audit-project";
const SESSION_ID = "focus-audit-session";

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

function seedActivity(n, summaryPrefix) {
  for (let i = 0; i < n; i++) {
    stmts.insertEvent.run(SESSION_ID, null, "PostToolUse", "Edit", `${summaryPrefix} ${i}`, null);
  }
}

before(() => {
  stmts.insertSession.run(SESSION_ID, "Audit Test", "active", CWD, null, null);
  stmts.upsertPlan.run(CWD, "Audit plan", `${CWD}/AGENT-PLAN.md`, "h", 1);
  stmts.upsertPlanItem.run(
    CWD,
    "item-4",
    4,
    null,
    "Migrate authentication to SSO",
    "login works",
    null,
    0,
    0
  );
});

beforeEach(() => {
  db.prepare("DELETE FROM events WHERE session_id = ?").run(SESSION_ID);
  db.prepare("DELETE FROM session_focus WHERE session_id = ?").run(SESSION_ID);
  stmts.upsertSessionFocus.run(SESSION_ID, CWD, 4, null, new Date().toISOString(), "[]");
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

describe("heuristicVerdict", () => {
  it("is unknown with sparse activity", () => {
    assert.equal(heuristicVerdict("migrate auth", ["one", "two"]).status, "unknown");
  });
  it("flags drift on zero overlap with plenty of activity", () => {
    const activity = Array.from({ length: 12 }, (_, i) => `docker networking bridge ${i}`);
    assert.equal(heuristicVerdict("migrate authentication sso login", activity).status, "drift");
  });
  it("says ok when vocabulary overlaps", () => {
    const activity = Array.from({ length: 12 }, (_, i) => `authentication migration step ${i}`);
    assert.equal(heuristicVerdict("migrate authentication sso", activity).status, "ok");
  });
});

describe("parseLlmOutput", () => {
  const wrap = (result) => JSON.stringify({ result });
  it("parses a clean verdict", () => {
    const v = parseLlmOutput(wrap('{"match": false, "confidence": 0.9, "reason": "off task"}'));
    assert.deepEqual(v, { status: "drift", reason: "off task" });
  });
  it("strips code fences", () => {
    const v = parseLlmOutput(
      wrap('```json\n{"match": true, "confidence": 1, "reason": "on task"}\n```')
    );
    assert.equal(v.status, "ok");
  });
  it("gates low-confidence mismatches to ok", () => {
    const v = parseLlmOutput(wrap('{"match": false, "confidence": 0.3, "reason": "meh"}'));
    assert.equal(v.status, "ok");
  });
  it("returns null on malformed output", () => {
    assert.equal(parseLlmOutput("total garbage"), null);
    assert.equal(parseLlmOutput(wrap("not json either")), null);
  });
});

describe("auditSession", () => {
  const broadcasts = [];
  const broadcast = (type, data) => broadcasts.push({ type, data });

  function focusRow() {
    const row = stmts.getSessionFocus.get(SESSION_ID);
    return { ...row, session_updated_at: new Date().toISOString() };
  }

  it("writes a drift verdict from the injected LLM", async () => {
    seedActivity(12, "Tool completed: Edit docker networking");
    __injectSpawnForTest(
      fakeSpawn({
        stdout: JSON.stringify({
          result: '{"match": false, "confidence": 0.95, "reason": "editing docker files"}',
        }),
      })
    );
    await auditSession(dbModule, broadcast, focusRow(), "llm");
    const row = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(row.drift_status, "drift");
    assert.equal(row.drift_reason, "editing docker files");
    assert.ok(row.drift_checked_at);
    assert.ok(broadcasts.some((b) => b.type === "session_focus" && b.data.drift === true));
  });

  it("falls back to the heuristic when the CLI is unavailable", async () => {
    seedActivity(12, "authentication migration work");
    __injectSpawnForTest(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stderr.resume = () => {};
      child.kill = () => {};
      setImmediate(() => child.emit("error", new Error("ENOENT")));
      return child;
    });
    await auditSession(dbModule, broadcast, focusRow(), "llm");
    const row = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(row.drift_status, "ok");
    assert.match(row.drift_reason, /heuristic/);
  });

  it("an unknown pass never overwrites a real prior verdict", async () => {
    stmts.setSessionFocusDrift.run("drift", "prior", "2026-01-01T00:00:00Z", SESSION_ID);
    seedActivity(3, "sparse"); // heuristic → unknown
    await auditSession(dbModule, broadcast, focusRow(), "heuristic");
    const row = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(row.drift_status, "drift");
    assert.equal(row.drift_reason, "prior");
  });

  it("does nothing with zero recent activity", async () => {
    await auditSession(dbModule, broadcast, focusRow(), "heuristic");
    const row = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(row.drift_status, null);
  });
});
