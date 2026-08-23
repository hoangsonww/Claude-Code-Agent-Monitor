/**
 * @file Unit tests for owner-attributed Claude and Codex task-progress
 * extraction from JSONL transcripts and Claude lifecycle event fallbacks.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { extractSessionTaskProgress, clearTaskProgressCache } = require("../lib/task-progress");

const roots = [];

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-task-progress-"));
  roots.push(root);
  return root;
}

function writeJsonl(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function claudeToolUse(timestamp, id, name, input) {
  return {
    type: "assistant",
    timestamp,
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id, name, input }],
    },
  };
}

function claudeToolResult(timestamp, id, output) {
  return {
    type: "user",
    timestamp,
    toolUseResult: output,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: JSON.stringify(output) }],
    },
  };
}

afterEach(() => {
  clearTaskProgressCache();
  while (roots.length) {
    fs.rmSync(roots.pop(), { recursive: true, force: true });
  }
});

describe("task progress extraction", () => {
  it("drops an older Codex plan when the latest task starts without task progress", () => {
    const root = tempRoot();
    const transcript = path.join(root, "codex-latest-task-without-plan.jsonl");
    writeJsonl(transcript, [
      {
        type: "event_msg",
        timestamp: "2026-08-07T10:00:00.000Z",
        payload: { type: "task_started" },
      },
      {
        type: "response_item",
        timestamp: "2026-08-07T10:01:00.000Z",
        payload: {
          type: "function_call",
          name: "update_plan",
          arguments: JSON.stringify({
            plan: [{ step: "Old work", status: "in_progress" }],
          }),
        },
      },
      {
        type: "event_msg",
        timestamp: "2026-08-07T11:00:00.000Z",
        payload: { type: "task_started" },
      },
      {
        type: "response_item",
        timestamp: "2026-08-07T11:01:00.000Z",
        payload: { type: "message", role: "assistant", content: "Handled without a plan" },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "codex-latest-task-without-plan", provider: "codex" },
      mainTranscriptPath: transcript,
      agents: [{ id: "codex-latest-task-without-plan-main", type: "main" }],
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("drops unfinished Codex progress when the task ends without a final plan update", () => {
    const root = tempRoot();
    const transcript = path.join(root, "codex-unfinished-task-complete.jsonl");
    writeJsonl(transcript, [
      {
        type: "event_msg",
        timestamp: "2026-08-07T10:00:00.000Z",
        payload: { type: "task_started" },
      },
      {
        type: "response_item",
        timestamp: "2026-08-07T10:01:00.000Z",
        payload: {
          type: "function_call",
          name: "update_plan",
          arguments: JSON.stringify({
            plan: [{ step: "Forgotten work", status: "in_progress" }],
          }),
        },
      },
      {
        type: "event_msg",
        timestamp: "2026-08-07T10:02:00.000Z",
        payload: { type: "task_complete" },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "codex-unfinished-task-complete", provider: "codex" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("drops unfinished Claude progress when the turn ends without another TodoWrite", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-unfinished-turn.jsonl");
    writeJsonl(transcript, [
      {
        type: "user",
        timestamp: "2026-08-07T10:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "Do the work" }] },
      },
      claudeToolUse("2026-08-07T10:01:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Forgotten work", status: "in_progress" }],
      }),
      {
        type: "system",
        subtype: "turn_duration",
        timestamp: "2026-08-07T10:02:00.000Z",
        durationMs: 120000,
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-unfinished-turn", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("keeps fully completed task progress after a turn ends", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-completed-turn.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:01:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Finished work", status: "completed" }],
      }),
      {
        type: "system",
        subtype: "turn_duration",
        timestamp: "2026-08-07T10:02:00.000Z",
        durationMs: 120000,
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-completed-turn", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.completed, 1);
    assert.equal(result.snapshot.items[0].text, "Finished work");
  });

  it("drops every prior Claude owner tracker when the latest human turn has no task state", () => {
    const root = tempRoot();
    const sessionId = "claude-latest-turn-without-tasks";
    const transcript = path.join(root, `${sessionId}.jsonl`);
    const subagentTranscript = path.join(root, sessionId, "subagents", "agent-reviewer-1.jsonl");
    writeJsonl(transcript, [
      {
        type: "user",
        timestamp: "2026-08-07T10:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "Do the old work" }] },
      },
      claudeToolUse("2026-08-07T10:01:00.000Z", "old-todo", "TodoWrite", {
        todos: [{ content: "Old main work", status: "in_progress" }],
      }),
      {
        type: "user",
        timestamp: "2026-08-07T11:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "Answer a quick question" }] },
      },
      {
        type: "assistant",
        timestamp: "2026-08-07T11:01:00.000Z",
        message: { role: "assistant", content: [{ type: "text", text: "Answered" }] },
      },
    ]);
    writeJsonl(subagentTranscript, [
      {
        type: "user",
        timestamp: "2026-08-07T10:01:30.000Z",
        isSidechain: true,
        message: { role: "user", content: [{ type: "text", text: "Review the old work" }] },
      },
      claudeToolUse("2026-08-07T10:02:00.000Z", "sub-todo", "TodoWrite", {
        todos: [{ content: "Old review work", status: "in_progress" }],
      }),
    ]);
    fs.writeFileSync(
      subagentTranscript.replace(".jsonl", ".meta.json"),
      JSON.stringify({ agentType: "reviewer" })
    );

    const result = extractSessionTaskProgress({
      session: { id: sessionId, provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [
        { id: `${sessionId}-main`, type: "main" },
        { id: "reviewer-db-id", type: "subagent", subagent_type: "reviewer" },
      ],
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("does not treat Claude harness task notifications as a new human turn", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-task-notification.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Current work", status: "in_progress" }],
      }),
      {
        type: "user",
        timestamp: "2026-08-07T10:01:00.000Z",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: "<task-notification>Background helper completed</task-notification>",
            },
          ],
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-task-notification", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot.activeText, "Current work");
  });

  it("drops older Claude progress for a transcript-only queued human message", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-queued-human-message.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Old tracked work", status: "in_progress" }],
      }),
      {
        type: "attachment",
        timestamp: "2026-08-07T10:01:00.000Z",
        attachment: {
          type: "queued_command",
          prompt: "Handle this follow-up without a tracker",
          origin: { kind: "human" },
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-queued-human-message", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("does not reset Claude progress for a queued harness notification", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-queued-harness-message.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Current work", status: "in_progress" }],
      }),
      {
        type: "attachment",
        timestamp: "2026-08-07T10:01:00.000Z",
        attachment: {
          type: "queued_command",
          prompt: "<task-notification>Background helper completed</task-notification>",
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-queued-harness-message", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot.activeText, "Current work");
  });

  it("uses the latest Codex update_plan call as the current full snapshot", () => {
    const root = tempRoot();
    const transcript = path.join(root, "rollout.jsonl");
    writeJsonl(transcript, [
      {
        type: "response_item",
        timestamp: "2026-08-07T10:00:00.000Z",
        payload: {
          type: "function_call",
          name: "update_plan",
          arguments: JSON.stringify({
            plan: [
              { step: "Inspect code", status: "in_progress" },
              { step: "Implement", status: "pending" },
            ],
          }),
        },
      },
      {
        type: "response_item",
        timestamp: "2026-08-07T10:05:00.000Z",
        payload: {
          type: "function_call",
          name: "update_plan",
          arguments: JSON.stringify({
            explanation: "Implementation started",
            plan: [
              { step: "Inspect code", status: "completed" },
              { step: "Implement", status: "in_progress" },
            ],
          }),
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "codex-1", provider: "codex" },
      mainTranscriptPath: transcript,
      agents: [{ id: "codex-1-main", type: "main" }],
    });

    assert.equal(result.snapshot.total, 2);
    assert.equal(result.snapshot.completed, 1);
    assert.equal(result.snapshot.inProgress, 1);
    assert.equal(result.snapshot.percentComplete, 50);
    assert.equal(result.snapshot.activeText, "Implement");
    assert.equal(result.snapshot.explanation, "Implementation started");
    assert.equal(result.summary.previewItems[0].status, "in_progress");
  });

  it("extracts update_plan from the Codex exec wrapper used by unified tools", () => {
    const root = tempRoot();
    const transcript = path.join(root, "wrapped-plan.jsonl");
    writeJsonl(transcript, [
      {
        type: "response_item",
        timestamp: "2026-08-08T00:06:07.958Z",
        payload: {
          type: "custom_tool_call",
          name: "exec",
          input:
            'const r = await tools.update_plan({plan:[{step:"Create a sample task",status:"completed"},{step:"Create a lightweight todo list",status:"completed"},{step:"Confirm the setup is ready for local testing",status:"in_progress"}]}); text(r);',
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "codex-wrapped-plan", provider: "codex" },
      mainTranscriptPath: transcript,
      agents: [{ id: "codex-wrapped-plan-main", type: "main" }],
    });

    assert.equal(result.snapshot.sourceTool, "update_plan");
    assert.equal(result.snapshot.total, 3);
    assert.equal(result.snapshot.completed, 2);
    assert.equal(result.snapshot.inProgress, 1);
    assert.equal(result.snapshot.percentComplete, 67);
    assert.equal(result.snapshot.activeText, "Confirm the setup is ready for local testing");
  });

  it("ignores update_plan text inside Codex exec strings and comments", () => {
    const root = tempRoot();
    const transcript = path.join(root, "mentioned-plan.jsonl");
    writeJsonl(transcript, [
      {
        type: "response_item",
        timestamp: "2026-08-08T00:07:00.000Z",
        payload: {
          type: "custom_tool_call",
          name: "exec",
          input:
            'const example = "tools.update_plan({plan:[{step:\\"Fake\\",status:\\"completed\\"}]})"; // tools.update_plan({plan:[{step:"Also fake",status:"pending"}]})',
        },
      },
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "codex-mentioned-plan", provider: "codex" },
      mainTranscriptPath: transcript,
      agents: [{ id: "codex-mentioned-plan-main", type: "main" }],
    });

    assert.equal(result.snapshot, null);
    assert.equal(result.summary, null);
  });

  it("parses the latest legacy Claude TodoWrite snapshot", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-legacy.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [
          { content: "Inspect code", status: "in_progress" },
          { content: "Implement", status: "pending" },
        ],
      }),
      claudeToolUse("2026-08-07T10:05:00.000Z", "todo-2", "TodoWrite", {
        todos: [
          { content: "Inspect code", status: "completed" },
          { content: "Implement", status: "completed" },
        ],
      }),
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-1", provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [{ id: "claude-1-main", type: "main" }],
    });

    assert.equal(result.snapshot.total, 2);
    assert.equal(result.snapshot.completed, 2);
    assert.equal(result.snapshot.percentComplete, 100);
    assert.equal(result.snapshot.sourceTool, "TodoWrite");
  });

  it("reduces current Claude TaskCreate, TaskGet, TaskUpdate, and TaskList calls", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-current.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "create-1", "TaskCreate", {
        subject: "Inspect code",
        description: "Find relevant files",
      }),
      claudeToolResult("2026-08-07T10:00:01.000Z", "create-1", {
        task: { id: "task-1", subject: "Inspect code", status: "pending" },
      }),
      claudeToolUse("2026-08-07T10:01:00.000Z", "update-1", "TaskUpdate", {
        task_id: "task-1",
        status: "in_progress",
      }),
      claudeToolResult("2026-08-07T10:01:01.000Z", "update-1", {
        task: { id: "task-1", subject: "Inspect code", status: "in_progress" },
      }),
      claudeToolUse("2026-08-07T10:01:30.000Z", "get-1", "TaskGet", {
        task_id: "task-1",
      }),
      claudeToolResult("2026-08-07T10:01:31.000Z", "get-1", {
        task: { id: "task-1", subject: "Inspect code", status: "completed" },
      }),
      claudeToolUse("2026-08-07T10:02:00.000Z", "list-1", "TaskList", {}),
      claudeToolResult("2026-08-07T10:02:01.000Z", "list-1", {
        tasks: [
          { id: "task-1", subject: "Inspect code", status: "completed" },
          { id: "task-2", subject: "Implement tracker", status: "in_progress" },
        ],
      }),
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-2", provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [{ id: "claude-2-main", type: "main" }],
    });

    assert.equal(result.snapshot.sourceTool, "TaskList");
    assert.equal(result.snapshot.total, 2);
    assert.equal(result.snapshot.completed, 1);
    assert.equal(result.snapshot.activeText, "Implement tracker");
    assert.equal(result.snapshot.confidence, "full");
  });

  it("deduplicates repeated task ids in a full snapshot", () => {
    const root = tempRoot();
    const transcript = path.join(root, "duplicate-ids.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [
          { id: "task-1", content: "Inspect code", status: "pending" },
          { id: "task-1", content: "Inspect code", status: "completed" },
        ],
      }),
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "duplicate-ids", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.completed, 0);
    assert.equal(result.snapshot.pending, 1);
    assert.deepEqual(
      result.snapshot.items.map((item) => item.id),
      ["task-1"]
    );
  });

  it("caps aggregate task and owner arrays at the public response limit", () => {
    const agents = [];
    const events = [];
    for (let index = 0; index < 205; index++) {
      const agentId = `agent-${index}`;
      agents.push({ id: agentId, type: "subagent", subagent_type: "worker" });
      events.push({
        event_type: "TaskCreated",
        agent_id: agentId,
        created_at: `2026-08-07T10:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(
          index % 60
        ).padStart(2, "0")}.000Z`,
        data: JSON.stringify({
          task_id: `task-${index}`,
          task_subject: `Task ${index}`,
        }),
      });
    }

    const result = extractSessionTaskProgress({
      session: { id: "bounded-aggregate", provider: "claude" },
      agents,
      events,
    });

    assert.equal(result.snapshot.items.length, 200);
    assert.equal(result.snapshot.ownerBreakdown.length, 200);
    assert.equal(result.summary.ownerBreakdown.length, 200);
  });

  it("prefers a timestamped owner when another owner has no timestamp", () => {
    const root = tempRoot();
    const sessionId = "missing-owner-timestamp";
    const transcript = path.join(root, `${sessionId}.jsonl`);
    const subagentTranscript = path.join(root, sessionId, "subagents", "agent-reviewer-1.jsonl");
    writeJsonl(transcript, [
      claudeToolUse(undefined, "main-todo", "TodoWrite", {
        todos: [{ content: "Main task", status: "pending" }],
      }),
    ]);
    writeJsonl(subagentTranscript, [
      claudeToolUse("2026-08-07T10:01:00.000Z", "sub-todo", "TodoWrite", {
        todos: [{ content: "Review task", status: "in_progress" }],
      }),
    ]);
    fs.writeFileSync(
      subagentTranscript.replace(".jsonl", ".meta.json"),
      JSON.stringify({ agentType: "reviewer" })
    );

    const result = extractSessionTaskProgress({
      session: { id: sessionId, provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [
        { id: `${sessionId}-main`, type: "main" },
        { id: "reviewer-db-id", type: "subagent", subagent_type: "reviewer" },
      ],
    });

    assert.equal(result.snapshot.sourceTool, "TodoWrite");
    assert.equal(result.snapshot.updatedAt, "2026-08-07T10:01:00.000Z");
    assert.equal(result.snapshot.activeText, "Review task");
  });

  it("bounds large transcript reads to the tail and stops after the first timestamp", () => {
    const root = tempRoot();
    const sessionId = "bounded-tail";
    const transcript = path.join(root, `${sessionId}.jsonl`);
    const subagentTranscript = path.join(root, sessionId, "subagents", "agent-reviewer-1.jsonl");
    const largeBytes = 40 * 1024 * 1024;
    fs.mkdirSync(path.dirname(subagentTranscript), { recursive: true });
    fs.writeFileSync(
      transcript,
      `${JSON.stringify({ type: "system", timestamp: "2026-08-07T09:00:00.000Z" })}\n`
    );
    const descriptor = fs.openSync(subagentTranscript, "w");
    try {
      fs.writeSync(
        descriptor,
        `${JSON.stringify({ type: "system", timestamp: "2026-08-07T10:00:00.000Z" })}\n`
      );
      fs.ftruncateSync(descriptor, largeBytes);
      fs.writeSync(descriptor, "\n", largeBytes, "utf8");
      fs.writeSync(
        descriptor,
        `${JSON.stringify(
          claudeToolUse("2026-08-07T10:05:00.000Z", "tail-todo", "TodoWrite", {
            todos: [{ content: "Tail task", status: "completed" }],
          })
        )}\n`,
        largeBytes + 1,
        "utf8"
      );
    } finally {
      fs.closeSync(descriptor);
    }

    const originalReadSync = fs.readSync;
    let bytesRead = 0;
    fs.readSync = function countedReadSync(...args) {
      const count = originalReadSync.apply(this, args);
      bytesRead += count;
      return count;
    };
    let result;
    try {
      result = extractSessionTaskProgress({
        session: { id: sessionId, provider: "claude" },
        mainTranscriptPath: transcript,
        agents: [
          { id: `${sessionId}-main`, type: "main" },
          { id: "reviewer-db-id", type: "subagent", subagent_type: "reviewer" },
        ],
      });
    } finally {
      fs.readSync = originalReadSync;
    }

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.completed, 1);
    assert.equal(result.snapshot.items[0].text, "Tail task");
    assert.ok(bytesRead < largeBytes, `expected fewer than ${largeBytes} bytes, read ${bytesRead}`);
  });

  it("labels mutation-only Claude task state as partial", () => {
    const root = tempRoot();
    const transcript = path.join(root, "claude-mutations.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "create-1", "TaskCreate", {
        subject: "Inspect code",
      }),
      claudeToolResult("2026-08-07T10:00:01.000Z", "create-1", {
        task: { id: "task-1", subject: "Inspect code", status: "in_progress" },
      }),
    ]);

    const result = extractSessionTaskProgress({
      session: { id: "claude-mutations", provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [{ id: "claude-mutations-main", type: "main" }],
    });

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.confidence, "partial");
  });

  it("derives partial task state from lifecycle events when no transcript snapshot exists", () => {
    const result = extractSessionTaskProgress({
      session: { id: "claude-events", provider: "claude" },
      agents: [{ id: "claude-events-main", type: "main", subagent_type: null }],
      events: [
        {
          event_type: "TaskCreated",
          agent_id: "claude-events-main",
          created_at: "2026-08-07T10:00:00.000Z",
          data: JSON.stringify({
            task_id: "task-1",
            task_subject: "Implement tracker",
          }),
        },
        {
          event_type: "TaskCompleted",
          agent_id: "claude-events-main",
          created_at: "2026-08-07T10:05:00.000Z",
          data: JSON.stringify({
            task_id: "task-1",
            task_subject: "Implement tracker",
          }),
        },
      ],
    });

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.completed, 1);
    assert.equal(result.snapshot.confidence, "partial");
    assert.equal(result.snapshot.includesSubagents, false);
  });

  it("keeps subagent task ownership separate in the session aggregate", () => {
    const root = tempRoot();
    const sessionId = "claude-subagents";
    const transcript = path.join(root, `${sessionId}.jsonl`);
    const subagentTranscript = path.join(root, sessionId, "subagents", "agent-reviewer-1.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "main-todo", "TodoWrite", {
        todos: [{ content: "Implement tracker", status: "in_progress" }],
      }),
    ]);
    writeJsonl(subagentTranscript, [
      claudeToolUse("2026-08-07T10:01:00.000Z", "sub-todo", "TodoWrite", {
        todos: [{ content: "Review tracker", status: "completed" }],
      }),
    ]);
    fs.writeFileSync(
      subagentTranscript.replace(".jsonl", ".meta.json"),
      JSON.stringify({ agentType: "reviewer" })
    );

    const result = extractSessionTaskProgress({
      session: { id: sessionId, provider: "claude" },
      mainTranscriptPath: transcript,
      agents: [
        { id: `${sessionId}-main`, type: "main", started_at: "2026-08-07T09:59:00.000Z" },
        {
          id: "reviewer-db-id",
          type: "subagent",
          subagent_type: "reviewer",
          started_at: "2026-08-07T10:00:30.000Z",
        },
      ],
    });

    assert.equal(result.snapshot.total, 2);
    assert.equal(result.snapshot.includesSubagents, true);
    const subagentItem = result.snapshot.items.find((item) => item.text === "Review tracker");
    assert.equal(subagentItem.agentId, "reviewer-db-id");
    assert.equal(subagentItem.agentType, "reviewer");
    assert.deepEqual(result.snapshot.ownerBreakdown.map((owner) => owner.agentType).sort(), [
      "main",
      "reviewer",
    ]);
  });

  it("invalidates the stat cache when a transcript grows (TTL disabled)", () => {
    // TTL 0 restores immediate re-parse on growth; the default TTL's
    // serve-stale window is covered by the next test.
    // Save and restore rather than delete: the variable may be supplied by the
    // test command, and clobbering it would leak into later tests.
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "growing.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Inspect", status: "in_progress" }],
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "growing", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.completed, 0);

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
            todos: [{ content: "Inspect", status: "completed" }],
          })
        )}\n`
      );

      const second = extractSessionTaskProgress({
        session: { id: "growing", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(second.snapshot.completed, 1);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("serves a just-parsed result for a grown transcript within the TTL", () => {
    // Default TTL: a burst of requests against an actively-appended transcript
    // must not re-parse per request — the second read inside the window sees
    // the cached (stale) snapshot, and clearing the cache forces a fresh one.
    // Clear the override explicitly so this asserts the DEFAULT, not whatever
    // the test command happened to export.
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    try {
      runDefaultTtlAssertions();
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  function runDefaultTtlAssertions() {
    const root = tempRoot();
    const transcript = path.join(root, "growing-ttl.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Inspect", status: "in_progress" }],
      }),
    ]);
    const first = extractSessionTaskProgress({
      session: { id: "growing-ttl", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(first.snapshot.completed, 0);

    fs.appendFileSync(
      transcript,
      `${JSON.stringify(
        claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
          todos: [{ content: "Inspect", status: "completed" }],
        })
      )}\n`
    );

    const stale = extractSessionTaskProgress({
      session: { id: "growing-ttl", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(stale.snapshot.completed, 0);

    clearTaskProgressCache();
    const fresh = extractSessionTaskProgress({
      session: { id: "growing-ttl", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(fresh.snapshot.completed, 1);
  }

  it("re-parses a grown transcript automatically once the TTL expires", async () => {
    // Guards against an accidentally-infinite TTL: with a 1ms window, a read
    // after the window must pick up appended data without any manual clear.
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "1";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "growing-ttl-expiry.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Inspect", status: "in_progress" }],
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "growing-ttl-expiry", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.completed, 0);

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
            todos: [{ content: "Inspect", status: "completed" }],
          })
        )}\n`
      );
      await new Promise((resolve) => setTimeout(resolve, 15));

      const fresh = extractSessionTaskProgress({
        session: { id: "growing-ttl-expiry", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(fresh.snapshot.completed, 1);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });
});

describe("task-progress caches validate file identity", () => {
  /**
   * Replace a transcript with a DIFFERENT file at the same path, matching the
   * original's size and mtime exactly. Only the inode differs — which is
   * precisely what a size+mtime (or TTL) cache key cannot see.
   */
  function replaceInPlace(filePath, entries) {
    // Pin the ORIGINAL to a whole-millisecond mtime first. utimesSync only
    // round-trips millisecond precision, so without this the original's
    // sub-millisecond mtimeMs could never be reproduced on the replacement and
    // the "same size + same mtime" collision this test needs would not happen.
    const pinned = new Date(Math.floor(fs.statSync(filePath).mtimeMs));
    fs.utimesSync(filePath, pinned, pinned);
    const before = fs.statSync(filePath);
    const sibling = `${filePath}.replacement`;
    writeJsonl(sibling, entries);
    // Pad or truncate so the replacement is byte-identical in length.
    const target = before.size;
    let body = fs.readFileSync(sibling);
    if (body.length < target)
      body = Buffer.concat([body, Buffer.alloc(target - body.length, 0x20)]);
    else body = body.subarray(0, target);
    fs.writeFileSync(sibling, body);
    fs.renameSync(sibling, filePath);
    fs.utimesSync(filePath, before.atime, before.mtime);
    return { before, after: fs.statSync(filePath) };
  }

  it("does not serve a replaced file from the previous file's parse", () => {
    // Within the TTL — and even on an exact size+mtime match — a different
    // inode at the same path must force a fresh parse.
    const root = tempRoot();
    const transcript = path.join(root, "replaced.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Inspect", status: "in_progress" }],
      }),
    ]);
    const first = extractSessionTaskProgress({
      session: { id: "replaced", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(first.snapshot.completed, 0);

    const { before, after } = replaceInPlace(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "Inspect", status: "completed" }],
      }),
    ]);
    // Assert the PRECONDITION, not just the outcome: without proving that size
    // and mtime actually collided, a filesystem that fails to preserve mtimeMs
    // would make this test pass through mtime detection and quietly stop
    // testing inode detection at all.
    assert.equal(after.size, before.size, "replacement must match the original size");
    assert.equal(after.mtimeMs, before.mtimeMs, "replacement must match the original mtime");
    assert.notEqual(after.ino, before.ino, "replacement must be a different inode");

    const second = extractSessionTaskProgress({
      session: { id: "replaced", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(
      second.snapshot.completed,
      1,
      "a different inode at the same path must not reuse the cached parse"
    );
  });

  it("re-parses a truncated transcript instead of serving stale observations", () => {
    // Transcripts are append-only, so a SMALLER file means truncation or
    // replacement — the cached observations no longer describe it, even inside
    // the TTL window.
    const root = tempRoot();
    const transcript = path.join(root, "truncated.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [
          { content: "One", status: "completed" },
          { content: "Two", status: "completed" },
        ],
      }),
    ]);
    const first = extractSessionTaskProgress({
      session: { id: "truncated", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(first.snapshot.completed, 2);

    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
        todos: [{ content: "One", status: "in_progress" }],
      }),
    ]);

    const second = extractSessionTaskProgress({
      session: { id: "truncated", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(second.snapshot.completed, 0, "a shrunken file must be re-parsed");
  });
});
