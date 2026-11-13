/**
 * @file agy-support.test.js
 * @description Verifies Google Antigravity CLI (agy) ingestion: sessions are
 * created with provider "antigravity", name/cwd come from agy's conversation
 * index, prompts and tool calls become events, token totals are recorded,
 * re-syncing an unchanged transcript is a no-op, appended steps import
 * incrementally, a missing index still yields a usable session, live events
 * carry the full row shape, quiet sessions age out, index renames advance the
 * importer-owned name, unreadable transcripts are retried, transcripts render in
 * the reader, and Gemini usage never falls into Claude pricing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { before, after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(os.tmpdir(), `agy-support-${Date.now()}-${process.pid}`);
const AGY_HOME = path.join(ROOT, "antigravity");
const CONV_ID = "11111111-2222-4333-8444-555555555555";
const NO_INDEX_ID = "66666666-7777-4888-9999-000000000000";
const WORKSPACE = path.join(ROOT, "my-project");

process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(ROOT, "data");
process.env.DASHBOARD_AGY_HOME = AGY_HOME;
process.env.DASHBOARD_AGY_SYNC_MS = "0";
process.env.DASHBOARD_CURSOR_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

function transcriptPath(id) {
  return path.join(AGY_HOME, "brain", id, ".system_generated", "logs", "transcript.jsonl");
}

function writeTranscript(id, rows) {
  const file = transcriptPath(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

function appendTranscript(id, rows) {
  fs.appendFileSync(transcriptPath(id), `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`);
}

const STEPS = [
  {
    type: "USER_INPUT",
    content: "Add a dark theme to the settings page",
    created_at: "2026-11-11T10:00:00Z",
    step_index: 0,
  },
  {
    type: "PLANNER_RESPONSE",
    content: "I'll look at the settings page first.",
    created_at: "2026-11-11T10:00:05Z",
    step_index: 1,
    input_tokens: 1200,
    output_tokens: 80,
    cache_read_tokens: 300,
    tool_calls: [{ name: "view_file", args: { path: "settings.tsx" } }],
  },
  { type: "GENERIC", content: "file contents", created_at: "2026-11-11T10:00:06Z", step_index: 2 },
  {
    type: "PLANNER_RESPONSE",
    content: "Done.",
    created_at: "2026-11-11T10:00:20Z",
    step_index: 3,
    input_tokens: 1500,
    output_tokens: 120,
    cache_read_tokens: 0,
    tool_calls: [
      { name: "edit_file", args: {} },
      { name: "run_command", args: {} },
    ],
  },
];

let dbModule;
let ingest;

before(() => {
  fs.mkdirSync(AGY_HOME, { recursive: true });
  writeTranscript(CONV_ID, STEPS);
  writeTranscript(NO_INDEX_ID, [
    {
      type: "USER_INPUT",
      content: "Explain this stack trace please",
      created_at: "2026-11-11T09:00:00Z",
    },
  ]);
  const Database = require("../compat-sqlite");
  const idx = new Database(path.join(AGY_HOME, "conversation_summaries.db"));
  idx.exec(`CREATE TABLE conversation_summaries (
    conversation_id TEXT PRIMARY KEY, title TEXT, workspace_uris TEXT, status TEXT,
    last_modified_time TEXT, agent_name TEXT)`);
  idx
    .prepare("INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      CONV_ID,
      "Dark theme for settings",
      JSON.stringify([pathToFileURL(WORKSPACE).href]),
      "CASCADE_RUN_STATUS_IDLE",
      "2026-11-11 10:00:20.123",
      ""
    );
  idx.close();
  dbModule = require("../db");
  ingest = require("../lib/agy-ingest");
});

after(() => {
  try {
    dbModule?.db?.close();
  } catch {
    /* ignore */
  }
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("Antigravity (agy) ingestion", () => {
  it("parses agy timestamps and workspace URIs", () => {
    assert.equal(ingest.agyTimeToIso("2026-11-11 10:00:20.123"), "2026-11-11T10:00:20.123Z");
    assert.equal(ingest.agyTimeToIso("2026-11-11T10:00:05Z"), "2026-11-11T10:00:05.000Z");
    assert.equal(ingest.agyTimeToIso(""), null);
    assert.equal(ingest.workspaceToCwd(JSON.stringify([pathToFileURL(WORKSPACE).href])), WORKSPACE);
    assert.equal(ingest.workspaceToCwd("not json"), null);
  });

  it("imports a conversation as an antigravity session with events and tokens", async () => {
    const results = await ingest.syncAgySessions(dbModule);
    assert.equal(results.length, 2);
    const s = dbModule.stmts.getSession.get(CONV_ID);
    assert.equal(s.provider, "antigravity");
    assert.equal(s.name, "Dark theme for settings");
    assert.equal(s.cwd, WORKSPACE);
    assert.equal(s.status, "completed");
    const events = dbModule.stmts.listEventsBySession.all(CONV_ID);
    assert.equal(events.filter((e) => e.event_type === "UserPromptSubmit").length, 1);
    assert.deepEqual(
      events
        .filter((e) => e.event_type === "PostToolUse")
        .map((e) => e.tool_name)
        .sort(),
      ["edit_file", "run_command", "view_file"]
    );
    const tok = dbModule.db
      .prepare(
        "SELECT SUM(input_tokens) i, SUM(output_tokens) o, SUM(cache_read_tokens) c FROM token_usage WHERE session_id = ?"
      )
      .get(CONV_ID);
    assert.deepEqual([tok.i, tok.o, tok.c], [2700, 200, 300]);
    const main = dbModule.stmts.getAgent.get(`${CONV_ID}-main`);
    assert.equal(main.name, "Antigravity · Dark theme for settings");
  });

  it("is a no-op when the transcript did not change", async () => {
    const before = dbModule.stmts.listEventsBySession.all(CONV_ID).length;
    const results = await ingest.syncAgySessions(dbModule);
    assert.equal(results.length, 0);
    assert.equal(dbModule.stmts.listEventsBySession.all(CONV_ID).length, before);
  });

  it("imports only new steps when the conversation grows", async () => {
    appendTranscript(CONV_ID, [
      { type: "USER_INPUT", content: "Also add a toggle", created_at: "2026-11-11T10:05:00Z" },
      {
        type: "PLANNER_RESPONSE",
        content: "Added.",
        created_at: "2026-11-11T10:05:10Z",
        input_tokens: 100,
        output_tokens: 10,
        cache_read_tokens: 0,
        tool_calls: [{ name: "edit_file", args: {} }],
      },
    ]);
    await ingest.syncAgySessions(dbModule);
    const events = dbModule.stmts.listEventsBySession.all(CONV_ID);
    assert.equal(events.filter((e) => e.event_type === "UserPromptSubmit").length, 2);
    assert.equal(events.filter((e) => e.event_type === "PostToolUse").length, 4);
    const tok = dbModule.db
      .prepare("SELECT SUM(input_tokens) i FROM token_usage WHERE session_id = ?")
      .get(CONV_ID);
    assert.equal(tok.i, 2800);
  });

  it("still builds a session when the conversation is missing from the index", () => {
    const s = dbModule.stmts.getSession.get(NO_INDEX_ID);
    assert.equal(s.provider, "antigravity");
    assert.equal(s.name, "Explain this stack trace please");
    assert.equal(s.cwd, null);
  });

  it("accepts antigravity in the provider filters", () => {
    const { parseProviders, parseExactProvider } = require("../lib/provider-filter");
    assert.deepEqual(parseProviders({ query: { providers: "antigravity" } }), ["antigravity"]);
    assert.equal(parseExactProvider({ query: { provider: "antigravity" } }), "antigravity");
  });
});

describe("Antigravity (agy) review follow-ups", () => {
  const RECENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const BROKEN_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

  function setIndexTitle(id, title) {
    const Database = require("../compat-sqlite");
    const idx = new Database(path.join(AGY_HOME, "conversation_summaries.db"));
    idx
      .prepare(
        "INSERT INTO conversation_summaries (conversation_id, title) VALUES (?, ?) ON CONFLICT(conversation_id) DO UPDATE SET title = excluded.title"
      )
      .run(id, title);
    idx.close();
  }

  it("broadcasts new events with the full DashboardEvent shape", async () => {
    appendTranscript(CONV_ID, [
      { type: "USER_INPUT", content: "One more thing", created_at: "2026-11-11T10:06:00Z" },
    ]);
    const seen = [];
    await ingest.syncAgySessions(dbModule, { onSession: (r) => seen.push(...r.events) });
    assert.equal(seen.length, 1);
    const [event] = seen;
    assert.equal(typeof event.id, "number");
    assert.equal(event.session_id, CONV_ID);
    assert.equal(event.agent_id, `${CONV_ID}-main`);
    assert.equal(event.event_type, "UserPromptSubmit");
    assert.equal(event.tool_name, null);
    assert.equal(event.summary, "One more thing");
    assert.equal(event.created_at, "2026-11-11T10:06:00.000Z");
  });

  it("ages a quiet active session to completed without a transcript change", async () => {
    writeTranscript(RECENT_ID, [
      { type: "USER_INPUT", content: "Still working", created_at: new Date().toISOString() },
    ]);
    await ingest.syncAgySessions(dbModule);
    assert.equal(dbModule.stmts.getSession.get(RECENT_ID).status, "active");
    assert.equal(dbModule.stmts.getAgent.get(`${RECENT_ID}-main`).status, "working");

    // The transcript stays byte-identical; only the clock moves on. Simulate
    // that by backdating the stored last activity past the 10-minute window.
    const old = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    dbModule.db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(old, RECENT_ID);
    const realNow = Date.now;
    Date.now = () => realNow() + 20 * 60 * 1000;
    try {
      const results = await ingest.syncAgySessions(dbModule);
      assert.ok(results.some((r) => r.session?.id === RECENT_ID));
    } finally {
      Date.now = realNow;
    }
    assert.equal(dbModule.stmts.getSession.get(RECENT_ID).status, "completed");
    assert.equal(dbModule.stmts.getAgent.get(`${RECENT_ID}-main`).status, "completed");
    assert.equal(
      dbModule.stmts.listEventsBySession
        .all(RECENT_ID)
        .filter((e) => e.event_type === "UserPromptSubmit").length,
      1
    );
  });

  it("follows index renames and keeps tracking them, but never a manual name", async () => {
    setIndexTitle(CONV_ID, "Dark theme v2");
    await ingest.syncAgySessions(dbModule);
    assert.equal(dbModule.stmts.getSession.get(CONV_ID).name, "Dark theme v2");
    setIndexTitle(CONV_ID, "Dark theme v3");
    await ingest.syncAgySessions(dbModule);
    assert.equal(dbModule.stmts.getSession.get(CONV_ID).name, "Dark theme v3");
    assert.equal(
      dbModule.stmts.getAgent.get(`${CONV_ID}-main`).name,
      "Antigravity · Dark theme v3"
    );

    dbModule.db.prepare("UPDATE sessions SET name = ? WHERE id = ?").run("My own name", CONV_ID);
    setIndexTitle(CONV_ID, "Dark theme v4");
    await ingest.syncAgySessions(dbModule);
    assert.equal(dbModule.stmts.getSession.get(CONV_ID).name, "My own name");
  });

  it("reports an unreadable transcript and does not import it", async () => {
    // A directory at the transcript path: stat succeeds, read fails.
    fs.mkdirSync(transcriptPath(BROKEN_ID), { recursive: true });
    const errors = [];
    try {
      await ingest.syncAgySessions(dbModule, { onError: (id) => errors.push(id) });
    } finally {
      fs.rmSync(path.join(AGY_HOME, "brain", BROKEN_ID), { recursive: true, force: true });
    }
    assert.deepEqual(errors, [BROKEN_ID]);
    assert.equal(dbModule.stmts.getSession.get(BROKEN_ID), undefined);
  });

  it("renders agy transcript steps as reader messages", () => {
    const { parseAgyMessage, cleanAgyUserText } = require("../lib/agy-transcript");
    assert.equal(cleanAgyUserText("<USER_REQUEST>\nFix the bug\n</USER_REQUEST>"), "Fix the bug");
    assert.equal(
      cleanAgyUserText("Explain <USER_REQUEST> in this file"),
      "Explain <USER_REQUEST> in this file"
    );
    const user = parseAgyMessage(
      { type: "USER_INPUT", content: "<USER_REQUEST>\nFix it\n</USER_REQUEST>", created_at: "t" },
      1
    );
    assert.deepEqual(user.content, [{ type: "text", text: "Fix it" }]);
    assert.equal(user.sender, "user");
    const reply = parseAgyMessage(
      {
        type: "PLANNER_RESPONSE",
        thinking: "plan",
        content: "On it",
        tool_calls: [{ name: "run_command", args: { CommandLine: '"dir"', toolSummary: '"x"' } }],
      },
      2
    );
    assert.deepEqual(
      reply.content.map((b) => b.type),
      ["thinking", "text", "tool_use"]
    );
    assert.deepEqual(reply.content[2].input, { CommandLine: "dir" });
    const output = parseAgyMessage({ type: "GENERIC", content: "exit 0" }, 3);
    assert.equal(output.sender, "tool");
    assert.equal(output.content[0].type, "tool_result");
    assert.equal(parseAgyMessage({ type: "CHECKPOINT", content: "x" }, 4), null);
  });

  it("serves an imported conversation through the transcript routes", async () => {
    const express = require("express");
    const app = express();
    app.use("/api/sessions", require("../routes/sessions"));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/sessions/${CONV_ID}`;
      const list = await (await fetch(`${base}/transcripts`)).json();
      assert.equal(list.transcripts[0].name, "Antigravity");
      const body = await (await fetch(`${base}/transcript?limit=200`)).json();
      const senders = body.messages.map((m) => m.sender);
      assert.ok(senders.includes("user"));
      assert.ok(senders.includes("assistant"));
      assert.ok(senders.includes("tool"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("keeps Antigravity usage out of Claude pricing", () => {
    const { calculateProviderCost } = require("../routes/pricing");
    const catchAll = [
      {
        model_pattern: "%",
        input_per_mtok: 5,
        output_per_mtok: 25,
        cache_read_per_mtok: 0.5,
        cache_write_per_mtok: 6.25,
      },
    ];
    const row = {
      provider: "antigravity",
      model: "gemini",
      speed: "standard",
      inference_geo: "global",
      service_tier: "standard",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cache_write_1h_tokens: 0,
      web_search_requests: 0,
      web_fetch_requests: 0,
      code_execution_requests: 0,
    };
    const result = calculateProviderCost([row], catchAll, [], []);
    assert.equal(result.total_cost, 0);
    assert.equal(result.breakdown.length, 0);
    assert.equal(result.unpriced_models.length, 0);
    // Sanity: the same row as Claude usage would have been priced.
    assert.ok(
      calculateProviderCost([{ ...row, provider: "claude" }], catchAll, [], []).total_cost > 0
    );
  });
});
