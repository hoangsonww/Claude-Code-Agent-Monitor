/**
 * @file Verifies HTTP reader failures retain status codes and safe JSON errors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-api-errors-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
const { ReadonlyQuery } = require("../lib/readonly-query");
const { createApp, startServer } = require("../index");
const { db } = require("../db");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
for (const status of [500, 503]) {
  it(`reader ${status} uses safe JSON instead of HTML or a stack`, async () => {
    const original = ReadonlyQuery.prototype.read;
    ReadonlyQuery.prototype.read = () =>
      Promise.reject(
        Object.assign(new Error("private-path /secret/file and SQL table"), { status })
      );
    const server = await startServer(createApp(), 0);
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stats`);
      assert.equal(response.status, status);
      assert.match(response.headers.get("content-type"), /application\/json/);
      const body = await response.json();
      assert.equal(body.error.code, status === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR");
      assert.doesNotMatch(JSON.stringify(body), /secret|SQL table|stack|DOCTYPE/i);
    } finally {
      ReadonlyQuery.prototype.read = original;
      server.close();
      server.closeAllConnections();
      await once(server, "close");
    }
  });
}
