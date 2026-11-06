/**
 * @file cursor-state-db.test.js
 * @description Verifies Cursor chat titles are read from a fixture state.vscdb
 * (found, missing, absent file, wrong schema, corrupt, locked), that ingestion
 * prefers them over the short-id placeholder, and that sync repairs rows
 * imported earlier with the placeholder name.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
// better-sqlite3 is optional; build fixtures with the same fallback server/db.js uses.
let Database;
try {
  Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch {
  Database = require("../compat-sqlite");
}

const ROOT = path.join(os.tmpdir(), `cursor-state-db-${Date.now()}-${process.pid}`);
const CURSOR_HOME = path.join(ROOT, ".cursor");
const STATE_DB = path.join(ROOT, "state.vscdb");
const TITLED_ID = "3eb9ff9b-4e11-486e-b678-7ac26820ea22";
const UNTITLED_ID = "4fc0aa0c-5f22-497f-8789-8bd37931fb33";
const REPAIR_ID = "5ad1bb1d-6033-4a80-989a-9ce48a42ac44";
const GENERATED_TITLE_ID = "6be2cc2e-7144-4b91-a8e3-ae816f757b55";
const LEGACY_CUSTOM_ID = "7cf3dd3f-8254-4c92-b9c2-bf927ef86c66";

fs.mkdirSync(ROOT, { recursive: true });
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(ROOT, "data");
process.env.DASHBOARD_CURSOR_HOME = CURSOR_HOME;
process.env.DASHBOARD_CURSOR_STATE_DB = STATE_DB;

const dbModule = require("../db");
const { createCursorTitleLookup, getCursorStateDbPath } = require("../lib/cursor-state-db");
const { enrichCursorSession, syncCursorSessions } = require("../lib/cursor-ingest");

function writeStateDb(filePath, composers) {
  fs.rmSync(filePath, { force: true });
  const db = new Database(filePath);
  db.exec("CREATE TABLE cursorDiskKV (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)");
  const insert = db.prepare("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)");
  for (const [id, composer] of Object.entries(composers)) {
    insert.run(`composerData:${id}`, JSON.stringify({ _v: 18, composerId: id, ...composer }));
  }
  db.close();
}

function writeTranscript(sessionId) {
  const transcript = path.join(
    CURSOR_HOME,
    "projects",
    "Users-example-project",
    "agent-transcripts",
    sessionId,
    `${sessionId}.jsonl`
  );
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(
    transcript,
    `${JSON.stringify({ role: "assistant", message: { content: [{ type: "text", text: "ok" }] } })}\n`
  );
  const stale = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(transcript, stale, stale);
  return transcript;
}

function writeChat(sessionId, { title, prompts }) {
  const chatDir = path.join(CURSOR_HOME, "chats", "workspace", sessionId);
  fs.mkdirSync(chatDir, { recursive: true });
  fs.writeFileSync(
    path.join(chatDir, "meta.json"),
    JSON.stringify({
      schemaVersion: 1,
      createdAtMs: Date.now() - 60_000,
      updatedAtMs: Date.now(),
      hasConversation: true,
      ...(title ? { title } : {}),
    })
  );
  fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify(prompts));
  return chatDir;
}

after(() => {
  dbModule.db.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("Cursor state.vscdb title lookup", () => {
  it("honors DASHBOARD_CURSOR_STATE_DB", () => {
    assert.equal(getCursorStateDbPath(), path.resolve(STATE_DB));
  });

  it("expands a leading ~ in DASHBOARD_CURSOR_STATE_DB", () => {
    process.env.DASHBOARD_CURSOR_STATE_DB = "~/cursor/state.vscdb";
    try {
      assert.equal(getCursorStateDbPath(), path.join(os.homedir(), "cursor", "state.vscdb"));
    } finally {
      process.env.DASHBOARD_CURSOR_STATE_DB = STATE_DB;
    }
  });

  it("returns the chat name when present and null when it is missing", () => {
    writeStateDb(STATE_DB, {
      [TITLED_ID]: { name: "Nexus1 model serving test" },
      [UNTITLED_ID]: { text: "" },
    });
    const lookup = createCursorTitleLookup(STATE_DB);
    try {
      assert.equal(lookup.title(TITLED_ID), "Nexus1 model serving test");
      assert.equal(lookup.title(UNTITLED_ID), null);
      assert.equal(lookup.title("00000000-0000-0000-0000-000000000000"), null);
      assert.equal(lookup.title("../escape"), null);
    } finally {
      lookup.close();
    }
  });

  it("opens the store read-only and never creates it", () => {
    writeStateDb(STATE_DB, { [TITLED_ID]: { name: "Read only" } });
    const before = fs.statSync(STATE_DB).mtimeMs;
    const lookup = createCursorTitleLookup(STATE_DB);
    assert.equal(lookup.title(TITLED_ID), "Read only");
    lookup.close();
    assert.equal(fs.statSync(STATE_DB).mtimeMs, before);

    const missing = path.join(ROOT, "missing", "state.vscdb");
    const absent = createCursorTitleLookup(missing);
    assert.equal(absent.title(TITLED_ID), null);
    absent.close();
    assert.equal(fs.existsSync(missing), false);
  });

  it("returns null for an unexpected schema or a corrupt file", () => {
    const wrongSchema = path.join(ROOT, "wrong-schema.vscdb");
    const db = new Database(wrongSchema);
    db.exec("CREATE TABLE ItemTable (key TEXT, value BLOB)");
    db.close();
    const wrong = createCursorTitleLookup(wrongSchema);
    assert.equal(wrong.title(TITLED_ID), null);
    wrong.close();

    const corrupt = path.join(ROOT, "corrupt.vscdb");
    fs.writeFileSync(corrupt, "not a sqlite database at all, just some bytes".repeat(100));
    const broken = createCursorTitleLookup(corrupt);
    assert.equal(broken.title(TITLED_ID), null);
    broken.close();
  });

  it("gives up quickly on a locked store and stays disabled for the pass", () => {
    const locked = path.join(ROOT, "locked.vscdb");
    writeStateDb(locked, { [TITLED_ID]: { name: "Locked" } });
    const writer = new Database(locked);
    writer.exec("BEGIN EXCLUSIVE");
    const lookup = createCursorTitleLookup(locked);
    try {
      const started = Date.now();
      assert.equal(lookup.title(TITLED_ID), null);
      assert.ok(Date.now() - started < 2000, "lookup must not block on Cursor's lock");
      writer.exec("ROLLBACK");
      assert.equal(lookup.title(TITLED_ID), null);
    } finally {
      lookup.close();
      writer.close();
    }
    const nextPass = createCursorTitleLookup(locked);
    assert.equal(nextPass.title(TITLED_ID), "Locked");
    nextPass.close();
  });
});

describe("Cursor ingestion with state.vscdb titles", () => {
  it("names a transcript-only session from state.vscdb, else the short id", () => {
    writeStateDb(STATE_DB, { [TITLED_ID]: { name: "Nexus1 model serving test" } });
    const lookup = createCursorTitleLookup(STATE_DB);
    try {
      const titled = enrichCursorSession(dbModule, writeTranscript(TITLED_ID), {
        sessionId: TITLED_ID,
        chatDir: null,
        cursorTitle: lookup.title,
      });
      assert.equal(titled.session.name, "Nexus1 model serving test");
      assert.equal(
        dbModule.stmts.getAgent.get(`${TITLED_ID}-main`).name,
        "Cursor · Nexus1 model serving test"
      );

      const untitled = enrichCursorSession(dbModule, writeTranscript(UNTITLED_ID), {
        sessionId: UNTITLED_ID,
        chatDir: null,
        cursorTitle: lookup.title,
      });
      assert.equal(untitled.session.name, `Cursor session ${UNTITLED_ID.slice(0, 8)}`);
    } finally {
      lookup.close();
    }
  });

  it("keeps the short-id fallback when state.vscdb is missing", async () => {
    process.env.DASHBOARD_CURSOR_STATE_DB = path.join(ROOT, "missing.vscdb");
    try {
      const transcript = writeTranscript(REPAIR_ID);
      const placeholder = enrichCursorSession(dbModule, transcript, {
        sessionId: REPAIR_ID,
        chatDir: null,
      });
      assert.equal(placeholder.session.name, `Cursor session ${REPAIR_ID.slice(0, 8)}`);
      await syncCursorSessions(dbModule);
      assert.equal(
        dbModule.stmts.getSession.get(REPAIR_ID).name,
        `Cursor session ${REPAIR_ID.slice(0, 8)}`
      );
    } finally {
      process.env.DASHBOARD_CURSOR_STATE_DB = STATE_DB;
    }
  });

  it("repairs previously imported placeholder names on the next sync", async () => {
    writeStateDb(STATE_DB, { [REPAIR_ID]: { name: "Repaired title" } });
    // A new file fingerprint makes the sync re-enrich, as a fresh boot does.
    const transcript = writeTranscript(REPAIR_ID);
    fs.appendFileSync(transcript, "\n");
    await syncCursorSessions(dbModule);
    assert.equal(dbModule.stmts.getSession.get(REPAIR_ID).name, "Repaired title");
    assert.equal(dbModule.stmts.getAgent.get(`${REPAIR_ID}-main`).name, "Cursor · Repaired title");
  });

  it("replaces a prompt fallback when Cursor generates its native title later", () => {
    const transcript = writeTranscript(GENERATED_TITLE_ID);
    const chatDir = writeChat(GENERATED_TITLE_ID, { prompts: ["hi"] });
    const initial = enrichCursorSession(dbModule, transcript, {
      sessionId: GENERATED_TITLE_ID,
      chatDir,
    });
    assert.equal(initial.session.name, "hi");
    assert.equal(JSON.parse(initial.session.metadata).cursor_title_source, "prompt");

    writeChat(GENERATED_TITLE_ID, { title: "Friendly Chat", prompts: ["hi"] });
    const titled = enrichCursorSession(dbModule, transcript, {
      sessionId: GENERATED_TITLE_ID,
      chatDir,
    });
    assert.equal(titled.session.name, "Friendly Chat");
    assert.equal(JSON.parse(titled.session.metadata).cursor_title_source, "native");
    assert.equal(JSON.parse(titled.session.metadata).cursor_ingested_name, "Friendly Chat");
    assert.equal(
      dbModule.stmts.getAgent.get(`${GENERATED_TITLE_ID}-main`).name,
      "Cursor · Friendly Chat"
    );

    dbModule.stmts.updateSession.run("Dashboard custom name", null, null, null, GENERATED_TITLE_ID);
    writeChat(GENERATED_TITLE_ID, { title: "Regenerated native title", prompts: ["hi"] });
    const custom = enrichCursorSession(dbModule, transcript, {
      sessionId: GENERATED_TITLE_ID,
      chatDir,
    });
    assert.equal(custom.session.name, "Dashboard custom name");
  });

  it("does not infer that a legacy name matching the first prompt is ingestion-owned", () => {
    const transcript = writeTranscript(LEGACY_CUSTOM_ID);
    const chatDir = writeChat(LEGACY_CUSTOM_ID, { prompts: ["hi"] });
    enrichCursorSession(dbModule, transcript, { sessionId: LEGACY_CUSTOM_ID, chatDir });
    dbModule.db
      .prepare("UPDATE sessions SET name = ?, metadata = ? WHERE id = ?")
      .run("hi", JSON.stringify({ cursor: true }), LEGACY_CUSTOM_ID);

    writeChat(LEGACY_CUSTOM_ID, { title: "Generated after the rename", prompts: ["hi"] });
    const preserved = enrichCursorSession(dbModule, transcript, {
      sessionId: LEGACY_CUSTOM_ID,
      chatDir,
    });
    assert.equal(preserved.session.name, "hi");
  });

  it("preserves a manual rename even when it resembles a generated placeholder", () => {
    const transcript = writeTranscript(LEGACY_CUSTOM_ID);
    const chatDir = writeChat(LEGACY_CUSTOM_ID, { prompts: ["original prompt"] });
    enrichCursorSession(dbModule, transcript, { sessionId: LEGACY_CUSTOM_ID, chatDir });
    const manualName = `Cursor session ${LEGACY_CUSTOM_ID.slice(0, 8)}`;
    dbModule.db
      .prepare("UPDATE sessions SET name = ?, metadata = ? WHERE id = ?")
      .run(
        manualName,
        JSON.stringify({ cursor: true, cursor_title_source: "manual" }),
        LEGACY_CUSTOM_ID
      );

    writeChat(LEGACY_CUSTOM_ID, {
      title: "Generated title must not win",
      prompts: ["original prompt"],
    });
    const preserved = enrichCursorSession(dbModule, transcript, {
      sessionId: LEGACY_CUSTOM_ID,
      chatDir,
    });
    assert.equal(preserved.session.name, manualName);
  });
});
