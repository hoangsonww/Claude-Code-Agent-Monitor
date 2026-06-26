/**
 * @file transcript-sender.test.js
 * @description Unit tests for classifyTranscriptSender — the transcript viewer
 * must attribute each JSONL line to its TRUE sender, not blanket-label every
 * `type:"user"` line as the human. Cases mirror real Claude Code transcripts:
 * tool results, harness task-notifications, /loop (isMeta) re-injections, and a
 * subagent's orchestrator-assigned task. (Reported transcript mis-attribution.)
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

// Point the db at a throwaway file before requiring the router (it pulls in db).
const TEST_DB = path.join(os.tmpdir(), `transcript-sender-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { classifyTranscriptSender } = require("../routes/sessions");
const { db } = require("../db");

after(() => {
  if (db) db.close();
  for (const s of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + s);
    } catch {
      /* ignore */
    }
  }
});

// Shapes lifted from real ~/.claude transcripts.
const realUser = (text) => ({
  type: "user",
  message: { role: "user", content: text },
  promptSource: "user_input",
  origin: "cli",
});
const toolResult = () => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
  toolUseResult: { stdout: "ok" },
});
const assistant = () => ({ type: "assistant", message: { role: "assistant", content: [] } });

describe("classifyTranscriptSender — main transcript", () => {
  it("real human message → user", () => {
    assert.equal(classifyTranscriptSender(realUser("spin up a team of agents"), false), "user");
  });

  it("tool result (toolUseResult / tool_result content) → tool", () => {
    assert.equal(classifyTranscriptSender(toolResult(), false), "tool");
  });

  it("harness task-notification → system", () => {
    const e = {
      type: "user",
      message: { role: "user", content: "<task-notification>\n<task-id>abc</task-id>\n" },
      promptSource: "task_notification",
      origin: "system",
    };
    assert.equal(classifyTranscriptSender(e, false), "system");
  });

  it("/loop re-injection (isMeta) → system", () => {
    const e = {
      type: "user",
      isMeta: true,
      message: { role: "user", content: "Sonnet cognition agent last one — stitch the brief" },
    };
    assert.equal(classifyTranscriptSender(e, false), "system");
  });

  it("assistant turn → assistant", () => {
    assert.equal(classifyTranscriptSender(assistant(), false), "assistant");
  });

  it("@agent mention typed by the human → user", () => {
    assert.equal(classifyTranscriptSender(realUser("@agent-ai-engineer hi"), false), "user");
  });

  it("local slash-command (type=system) → user", () => {
    assert.equal(
      classifyTranscriptSender(
        { type: "system", subtype: "local_command", content: "/color" },
        false
      ),
      "user"
    );
  });
});

describe("classifyTranscriptSender — subagent transcript", () => {
  it("orchestrator-assigned task (no promptSource/origin) → orchestrator", () => {
    const task = {
      type: "user",
      isSidechain: true,
      agentId: "a484",
      message: { role: "user", content: "Light research/synthesis task. Write a synthesis…" },
    };
    assert.equal(classifyTranscriptSender(task, true), "orchestrator");
  });

  it("tool result inside a subagent → tool", () => {
    assert.equal(classifyTranscriptSender(toolResult(), true), "tool");
  });

  it("human directly messaging the subagent (has provenance) → user", () => {
    const direct = {
      type: "user",
      isSidechain: true,
      agentId: "a484",
      message: { role: "user", content: "actually, focus on cognition" },
      promptSource: "user_input",
      origin: "cli",
    };
    assert.equal(classifyTranscriptSender(direct, true), "user");
  });

  it("assistant turn in a subagent → assistant", () => {
    assert.equal(classifyTranscriptSender(assistant(), true), "assistant");
  });
});
