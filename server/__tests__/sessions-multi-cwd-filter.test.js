/**
 * @file Integration tests for the Sessions API's repeatable `cwd` query filter.
 * Verifies that selecting multiple project directories is an OR filter while
 * preserving the existing single-directory behavior and result pagination.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const TEST_DB = path.join(os.tmpdir(), `ccam-sessions-cwd-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let baseUrl;

function requestJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "GET",
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      }
    );
    request.on("error", reject);
    request.end();
  });
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const [id, cwd] of [
    ["session-project-a", "/work/project-a"],
    ["session-project-b", "/work/project-b"],
    ["session-project-c", "/work/project-c"],
  ]) {
    stmts.createSession.run(id, id, "active", cwd, "claude-sonnet-4", null);
  }
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    // Already closed by a failed test setup.
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      // The database sidecar may not be created in every SQLite mode.
    }
  }
});

describe("GET /api/sessions?cwd=", () => {
  it("returns sessions from every repeated working-directory query value", async () => {
    const params = new URLSearchParams();
    params.append("cwd", "/work/project-a");
    params.append("cwd", "/work/project-c");
    params.set("limit", "10");

    const response = await requestJson(`/api/sessions?${params}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 2);
    assert.deepEqual(response.body.sessions.map((session) => session.id).sort(), [
      "session-project-a",
      "session-project-c",
    ]);
  });

  it("continues to accept one working-directory query value", async () => {
    const response = await requestJson("/api/sessions?cwd=%2Fwork%2Fproject-b&limit=10");

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.sessions[0].id, "session-project-b");
  });
});
