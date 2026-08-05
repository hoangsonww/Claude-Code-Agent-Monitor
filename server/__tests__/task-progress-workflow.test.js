/**
 * @file Tests for Workflow-tool fleet progress written onto the run's MAIN
 * agent (`${sessionId}-main`) with `progress_source='workflow'`. A completed
 * journal's `progress[]` (done/total inner `workflow_agent` entries) is folded
 * onto the main row — counting a `done` OR `error` inner agent as finished —
 * but a finer-grained `'todo'` progress the orchestrator set for itself via
 * TodoWrite is never overwritten (TodoWrite wins the precedence).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Isolated test DB before requiring any server module.
const TEST_DB = path.join(os.tmpdir(), `dashboard-wfprog-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { stmts } = dbModule;
const { ingestWorkflowsForSession } = require("../lib/workflow-ingest");

let ROOT; // temp transcript root

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
}

/** Path to a session's transcript JSONL under the temp root. */
function transcriptPathFor(sid) {
  return path.join(ROOT, `${sid}.jsonl`);
}

/** Seed a session row + its `${sid}-main` agent (FK targets), write transcript. */
function seedSession(sid) {
  const tp = transcriptPathFor(sid);
  fs.writeFileSync(tp, ""); // only dirname + basename are used
  stmts.insertSession.run(sid, `session ${sid}`, "active", "/tmp/proj", "claude-opus-4-8", null);
  stmts.insertAgent.run(`${sid}-main`, sid, "Main", "main", null, "completed", null, null, null);
  return tp;
}

/** Write a completed run journal whose progress[] carries workflow_agent entries. */
function writeJournal(sid, runId, agents) {
  const workflowProgress = agents.map((a, i) => ({
    type: "workflow_agent",
    index: i + 1,
    agentId: a.agentId || `${runId}-a${i + 1}`,
    model: "claude-opus-4-8",
    state: a.state,
    label: `agent:${i + 1}`,
    phaseTitle: "Work",
  }));
  writeJson(path.join(ROOT, sid, "workflows", `${runId}.json`), {
    runId,
    workflowName: "fleet-run",
    status: "completed",
    startTime: 1700000000000,
    durationMs: 1000,
    agentCount: agents.length,
    totalTokens: 0,
    totalToolCalls: 0,
    phases: [],
    workflowProgress,
  });
}

before(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "wfprog-fixture-"));
});

after(() => {
  try {
    fs.rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    dbModule.db.close();
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(TEST_DB, { force: true });
  } catch {
    /* ignore */
  }
});

describe("workflow fleet progress on the main agent", () => {
  it("writes done/total from workflow_agent entries with progress_source='workflow'", async () => {
    const sid = "sess-prog-1";
    const tp = seedSession(sid);
    // 3 inner agents: 2 done, 1 running.
    writeJournal(sid, "wf_prog1", [{ state: "done" }, { state: "done" }, { state: "running" }]);

    await ingestWorkflowsForSession(dbModule, { id: sid, transcript_path: tp });

    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.todo_total, 3);
    assert.equal(main.todo_done, 2);
    assert.equal(main.progress_source, "workflow");
  });

  it("counts an 'error' inner agent as finished", async () => {
    const sid = "sess-prog-2";
    const tp = seedSession(sid);
    // done, error, running → 2 finished of 3.
    writeJournal(sid, "wf_prog2", [{ state: "done" }, { state: "error" }, { state: "running" }]);

    await ingestWorkflowsForSession(dbModule, { id: sid, transcript_path: tp });

    const main = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main.todo_total, 3);
    assert.equal(main.todo_done, 2);
    assert.equal(main.progress_source, "workflow");
  });

  it("never overwrites a finer-grained 'todo' progress (TodoWrite wins)", async () => {
    const sid = "sess-prog-3";
    const tp = seedSession(sid);
    // Orchestrator set its own todo progress first.
    stmts.updateAgentProgress.run(1, 4, "todo", `${sid}-main`);

    writeJournal(sid, "wf_prog3", [{ state: "done" }, { state: "done" }, { state: "running" }]);

    await ingestWorkflowsForSession(dbModule, { id: sid, transcript_path: tp });

    const main2 = stmts.getAgent.get(`${sid}-main`);
    assert.equal(main2.progress_source, "todo");
    assert.equal(main2.todo_total, 4);
    assert.equal(main2.todo_done, 1);
  });
});
