/**
 * @file Proves that the Workflows API exposes only truthful Codex-derived
 * session, tool, token, compaction, and drill-in data under a Codex scope.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-workflows-codex-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_CODEX_HOME = path.join(ROOT, "codex");

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const { ingestCodexTranscript } = require("../lib/codex-ingest");

const SESSION_ID = "019fbb99-bd87-7c80-afec-ee65e2ebbe1c";
const ROLLOUT = path.join(
  process.env.DASHBOARD_CODEX_HOME,
  "sessions",
  "2026",
  "08",
  "01",
  `rollout-2026-08-01T22-00-00-${SESSION_ID}.jsonl`
);

let server;
let baseUrl;

function record(type, payload) {
  return { timestamp: "2026-08-01T22:00:00.000Z", type, payload };
}

function requestJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "{}") }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  fs.mkdirSync(path.dirname(ROLLOUT), { recursive: true });
  fs.writeFileSync(
    ROLLOUT,
    [
      record("session_meta", { id: SESSION_ID, cwd: "/workspace/codex" }),
      record("turn_context", { model: "gpt-5.6-terra", service_tier: "standard" }),
      record("event_msg", { type: "user_message", message: "Trace workflow data" }),
      record("response_item", {
        type: "function_call",
        name: "exec_command",
        call_id: "tool-1",
        arguments: '{"cmd":"rg workflows"}',
      }),
      record("response_item", {
        type: "custom_tool_call",
        name: "apply_patch",
        call_id: "tool-2",
        input: "*** Begin Patch",
      }),
      record("event_msg", { type: "context_compacted" }),
      record("event_msg", {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 120,
            cached_input_tokens: 20,
            cache_write_input_tokens: 0,
            output_tokens: 30,
            reasoning_output_tokens: 10,
          },
        },
      }),
      record("event_msg", { type: "task_complete" }),
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n"
  );
  ingestCodexTranscript(ROLLOUT);
  server = await startServer(createApp(), 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  db.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("Codex workflow intelligence", () => {
  it("returns Codex sessions, tools, tokens, and compactions without Claude leakage", async () => {
    const result = await requestJson("/api/workflows?providers=codex");
    assert.equal(result.status, 200);
    assert.equal(result.body.stats.totalSessions, 1);
    assert.equal(result.body.stats.totalAgents, 1);
    assert.equal(result.body.stats.totalCompactions, 1);
    assert.equal(result.body.orchestration.sessionCount, 1);
    assert.equal(result.body.orchestration.mainCount, 1);
    assert.deepEqual(result.body.toolFlow.toolCounts.map((row) => row.tool_name).sort(), [
      "Bash",
      "Edit",
    ]);
    assert.deepEqual(result.body.toolFlow.transitions, [
      { source: "Bash", target: "Edit", value: 1 },
    ]);
    assert.equal(result.body.modelDelegation.mainModels[0].model, "gpt-5.6-terra");
    assert.equal(result.body.modelDelegation.tokensByModel[0].input_tokens, 100);
    assert.equal(result.body.compaction.totalCompactions, 1);
    assert.equal(result.body.complexity[0].id, SESSION_ID);

    const claudeOnly = await requestJson("/api/workflows?providers=claude");
    assert.equal(claudeOnly.status, 200);
    assert.equal(claudeOnly.body.stats.totalSessions, 0);
  });

  it("allows Codex drill-ins and rejects a provider-mismatched request", async () => {
    const visible = await requestJson(`/api/workflows/session/${SESSION_ID}?providers=codex`);
    assert.equal(visible.status, 200);
    assert.equal(visible.body.tree.length, 1);
    assert.deepEqual(
      visible.body.toolTimeline.map((event) => event.tool_name),
      ["Bash", "Edit"]
    );

    const hidden = await requestJson(`/api/workflows/session/${SESSION_ID}?providers=claude`);
    assert.equal(hidden.status, 404);
  });
});
