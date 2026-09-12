/**
 * @file Regression test for idx_events_session_type_uuid — a partial index on
 * events(session_id, event_type, json_extract(data,'$.uuid')) guarded by
 * `WHERE json_valid(data) = 1` (see server/db.js, near idx_events_session_type).
 *
 * SQLite evaluates an indexed expression against every existing row when the
 * index is CREATEd. This table has legacy rows whose `data` predates the
 * JSON-events convention and is not valid JSON, so a naive (non-partial)
 * version of this index would throw "malformed JSON" and prevent the server
 * from starting on any installation carrying such rows. This test simulates
 * exactly that installation: an existing DB file with a non-JSON `data` row
 * already present, created BEFORE server/db.js (and its migrations/index
 * creation) ever runs against it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const Database = require("better-sqlite3");

const STAMP = `events-uuid-index-legacy-json-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const DB_FILE = path.join(TMP, "dashboard.db");

process.env.DASHBOARD_DB_PATH = DB_FILE;
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

// Simulate a pre-existing installation: build a minimal `events` table by hand
// with better-sqlite3 directly and insert a legacy non-JSON row BEFORE
// server/db.js is ever required against this file. Requiring db.js first
// would apply migrations/create the index against a clean, empty table and
// never exercise the "malformed JSON at index-build time" case at all.
const legacyDb = new Database(DB_FILE);
legacyDb.pragma("journal_mode = WAL");
legacyDb.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    event_type TEXT NOT NULL,
    tool_name TEXT,
    summary TEXT,
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);
legacyDb
  .prepare(
    `INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  .run("legacy-session-1", null, "ToolEvent", "Bash", "legacy pre-JSON row", "not json at all");
legacyDb.close();

let db;

after(() => {
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("idx_events_session_type_uuid on a DB with legacy non-JSON events.data", () => {
  it("server/db.js loads without throwing despite the legacy non-JSON row", () => {
    // This is the actual regression: a naive (non-partial) index would throw
    // "malformed JSON" here and abort startup.
    assert.doesNotThrow(() => {
      db = require("../db").db;
    });
  });

  it("creates the partial index", () => {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_events_session_type_uuid'"
      )
      .get();
    assert.ok(row, "idx_events_session_type_uuid must exist after db.js runs its migrations");
  });

  it("a dedup-style query against events.data finds a valid-JSON row and does not throw, alongside the coexisting legacy row", () => {
    db.prepare(
      `INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      "legacy-session-1",
      null,
      "ToolEvent",
      "Bash",
      "well-formed row",
      JSON.stringify({ uuid: "abc-123", tool_name: "Bash" })
    );

    let found;
    assert.doesNotThrow(() => {
      found = db
        .prepare(
          `SELECT 1 FROM events
           WHERE session_id = ?
             AND event_type = ?
             AND json_valid(data) = 1
             AND json_extract(data, '$.uuid') = ?`
        )
        .get("legacy-session-1", "ToolEvent", "abc-123");
    });
    assert.ok(
      found,
      "dedup query must find the valid-JSON row despite the coexisting legacy non-JSON row"
    );
  });

  it("index predicate is narrowed to RemoteToolEvent/RemoteTurn (PR #329 follow-up)", () => {
    const sql = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_events_session_type_uuid'"
      )
      .get().sql;
    assert.match(sql, /event_type IN \('RemoteToolEvent', ?'RemoteTurn'\)/);
  });

  it("a dedup query repeating the event_type IN (...) list literally uses the partial index, not a full scan", () => {
    // Mirrors hooks.js's dedupEventStmt exactly. The maintainer's own review
    // measured that a bare `event_type = ?` parameter does NOT let SQLite prove
    // the query's WHERE implies the narrowed index's WHERE, so it falls back to
    // a full events scan -- verified here against EXPLAIN QUERY PLAN, not
    // assumed from the claim alone.
    const withInList = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT 1 FROM events
         WHERE session_id = ? AND event_type = ? AND json_valid(data) = 1
           AND event_type IN ('RemoteToolEvent', 'RemoteTurn')
           AND json_extract(data, '$.uuid') = ? LIMIT 1`
      )
      .all("s", "RemoteToolEvent", "u")
      .map((r) => r.detail)
      .join(" | ");
    assert.match(withInList, /USING INDEX idx_events_session_type_uuid/);

    const withoutInList = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT 1 FROM events
         WHERE session_id = ? AND event_type = ? AND json_valid(data) = 1
           AND json_extract(data, '$.uuid') = ? LIMIT 1`
      )
      .all("s", "RemoteToolEvent", "u")
      .map((r) => r.detail)
      .join(" | ");
    assert.doesNotMatch(
      withoutInList,
      /USING INDEX idx_events_session_type_uuid/,
      "without the literal IN-list this must NOT use the narrowed index -- confirms the IN-list repetition is load-bearing, not decorative"
    );
  });
});
