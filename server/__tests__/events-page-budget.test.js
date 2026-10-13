/**
 * @file Verifies that an event page too large for the read-only worker's heap is
 * still served in full through the real HTTP route, and that the worker keeps
 * serving other reads afterwards.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-events-budget-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { createApp, startServer } = require("../index");
const { db } = require("../db");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

it("a full page of 64 KB hook bodies beyond the worker heap is served in full", async () => {
  db.exec("INSERT INTO sessions(id,name,provider,source) VALUES ('big','big','claude','local')");
  const insert = db.prepare(
    "INSERT INTO events(session_id,event_type,summary,data,created_at) VALUES('big','PostToolUse',?,?,?)"
  );
  // 500 rows of 64 KB (~32 MB) is more than the 32 MB worker heap holds as a .all() page.
  const bodies = [];
  db.transaction(() => {
    for (let i = 0; i < 500; i++) {
      const data = JSON.stringify({ i, output: `${i}`.padEnd(64 * 1024, "x") });
      bodies.push(data);
      insert.run(`row ${i}`, data, new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString());
    }
  })();
  const server = await startServer(createApp(), 0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/events`;
    const response = await fetch(`${base}?session_id=big&limit=500`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["events", "limit", "offset", "total"]);
    assert.equal(body.total, 500);
    assert.deepEqual(
      body.events.map((event) => event.data),
      bodies.slice().reverse()
    );
    const small = await fetch(`${base}?session_id=big&limit=2`);
    assert.equal(small.status, 200);
    assert.equal((await small.json()).events.length, 2);
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});
