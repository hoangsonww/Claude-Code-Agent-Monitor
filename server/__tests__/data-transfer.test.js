/**
 * @file Round-trip correctness for the full-dataset export/import (backup /
 * restore) in server/lib/data-transfer.js.
 *
 * Verifies the two product requirements:
 *   1. Export captures ALL user data (sessions, agents, events, token_usage,
 *      workflows, dashboard_runs, alert_rules, model_pricing) with a
 *      format/version stamp.
 *   2. Re-importing that export reproduces the data accurately, is idempotent
 *      (re-import skips existing sessions, never duplicates), and merges cleanly
 *      when consolidating another machine's sessions into an existing DB.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-data-transfer-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  buildExportBundle,
  importExportBundle,
  EXPORT_FORMAT,
  EXPORT_VERSION,
} = require("../lib/data-transfer");

after(() => {
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

function seedSession(id, { events = 2 } = {}) {
  db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at, ended_at) VALUES (?,?,?,?,?,?,?)"
  ).run(
    id,
    `Session ${id}`,
    "completed",
    "/tmp/x",
    "claude-opus-4-8",
    "2026-06-01T00:00:00.000Z",
    "2026-06-01T01:00:00.000Z"
  );

  const mainId = `agent_main_${id}`;
  const subId = `agent_sub_${id}`;
  db.prepare(
    "INSERT INTO agents (id, session_id, name, type, status, started_at) VALUES (?,?,?,?,?,?)"
  ).run(mainId, id, "Main", "main", "completed", "2026-06-01T00:00:00.000Z");
  // Child references parent — exercises deferred-FK ordering on restore.
  db.prepare(
    "INSERT INTO agents (id, session_id, name, type, subagent_type, status, started_at, parent_agent_id) VALUES (?,?,?,?,?,?,?,?)"
  ).run(subId, id, "Sub", "subagent", "explorer", "completed", "2026-06-01T00:10:00.000Z", mainId);

  for (let i = 0; i < events; i++) {
    db.prepare(
      "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, created_at) VALUES (?,?,?,?,?,?)"
    ).run(id, mainId, "PostToolUse", "Bash", `evt ${i}`, `2026-06-01T00:0${i}:00.000Z`);
  }

  db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, baseline_input) VALUES (?,?,?,?,?)"
  ).run(id, "claude-opus-4-8", 1000, 500, 250);

  db.prepare(
    "INSERT INTO workflows (run_id, session_id, name, status, agent_count, total_tokens) VALUES (?,?,?,?,?,?)"
  ).run(`wf_${id}`, id, "wf", "completed", 2, 1500);
}

describe("data-transfer export/import round-trip", () => {
  before(() => {
    // Config-like rows (independent of sessions).
    db.prepare(
      "INSERT INTO dashboard_runs (id, session_id, mode, cwd, status) VALUES (?,?,?,?,?)"
    ).run("run_1", "S1", "headless", "/tmp/x", "completed");
    db.prepare("INSERT INTO alert_rules (id, name, rule_type, config) VALUES (?,?,?,?)").run(
      "rule_1",
      "My Rule",
      "inactivity",
      "{}"
    );
    stmts.upsertPricing.run("custom-model-*", "Custom", 3, 15, 0.3, 3.75, 6, 0, 0);

    seedSession("S1", { events: 3 });
    seedSession("S2", { events: 2 });
  });

  it("exports every table with a format/version stamp", () => {
    const bundle = buildExportBundle(db, stmts);
    assert.equal(bundle.format, EXPORT_FORMAT);
    assert.equal(bundle.version, EXPORT_VERSION);
    assert.ok(bundle.exported_at);
    assert.equal(bundle.sessions.length, 2);
    assert.equal(bundle.agents.length, 4);
    assert.equal(bundle.events.length, 5);
    assert.equal(bundle.token_usage.length, 2);
    assert.equal(bundle.workflows.length, 2);
    assert.ok(bundle.dashboard_runs.some((r) => r.id === "run_1"));
    assert.ok(bundle.alert_rules.some((r) => r.id === "rule_1"));
    assert.ok(bundle.model_pricing.some((p) => p.model_pattern === "custom-model-*"));
  });

  it("restores an exported bundle accurately into a fresh DB", () => {
    const bundle = JSON.parse(JSON.stringify(buildExportBundle(db, stmts)));

    // Simulate a fresh machine: wipe everything the bundle carries.
    db.exec(
      "DELETE FROM events; DELETE FROM token_usage; DELETE FROM workflows; DELETE FROM agents; DELETE FROM sessions; DELETE FROM dashboard_runs; DELETE FROM alert_rules; DELETE FROM model_pricing;"
    );

    const c = importExportBundle(db, bundle);
    assert.equal(c.sessions_imported, 2);
    assert.equal(c.sessions_skipped, 0);
    assert.equal(c.agents, 4);
    assert.equal(c.events, 5);
    assert.equal(c.token_usage, 2);
    assert.equal(c.workflows, 2);
    assert.equal(c.dashboard_runs, 1);
    assert.equal(c.alert_rules, 1);
    // model_pricing includes the seeded default rows plus our custom one; all
    // are restored into the wiped DB.
    assert.equal(c.model_pricing, bundle.model_pricing.length);
    assert.ok(
      db.prepare("SELECT 1 FROM model_pricing WHERE model_pattern = 'custom-model-*'").get()
    );

    // Accuracy: token totals (incl. baseline) restored verbatim.
    const tu = db.prepare("SELECT * FROM token_usage WHERE session_id = 'S1'").get();
    assert.equal(tu.input_tokens, 1000);
    assert.equal(tu.baseline_input, 250);

    // Parent/child agent link survived deferred-FK restore.
    const sub = db.prepare("SELECT parent_agent_id FROM agents WHERE id = 'agent_sub_S1'").get();
    assert.equal(sub.parent_agent_id, "agent_main_S1");
  });

  it("is idempotent — re-importing skips existing sessions, no duplicate events", () => {
    const bundle = buildExportBundle(db, stmts);
    const eventsBefore = db.prepare("SELECT COUNT(*) c FROM events").get().c;

    const c = importExportBundle(db, bundle);
    assert.equal(c.sessions_imported, 0);
    assert.equal(c.sessions_skipped, 2);
    assert.equal(c.events, 0);

    const eventsAfter = db.prepare("SELECT COUNT(*) c FROM events").get().c;
    assert.equal(eventsAfter, eventsBefore, "events must not be duplicated on re-import");
  });

  it("merges a second machine's sessions without touching existing ones", () => {
    // Current DB has S1, S2. Build a bundle that adds a brand-new session S3.
    const bundle = buildExportBundle(db, stmts);
    seedSession("S3", { events: 4 });
    const merged = buildExportBundle(db, stmts);
    // Roll the seeded S3 back out so the DB looks like the "target" (S1,S2)
    // and the bundle is the "source" (S1,S2,S3).
    db.exec(
      "DELETE FROM events WHERE session_id='S3'; DELETE FROM token_usage WHERE session_id='S3'; DELETE FROM workflows WHERE session_id='S3'; DELETE FROM agents WHERE session_id='S3'; DELETE FROM sessions WHERE id='S3';"
    );
    void bundle;

    const c = importExportBundle(db, merged);
    assert.equal(c.sessions_imported, 1, "only the new session imports");
    assert.equal(c.sessions_skipped, 2, "existing sessions are skipped");
    assert.equal(db.prepare("SELECT COUNT(*) c FROM sessions").get().c, 3);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM events WHERE session_id='S3'").get().c, 4);
  });

  it("rejects a non-export object", () => {
    assert.throws(() => importExportBundle(db, { foo: "bar" }), /recognizable dashboard export/);
    assert.throws(() => importExportBundle(db, { format: "something-else" }), /Unrecognized/);
  });
});
