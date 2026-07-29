/**
 * @file Tests for the global Kanban Board monitor layout: the /api/monitors
 * route's GET/PUT CRUD, partial-patch behavior, and input validation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

// Isolate the DB before loading server.
const TEST_DB = path.join(os.tmpdir(), `dashboard-monitors-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;

function fetchJson(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}
const get = (p) => fetchJson(p);
const put = (p, body) => fetchJson(p, { method: "PUT", body });

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

// Every test starts from the pristine singleton row, since it's process-wide
// global state, not per-test-isolated like a normal table's rows would be.
beforeEach(async () => {
  await put("/api/monitors", { monitors: [], monitorMap: {}, collapsedProjects: {} });
});

describe("GET /api/monitors", () => {
  it("returns the empty default on a fresh DB", async () => {
    const res = await get("/api/monitors");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { monitors: [], monitorMap: {}, collapsedProjects: {} });
  });
});

describe("PUT /api/monitors", () => {
  it("persists a full layout and a follow-up GET reflects it", async () => {
    const layout = {
      monitors: [{ id: "m1", name: "Left Screen", collapsed: false, orientation: "horizontal" }],
      monitorMap: { "proj-1": "m1" },
      collapsedProjects: { "proj-2": true },
    };
    const putRes = await put("/api/monitors", layout);
    assert.equal(putRes.status, 200);
    assert.deepEqual(putRes.body, layout);

    const getRes = await get("/api/monitors");
    assert.deepEqual(getRes.body, layout);
  });

  it("patches only the given subset, leaving the rest untouched", async () => {
    await put("/api/monitors", {
      monitors: [{ id: "m1", name: "Left Screen" }],
      monitorMap: { "proj-1": "m1" },
      collapsedProjects: { "proj-2": true },
    });

    const res = await put("/api/monitors", { monitorMap: { "proj-1": "m1", "proj-3": "m1" } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.monitors, [{ id: "m1", name: "Left Screen" }]);
    assert.deepEqual(res.body.monitorMap, { "proj-1": "m1", "proj-3": "m1" });
    assert.deepEqual(res.body.collapsedProjects, { "proj-2": true });
  });

  const rejects = [
    ["monitors not an array", { monitors: { id: "m1" } }],
    ["a monitor missing id", { monitors: [{ name: "x" }] }],
    ["a monitor missing name", { monitors: [{ id: "m1" }] }],
    [
      "a monitor with a bad orientation",
      { monitors: [{ id: "m1", name: "x", orientation: "up" }] },
    ],
    ["monitorMap not an object", { monitorMap: ["m1"] }],
    ["monitorMap value not a string", { monitorMap: { "proj-1": 1 } }],
    ["collapsedProjects not an object", { collapsedProjects: ["proj-1"] }],
    ["collapsedProjects value not a boolean", { collapsedProjects: { "proj-1": "yes" } }],
  ];
  for (const [name, body] of rejects) {
    it(`rejects ${name} with a 400 + structured error`, async () => {
      const res = await put("/api/monitors", body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_LAYOUT");
    });
  }
});
