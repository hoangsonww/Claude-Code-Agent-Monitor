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
let Database;
try {
  Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch {
  Database = require("../compat-sqlite");
}

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-resume-cost-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = ROOT;
process.env.DASHBOARD_CURSOR_HOME = path.join(ROOT, ".cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const { createApp, startServer } = require("../index");
const { calculateCursorCost } = require("../routes/pricing");
const { enrichCursorSession } = require("../lib/cursor-ingest");
const { resolveCursorStoreModel } = require("../lib/cursor-store-transcript");
const { reconcileHistoricalCursorSessions } = require("../lib/cursor-session-identity");
const { repairHistoricalCursorData } = require("../lib/cursor-turn-usage");
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
    const rename = await fetch(`${base}/api/sessions/${provisional}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "My resumed conversation" }),
    });
    assert.equal(rename.status, 200);
    await postHook("Stop", {
      conversation_id: canonical,
      generation_id: generation,
      model: "grok-4.7",
      transcript_path: transcript,
      status: "completed",
    });

    assert.equal(stmts.getSession.get(provisional), undefined);
    assert.equal(stmts.getSession.get(canonical).provider, "cursor");
    assert.equal(stmts.getSession.get(canonical).name, "My resumed conversation");
    assert.equal(stmts.listEventsBySession.all(canonical).length, 2);
    const response = await fetch(`${base}/api/sessions/${provisional}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.session.id, canonical);
    const aliasedEvents = await (
      await fetch(`${base}/api/events?session_id=${provisional}`)
    ).json();
    assert.equal(aliasedEvents.total, 2);
    const aliasedAgents = await (
      await fetch(`${base}/api/agents?session_id=${provisional}`)
    ).json();
    assert.ok(aliasedAgents.agents.some((agent) => agent.session_id === canonical));

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

    createStore(provisional, "cursor-grok-4.5-high", "Alias-native reply");
    const conversation = await fetch(`${base}/api/sessions/${provisional}/transcript`);
    assert.equal(conversation.status, 200);
    const conversationBody = await conversation.json();
    const text = conversationBody.messages
      .flatMap((message) => message.content || [])
      .map((block) => block.text)
      .filter(Boolean);
    assert.ok(text.includes("follow up"));
    assert.ok(text.includes("Alias-native reply"));

    await postHook("afterAgentResponse", {
      conversation_id: canonical,
      generation_id: "generation-alias-store-model",
      model: "default",
      input_tokens: 20,
      output_tokens: 2,
      text: "Alias-native reply",
    });
    assert.ok(
      stmts.getTokensBySession
        .all(canonical)
        .some((row) => row.model === "grok-4.5-high" && row.output_tokens === 2)
    );

    await postHook("PreToolUse", {
      conversation_id: provisional,
      generation_id: "generation-known-alias",
      model: "grok-4.7",
      tool_name: "Read",
      tool_use_id: "known-alias-call",
    });
    assert.equal(stmts.getSession.get(provisional), undefined);
    assert.ok(
      stmts.listEventsBySession
        .all(canonical)
        .some((event) => event.tool_name === "Read" && event.event_type === "PreToolUse")
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

  it("keeps complete generation counts when a later hook omits fields", async () => {
    const sessionId = "cursor-partial-usage";
    const generation = "generation-partial-usage";
    await postHook("afterAgentResponse", {
      conversation_id: sessionId,
      generation_id: generation,
      model: "grok-4.7",
      input_tokens: 100,
      output_tokens: 10,
      cache_read_tokens: 20,
      cache_write_tokens: 0,
    });
    await postHook("Stop", {
      conversation_id: sessionId,
      generation_id: generation,
      model: "grok-4.7",
      input_tokens: 120,
      status: "completed",
    });
    const [usage] = stmts.getTokensBySession.all(sessionId);
    assert.equal(usage.input_tokens, 100);
    assert.equal(usage.output_tokens, 10);
    assert.equal(usage.cache_read_tokens, 20);
  });

  it("rejects invalid counts and scopes generation-less usage to each session", async () => {
    await postHook("afterAgentResponse", {
      conversation_id: "cursor-invalid-count",
      generation_id: "generation-invalid-count",
      model: "grok-4.7",
      input_tokens: -1,
      output_tokens: 10,
    });
    assert.deepEqual(stmts.getTokensBySession.all("cursor-invalid-count"), []);

    for (const [sessionId, input] of [
      ["cursor-ungrouped-a", 40],
      ["cursor-ungrouped-b", 70],
    ]) {
      await postHook("afterAgentResponse", {
        conversation_id: sessionId,
        model: "grok-4.7",
        input_tokens: input,
        output_tokens: 5,
      });
    }
    assert.equal(stmts.getTokensBySession.all("cursor-ungrouped-a")[0].input_tokens, 40);
    assert.equal(stmts.getTokensBySession.all("cursor-ungrouped-b")[0].input_tokens, 70);
  });

  it("claims an exact receipt before it can overwrite a newer usage snapshot", async () => {
    const sessionId = "cursor-replayed-response";
    const generation = "generation-replayed-response";
    const older = {
      conversation_id: sessionId,
      generation_id: generation,
      model: "grok-4.7",
      input_tokens: 100,
      output_tokens: 10,
    };
    await postHook("afterAgentResponse", older);
    await postHook("Stop", {
      ...older,
      input_tokens: 200,
      output_tokens: 20,
      status: "completed",
    });
    await postHook("afterAgentResponse", older);
    const [usage] = stmts.getTokensBySession.all(sessionId);
    assert.equal(usage.input_tokens, 200);
    assert.equal(usage.output_tokens, 20);
  });

  it("does not guess a native-store model when response text does not match", async () => {
    const sessionId = "cursor-model-mismatch";
    createStore(sessionId, "cursor-grok-4.5-high", "A later response");
    await postHook("afterAgentResponse", {
      conversation_id: sessionId,
      generation_id: "generation-model-concrete",
      model: "grok-4.7",
      input_tokens: 20,
      output_tokens: 4,
    });
    await postHook("afterAgentResponse", {
      conversation_id: sessionId,
      generation_id: "generation-model-mismatch",
      model: "default",
      input_tokens: 10,
      output_tokens: 2,
      text: "An earlier delayed response",
    });
    assert.ok(
      stmts.getTokensBySession
        .all(sessionId)
        .some((row) => row.model === "default" && row.output_tokens === 2)
    );
  });

  it("prefers the current native store and rejects short suffix-only model matches", () => {
    const current = "cursor-model-current";
    const alias = "cursor-model-alias";
    const suffixOnly = "cursor-model-short-suffix";
    createStore(current, "cursor-grok-4.7", "OK");
    createStore(alias, "cursor-grok-4.5-high", "OK");
    createStore(suffixOnly, "cursor-grok-4.5-high", "Earlier response: OK");

    assert.equal(resolveCursorStoreModel([current, alias], "OK"), "grok-4.7");
    assert.equal(resolveCursorStoreModel([suffixOnly], "OK"), "");
  });

  it("anchors untimed prompts and preserves attachment placeholders", async () => {
    const sessionId = "cursor-untimed-prompts";
    const transcript = path.join(
      process.env.DASHBOARD_CURSOR_HOME,
      "projects",
      "workspace",
      "agent-transcripts",
      sessionId,
      `${sessionId}.jsonl`
    );
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    const entry = (role, text) =>
      JSON.stringify({ role, message: { content: [{ type: "text", text }] } });
    fs.writeFileSync(
      transcript,
      [
        entry("user", "<user_query>first prompt</user_query>"),
        entry("assistant", "first answer"),
        entry("user", "<user_query>Summarize the report</user_query>"),
        entry("assistant", "report summary"),
      ].join("\n")
    );
    const chatDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    fs.mkdirSync(chatDir, { recursive: true });
    fs.writeFileSync(
      path.join(chatDir, "prompt_history.json"),
      JSON.stringify([
        "first prompt",
        "first prompt",
        "middle pending prompt",
        "[Image #1] Summarize the report",
      ])
    );
    await postHook("Stop", {
      conversation_id: sessionId,
      generation_id: "generation-untimed-prompts",
      model: "grok-4.7",
      transcript_path: transcript,
      status: "completed",
    });

    const body = await (await fetch(`${base}/api/sessions/${sessionId}/transcript`)).json();
    const text = body.messages
      .flatMap((message) => message.content || [])
      .map((block) => block.text)
      .filter(Boolean);
    assert.equal(text.filter((entry) => entry === "first prompt").length, 2);
    assert.ok(text.indexOf("first answer") < text.lastIndexOf("first prompt"));
    assert.ok(text.lastIndexOf("first prompt") < text.indexOf("middle pending prompt"));
    assert.ok(
      text.indexOf("middle pending prompt") < text.indexOf("[Image #1] Summarize the report")
    );
    assert.ok(text.includes("Summarize the report"));
  });

  it("merges newer JSONL replies with store detail and keeps short pending prompts", async () => {
    const sessionId = "cursor-merged-conversation";
    const transcript = path.join(
      process.env.DASHBOARD_CURSOR_HOME,
      "projects",
      "workspace",
      "agent-transcripts",
      sessionId,
      `${sessionId}.jsonl`
    );
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    const entry = (role, text) =>
      JSON.stringify({ role, message: { content: [{ type: "text", text }] } });
    fs.writeFileSync(
      transcript,
      [
        entry("user", "<user_query>hello</user_query>"),
        entry("assistant", "Stored response"),
        entry("user", "<user_query>hi there</user_query>"),
        entry("assistant", "Newest JSONL response"),
      ].join("\n")
    );
    createStore(sessionId, "cursor-grok-4.5-high", "Stored response");
    const chatDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify(["hi"]));
    await postHook("Stop", {
      conversation_id: sessionId,
      generation_id: "generation-merged-conversation",
      model: "grok-4.5-high",
      transcript_path: transcript,
      status: "completed",
    });

    const response = await fetch(`${base}/api/sessions/${sessionId}/transcript`);
    const body = await response.json();
    const text = body.messages
      .flatMap((message) => message.content || [])
      .map((block) => block.text)
      .filter(Boolean);
    assert.ok(text.includes("Stored response"));
    assert.ok(text.includes("Newest JSONL response"));
    assert.ok(text.includes("hi"));
    assert.ok(text.includes("hi there"));
    assert.ok(text.indexOf("hi") < text.indexOf("Newest JSONL response"));
  });

  it("deduplicates matching stops across bounded repair ranges", async () => {
    const sessionId = "cursor-repair-ranges";
    const generationId = "generation-repair-ranges";
    stmts.insertSession.run(sessionId, "Repair ranges", "completed", null, null, "{}");
    db.prepare("UPDATE sessions SET provider = 'cursor' WHERE id = ?").run(sessionId);
    const insert = stmts.insertEvent;
    const duplicate = JSON.stringify({
      generation_id: generationId,
      status: "completed",
      input_tokens: 10,
      output_tokens: 2,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      model: "grok-4.7",
    });
    insert.run(sessionId, null, "Stop", null, null, duplicate);
    for (let index = 0; index < 600; index++) {
      insert.run(sessionId, null, "PreToolUse", null, null, "{}");
    }
    insert.run(
      sessionId,
      null,
      "Stop",
      null,
      null,
      JSON.stringify({
        generation_id: generationId,
        status: "completed",
        input_tokens: 10,
        output_tokens: 2,
        model: "grok-4.7",
      })
    );
    db.prepare("DELETE FROM cursor_repair_state WHERE repair_key = ?").run("resume-usage-v2");
    db.prepare("DELETE FROM cursor_repair_progress WHERE repair_key = ?").run("resume-usage-v2");

    await repairHistoricalCursorData({ db, stmts });

    const remaining = db
      .prepare(
        `SELECT COUNT(*) AS count FROM events
         WHERE session_id = ? AND event_type = 'Stop'
           AND json_extract(data, '$.generation_id') = ?`
      )
      .get(sessionId, generationId).count;
    assert.equal(remaining, 1);
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

  it("preserves chained user commands and reports non-object hook files", () => {
    const hooksPath = path.join(process.env.DASHBOARD_CURSOR_HOME, "hooks.json");
    const chained = `node "${path.resolve(__dirname, "../../scripts/hook-handler.js").replace(/\\/g, "/")}" Stop && keep-running`;
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ version: 1, hooks: { stop: [{ command: chained }] } })
    );
    assert.equal(installCursorHooks({ silent: true }).ok, true);
    const config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    assert.ok(config.hooks.stop.some((entry) => entry.command === chained));

    fs.writeFileSync(hooksPath, "null");
    const invalid = installCursorHooks({ silent: true });
    assert.equal(invalid.ok, false);
    assert.match(invalid.output[0], /expected a JSON object/);
  });
});
