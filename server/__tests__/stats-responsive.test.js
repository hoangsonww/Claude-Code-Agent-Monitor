/**
 * @file Verifies the real application's health and source routes remain usable
 * while /api/stats counts a large SQLite view in its read-only worker.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-responsive-test-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { ReadonlyQuery } = require("../lib/readonly-query");
const { createApp, startServer } = require("../index");
const { db } = require("../db");

it(
  "actual health and remote-source endpoints finish before a slow stats read",
  { timeout: 30000 },
  async () => {
    db.exec(`DROP TABLE events;
    CREATE VIEW events AS WITH RECURSIVE counter(n) AS (
      VALUES(1) UNION ALL SELECT n + 1 FROM counter WHERE n < 5000000
    ) SELECT n AS id, NULL AS session_id, datetime('now') AS created_at FROM counter;`);
    let resolveStarted;
    const started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    const original = ReadonlyQuery.prototype.read;
    ReadonlyQuery.prototype.read = function (query, generation) {
      if (query.op === "stats") this.once("started", resolveStarted);
      return original.call(this, query, generation);
    };
    let statsDone = false;
    let server;
    try {
      server = await startServer(createApp(), 0);
      const base = `http://127.0.0.1:${server.address().port}`;
      const stats = fetch(base + "/api/stats")
        .then((res) => res.json())
        .then((row) => {
          statsDone = true;
          return row;
        });
      await started;
      const [health, sources] = await Promise.all([
        fetch(base + "/api/health"),
        fetch(base + "/api/remote-sources"),
      ]);
      assert.equal(health.status, 200);
      assert.equal(sources.status, 200);
      assert.equal(statsDone, false, "light routes must not wait for the stats scan");
      assert.equal((await stats).total_events, 5000000);
    } finally {
      ReadonlyQuery.prototype.read = original;
      if (server) {
        server.close();
        server.closeAllConnections();
        await once(server, "close");
      }
      db.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
);
