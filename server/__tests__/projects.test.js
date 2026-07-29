/**
 * @file Tests for the Projects router: CRUD validation, folder (cwd) mapping
 * uniqueness, aggregated session-count/active-count/last-activity stats per
 * project, the unassigned-cwd bucket for sessions not yet mapped to any
 * project, the `priority` column's guarded migration/default (build-task-
 * list.md Task 4), and `PUT /api/projects/reorder`'s happy path, validation,
 * and `project_updated` WebSocket broadcast — including a real `ws` client
 * proof (closing this repo's "broadcast trusted by convention only" gap for
 * this one endpoint) and the negative "other project mutations never
 * broadcast" scope-creep guard (build-task-list.md Tasks 6/7).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");
const WebSocket = require("ws");

const TEST_DB = path.join(os.tmpdir(), `dashboard-projects-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;

function fetch(urlPath, options = {}) {
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
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function post(urlPath, body) {
  return fetch(urlPath, { method: "POST", body });
}

function patch(urlPath, body) {
  return fetch(urlPath, { method: "PATCH", body });
}

function del(urlPath) {
  return fetch(urlPath, { method: "DELETE" });
}

function put(urlPath, body) {
  return fetch(urlPath, { method: "PUT", body });
}

/** Opens a real `ws` client against the running test server and collects
 *  every parsed message it receives, for asserting on `broadcast()` frames
 *  directly instead of trusting the HTTP response alone. */
function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace("http", "ws")}/ws`);
    const messages = [];
    ws.on("message", (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch {
        /* not JSON - ignore */
      }
    });
    ws.on("open", () => resolve({ ws, messages }));
    ws.on("error", reject);
  });
}

function waitForMessageType(messages, type, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      const found = messages.find((m) => m.type === type);
      if (found) return resolve(found);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`timed out waiting for a "${type}" broadcast`));
      }
      setTimeout(check, 20);
    })();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

describe("Project CRUD", () => {
  it("rejects a project without a name", async () => {
    const res = await post("/api/projects", {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("rejects a non-array cwds field", async () => {
    const res = await post("/api/projects", { name: "Bad", cwds: "/not-an-array" });
    assert.equal(res.status, 400);
  });

  it("creates, lists, renames, and deletes a project", async () => {
    const created = await post("/api/projects", { name: "  Dashboard  " });
    assert.equal(created.status, 201);
    const project = created.body.project;
    assert.ok(project.id);
    assert.equal(project.name, "Dashboard"); // trimmed
    assert.deepEqual(project.paths, []);

    const list = await fetch("/api/projects");
    assert.equal(list.status, 200);
    assert.ok(list.body.projects.some((p) => p.id === project.id));

    const renamed = await patch(`/api/projects/${project.id}`, { name: "Renamed" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.project.name, "Renamed");

    const badRename = await patch(`/api/projects/${project.id}`, { name: "" });
    assert.equal(badRename.status, 400);

    const deleted = await del(`/api/projects/${project.id}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.ok, true);

    const listAfter = await fetch("/api/projects");
    assert.ok(!listAfter.body.projects.some((p) => p.id === project.id));
  });

  it("404s on rename/delete of an unknown project", async () => {
    const renamed = await patch("/api/projects/does-not-exist", { name: "x" });
    assert.equal(renamed.status, 404);
    const deleted = await del("/api/projects/does-not-exist");
    assert.equal(deleted.status, 404);
  });

  it("creates a project pre-attached to folders", async () => {
    const created = await post("/api/projects", {
      name: "Multi-folder",
      cwds: ["/tmp/proj-a", "/tmp/proj-b", "/tmp/proj-a"], // dup collapses
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.project.paths.length, 2);
    const cwds = created.body.project.paths.map((p) => p.cwd).sort();
    assert.deepEqual(cwds, ["/tmp/proj-a", "/tmp/proj-b"]);
  });
});

describe("Folder (cwd) mapping", () => {
  it("a folder can only belong to one project", async () => {
    const a = await post("/api/projects", { name: "A", cwds: ["/tmp/shared"] });
    assert.equal(a.status, 201);

    const b = await post("/api/projects", { name: "B", cwds: ["/tmp/shared"] });
    assert.equal(b.status, 409);
    assert.equal(b.body.error.code, "ALREADY_MAPPED");
    assert.equal(a.body.project.paths.length, 1); // A's mapping is untouched
  });

  it("adds and removes a folder mapping", async () => {
    const project = (await post("/api/projects", { name: "Foldered" })).body.project;

    const added = await post(`/api/projects/${project.id}/paths`, { cwd: "/tmp/foldered-a" });
    assert.equal(added.status, 201);
    assert.equal(added.body.project.paths.length, 1);
    const pathId = added.body.project.paths[0].id;

    const dupe = await post(`/api/projects/${project.id}/paths`, { cwd: "/tmp/foldered-a" });
    assert.equal(dupe.status, 409);
    assert.match(dupe.body.error.message, /already part of this project/);

    const removed = await del(`/api/projects/${project.id}/paths/${pathId}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.project.paths.length, 0);

    const removeAgain = await del(`/api/projects/${project.id}/paths/${pathId}`);
    assert.equal(removeAgain.status, 404);
  });

  it("rejects adding a folder without a cwd", async () => {
    const project = (await post("/api/projects", { name: "NoCwd" })).body.project;
    const res = await post(`/api/projects/${project.id}/paths`, {});
    assert.equal(res.status, 400);
  });
});

describe("Aggregated session stats", () => {
  it("sums session/active counts and tracks last_activity across a project's folders, and buckets unmapped cwds as unassigned", async () => {
    const project = (
      await post("/api/projects", { name: "Stats Project", cwds: ["/tmp/stats-a", "/tmp/stats-b"] })
    ).body.project;

    stmts.insertSession.run("stats-1", "s1", "active", "/tmp/stats-a", "claude-opus-4-8", null);
    stmts.insertSession.run("stats-2", "s2", "completed", "/tmp/stats-a", "claude-opus-4-8", null);
    stmts.insertSession.run("stats-3", "s3", "active", "/tmp/stats-b", "claude-opus-4-8", null);
    stmts.insertSession.run(
      "stats-unassigned",
      "s4",
      "active",
      "/tmp/stats-unmapped",
      "claude-opus-4-8",
      null
    );

    const list = await fetch("/api/projects");
    assert.equal(list.status, 200);
    const found = list.body.projects.find((p) => p.id === project.id);
    assert.ok(found);
    assert.equal(found.session_count, 3);
    assert.equal(found.active_count, 2);
    assert.ok(found.last_activity);

    assert.ok(list.body.unassigned.cwds.includes("/tmp/stats-unmapped"));
    assert.ok(!list.body.unassigned.cwds.includes("/tmp/stats-a"));
    assert.ok(!list.body.unassigned.cwds.includes("/tmp/stats-b"));
  });
});

describe("GET /:id/focus-report", () => {
  const CWD = "/tmp/focus-report-route-test";
  const insertFocusEventRaw = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, NULL, 'Focus', NULL, ?, ?, ?)"
  );
  function t(minutesFromStart) {
    return new Date(Date.UTC(2026, 0, 1) + minutesFromStart * 60_000).toISOString();
  }
  function focus(sessionId, minute, data) {
    insertFocusEventRaw.run(sessionId, "focus test", JSON.stringify(data), t(minute));
  }

  it("404s for an unknown project", async () => {
    const res = await fetch("/api/projects/does-not-exist/focus-report");
    assert.equal(res.status, 404);
  });

  it("returns well-shaped empty totals for a project with no mapped folders", async () => {
    const created = await post("/api/projects", { name: "No folders" });
    const res = await fetch(`/api/projects/${created.body.project.id}/focus-report`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.sessions, []);
    assert.deepEqual(res.body.items, []);
    assert.equal(res.body.totals.wall_ms, 0);
    assert.ok(res.body.totals.by_kind.item);
    assert.ok(typeof res.body.idle_grace_seconds === "number");
  });

  it("scopes the report to only the clicked project's sessions, and rolls a bug detour up under its item", async () => {
    process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0"; // isolate from idle discounting
    stmts.upsertPlan.run(CWD, "Report route test plan", `${CWD}/AGENT-PLAN.md`, "hash", 1);
    stmts.upsertPlanItem.run(CWD, "item-4", 4, null, "Shared Backend", null, null, 0, 0);

    const created = await post("/api/projects", { name: "Report Route Test", cwds: [CWD] });
    const projectId = created.body.project.id;

    stmts.insertSession.run("report-route-1", "In project", "active", CWD, "claude-opus-4-8", null);
    stmts.insertSession.run(
      "report-route-2",
      "Outside project",
      "active",
      "/tmp/focus-report-route-OTHER",
      "claude-opus-4-8",
      null
    );

    focus("report-route-1", 0, {
      verb: "set",
      item_number: 4,
      item_text_snapshot: "Shared Backend",
    });
    focus("report-route-1", 20, {
      verb: "bug",
      kind: "bug",
      title: "npm conflict",
      description: "npm conflict",
    });
    focus("report-route-1", 35, { verb: "pop", description: "npm conflict" });
    // Closes the segment deterministically instead of leaving it open to
    // "now" (the session's real `ended_at` is NULL - still "active" - so an
    // unclosed segment would otherwise span from minute 35 to whenever this
    // test happens to run, making the assertions below flaky).
    focus("report-route-1", 35, {
      verb: "done",
      item_number: 4,
      item_text_snapshot: "Shared Backend",
    });
    // Never declared any focus for report-route-2 - it must not appear.

    const res = await fetch(`/api/projects/${projectId}/focus-report`);
    assert.equal(res.status, 200);
    assert.equal(res.body.project_id, projectId);
    assert.equal(res.body.sessions.length, 1);
    assert.equal(res.body.sessions[0].session_id, "report-route-1");

    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].item_number, 4);
    assert.equal(res.body.items[0].text, "Shared Backend");
    assert.equal(res.body.items[0].totals.by_kind.bug.wall_ms, 15 * 60_000);

    assert.equal(res.body.totals.by_kind.bug.wall_ms, 15 * 60_000);
    assert.equal(res.body.totals.by_kind.item.wall_ms, 20 * 60_000);
  });
});

describe("Project priority — guarded migration + default (WIP queue page)", () => {
  it("a freshly created project reads priority: 0", async () => {
    const created = await post("/api/projects", { name: "Priority Fresh" });
    assert.equal(created.status, 201);
    assert.equal(created.body.project.priority, 0);

    const list = await fetch("/api/projects");
    const found = list.body.projects.find((p) => p.id === created.body.project.id);
    assert.ok(found);
    assert.equal(found.priority, 0);
  });

  it("a directly-inserted pre-migration-style row reads priority: 0 with no error", async () => {
    // Bypass the route entirely - insert exactly like the OLD (pre-priority)
    // schema would have, then read it back through the real API to prove the
    // guarded migration's DEFAULT backfills existing rows cleanly.
    const id = "priority-premigration-row";
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(id, "Pre-migration project");

    const list = await fetch("/api/projects");
    assert.equal(list.status, 200);
    const found = list.body.projects.find((p) => p.id === id);
    assert.ok(found, "pre-migration row must still be readable");
    assert.equal(found.priority, 0);
  });

  it("re-requiring server/db.js re-runs its real guarded priority migration against an already-migrated DB, without throwing or duplicating the column", () => {
    // Deliberately does NOT re-implement the SELECT-then-ALTER-on-catch guard
    // itself here (a copy would trivially "pass" regardless of whether
    // server/db.js actually has the real migration - proving nothing). This
    // instead force-reruns db.js's OWN top-level migration code a second
    // time, by busting node's require cache and requiring it again against
    // the SAME already-migrated DB file - the same idempotency shape the
    // `source`-column migration already relies on (every other test file in
    // this suite implicitly re-runs db.js's guards once per process, since
    // each spins up its own fresh DB; this test is the one place that does
    // it explicitly, twice, against the SAME file, inside a single test).
    const dbModulePath = require.resolve("../db");
    const originalDbModule = require.cache[dbModulePath];
    let fresh;
    try {
      assert.doesNotThrow(() => {
        delete require.cache[dbModulePath];
        fresh = require("../db");
      }, "a second require of server/db.js must not throw");

      assert.doesNotThrow(() => {
        fresh.db.prepare("SELECT priority FROM projects LIMIT 1").get();
      }, "the priority column must exist (and be queryable with no duplicate-column error) after the real migration guard has run twice");
    } finally {
      if (fresh && fresh.db !== db) {
        try {
          fresh.db.close();
        } catch {
          /* already closed */
        }
      }
      // Restore the require cache to the module instance this file's shared
      // `db`/`stmts` (declared at the top of this file) already reference,
      // so every OTHER test below keeps using that same live connection.
      require.cache[dbModulePath] = originalDbModule;
    }
  });
});

describe("PUT /api/projects/reorder", () => {
  it("sets dense ranks 0..N-1 matching array order, in the exact { projects: [{ id, priority }] } response shape", async () => {
    const a = (await post("/api/projects", { name: "Reorder A" })).body.project;
    const b = (await post("/api/projects", { name: "Reorder B" })).body.project;
    const c = (await post("/api/projects", { name: "Reorder C" })).body.project;

    const res = await put("/api/projects/reorder", { order: [c.id, a.id, b.id] });
    assert.equal(res.status, 200);
    const byId = new Map(res.body.projects.map((p) => [p.id, p.priority]));
    assert.equal(byId.get(c.id), 0);
    assert.equal(byId.get(a.id), 1);
    assert.equal(byId.get(b.id), 2);
  });

  it("persists to the DB, not just the PUT echo - a follow-up GET /api/projects reflects the same values", async () => {
    const a = (await post("/api/projects", { name: "Reorder Persist A" })).body.project;
    const b = (await post("/api/projects", { name: "Reorder Persist B" })).body.project;

    await put("/api/projects/reorder", { order: [b.id, a.id] });

    const list = await fetch("/api/projects");
    const byId = new Map(list.body.projects.map((p) => [p.id, p.priority]));
    assert.equal(byId.get(b.id), 0);
    assert.equal(byId.get(a.id), 1);
  });

  it("re-reordering fully replaces ranks, not additive", async () => {
    const a = (await post("/api/projects", { name: "Reorder2 A" })).body.project;
    const b = (await post("/api/projects", { name: "Reorder2 B" })).body.project;

    await put("/api/projects/reorder", { order: [a.id, b.id] });
    await put("/api/projects/reorder", { order: [b.id, a.id] });

    const list = await fetch("/api/projects");
    const byId = new Map(list.body.projects.map((p) => [p.id, p.priority]));
    assert.equal(byId.get(b.id), 0);
    assert.equal(byId.get(a.id), 1);
  });

  it("a project omitted from `order` keeps its prior priority unchanged (partial reorder, distinct from an unknown id)", async () => {
    const a = (await post("/api/projects", { name: "Partial A" })).body.project;
    const b = (await post("/api/projects", { name: "Partial B" })).body.project;
    const untouched = (await post("/api/projects", { name: "Partial Untouched" })).body.project;

    await put("/api/projects/reorder", { order: [untouched.id, a.id, b.id] });

    // Reorder again WITHOUT `untouched` in the array at all.
    const res = await put("/api/projects/reorder", { order: [b.id, a.id] });
    assert.equal(res.status, 200);
    assert.ok(!res.body.projects.some((p) => p.id === untouched.id));

    const list = await fetch("/api/projects");
    const byId = new Map(list.body.projects.map((p) => [p.id, p.priority]));
    assert.equal(byId.get(untouched.id), 0, "omitted project's priority is untouched");
    assert.equal(byId.get(b.id), 0);
    assert.equal(byId.get(a.id), 1);
  });

  it("404s on an unknown id, naming the missing id", async () => {
    const a = (await post("/api/projects", { name: "Validation A" })).body.project;
    const res = await put("/api/projects/reorder", { order: [a.id, "does-not-exist"] });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
    assert.match(res.body.error.message, /does-not-exist/);
  });

  it("400s on a duplicate id", async () => {
    const a = (await post("/api/projects", { name: "Validation Dup" })).body.project;
    const res = await put("/api/projects/reorder", { order: [a.id, a.id] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("400s on a non-array order", async () => {
    const res = await put("/api/projects/reorder", { order: "not-an-array" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("400s on a non-string entry", async () => {
    const a = (await post("/api/projects", { name: "Validation NonString" })).body.project;
    const res = await put("/api/projects/reorder", { order: [a.id, 42] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("400s on an empty array — this test asserts the 400 choice; build-task-list.md Task 5/test-plan.md require the implementer to pick ONE explicit behavior (400 or a documented no-op) and this is the one this suite checks for", async () => {
    const res = await put("/api/projects/reorder", { order: [] });
    assert.equal(res.status, 400);
  });
});

describe("PUT /api/projects/reorder — WebSocket broadcast", () => {
  it("a real ws client receives exactly one project_updated message shaped { projects: [{ id, priority }] } after a successful reorder", async () => {
    const a = (await post("/api/projects", { name: "Broadcast A" })).body.project;
    const b = (await post("/api/projects", { name: "Broadcast B" })).body.project;

    const { ws, messages } = await connectWs();
    try {
      await put("/api/projects/reorder", { order: [b.id, a.id] });
      const msg = await waitForMessageType(messages, "project_updated");
      const byId = new Map(msg.data.projects.map((p) => [p.id, p.priority]));
      assert.equal(byId.get(b.id), 0);
      assert.equal(byId.get(a.id), 1);

      await wait(150);
      assert.equal(
        messages.filter((m) => m.type === "project_updated").length,
        1,
        "exactly one project_updated broadcast for one reorder call"
      );
    } finally {
      ws.terminate();
    }
  });

  it("negative: create/rename/add-path/remove-path/delete never fire project_updated — the documented carve-out against silent scope creep", async () => {
    const { ws, messages } = await connectWs();
    try {
      const created = await post("/api/projects", { name: "No Broadcast" });
      const id = created.body.project.id;
      await patch(`/api/projects/${id}`, { name: "No Broadcast Renamed" });
      const withPath = await post(`/api/projects/${id}/paths`, { cwd: "/tmp/no-broadcast-path" });
      const pathId = withPath.body.project.paths[0].id;
      await del(`/api/projects/${id}/paths/${pathId}`);
      await del(`/api/projects/${id}`);

      await wait(250);
      assert.equal(
        messages.filter((m) => m.type === "project_updated").length,
        0,
        "no project_updated for create/rename/path-add/path-remove/delete"
      );
    } finally {
      ws.terminate();
    }
  });
});
