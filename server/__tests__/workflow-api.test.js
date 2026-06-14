/**
 * @file Integration test for the Workflow-tool run feature (issue #167): a Stop
 * hook with a transcript_path triggers on-disk journal ingestion off the
 * response path, and the run then surfaces via GET /api/workflows/runs,
 * GET /api/workflows/runs/:runId, and the session-detail `workflows[]` field.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-wfapi-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;
let ROOT;
const SESSION_ID = "wfapi-sess-1";

function fetchJson(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...options.headers },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "wfapi-fixture-"));
  const transcriptPath = path.join(ROOT, `${SESSION_ID}.jsonl`);
  fs.writeFileSync(transcriptPath, "");

  // On-disk run journal next to the transcript.
  const wfDir = path.join(ROOT, SESSION_ID, "workflows");
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(
    path.join(wfDir, "wf_apitest1.json"),
    JSON.stringify({
      runId: "wf_apitest1",
      workflowName: "api-review",
      status: "completed",
      startTime: 1700001000000,
      durationMs: 4000,
      defaultModel: "claude-opus-4-8",
      agentCount: 1,
      totalTokens: 999,
      totalToolCalls: 2,
      phases: [{ title: "Scan" }],
      workflowProgress: [
        { type: "workflow_phase", index: 1, title: "Scan" },
        {
          type: "workflow_agent",
          index: 1,
          agentId: "x1",
          state: "done",
          phaseTitle: "Scan",
          label: "scan:repo",
          tokens: 999,
          toolCalls: 2,
        },
      ],
    })
  );

  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  // Drive a Stop hook with the transcript_path — this is what triggers the
  // post-response workflow ingest in the hooks router.
  await fetchJson("/api/hooks/event", {
    method: "POST",
    body: {
      hook_type: "Stop",
      data: {
        session_id: SESSION_ID,
        cwd: "/tmp/proj",
        transcript_path: transcriptPath,
      },
    },
  });

  // Ingest is fire-and-forget after res.json; poll until it lands.
  for (let i = 0; i < 40; i++) {
    const r = await fetchJson(`/api/workflows/runs?session_id=${SESSION_ID}`);
    if (r.body && r.body.runs && r.body.runs.length > 0) break;
    await sleep(50);
  }
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(TEST_DB, { force: true });
  } catch {
    /* ignore */
  }
});

describe("GET /api/workflows/runs", () => {
  it("lists the ingested run with hydrated phases/progress arrays", async () => {
    const r = await fetchJson(`/api/workflows/runs?session_id=${SESSION_ID}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.runs));
    const run = r.body.runs.find((x) => x.run_id === "wf_apitest1");
    assert.ok(run, "run present");
    assert.equal(run.name, "api-review");
    assert.equal(run.status, "completed");
    assert.equal(run.total_tokens, 999);
    assert.ok(Array.isArray(run.phases) && run.phases.length === 1);
    assert.ok(Array.isArray(run.progress) && run.progress.length === 2);
    assert.equal(run.progress.filter((p) => p.type === "workflow_agent").length, 1);
    assert.equal(typeof r.body.total, "number");
    assert.ok(r.body.counts && typeof r.body.counts === "object");
    assert.ok(r.body.counts.completed >= 1, "status counts include completed");
  });

  it("filters by status", async () => {
    const completed = await fetchJson("/api/workflows/runs?status=completed");
    assert.equal(completed.status, 200);
    assert.ok(completed.body.runs.some((x) => x.run_id === "wf_apitest1"));
    const running = await fetchJson("/api/workflows/runs?status=running");
    assert.equal(running.status, 200);
    assert.ok(
      !running.body.runs.some((x) => x.run_id === "wf_apitest1"),
      "completed run excluded from the running filter"
    );
  });
});

describe("GET /api/workflows/runs/:runId", () => {
  it("returns the run with its linked inner agents", async () => {
    const r = await fetchJson("/api/workflows/runs/wf_apitest1");
    assert.equal(r.status, 200);
    assert.equal(r.body.workflow.run_id, "wf_apitest1");
    assert.ok(Array.isArray(r.body.agents));
    const linked = r.body.agents.find((a) => a.id === `${SESSION_ID}-jsonl-x1`);
    assert.ok(linked, "inner agent linked");
    assert.equal(linked.workflow_run_id, "wf_apitest1");
    assert.equal(linked.workflow_phase, "Scan");
  });

  it("404s an unknown run id", async () => {
    const r = await fetchJson("/api/workflows/runs/wf_nope");
    assert.equal(r.status, 404);
  });
});

describe("GET /api/sessions/:id includes workflows[]", () => {
  it("surfaces the run on the parent session detail", async () => {
    const r = await fetchJson(`/api/sessions/${SESSION_ID}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.workflows));
    assert.ok(r.body.workflows.some((w) => w.run_id === "wf_apitest1"));
  });
});
