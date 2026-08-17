/**
 * @file Integration tests for task-progress summaries on the Sessions list
 * and full owner-attributed snapshots on Session Detail.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-task-progress-api-"));
const TEST_DB = path.join(ROOT, "test.db");
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
process.env.CLAUDE_CONFIG_DIR = path.join(ROOT, ".claude");

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let baseUrl;

function requestJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "GET",
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      }
    );
    request.on("error", reject);
    request.end();
  });
}

function insertSession(id, provider, transcriptPath) {
  stmts.insertSession.run(id, id, "active", ROOT, "test-model", null);
  db.prepare("UPDATE sessions SET provider = ?, transcript_path = ? WHERE id = ?").run(
    provider,
    transcriptPath,
    id
  );
  stmts.insertAgent.run(`${id}-main`, id, "Main Agent", "main", null, "working", null, null, null);
}

function writeJsonl(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

before(async () => {
  const claudeId = "task-progress-claude";
  const claudeTranscript = path.join(
    process.env.CLAUDE_CONFIG_DIR,
    "projects",
    ROOT.replace(/[^a-zA-Z0-9]/g, "-"),
    `${claudeId}.jsonl`
  );
  writeJsonl(claudeTranscript, [
    {
      type: "assistant",
      timestamp: "2026-08-07T10:00:00.000Z",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "todo-1",
            name: "TodoWrite",
            input: {
              todos: [
                { content: "Inspect code", status: "completed" },
                { content: "Implement tracker", status: "in_progress" },
              ],
            },
          },
        ],
      },
    },
  ]);
  insertSession(claudeId, "claude", claudeTranscript);

  const codexId = "task-progress-codex";
  const codexTranscript = path.join(ROOT, "codex-rollout.jsonl");
  writeJsonl(codexTranscript, [
    {
      type: "response_item",
      timestamp: "2026-08-07T11:00:00.000Z",
      payload: {
        type: "function_call",
        name: "update_plan",
        arguments: JSON.stringify({
          plan: [
            { step: "Plan implementation", status: "completed" },
            { step: "Run tests", status: "pending" },
          ],
        }),
      },
    },
  ]);
  insertSession(codexId, "codex", codexTranscript);

  insertSession("task-progress-empty", "claude", null);

  const staleId = "task-progress-stopped-without-final-update";
  const staleTranscript = path.join(ROOT, `${staleId}.jsonl`);
  writeJsonl(staleTranscript, [
    {
      type: "assistant",
      timestamp: "2026-08-07T12:00:00.000Z",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "stale-todo",
            name: "TodoWrite",
            input: {
              todos: [{ content: "Forgotten API work", status: "in_progress" }],
            },
          },
        ],
      },
    },
  ]);
  insertSession(staleId, "claude", staleTranscript);
  stmts.insertEventAt.run(
    staleId,
    `${staleId}-main`,
    "Stop",
    null,
    "Turn completed",
    JSON.stringify({ session_id: staleId }),
    "2026-08-07T12:01:00.000Z"
  );

  const newPromptId = "task-progress-new-prompt-without-tracker";
  const newPromptTranscript = path.join(ROOT, `${newPromptId}.jsonl`);
  writeJsonl(newPromptTranscript, [
    {
      type: "assistant",
      timestamp: "2026-08-07T13:00:00.000Z",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "completed-todo",
            name: "TodoWrite",
            input: {
              todos: [{ content: "Finished previous work", status: "completed" }],
            },
          },
        ],
      },
    },
  ]);
  insertSession(newPromptId, "claude", newPromptTranscript);
  stmts.insertEventAt.run(
    newPromptId,
    `${newPromptId}-main`,
    "UserPromptSubmit",
    null,
    "User prompt submitted",
    JSON.stringify({ session_id: newPromptId }),
    "2026-08-07T13:01:00.000Z"
  );

  const app = createApp();
  server = await startServer(app, 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("session task progress API", () => {
  it("includes compact summaries only for sessions with emitted task state", async () => {
    const response = await requestJson("/api/sessions?limit=20&include_task_progress=true");

    assert.equal(response.status, 200);
    const claude = response.body.sessions.find((session) => session.id === "task-progress-claude");
    const codex = response.body.sessions.find((session) => session.id === "task-progress-codex");
    const empty = response.body.sessions.find((session) => session.id === "task-progress-empty");

    assert.equal(claude.todo_summary.total, 2);
    assert.equal(claude.todo_summary.completed, 1);
    assert.equal(claude.todo_summary.activeText, "Implement tracker");
    assert.equal(claude.todo_summary.previewItems.length, 2);
    assert.equal(codex.todo_summary.percentComplete, 50);
    assert.equal(empty.todo_summary, null);
  });

  it("keeps task summaries opt-in on ordinary session list calls", async () => {
    const response = await requestJson("/api/sessions?limit=20");

    assert.equal(response.status, 200);
    const claude = response.body.sessions.find((session) => session.id === "task-progress-claude");
    assert.equal(claude.todo_summary, undefined);
  });

  it("includes the full task snapshot on session detail", async () => {
    const response = await requestJson("/api/sessions/task-progress-claude");

    assert.equal(response.status, 200);
    assert.equal(response.body.session.todo_snapshot.total, 2);
    assert.equal(response.body.session.todo_snapshot.items.length, 2);
    assert.equal(response.body.session.todo_snapshot.items[1].status, "in_progress");
    assert.equal(response.body.session.todo_snapshot.ownerBreakdown[0].agentType, "main");
  });

  it("returns a null snapshot when the session exposed no task state", async () => {
    const response = await requestJson("/api/sessions/task-progress-empty");

    assert.equal(response.status, 200);
    assert.equal(response.body.session.todo_snapshot, null);
  });

  it("removes unfinished progress on the persisted Stop event before transcript markers flush", async () => {
    const listResponse = await requestJson("/api/sessions?limit=20&include_task_progress=true");
    const stale = listResponse.body.sessions.find(
      (session) => session.id === "task-progress-stopped-without-final-update"
    );
    const detailResponse = await requestJson(
      "/api/sessions/task-progress-stopped-without-final-update"
    );

    assert.equal(listResponse.status, 200);
    assert.equal(stale.todo_summary, null);
    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.session.todo_snapshot, null);
  });

  it("removes completed history as soon as a new prompt starts without a tracker", async () => {
    const listResponse = await requestJson("/api/sessions?limit=20&include_task_progress=true");
    const latest = listResponse.body.sessions.find(
      (session) => session.id === "task-progress-new-prompt-without-tracker"
    );
    const detailResponse = await requestJson(
      "/api/sessions/task-progress-new-prompt-without-tracker"
    );

    assert.equal(listResponse.status, 200);
    assert.equal(latest.todo_summary, null);
    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.session.todo_snapshot, null);
  });

  it("caps task-progress enrichment on large list requests", async () => {
    for (let index = 0; index < 105; index++) {
      insertSession(`task-progress-cap-${String(index).padStart(3, "0")}`, "claude", null);
    }

    const response = await requestJson("/api/sessions?limit=10000&include_task_progress=true");

    assert.equal(response.status, 200);
    assert.equal(
      response.body.sessions.filter((session) =>
        Object.prototype.hasOwnProperty.call(session, "todo_summary")
      ).length,
      100
    );
  });
});
