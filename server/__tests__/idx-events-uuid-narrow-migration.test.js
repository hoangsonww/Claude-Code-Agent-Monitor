/**
 * @file Regression test for the idx_events_session_type_uuid narrowing
 * migration (PR #329 CodeRabbit review): `CREATE INDEX IF NOT EXISTS` in
 * server/db.js is a no-op against an installation that already has the OLDER,
 * broad version of this index (from before the `event_type IN ('RemoteToolEvent',
 * 'RemoteTurn')` predicate was added) -- without an explicit migration step,
 * such an installation would silently keep paying that index's full
 * per-installation cost forever, never picking up the narrowing fix.
 *
 * This simulates exactly that installation: an existing DB file whose
 * idx_events_session_type_uuid was built with the pre-narrowing definition,
 * created BEFORE server/db.js (and its migration) ever runs against it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const Database = require("better-sqlite3");

const STAMP = `idx-events-uuid-narrow-migration-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
const DB_FILE = path.join(TMP, "dashboard.db");

process.env.DASHBOARD_DB_PATH = DB_FILE;
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

// Build a minimal `events` table by hand with the OLD, broad index already in
// place -- BEFORE server/db.js is ever required against this file. Requiring
// db.js first would create the (already-narrowed) index fresh and never
// exercise the "an older, broader definition already exists" migration path.
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
  CREATE INDEX IF NOT EXISTS idx_events_session_type_uuid
  ON events(session_id, event_type, json_extract(data, '$.uuid'))
  WHERE json_valid(data) = 1;
`);
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

describe("idx_events_session_type_uuid narrowing migration on a pre-existing broad index", () => {
  it("server/db.js loads without throwing against the pre-existing broad index", () => {
    assert.doesNotThrow(() => {
      db = require("../db").db;
    });
  });

  it("the OLD broad index is replaced by the narrowed definition, not left as-is", () => {
    const row = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_events_session_type_uuid'"
      )
      .get();
    assert.ok(row, "idx_events_session_type_uuid must still exist");
    assert.match(
      row.sql,
      /event_type IN \('RemoteToolEvent', ?'RemoteTurn'\)/,
      "CREATE INDEX IF NOT EXISTS alone would have left the pre-existing broad index untouched -- this must have been explicitly dropped and rebuilt"
    );
  });
});
