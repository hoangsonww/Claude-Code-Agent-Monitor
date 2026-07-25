/**
 * @file Tests for the Plans router and session focus/todos endpoints:
 * plan list / for-cwd / project rollup / force-refresh, the bulk
 * GET /api/focus hydrate, the strict POST /:id/focus write path (validation
 * 400s, UNKNOWN_ITEM / EMPTY_STACK 409s, idempotent same-state dedupe), and
 * the parse-on-read GET /:id/todos including the malformed-data fallback.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-plans-api-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;
let workDir;

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
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
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const post = (p, body) => fetch(p, { method: "POST", body });

const SESSION_ID = "plans-api-session-1";

before(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "plans-api-cwd-"));
  fs.writeFileSync(
    path.join(workDir, "AGENT-PLAN.md"),
    "# API plan\n- [x] 1. Done thing\n- [ ] 2. Next thing — acceptance: works\n"
  );
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
  stmts.insertSession.run(SESSION_ID, "Plans API Test", "active", workDir, null, null);
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${TEST_DB}${suffix}`, { force: true });
    } catch {
      /* best effort */
    }
  }
});

describe("plans routes", () => {
  it("POST /api/plans/refresh ingests and returns the plan", async () => {
    const res = await post("/api/plans/refresh", { cwd: workDir });
    assert.equal(res.status, 200);
    assert.equal(res.body.changed, true);
    assert.equal(res.body.plan.title, "API plan");
    assert.equal(res.body.items.length, 2);
  });

  it("refresh validation: 400 without cwd, 404 for unknown cwd", async () => {
    assert.equal((await post("/api/plans/refresh", {})).status, 400);
    assert.equal(
      (await post("/api/plans/refresh", { cwd: path.join(os.tmpdir(), "no-such-dir-xyz") })).status,
      404
    );
  });

  it("GET /api/plans lists plans with items", async () => {
    const res = await fetch("/api/plans");
    assert.equal(res.status, 200);
    const plan = res.body.plans.find((p) => p.cwd === workDir);
    assert.ok(plan);
    assert.equal(plan.items.length, 2);
  });

  it("GET /api/plans/for-cwd returns the plan or 404/400", async () => {
    const ok = await fetch(`/api/plans/for-cwd?cwd=${encodeURIComponent(workDir)}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.plan.cwd, workDir);
    assert.equal((await fetch("/api/plans/for-cwd")).status, 400);
    assert.equal((await fetch("/api/plans/for-cwd?cwd=%2Fno%2Fsuch")).status, 404);
  });

  it("GET /api/plans/project/:id rolls up plans for mapped cwds", async () => {
    const created = await post("/api/projects", { name: "Plan Project", cwds: [workDir] });
    assert.equal(created.status, 201);
    const projectId = created.body.project.id;
    const res = await fetch(`/api/plans/project/${projectId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.plans.length, 1);
    assert.equal(res.body.plans[0].cwd, workDir);
    assert.equal((await fetch("/api/plans/project/nope")).status, 404);
  });
});

describe("session focus endpoints", () => {
  it("POST focus validates verb and shapes", async () => {
    assert.equal((await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "jump" })).status, 400);
    assert.equal((await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "set" })).status, 400);
    assert.equal((await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "push" })).status, 400);
    assert.equal((await post("/api/sessions/nope/focus", { verb: "pop" })).status, 404);
  });

  it("POST focus set writes state; unknown item is 409", async () => {
    const bad = await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "set", item_number: 99 });
    assert.equal(bad.status, 409);
    assert.equal(bad.body.error.code, "UNKNOWN_ITEM");
    const ok = await post(`/api/sessions/${SESSION_ID}/focus`, {
      verb: "set",
      item_number: 2,
      note: "api path",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.focus.item_number, 2);
    assert.equal(ok.body.focus.item_text, "Next thing");
    assert.equal(ok.body.deduped, false);
  });

  it("POST focus is idempotent on identical end state", async () => {
    const res = await post(`/api/sessions/${SESSION_ID}/focus`, {
      verb: "set",
      item_number: 2,
      note: "api path",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.deduped, true);
  });

  it("POST focus pop on empty stack is 409 EMPTY_STACK", async () => {
    const res = await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "pop" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "EMPTY_STACK");
  });

  it("GET /api/focus bulk-hydrates active sessions", async () => {
    const res = await fetch("/api/focus");
    assert.equal(res.status, 200);
    const mine = res.body.focus.find((f) => f.session_id === SESSION_ID);
    assert.ok(mine);
    assert.equal(mine.item_number, 2);
  });

  it("GET /:id/focus returns wire shape + history", async () => {
    await post(`/api/sessions/${SESSION_ID}/focus`, { verb: "push", description: "detour A" });
    const res = await fetch(`/api/sessions/${SESSION_ID}/focus`);
    assert.equal(res.status, 200);
    assert.equal(res.body.focus.item_number, 2);
    assert.equal(res.body.focus.detour_stack.length, 1);
    assert.equal(res.body.plan_title, "API plan");
    assert.ok(res.body.history.length >= 2);
    assert.equal(res.body.history[0].kind, "detour_push");
    assert.equal(res.body.history[0].text, "detour A");
  });
});

describe("session todos endpoint", () => {
  it("returns null when no TodoWrite has fired", async () => {
    const res = await fetch(`/api/sessions/${SESSION_ID}/todos`);
    assert.equal(res.status, 200);
    assert.equal(res.body.todos, null);
  });

  it("parses the latest TodoWrite event on read", async () => {
    const todos = [
      { content: "step one", status: "completed" },
      { content: "step two", status: "in_progress", activeForm: "Doing step two" },
    ];
    stmts.insertEvent.run(
      SESSION_ID,
      null,
      "PostToolUse",
      "TodoWrite",
      "Tool completed: TodoWrite",
      JSON.stringify({ tool_input: { todos } })
    );
    const res = await fetch(`/api/sessions/${SESSION_ID}/todos`);
    assert.equal(res.status, 200);
    assert.equal(res.body.todos.length, 2);
    assert.equal(res.body.todos[1].status, "in_progress");
  });

  it("malformed TodoWrite data degrades to null", async () => {
    stmts.insertEvent.run(
      SESSION_ID,
      null,
      "PostToolUse",
      "TodoWrite",
      "Tool completed: TodoWrite",
      "not json at all"
    );
    const res = await fetch(`/api/sessions/${SESSION_ID}/todos`);
    assert.equal(res.status, 200);
    assert.equal(res.body.todos, null);
  });
});
