/**
 * @file Regression tests for Cursor resumed-session correlation, completion
 * deduplication, native-store model resolution, token pricing, and hook install.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-resume-cost-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = ROOT;
process.env.DASHBOARD_CURSOR_HOME = path.join(ROOT, ".cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const { createApp, startServer } = require("../index");
const { calculateCursorCost } = require("../routes/pricing");
const { enrichCursorSession } = require("../lib/cursor-ingest");
const { reconcileHistoricalCursorSessions } = require("../lib/cursor-session-identity");
const { installCursorHooks } = require("../../scripts/install-cursor-hooks");

let server;
let base;

function hash(label) {
  return Buffer.from(label.padEnd(32, "0").slice(0, 32));
}

function createStore(sessionId, model, responseText) {
  const directory = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
  fs.mkdirSync(directory, { recursive: true });
  const store = new Database(path.join(directory, "store.db"));
  store.exec(
    "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB)"
  );
  const user = hash("cursor-user");
  const assistant = hash("cursor-assistant");
  const root = hash("cursor-root");
  const insert = store.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
  insert.run(
    user.toString("hex"),
    JSON.stringify({
      role: "user",
      content: [{ type: "text", text: "<user_query>hello</user_query>" }],
    })
  );
  insert.run(
    assistant.toString("hex"),
    JSON.stringify({
      role: "assistant",
      content: [
        { type: "reasoning", text: "", providerOptions: { cursor: { modelName: model } } },
        { type: "text", text: responseText },
      ],
    })
  );
  insert.run(
    root.toString("hex"),
    Buffer.concat([Buffer.from([0x0a, 0x20]), user, Buffer.from([0x0a, 0x20]), assistant])
  );
  store
    .prepare("INSERT INTO meta (key, value) VALUES ('0', ?)")
    .run(
      Buffer.from(JSON.stringify({ latestRootBlobId: root.toString("hex") }), "utf8").toString(
        "hex"
      )
    );
  store.close();
}

async function postHook(hookType, data) {
  const response = await fetch(`${base}/api/hooks/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hook_type: hookType, data }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

describe("Cursor resume and cost ingestion", () => {
  before(async () => {
    server = await startServer(createApp(), 0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it("merges a provisional /resume shell and resolves the old session URL", async () => {
    const provisional = "cursor-provisional";
    const canonical = "cursor-canonical";
    const generation = "generation-resume-1";
    const transcript = path.join(
      process.env.DASHBOARD_CURSOR_HOME,
      "projects",
      "workspace",
      "agent-transcripts",
      canonical,
      `${canonical}.jsonl`
    );
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, "");

    await postHook("PreToolUse", {
      conversation_id: provisional,
      generation_id: generation,
      model: "grok-4.7",
      tool_name: "Read",
      tool_use_id: "call-1",
    });
    await postHook("Stop", {
      conversation_id: canonical,
      generation_id: generation,
      model: "grok-4.7",
      transcript_path: transcript,
      status: "completed",
    });

    assert.equal(stmts.getSession.get(provisional), undefined);
    assert.equal(stmts.getSession.get(canonical).provider, "cursor");
    assert.equal(stmts.listEventsBySession.all(canonical).length, 2);
    const response = await fetch(`${base}/api/sessions/${provisional}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.session.id, canonical);

    const chatDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", provisional);
    fs.mkdirSync(chatDir, { recursive: true });
    fs.writeFileSync(
      path.join(chatDir, "meta.json"),
      JSON.stringify({ title: "Resumed shell", updatedAtMs: Date.now() })
    );
    fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify(["follow up"]));
    enrichCursorSession({ db, stmts }, null, { sessionId: provisional, chatDir });
    assert.equal(stmts.getSession.get(provisional), undefined);
    assert.equal(
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM events
           WHERE session_id = ? AND event_type = 'cursor_user_message'
             AND json_extract(data, '$.cursor_source_session_id') = ?`
        )
        .get(canonical, provisional).count,
      1
    );

    // Older builds could recreate a native chat row after the first merge.
    stmts.insertSession.run(provisional, "Recreated shell", "completed", null, null, "{}");
    stmts.insertAgent.run(
      `${provisional}-main`,
      provisional,
      "Cursor · Recreated shell",
      "main",
      null,
      "completed",
      null,
      null,
      "{}"
    );
    assert.equal(reconcileHistoricalCursorSessions(db), 1);
    assert.equal(stmts.getSession.get(provisional), undefined);
  });

  it("suppresses response events, deduplicates repeated stops, and prices the real model", async () => {
    const sessionId = "cursor-cost-session";
    const generation = "generation-cost-1";
    const responseText = "Ready when you are.";
    createStore(sessionId, "cursor-grok-4.5-high", responseText);
    const usage = {
      conversation_id: sessionId,
      generation_id: generation,
      model: "default",
      input_tokens: 28_743,
      output_tokens: 140,
      cache_read_tokens: 3_968,
      cache_write_tokens: 0,
    };
    const response = await postHook("afterAgentResponse", { ...usage, text: responseText });
    assert.equal(response.event, undefined);
    await postHook("stop", { ...usage, status: "completed" });
    const duplicate = await postHook("stop", { ...usage, status: "completed" });
    assert.equal(duplicate.event, undefined);

    const events = stmts.listEventsBySession.all(sessionId);
    assert.equal(events.filter((event) => event.event_type === "afterAgentResponse").length, 0);
    assert.equal(events.filter((event) => event.event_type === "Stop").length, 1);
    const rows = stmts.getTokensBySession.all(sessionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].model, "grok-4.5-high");
    assert.equal(rows[0].input_tokens, 24_775);
    assert.equal(rows[0].cache_read_tokens, 3_968);
    const cost = calculateCursorCost(
      rows.map((row) => ({ ...row, provider: "cursor" })),
      stmts.listCursorPricing.all()
    );
    assert.equal(cost.unpriced_models.length, 0);
    assert.equal(cost.total_cost, 0.0524);
  });

  it("uses the concrete model from same-generation tool hooks when the store is unreadable", async () => {
    const sessionId = "cursor-event-model";
    const generation = "generation-event-model";
    await postHook("PreToolUse", {
      conversation_id: sessionId,
      generation_id: generation,
      model: "grok-4.7",
      tool_name: "Read",
      tool_use_id: "event-model-tool",
    });
    await postHook("afterAgentResponse", {
      conversation_id: sessionId,
      generation_id: generation,
      model: "default",
      input_tokens: 100,
      output_tokens: 10,
      cache_read_tokens: 40,
      cache_write_tokens: 0,
      text: "No native store is available.",
    });

    const usage = stmts.getTokensBySession.all(sessionId);
    assert.equal(usage.length, 1);
    assert.equal(usage[0].model, "grok-4.7");
    assert.equal(usage[0].input_tokens, 60);
    assert.equal(usage[0].cache_read_tokens, 40);
  });

  it("installs one copy of each usage hook while preserving unrelated commands", () => {
    const hooksPath = path.join(process.env.DASHBOARD_CURSOR_HOME, "hooks.json");
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ version: 1, hooks: { stop: [{ command: "keep-me" }] } })
    );
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    const config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    assert.deepEqual(
      config.hooks.stop.filter((entry) => entry.command === "keep-me"),
      [{ command: "keep-me" }]
    );
    assert.equal(
      config.hooks.stop.filter((entry) => entry.command.includes("hook-handler.js")).length,
      1
    );
    assert.equal(
      config.hooks.afterAgentResponse.filter((entry) => entry.command.includes("hook-handler.js"))
        .length,
      1
    );
  });
});
