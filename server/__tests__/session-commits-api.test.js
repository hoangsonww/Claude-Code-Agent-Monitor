/**
 * @file Integration tests for the session→commit routes (GET /:id/commits and
 * /:id/commits/:hash). These assert the route wiring, the scope/404 guards, and
 * the silent-degradation contract WITHOUT a real repository: a session whose
 * `cwd` is empty short-circuits to `repo:false` before any git call, so the
 * suite spawns no git (see no-mutating-git-in-tests.test.js). The commit logic
 * itself is unit-tested in session-commits.test.js with an injected runner.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-commits-api-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
process.env.CLAUDE_CONFIG_DIR = path.join(ROOT, ".claude");

const { createApp, startServer } = require("../index");
const { stmts } = require("../db");

let server;
let baseUrl;

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const request = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET" },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body: body ? JSON.parse(body) : null })
        );
      }
    );
    request.on("error", reject);
    request.end();
  });
}

before(async () => {
  server = await startServer(createApp(), 0);
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
  // A session with NO cwd: the route returns repo:false without shelling out.
  stmts.insertSession.run("sess-nocwd", "No CWD", "active", null, "test-model", null);
});

after(() => {
  if (server) server.close();
  try {
    fs.rmSync(ROOT, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

describe("GET /api/sessions/:id/commits", () => {
  it("404s for an unknown session", async () => {
    const res = await getJson("/api/sessions/does-not-exist/commits");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("returns repo:false (200) for a session with no working directory", async () => {
    const res = await getJson("/api/sessions/sess-nocwd/commits");
    assert.equal(res.status, 200);
    assert.equal(res.body.repo, false);
    assert.deepEqual(res.body.commits, []);
    assert.equal(res.body.truncated, false);
    assert.equal(res.body.session_id, "sess-nocwd");
  });
});

describe("GET /api/sessions/:id/commits/:hash", () => {
  it("404s for an unknown session", async () => {
    const res = await getJson("/api/sessions/does-not-exist/commits/abc1234");
    assert.equal(res.status, 404);
  });

  it("404s when the commit can't be read (no repo for this session)", async () => {
    const res = await getJson("/api/sessions/sess-nocwd/commits/abc1234");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
});
