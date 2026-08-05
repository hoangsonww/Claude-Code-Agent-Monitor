/**
 * @file Regression: TodoWrite hook payloads must be parsed into per-agent
 * progress counts (agents.todo_done / todo_total / progress_source='todo').
 * Driven via processEvent directly (no HTTP socket) so it runs under the
 * sandbox's localhost-bind restriction. Malformed/empty payloads must never
 * write or throw.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");

const TEST_DB = path.join(os.tmpdir(), `task-progress-todo-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const hooks = require("../routes/hooks");
const processEvent = hooks.processEvent;

after(() => {
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

function driveWorkingMain(sid) {
  processEvent("SessionStart", { session_id: sid });
  processEvent("UserPromptSubmit", { session_id: sid, prompt: "go" });
}

describe("TodoWrite -> agent progress", () => {
  it("writes completed/total and progress_source='todo'", () => {
    const sid = "todo-basic";
    driveWorkingMain(sid);
    processEvent("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: {
        todos: [
          { content: "a", status: "completed" },
          { content: "b", status: "completed" },
          { content: "c", status: "in_progress" },
          { content: "d", status: "pending" },
          { content: "e", status: "pending" },
        ],
      },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, 5);
    assert.equal(agent.todo_done, 2); // in_progress counts as NOT done (unweighted)
    assert.equal(agent.progress_source, "todo");
  });

  it("updates counts when a later TodoWrite replaces the list", () => {
    const sid = "todo-replace";
    driveWorkingMain(sid);
    processEvent("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: { todos: [{ content: "x", status: "completed" }] },
    });
    processEvent("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: {
        todos: [
          { content: "x", status: "completed" },
          { content: "y", status: "completed" },
          { content: "z", status: "pending" },
        ],
      },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, 3);
    assert.equal(agent.todo_done, 2);
  });

  it("ignores an empty todos array (no write, no throw)", () => {
    const sid = "todo-empty";
    driveWorkingMain(sid);
    processEvent("PostToolUse", {
      session_id: sid,
      tool_name: "TodoWrite",
      tool_input: { todos: [] },
    });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
    assert.equal(agent.progress_source, null);
  });

  it("ignores a malformed TodoWrite payload without throwing", () => {
    const sid = "todo-malformed";
    driveWorkingMain(sid);
    assert.doesNotThrow(() =>
      processEvent("PostToolUse", {
        session_id: sid,
        tool_name: "TodoWrite",
        tool_input: { todos: "not-an-array" },
      })
    );
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
  });

  it("leaves non-TodoWrite tools untouched", () => {
    const sid = "todo-other";
    driveWorkingMain(sid);
    processEvent("PreToolUse", { session_id: sid, tool_name: "Read", tool_input: {} });
    processEvent("PostToolUse", { session_id: sid, tool_name: "Read", tool_input: {} });
    const agent = stmts.getAgent.get(`${sid}-main`);
    assert.equal(agent.todo_total, null);
    assert.equal(agent.progress_source, null);
  });
});
