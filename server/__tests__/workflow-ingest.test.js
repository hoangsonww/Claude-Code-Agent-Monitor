/**
 * @file Tests for Workflow-tool run ingestion (issue #167): parsing the on-disk
 * run journal, upserting a workflows row, linking inner agents by the shared
 * `${sessionId}-jsonl-<agentId>` id scheme, idempotency, running→completed
 * detection with launch-time preservation, and the no-double-count invariant
 * (workflow ingest never writes token_usage).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Isolated test DB before requiring any server module.
const TEST_DB = path.join(os.tmpdir(), `dashboard-wf-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { stmts } = dbModule;
const {
  ingestWorkflowsForSession,
  extractRunId,
  nameFromScript,
} = require("../lib/workflow-ingest");

const SESSION_ID = "sess-wf-1";
let ROOT; // temp transcript root
let transcriptPath;

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
}

function subagentDir() {
  return path.join(ROOT, SESSION_ID, "subagents");
}
function workflowsDir() {
  return path.join(ROOT, SESSION_ID, "workflows");
}

before(() => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "wf-fixture-"));
  transcriptPath = path.join(ROOT, `${SESSION_ID}.jsonl`);
  fs.writeFileSync(transcriptPath, ""); // only dirname + basename are used

  // Parent session + main agent (FK targets).
  stmts.insertSession.run(
    SESSION_ID,
    "WF test session",
    "active",
    "/tmp/proj",
    "claude-opus-4-8",
    null
  );
  stmts.insertAgent.run(
    `${SESSION_ID}-main`,
    SESSION_ID,
    "Main",
    "main",
    null,
    "completed",
    null,
    null,
    null
  );

  // A completed run journal with two inner agents in two phases.
  writeJson(path.join(workflowsDir(), "wf_test123.json"), {
    runId: "wf_test123",
    taskId: "task-1",
    workflowName: "review-changes",
    status: "completed",
    startTime: 1700000000000,
    durationMs: 5000,
    defaultModel: "claude-opus-4-8",
    agentCount: 2,
    totalTokens: 12345,
    totalToolCalls: 7,
    phases: [
      { title: "Review", detail: "review the diff" },
      { title: "Verify", detail: "verify findings" },
    ],
    workflowProgress: [
      { type: "workflow_phase", index: 1, title: "Review" },
      { type: "workflow_phase", index: 2, title: "Verify" },
      {
        type: "workflow_agent",
        index: 1,
        agentId: "a1",
        model: "claude-opus-4-8",
        state: "done",
        label: "review:bugs",
        phaseTitle: "Review",
        startedAt: 1700000000000,
        tokens: 5000,
        toolCalls: 3,
        durationMs: 2000,
        lastToolName: "Read",
      },
      {
        type: "workflow_agent",
        index: 2,
        agentId: "a2",
        model: "claude-haiku-4-5",
        state: "error",
        label: "verify:x",
        phaseTitle: "Verify",
        startedAt: 1700000002000,
        tokens: 7345,
        toolCalls: 4,
        durationMs: 3000,
        lastToolName: "Bash",
      },
    ],
  });
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

describe("extractRunId / nameFromScript", () => {
  it("derives the same run id from a journal and its launch script", () => {
    assert.equal(extractRunId("wf_run999.json"), "wf_run999");
    assert.equal(extractRunId("/x/y/myflow-wf_run999.js"), "wf_run999");
  });
  it("strips the -wf_<runId> tail to recover the workflow name", () => {
    assert.equal(nameFromScript("review-changes-wf_abc123.js"), "review-changes");
  });
});

describe("ingestWorkflowsForSession — completed journal", () => {
  it("ingests the journal as a workflow row with parsed phases/progress", async () => {
    const changed = await ingestWorkflowsForSession(dbModule, {
      id: SESSION_ID,
      transcript_path: transcriptPath,
    });
    assert.ok(changed.length >= 1);

    const wf = stmts.getWorkflow.get("wf_test123");
    assert.ok(wf, "workflow row exists");
    assert.equal(wf.session_id, SESSION_ID);
    assert.equal(wf.name, "review-changes");
    assert.equal(wf.status, "completed");
    assert.equal(wf.agent_count, 2);
    assert.equal(wf.total_tokens, 12345);
    assert.equal(wf.total_tool_calls, 7);
    assert.equal(wf.source, "journal");
    assert.ok(wf.started_at, "started_at populated");
    assert.equal(wf.ended_at, new Date(1700000000000 + 5000).toISOString());
    assert.equal(JSON.parse(wf.phases).length, 2);
    // progress keeps all entries (2 phase markers + 2 agents)
    assert.equal(JSON.parse(wf.progress).length, 4);
    assert.equal(JSON.parse(wf.progress).filter((p) => p.type === "workflow_agent").length, 2);
  });

  it("links each inner agent by the shared jsonl id scheme, with phase + status", () => {
    const a1 = stmts.getAgent.get(`${SESSION_ID}-jsonl-a1`);
    const a2 = stmts.getAgent.get(`${SESSION_ID}-jsonl-a2`);
    assert.ok(a1 && a2, "both inner-agent rows exist");
    assert.equal(a1.workflow_run_id, "wf_test123");
    assert.equal(a1.workflow_phase, "Review");
    assert.equal(a1.status, "completed");
    assert.equal(a2.workflow_run_id, "wf_test123");
    assert.equal(a2.workflow_phase, "Verify");
    assert.equal(a2.status, "error");

    const linked = stmts.listAgentsByWorkflow.all("wf_test123");
    assert.equal(linked.length, 2);
  });

  it("never writes token_usage (no double-counting)", () => {
    const n = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM token_usage WHERE session_id = ?")
      .get(SESSION_ID);
    assert.equal(n.n, 0);
  });

  it("is idempotent — re-ingest creates no duplicate workflow or agent rows", async () => {
    await ingestWorkflowsForSession(dbModule, { id: SESSION_ID, transcript_path: transcriptPath });
    const wfCount = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM workflows WHERE session_id = ?")
      .get(SESSION_ID);
    assert.equal(wfCount.n, 1);
    const subCount = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM agents WHERE session_id = ? AND type = 'subagent'")
      .get(SESSION_ID);
    assert.equal(subCount.n, 2);
  });
});

describe("running detection → completed transition", () => {
  it("shows a launch-script-only run as running, then completes it preserving started_at", async () => {
    // 1) Launch script, no journal yet.
    fs.mkdirSync(path.join(workflowsDir(), "scripts"), { recursive: true });
    fs.writeFileSync(path.join(workflowsDir(), "scripts", "deep-audit-wf_run999.js"), "// script");

    await ingestWorkflowsForSession(dbModule, { id: SESSION_ID, transcript_path: transcriptPath });
    const running = stmts.getWorkflow.get("wf_run999");
    assert.ok(running, "running row created from launch script");
    assert.equal(running.status, "running");
    assert.equal(running.source, "live");
    assert.equal(running.name, "deep-audit");
    assert.ok(running.started_at, "running row has a launch time");
    const launchTime = running.started_at;

    // 2) Journal lands → same run_id → becomes completed, launch time preserved.
    writeJson(path.join(workflowsDir(), "wf_run999.json"), {
      runId: "wf_run999",
      workflowName: "deep-audit",
      status: "completed",
      startTime: 1700000500000,
      durationMs: 1000,
      agentCount: 0,
      totalTokens: 0,
      totalToolCalls: 0,
      phases: [],
      workflowProgress: [],
    });
    await ingestWorkflowsForSession(dbModule, { id: SESSION_ID, transcript_path: transcriptPath });
    const done = stmts.getWorkflow.get("wf_run999");
    assert.equal(done.status, "completed");
    assert.equal(done.started_at, launchTime, "launch time preserved across transition");
  });
});
