/**
 * @file Tests for Workflow-tool run ingestion (issue #167): parsing the on-disk
 * run journal, upserting a workflows row, linking inner agents by the shared
 * `${sessionId}-jsonl-<agentId>` id scheme, idempotency, running→completed
 * detection with launch-time preservation, and folding inner-agent token usage
 * into the session cost under a namespaced `workflow` service_tier.
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
  ingestAllWorkflows,
  workflowsMaxMtime,
  extractRunId,
  nameFromScript,
  mapState,
} = require("../lib/workflow-ingest");

const SESSION_ID = "sess-wf-1";
let ROOT; // temp transcript root
let transcriptPath;

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
}

// A minimal subagent transcript with token usage + one tool call.
function agentJsonl(model, input, output) {
  return [
    { type: "user", timestamp: "2026-02-01T00:00:00.000Z", message: { content: "go" } },
    {
      type: "assistant",
      timestamp: "2026-02-01T00:00:02.000Z",
      message: {
        model,
        content: [{ type: "tool_use", id: "t1", name: "WebSearch", input: {} }],
        usage: {
          input_tokens: input,
          output_tokens: output,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
  ]
    .map((l) => JSON.stringify(l))
    .join("\n");
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

  // Inner-agent transcripts in the per-run nested dir, each with token usage so
  // ingest can fold their spend into the session cost.
  const runAgentDir = path.join(workflowsDir(), "..", "subagents", "workflows", "wf_test123");
  const agentLines = (model, input, output) =>
    [
      { type: "user", timestamp: "2026-01-01T00:00:00.000Z", message: { content: "go" } },
      {
        type: "assistant",
        timestamp: "2026-01-01T00:00:01.000Z",
        message: {
          model,
          content: [{ type: "text", text: "done" }],
          usage: {
            input_tokens: input,
            output_tokens: output,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      },
    ]
      .map((l) => JSON.stringify(l))
      .join("\n");
  fs.mkdirSync(runAgentDir, { recursive: true });
  fs.writeFileSync(
    path.join(runAgentDir, "agent-a1.jsonl"),
    agentLines("claude-opus-4-8", 4000, 1000)
  );
  fs.writeFileSync(
    path.join(runAgentDir, "agent-a2.jsonl"),
    agentLines("claude-opus-4-8", 6000, 1345)
  );
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

describe("mapState", () => {
  it("maps journal states to agent statuses", () => {
    assert.equal(mapState("done"), "completed");
    assert.equal(mapState("completed"), "completed");
    assert.equal(mapState("success"), "completed");
    assert.equal(mapState("error"), "error");
    assert.equal(mapState("failed"), "error");
    assert.equal(mapState("running"), "working");
    assert.equal(mapState("queued"), "working");
    assert.equal(mapState("in_progress"), "working");
    assert.equal(mapState("anything-unknown"), "completed");
    assert.equal(mapState(null), "completed");
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

  it("folds inner-agent tokens into the session under a 'workflow' service_tier", () => {
    const rows = dbModule.db
      .prepare("SELECT * FROM token_usage WHERE session_id = ?")
      .all(SESSION_ID);
    assert.ok(rows.length > 0, "workflow token rows written");
    assert.ok(
      rows.every((r) => r.service_tier === "workflow"),
      "isolated under the workflow tier (no collision with main buckets)"
    );
    // a1(4000)+a2(6000)=10000 input, 1000+1345=2345 output (same model → one row)
    const totalInput = rows.reduce((s, r) => s + r.input_tokens + r.baseline_input, 0);
    const totalOutput = rows.reduce((s, r) => s + r.output_tokens + r.baseline_output, 0);
    assert.equal(totalInput, 10000);
    assert.equal(totalOutput, 2345);
  });

  it("is idempotent — re-ingest creates no duplicate rows and stable token totals", async () => {
    await ingestWorkflowsForSession(dbModule, { id: SESSION_ID, transcript_path: transcriptPath });
    const wfCount = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM workflows WHERE session_id = ?")
      .get(SESSION_ID);
    assert.equal(wfCount.n, 1);
    const subCount = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM agents WHERE session_id = ? AND type = 'subagent'")
      .get(SESSION_ID);
    assert.equal(subCount.n, 2);
    // tokens not double-counted on re-ingest (replace semantics)
    const tot = dbModule.db
      .prepare(
        "SELECT SUM(input_tokens + baseline_input) AS i FROM token_usage WHERE session_id = ?"
      )
      .get(SESSION_ID);
    assert.equal(tot.i, 10000);
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

describe("workflowsMaxMtime", () => {
  it("returns the newest artifact mtime for a session with workflows, 0 otherwise", () => {
    assert.ok(workflowsMaxMtime(transcriptPath) > 0, "fingerprint > 0 when journals exist");
    assert.equal(
      workflowsMaxMtime(path.join(ROOT, "no-such-session.jsonl")),
      0,
      "0 when there are no workflow artifacts"
    );
  });
});

describe("live running workflow (no terminal journal)", () => {
  it("builds real-time progress + tokens from the streaming run dir", async () => {
    const runId = "wf_live77";
    const runDir = path.join(ROOT, SESSION_ID, "subagents", "workflows", runId);
    fs.mkdirSync(runDir, { recursive: true });
    // a1 finished (has a result event), a2 still running (started only)
    fs.writeFileSync(path.join(runDir, "agent-a1.jsonl"), agentJsonl("claude-opus-4-8", 3000, 800));
    fs.writeFileSync(path.join(runDir, "agent-a2.jsonl"), agentJsonl("claude-opus-4-8", 1500, 200));
    fs.writeFileSync(
      path.join(runDir, "journal.jsonl"),
      [
        JSON.stringify({ type: "started", agentId: "a1" }),
        JSON.stringify({ type: "started", agentId: "a2" }),
        // a3 started but has no transcript yet (queued) → minimal live entry
        JSON.stringify({ type: "started", agentId: "a3" }),
        JSON.stringify({ type: "result", agentId: "a1", result: { ok: true, note: "done" } }),
      ].join("\n")
    );
    // a launch script (no terminal journal) → name resolves from it
    fs.mkdirSync(path.join(workflowsDir(), "scripts"), { recursive: true });
    fs.writeFileSync(path.join(workflowsDir(), "scripts", `ds-pipeline-${runId}.js`), "// s");

    await ingestWorkflowsForSession(dbModule, { id: SESSION_ID, transcript_path: transcriptPath });

    const wf = stmts.getWorkflow.get(runId);
    assert.ok(wf, "live run row created");
    assert.equal(wf.status, "running", "shown as running before terminal journal");
    assert.equal(wf.source, "live");
    assert.equal(wf.name, "ds-pipeline");
    assert.equal(wf.agent_count, 3, "two transcripts + one queued agent");
    assert.ok(wf.total_tokens > 0, "live tokens accumulated");
    assert.ok(wf.total_tool_calls >= 2, "live tool calls counted");

    const prog = JSON.parse(wf.progress);
    assert.equal(prog.length, 3);
    const a1 = prog.find((p) => p.agentId === "a1");
    const a2 = prog.find((p) => p.agentId === "a2");
    const a3 = prog.find((p) => p.agentId === "a3");
    assert.equal(a1.state, "done", "a1 has a result → done");
    assert.equal(a2.state, "running", "a2 only started → running");
    assert.equal(a3.state, "running", "a3 queued (started, no transcript) → running");
    assert.equal(a3.tokens, 0, "queued agent has no tokens yet");
    assert.ok(a1.tokens > 0 && a1.toolCalls >= 1);
    assert.ok(a1.resultPreview, "finished agent carries its result");

    // inner agents linked + live workflow tokens folded under the workflow tier
    assert.equal(stmts.listAgentsByWorkflow.all(runId).length, 2);
    const liveTier = dbModule.db
      .prepare("SELECT COUNT(*) AS n FROM token_usage WHERE session_id = ? AND service_tier = ?")
      .get(SESSION_ID, "workflow");
    assert.ok(liveTier.n >= 1, "workflow-tier cost row written for the live run");
  });
});

describe("ingestAllWorkflows backfill", () => {
  it("ingests on-disk workflows for sessions whose transcript_path is in the DB", async () => {
    // Backfill resolves the transcript from the session row, so persist it.
    dbModule.db
      .prepare("UPDATE sessions SET transcript_path = ? WHERE id = ?")
      .run(transcriptPath, SESSION_ID);
    const res = await ingestAllWorkflows(dbModule);
    assert.ok(res.sessions >= 1, "at least one session backfilled");
    assert.ok(res.workflows >= 1, "at least one workflow ingested");
    // The completed fixture run is present after backfill.
    assert.ok(stmts.getWorkflow.get("wf_test123"), "fixture run present");
  });
});
