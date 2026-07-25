/**
 * @file End-to-end tests for the hook-stream focus channel: POSTing a
 * PostToolUse Bash event whose command contains `ccam focus …` to
 * /api/hooks/event must create the session_focus row and a Focus event —
 * while the SAME command arriving as PreToolUse must produce nothing (the
 * parser deliberately reads PostToolUse only, for exactly-once semantics).
 * Also covers the opportunistic AGENT-PLAN.md ingest on SessionStart.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-focus-hook-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;
let workDir;

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function hookEvent(hookType, sessionId, extra = {}) {
  return post("/api/hooks/event", {
    hook_type: hookType,
    data: { session_id: sessionId, cwd: workDir, ...extra },
  });
}

const SESSION_ID = "focus-hook-session-1";

before(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "focus-hook-cwd-"));
  fs.writeFileSync(
    path.join(workDir, "AGENT-PLAN.md"),
    "# Hook plan\n- [ ] 1. First thing\n- [ ] 4. Migrate auth — acceptance: SSO works\n"
  );
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
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

describe("hook-stream focus channel", () => {
  it("SessionStart creates the session and opportunistically ingests AGENT-PLAN.md", async () => {
    const res = await hookEvent("SessionStart", SESSION_ID);
    assert.equal(res.status, 200);
    // Opportunistic ingest runs after the response; give it a tick.
    await new Promise((r) => setTimeout(r, 50));
    const plan = stmts.getPlanByCwd.get(workDir);
    assert.ok(plan, "plan ingested on SessionStart");
    assert.equal(plan.item_count, 2);
  });

  it("a PreToolUse focus command produces NO focus state (dedupe proof)", async () => {
    const res = await hookEvent("PreToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: "ccam focus set 4" },
    });
    assert.equal(res.status, 200);
    assert.equal(stmts.getSessionFocus.get(SESSION_ID) ?? null, null);
    assert.equal(stmts.listFocusEvents.all(SESSION_ID, 10).length, 0);
  });

  it("a PostToolUse focus command creates session_focus + a Focus event", async () => {
    const res = await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: 'ccam focus set 4 "backend first"' },
    });
    assert.equal(res.status, 200);
    const focus = stmts.getSessionFocus.get(SESSION_ID);
    assert.ok(focus);
    assert.equal(focus.item_number, 4);
    assert.equal(focus.note, "backend first");
    assert.equal(focus.cwd, workDir);
    const events = stmts.listFocusEvents.all(SESSION_ID, 10);
    assert.equal(events.length, 1);
    assert.match(events[0].summary, /Migrate auth/);
  });

  it("compound commands and detour verbs work through the hook path", async () => {
    await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: 'cd /tmp && ccam focus push "npm conflict"' },
    });
    let focus = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(JSON.parse(focus.detour_stack).length, 1);
    await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: "ccam focus pop" },
    });
    focus = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(JSON.parse(focus.detour_stack).length, 0);
    assert.equal(focus.item_number, 4);
  });

  it("focus done stamps the item and clears the pointer", async () => {
    await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: "ccam focus done 4" },
    });
    const item = stmts.getPlanItem.get(workDir, 4);
    assert.ok(item.declared_done_at);
    assert.equal(item.declared_done_session, SESSION_ID);
    const focus = stmts.getSessionFocus.get(SESSION_ID);
    assert.equal(focus.item_number, null);
  });

  it("non-focus Bash commands and focus status are ignored", async () => {
    const before = stmts.listFocusEvents.all(SESSION_ID, 50).length;
    await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: "git status && ls -la" },
    });
    await hookEvent("PostToolUse", SESSION_ID, {
      tool_name: "Bash",
      tool_input: { command: "ccam focus status" },
    });
    assert.equal(stmts.listFocusEvents.all(SESSION_ID, 50).length, before);
  });
});
