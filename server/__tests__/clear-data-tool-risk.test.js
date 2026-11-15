/**
 * @file Regression tests for scripts/clear-data.js and the Tool Risk Audit
 * index (#301). The derived tables (tool_risk_events/_signals/_state) are wiped
 * with foreign keys OFF, so their ON DELETE CASCADE never fires — the CLI must
 * clear them explicitly. Covers both cleanup paths: a full `--yes` wipe removes
 * every tool_risk_* row, while `--demo-only --yes` removes only the rows derived
 * from the deleted fixture sessions and leaves unrelated history and the scan
 * watermark (tool_risk_state) intact.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const TMP = path.join(os.tmpdir(), `clear-data-tool-risk-${Date.now()}-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");

const { db } = require("../db");

const SCRIPT = path.resolve(__dirname, "..", "..", "scripts", "clear-data.js");

// Fixture session ids must match FIXTURE_SESSION_IDS in scripts/clear-data.js.
const FIXTURE_ID = "demo-solo-0001-0001-0001-000000000001";
const KEEP_ID = "keep-session-0001-real-history";

const insertSession = db.prepare("INSERT INTO sessions (id, name, cwd) VALUES (?, ?, ?)");
const insertEvent = db.prepare(
  "INSERT INTO events (session_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);
const insertRiskEvent = db.prepare(
  `INSERT INTO tool_risk_events
     (event_id, session_id, agent_id, tool_name, created_at, max_severity, severity_rank, target, degraded)
   VALUES (?, ?, NULL, 'Bash', ?, 'critical', 4, ?, 0)`
);
const insertSignal = db.prepare(
  "INSERT INTO tool_risk_signals (event_id, signal, severity, rule, match, host) VALUES (?, ?, ?, ?, ?, ?)"
);

/** Seed one flagged tool call on `sessionId` and return its event id. */
function seedFlagged(sessionId, target) {
  const created = "2026-11-01T12:00:00.000Z";
  const eventId = Number(
    insertEvent.run(
      sessionId,
      "PreToolUse",
      "Bash",
      null,
      JSON.stringify({ command: target }),
      created
    ).lastInsertRowid
  );
  insertRiskEvent.run(eventId, sessionId, created, target);
  insertSignal.run(eventId, "destructive", "critical", "rm-rf", target, null);
  return eventId;
}

function count(table, where = "", ...params) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get(...params).c;
}

/** Run scripts/clear-data.js against the shared test database. */
function run(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const killer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code, out, err });
    });
  });
}

describe("clear-data.js wipes the derived Tool Risk Audit tables", () => {
  before(() => {
    db.pragma("foreign_keys = ON");
  });

  beforeEach(() => {
    db.pragma("foreign_keys = OFF");
    for (const t of [
      "tool_risk_signals",
      "tool_risk_events",
      "tool_risk_state",
      "events",
      "agents",
      "token_usage",
      "sessions",
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.pragma("foreign_keys = ON");
  });

  after(() => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("full --yes wipe removes every tool_risk_* row", async () => {
    insertSession.run(KEEP_ID, "Real work", "/home/dev/app");
    seedFlagged(KEEP_ID, "rm -rf /tmp/build");
    db.prepare("INSERT INTO tool_risk_state (key, value) VALUES ('last_event_id', '1')").run();

    assert.equal(count("tool_risk_events"), 1);
    assert.equal(count("tool_risk_signals"), 1);

    const { code } = await run("--yes");
    assert.equal(code, 0);

    assert.equal(count("tool_risk_events"), 0, "tool_risk_events");
    assert.equal(count("tool_risk_signals"), 0, "tool_risk_signals");
    assert.equal(count("tool_risk_state"), 0, "tool_risk_state");
  });

  it("--demo-only --yes clears only fixture-derived rows, keeping real history and the watermark", async () => {
    insertSession.run(FIXTURE_ID, "Demo fixture", "/home/dev/app");
    const fixtureEvent = seedFlagged(FIXTURE_ID, "rm -rf /demo");
    insertSession.run(KEEP_ID, "Real work", "/home/dev/app");
    const keepEvent = seedFlagged(KEEP_ID, "rm -rf /tmp/build");
    db.prepare("INSERT INTO tool_risk_state (key, value) VALUES ('last_event_id', '99')").run();
    db.prepare("INSERT INTO tool_risk_state (key, value) VALUES ('ruleset_version', '1')").run();

    const { code } = await run("--demo-only", "--yes");
    assert.equal(code, 0);

    // Fixture-derived rows are gone.
    assert.equal(
      count("tool_risk_events", "WHERE session_id = ?", FIXTURE_ID),
      0,
      "fixture events"
    );
    assert.equal(
      count("tool_risk_signals", "WHERE event_id = ?", fixtureEvent),
      0,
      "fixture signals"
    );

    // Unrelated history survives untouched.
    assert.equal(count("tool_risk_events", "WHERE session_id = ?", KEEP_ID), 1, "kept events");
    assert.equal(count("tool_risk_signals", "WHERE event_id = ?", keepEvent), 1, "kept signals");

    // The scan watermark is not reset by a demo-only cleanup.
    assert.equal(count("tool_risk_state"), 2, "tool_risk_state preserved");
    assert.equal(
      db.prepare("SELECT value FROM tool_risk_state WHERE key = 'last_event_id'").get().value,
      "99"
    );
  });
});
