/**
 * @file agy-support.test.js
 * @description Verifies Google Antigravity CLI (agy) ingestion: sessions are
 * created with provider "antigravity", name/cwd come from agy's conversation
 * index, prompts and tool calls become events, token totals are recorded,
 * re-syncing an unchanged transcript is a no-op, appended steps import
 * incrementally, and a missing index still yields a usable session.
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
