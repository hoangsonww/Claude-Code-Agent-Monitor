/**
 * @file Verifies cost HTTP reads preserve scoped accounting and remain outside
 * the HTTP thread during slow real SQL; worker failures reach Express unchanged.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-cost-responsive-"));
process.env.NODE_ENV = "test";
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { ReadonlyQuery } = require("../lib/readonly-query");
const { createApp, startServer } = require("../index");
const { db } = require("../db");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

it("cost reads preserve provider/source scopes, baselines, missing-rate coverage and local dates", async () => {
  db.exec(`INSERT INTO sessions(id,name,provider,source,started_at) VALUES
    ('local','local','claude','local','2026-08-31T23:30:00Z'),
    ('box','box','codex','src_box','2026-09-01T12:00:00Z');
    INSERT INTO model_pricing(model_pattern,display_name,input_per_mtok,output_per_mtok,
      intro_output_per_mtok,intro_until) VALUES ('test-claude','test',2,10,5,'2026-08-31');
    INSERT INTO gpt_model_pricing(model_pattern,display_name,short_input_per_mtok,short_output_per_mtok)
      VALUES('test-codex','test',3,20);
    INSERT INTO token_usage(session_id,model,input_tokens,output_tokens,baseline_output) VALUES
      ('local','test-claude',1000000,1000000,1000000),
      ('box','test-codex',1000000,1000000,0),
      ('box','unpriced-fixture',0,20,0);`);
  const server = await startServer(createApp(), 0);
  const base = `http://127.0.0.1:${server.address().port}/api/pricing/cost`;
  try {
    for (const [query, expected] of [
      ["", 35],
      ["?sources=local", 12],
      ["?providers=codex", 23],
      ["?sources=local&providers=codex", 0],
      ["?sources=local,src_box&providers=claude,codex", 35],
      ["?sources=local&tz_offset=-120", 22],
    ]) {
      const res = await fetch(base + query);
      assert.equal(res.status, 200);
      const row = await res.json();
      assert.equal(row.total_cost, expected);
      assert.equal(
        Math.round(row.daily_costs.reduce((sum, d) => sum + d.cost, 0) * 10000) / 10000,
        expected
      );
      assert.equal(
        row.unpriced_models.length,
        query.includes("sources=local") && !query.includes("src_box") ? 0 : 1
      );
    }
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

it(
  "health responds while real cost SQL is busy and later SQL errors are reported",
  { timeout: 30000 },
  async () => {
    const original = ReadonlyQuery.prototype.read;
    let signalStarted,
      fail = false;
    const started = new Promise((resolve) => {
      signalStarted = resolve;
    });
    ReadonlyQuery.prototype.read = function (query, generation) {
      if (query.op !== "cost") return original.call(this, query, generation);
      this.once("started", signalStarted);
      const sql = fail
        ? "SELECT * FROM missing_cost_table"
        : `SELECT * FROM (WITH RECURSIVE n(x) AS
      (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<5000000),
      pause AS MATERIALIZED (SELECT MAX(x) AS done FROM n)
      SELECT daily.* FROM (${query.sql}) daily CROSS JOIN pause WHERE pause.done=5000000)`;
      return original.call(this, { ...query, sql }, generation);
    };
    const server = await startServer(createApp(), 0);
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      let done = false;
      const cost = fetch(base + "/api/pricing/cost").then(async (res) => {
        assert.equal(res.status, 200);
        const row = await res.json();
        done = true;
        return row;
      });
      await started;
      assert.equal((await fetch(base + "/api/health")).status, 200);
      assert.equal(done, false, "health must not wait for cost SQL");
      assert.equal((await cost).total_cost, 35);
      fail = true;
      const failed = await fetch(base + "/api/pricing/cost");
      assert.equal(failed.status, 500);
      assert.deepEqual(await failed.json(), {
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    } finally {
      ReadonlyQuery.prototype.read = original;
      server.close();
      server.closeAllConnections();
      await once(server, "close");
    }
  }
);
