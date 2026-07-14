/**
 * @file Verifies the legacy `agents_new` rebuild in db.js (triggered when the
 * agents table's stored CHECK constraint still contains the old 'idle'
 * status) preserves the workflow_run_id/workflow_phase columns added by the
 * earlier workflow migration, plus awaiting_reason, and recreates
 * idx_agents_workflow.
 *
 * Regression coverage for a bug flagged on PR #228: the rebuild's CREATE
 * TABLE agents_new / INSERT INTO agents_new SELECT / index-recreate block was
 * written before the workflow_run_id + workflow_phase columns existed, so it
 * silently dropped them (and idx_agents_workflow) for any DB old enough to
 * still carry the legacy CHECK. Because the workflow_run_id/workflow_phase
 * prepared statements are compiled at module load time, right after the
 * migrations run, this crashed startup for such legacy DBs.
 *
 * @author Claude Fable 5 <noreply@anthropic.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const Database = require("better-sqlite3");

let TEST_DB;

before(() => {
  TEST_DB = path.join(os.tmpdir(), `dashboard-agents-legacy-${Date.now()}-${process.pid}.db`);
  process.env.DASHBOARD_DB_PATH = TEST_DB;

  // Hand-build a pre-workflow, pre-awaiting-reason legacy DB: a sessions table
  // just rich enough to satisfy the agents FK, and an agents table using the
  // old 3/5-status CHECK (still containing 'idle') with none of the columns
  // added by later migrations (workflow_run_id, workflow_phase, updated_at,
  // awaiting_input_since, awaiting_reason). This is the exact shape the
  // 'idle' CHECK detector at db.js:~731 is looking for.
  const raw = new Database(TEST_DB);
  raw.pragma("foreign_keys = OFF");
  raw.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','error','abandoned')),
      cwd TEXT,
      model TEXT,
      started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ended_at TEXT,
      metadata TEXT
    );

    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'main' CHECK(type IN ('main','subagent')),
      subagent_type TEXT,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','connected','working','completed','error')),
      task TEXT,
      current_tool TEXT,
      started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      ended_at TEXT,
      parent_agent_id TEXT,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);
  raw
    .prepare("INSERT INTO sessions (id, name, status, cwd, model) VALUES (?, ?, ?, ?, ?)")
    .run("s-legacy-1", "legacy session", "active", "/tmp/legacy-proj", "claude");
  raw
    .prepare(
      "INSERT INTO agents (id, session_id, name, type, status, task) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run("a-legacy-1", "s-legacy-1", "legacy main agent", "main", "idle", "legacy task");
  raw.close();
});

after(() => {
  try {
    delete require.cache[require.resolve("../db")];
  } catch {}
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {}
  }
});

describe("legacy agents_new rebuild (pre-workflow, pre-awaiting-reason DB)", () => {
  it("loads db.js against the legacy DB without throwing", () => {
    delete require.cache[require.resolve("../db")];
    assert.doesNotThrow(() => require("../db"));
  });

  it("adds workflow_run_id, workflow_phase and awaiting_reason to agents", () => {
    const { db } = require("../db");
    const cols = db.prepare("PRAGMA table_info(agents)").all();
    const names = cols.map((c) => c.name);
    for (const col of ["workflow_run_id", "workflow_phase", "awaiting_reason"]) {
      assert.ok(names.includes(col), `expected agents.${col}; got: ${names.join(",")}`);
    }
  });

  it("recreates idx_agents_workflow", () => {
    const { db } = require("../db");
    const idx = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_agents_workflow'"
      )
      .get();
    assert.ok(idx, "expected idx_agents_workflow to exist after the rebuild");
  });

  it("preserves the pre-existing agent row and remaps its status idle -> waiting", () => {
    const { db } = require("../db");
    const row = db.prepare("SELECT * FROM agents WHERE id = ?").get("a-legacy-1");
    assert.ok(row, "expected the legacy agent row to survive the rebuild");
    assert.equal(row.status, "waiting");
    assert.equal(row.session_id, "s-legacy-1");
    assert.equal(row.name, "legacy main agent");
    assert.equal(row.task, "legacy task");
    assert.equal(row.workflow_run_id, null);
    assert.equal(row.workflow_phase, null);
  });
});
