/**
 * @file Regression tests for dashboard-local session groups, assignment,
 * scope checks, and deletion without removing session history.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const dbPath = path.join(os.tmpdir(), `ccam-session-groups-${process.pid}-${Date.now()}.db`);
process.env.DASHBOARD_DB_PATH = dbPath;
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let base;

function request(method, route, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(route, base);
    const req = http.request(
      url,
      { method, headers: { "Content-Type": "application/json" } },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async () => {
  server = await startServer(createApp(), 0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const id of ["group-test-a", "group-test-b", "group-test-c"]) {
    stmts.insertSession.run(id, id, "active", "/tmp/group-test", null, null);
  }
});

after(() => {
  server?.close();
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      /* already absent */
    }
  }
});

test("group CRUD, bulk assignment, filtering, and safe deletion", async () => {
  const missing = await request("POST", "/api/session-groups", { name: "  " });
  assert.equal(missing.status, 400);

  const created = await request("POST", "/api/session-groups", { name: " Billing rework " });
  assert.equal(created.status, 201);
  const groupId = created.body.group.id;
  assert.equal(created.body.group.name, "Billing rework");
  assert.equal(
    (await request("POST", "/api/session-groups", { name: "billing rework" })).status,
    409
  );

  const failedPatch = await request("PATCH", "/api/sessions/group-test-c", {
    group_id: groupId,
    status: "invalid-status",
  });
  assert.equal(failedPatch.status, 400);
  assert.equal(stmts.getSession.get("group-test-c").group_id, null);

  db.exec(`CREATE TEMP TRIGGER reject_group_test_status
    BEFORE UPDATE OF status ON sessions WHEN NEW.id = 'group-test-c'
    BEGIN SELECT RAISE(ABORT, 'test status failure'); END`);
  try {
    const rejected = await request("PATCH", "/api/sessions/group-test-c", {
      group_id: groupId,
      status: "completed",
    });
    assert.equal(rejected.status, 500);
    assert.equal(stmts.getSession.get("group-test-c").group_id, null);
  } finally {
    db.exec("DROP TRIGGER reject_group_test_status");
  }

  const assigned = await request("PATCH", "/api/sessions/group", {
    session_ids: ["group-test-a", "group-test-b"],
    group_id: groupId,
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.updated, 2);
  const grouped = await request("GET", `/api/sessions?group=${groupId}`);
  assert.equal(grouped.body.total, 2);
  assert.deepEqual(grouped.body.sessions.map((session) => session.id).sort(), [
    "group-test-a",
    "group-test-b",
  ]);
  assert.equal(
    (await request("GET", "/api/sessions?group=ungrouped")).body.sessions.some(
      (s) => s.id === "group-test-c"
    ),
    true
  );

  const invalidBatch = await request("PATCH", "/api/sessions/group", {
    session_ids: ["group-test-a", "missing-session"],
    group_id: null,
  });
  assert.equal(invalidBatch.status, 404);
  assert.equal(stmts.getSession.get("group-test-a").group_id, groupId);

  const renamed = await request("PATCH", `/api/session-groups/${groupId}`, {
    name: "Monthly billing",
  });
  assert.equal(renamed.body.group.name, "Monthly billing");
  assert.equal(
    (await request("GET", "/api/session-groups")).body.groups.some((g) => g.id === groupId),
    true
  );

  const moved = await request("PATCH", "/api/sessions/group-test-c", { group_id: groupId });
  assert.equal(moved.body.session.group_id, groupId);
  assert.equal((await request("GET", `/api/sessions?group=${groupId}`)).body.total, 3);

  assert.equal((await request("DELETE", `/api/session-groups/${groupId}`)).status, 200);
  assert.equal(stmts.getSession.get("group-test-a").group_id, null);
  assert.equal(stmts.getSession.get("group-test-c").group_id, null);
  assert.equal(
    (await request("GET", "/api/sessions?group=ungrouped")).body.sessions.filter((s) =>
      s.id.startsWith("group-test-")
    ).length,
    3
  );
});
