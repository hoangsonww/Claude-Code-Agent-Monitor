/**
 * @file Unit tests for owner-attributed Claude and Codex task-progress
 * extraction from JSONL transcripts and Claude lifecycle event fallbacks.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { afterEach, describe, it, mock } = require("node:test");
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

function withoutSourceLine(snapshot) {
  if (!snapshot) return null;
  const stripped = { ...snapshot };
  delete stripped.sourceLine;
  return stripped;
}

afterEach(() => {
  mock.restoreAll();
  clearTaskProgressCache();
  while (roots.length) {
    fs.rmSync(roots.pop(), { recursive: true, force: true });
  }
});

describe("incremental task-progress transcript parsing", () => {
  it("reads only appended bytes when task progress grows", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "incremental-read.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Inspect", status: "in_progress" }],
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "incremental-read", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.completed, 0);

      const appended = `${JSON.stringify(
        claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
          todos: [{ content: "Inspect", status: "completed" }],
        })
      )}\n`;
      fs.appendFileSync(transcript, appended);

      const originalReadSync = fs.readSync;
      let bytesRead = 0;
      mock.method(fs, "readSync", (...args) => {
        const count = Reflect.apply(originalReadSync, fs, args);
        bytesRead += count;
        return count;
      });
      const second = extractSessionTaskProgress({
        session: { id: "incremental-read", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(second.snapshot.completed, 1);
      assert.equal(bytesRead, Buffer.byteLength(appended));
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("enriches a tool call when its result arrives in a later increment", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "split-tool-result.jsonl");
      writeJsonl(transcript, [claudeToolUse("2026-08-07T10:00:00.000Z", "list-1", "TaskList", {})]);
      const first = extractSessionTaskProgress({
        session: { id: "split-tool-result", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot, null);

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolResult("2026-08-07T10:00:01.000Z", "list-1", {
            tasks: [{ id: "task-1", subject: "Inspect", status: "completed" }],
          })
        )}\n`
      );
      const second = extractSessionTaskProgress({
        session: { id: "split-tool-result", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(second.snapshot.sourceTool, "TaskList");
      assert.equal(second.snapshot.sourceLine, 2);
      assert.equal(second.snapshot.total, 1);
      assert.equal(second.snapshot.completed, 1);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("retains output-dependent TaskGet and TaskUpdate calls across increments", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "split-output-dependent-results.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "get-1", "TaskGet", {
          task_id: "task-1",
        }),
        claudeToolUse("2026-08-07T10:00:01.000Z", "update-1", "TaskUpdate", {
          task_id: "task-2",
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "split-output-dependent-results", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot, null);

      fs.appendFileSync(
        transcript,
        [
          claudeToolResult("2026-08-07T10:00:02.000Z", "get-1", {
            task: { id: "task-1", subject: "Fetched task", status: "completed" },
          }),
          claudeToolResult("2026-08-07T10:00:03.000Z", "update-1", {
            task: { id: "task-2", subject: "Updated task", status: "in_progress" },
          }),
        ]
          .map((entry) => JSON.stringify(entry))
          .join("\n") + "\n"
      );
      const second = extractSessionTaskProgress({
        session: { id: "split-output-dependent-results", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.deepEqual(
        second.snapshot.items.map(({ id, text, status }) => ({ id, text, status })),
        [
          { id: "task-1", text: "Fetched task", status: "completed" },
          { id: "task-2", text: "Updated task", status: "in_progress" },
        ]
      );
      assert.equal(second.snapshot.sourceTool, "TaskUpdate");
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("does not retain unmatched non-task tool inputs across increments", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "non-task-pending-call.jsonl");
      const registeredCallIds = new Set();
      const originalMapSet = Map.prototype.set;
      mock.method(Map.prototype, "set", function recordPendingCall(key, value) {
        if (value?.tool && Object.hasOwn(value, "input") && value._byte !== undefined) {
          registeredCallIds.add(key);
        }
        return Reflect.apply(originalMapSet, this, [key, value]);
      });
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "write-1", "Write", {
          file_path: "/tmp/large.txt",
          content: "x".repeat(1024 * 1024),
        }),
        claudeToolUse("2026-08-07T10:00:01.000Z", "list-1", "TaskList", {}),
      ]);

      extractSessionTaskProgress({
        session: { id: "non-task-pending-call", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      fs.appendFileSync(
        transcript,
        `${JSON.stringify({
          type: "response_item",
          timestamp: "2026-08-07T10:00:02.000Z",
          payload: { type: "message", role: "assistant", content: "Still working" },
        })}\n`
      );
      extractSessionTaskProgress({
        session: { id: "non-task-pending-call", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(registeredCallIds.has("list-1"), true);
      assert.equal(registeredCallIds.has("write-1"), false);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("forgets a matched pending call after its first result", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "matched-pending-call.jsonl");
      writeJsonl(transcript, [claudeToolUse("2026-08-07T10:00:00.000Z", "list-1", "TaskList", {})]);
      extractSessionTaskProgress({
        session: { id: "matched-pending-call", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolResult("2026-08-07T10:00:01.000Z", "list-1", {
            tasks: [{ id: "first", subject: "First result", status: "completed" }],
          })
        )}\n`
      );
      extractSessionTaskProgress({
        session: { id: "matched-pending-call", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolResult("2026-08-07T10:00:02.000Z", "list-1", {
            tasks: [{ id: "duplicate", subject: "Duplicate result", status: "pending" }],
          })
        )}\n`
      );
      const result = extractSessionTaskProgress({
        session: { id: "matched-pending-call", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.deepEqual(
        result.snapshot.items.map((item) => item.id),
        ["first"]
      );
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("waits for a partial trailing line and consumes it exactly once", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "partial-line.jsonl");
      const firstLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "First", status: "in_progress" }],
        })
      );
      const partialLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
          todos: [{ content: "Second", status: "completed" }],
        })
      );
      fs.writeFileSync(transcript, `${firstLine}\n${partialLine}`);

      const beforeCompletion = extractSessionTaskProgress({
        session: { id: "partial-line", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(beforeCompletion.snapshot.activeText, "First");
      assert.equal(beforeCompletion.snapshot.sourceLine, 1);

      fs.appendFileSync(transcript, "\n");
      const completed = extractSessionTaskProgress({
        session: { id: "partial-line", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(completed.snapshot.completed, 1);
      assert.equal(completed.snapshot.items[0].text, "Second");
      assert.equal(completed.snapshot.sourceLine, 2);

      const thirdLine = `${JSON.stringify(
        claudeToolUse("2026-08-07T10:02:00.000Z", "todo-3", "TodoWrite", {
          todos: [{ content: "Third", status: "pending" }],
        })
      )}\n`;
      fs.appendFileSync(transcript, thirdLine);
      const afterAnotherAppend = extractSessionTaskProgress({
        session: { id: "partial-line", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(afterAnotherAppend.snapshot.items[0].text, "Third");
      assert.equal(afterAnotherAppend.snapshot.sourceLine, 3);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("handles an empty increment without reading or advancing lines", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "empty-increment.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Unchanged", status: "pending" }],
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "empty-increment", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.sourceLine, 1);

      const future = new Date(Date.now() + 10_000);
      fs.utimesSync(transcript, future, future);
      const originalReadSync = fs.readSync;
      let bytesRead = 0;
      mock.method(fs, "readSync", (...args) => {
        const count = Reflect.apply(originalReadSync, fs, args);
        bytesRead += count;
        return count;
      });
      const second = extractSessionTaskProgress({
        session: { id: "empty-increment", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(second.snapshot.sourceLine, 1);
      assert.equal(bytesRead, 0);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("parses CRLF-delimited increments at complete-line boundaries", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "crlf.jsonl");
      const firstLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "First", status: "pending" }],
        })
      );
      fs.writeFileSync(transcript, `${firstLine}\r\n`);
      extractSessionTaskProgress({
        session: { id: "crlf", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      const secondLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
          todos: [{ content: "Second", status: "completed" }],
        })
      );
      fs.appendFileSync(transcript, `${secondLine}\r\n`);
      const result = extractSessionTaskProgress({
        session: { id: "crlf", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(result.snapshot.items[0].text, "Second");
      assert.equal(result.snapshot.completed, 1);
      assert.equal(result.snapshot.sourceLine, 2);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("skips an overlong line that straddles increments", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "overlong-increment.jsonl");
      const firstLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Before", status: "pending" }],
        })
      );
      fs.writeFileSync(transcript, `${firstLine}\n${"x".repeat(16 * 1024 * 1024 + 1)}`);
      const first = extractSessionTaskProgress({
        session: { id: "overlong-increment", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.items[0].text, "Before");

      const afterLongLine = JSON.stringify(
        claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
          todos: [{ content: "After", status: "completed" }],
        })
      );
      fs.appendFileSync(transcript, `\n${afterLongLine}\n`);
      const second = extractSessionTaskProgress({
        session: { id: "overlong-increment", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      assert.equal(second.snapshot.items[0].text, "After");
      assert.equal(second.snapshot.completed, 1);
      assert.equal(second.snapshot.sourceLine, 3);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("falls back to a fresh tail parse after growth beyond the scan limit", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "oversized-growth.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "old", "TaskUpdate", {
          task_id: "old",
          subject: "Old task",
          status: "pending",
        }),
      ]);
      const first = extractSessionTaskProgress({
        session: { id: "oversized-growth", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(first.snapshot.items[0].id, "old");

      const descriptor = fs.openSync(transcript, "r+");
      try {
        const separatorPosition = fs.fstatSync(descriptor).size + 40 * 1024 * 1024;
        fs.writeSync(descriptor, "\n", separatorPosition, "utf8");
        const newLine = `${JSON.stringify(
          claudeToolUse("2026-08-07T10:01:00.000Z", "new", "TaskUpdate", {
            task_id: "new",
            subject: "New task",
            status: "completed",
          })
        )}\n`;
        fs.writeSync(descriptor, newLine, separatorPosition + 1, "utf8");
      } finally {
        fs.closeSync(descriptor);
      }

      const originalReadSync = fs.readSync;
      let bytesRead = 0;
      mock.method(fs, "readSync", (...args) => {
        const count = Reflect.apply(originalReadSync, fs, args);
        bytesRead += count;
        return count;
      });
      const second = extractSessionTaskProgress({
        session: { id: "oversized-growth", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.deepEqual(
        second.snapshot.items.map((item) => item.id),
        ["new"]
      );
      assert.equal(second.snapshot.completed, 1);
      assert.ok(bytesRead <= 33 * 1024 * 1024, `expected a bounded tail read, read ${bytesRead}`);
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("skips a valid JSON suffix when the fresh-tail cutoff is inside its line", () => {
    const root = tempRoot();
    const transcript = path.join(root, "valid-partial-tail-line.jsonl");
    const whitespaceBytes = 128;
    const cutoff = 64;
    const taskLine = `${" ".repeat(whitespaceBytes)}${JSON.stringify(
      claudeToolUse("2026-08-07T10:00:00.000Z", "partial", "TodoWrite", {
        todos: [{ content: "Must be skipped", status: "completed" }],
      })
    )}\n`;
    fs.writeFileSync(transcript, taskLine);
    const descriptor = fs.openSync(transcript, "r+");
    try {
      fs.writeSync(descriptor, "\n", 32 * 1024 * 1024 + cutoff - 1, "utf8");
    } finally {
      fs.closeSync(descriptor);
    }

    const result = extractSessionTaskProgress({
      session: { id: "valid-partial-tail-line", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot, null);
  });

  it("keeps incremental and cold snapshots equivalent as the byte window advances", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "warm-cold-equivalence.jsonl");
      const session = { id: "warm-cold-equivalence", provider: "claude" };
      const callLine = `${JSON.stringify(
        claudeToolUse("2026-08-07T10:00:00.000Z", "list-1", "TaskList", {})
      )}\n`;
      const resultLine = `${JSON.stringify(
        claudeToolResult("2026-08-07T10:00:01.000Z", "list-1", {
          tasks: [{ id: "task-1", subject: "Matched task", status: "completed" }],
        })
      )}\n`;
      fs.writeFileSync(transcript, callLine + resultLine);

      function assertWarmMatchesCold(step) {
        const warm = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
        clearTaskProgressCache();
        const cold = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
        assert.deepEqual(withoutSourceLine(warm.snapshot), withoutSourceLine(cold.snapshot), step);
      }

      assertWarmMatchesCold("initial matched result");
      fs.appendFileSync(
        transcript,
        `${JSON.stringify({
          type: "response_item",
          timestamp: "2026-08-07T10:00:02.000Z",
          payload: { type: "message", role: "assistant", content: "Still working" },
        })}\n`
      );
      assertWarmMatchesCold("small append");

      const resultByteOffset = Buffer.byteLength(callLine);
      const boundarySize = 32 * 1024 * 1024 + resultByteOffset;
      const descriptor = fs.openSync(transcript, "r+");
      try {
        fs.writeSync(descriptor, "\n", boundarySize - 1, "utf8");
      } finally {
        fs.closeSync(descriptor);
      }
      assertWarmMatchesCold("cutoff between matched call and result");

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolUse("2026-08-07T10:00:03.000Z", "later", "TaskUpdate", {
            task_id: "later",
            subject: "Later task",
            status: "in_progress",
          })
        )}\n`
      );
      assertWarmMatchesCold("task append after cutoff");
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

  it("keeps several hundred subagent transcripts cached between requests", () => {
    const root = tempRoot();
    const session = { id: "many-subagents", provider: "claude" };
    const transcript = path.join(root, `${session.id}.jsonl`);
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "main-todo", "TodoWrite", {
        todos: [{ content: "Main work", status: "in_progress" }],
      }),
    ]);
    const subagentDir = path.join(root, session.id, "subagents");
    const fileCount = 300;
    for (let index = 0; index < fileCount; index++) {
      writeJsonl(path.join(subagentDir, `agent-${String(index).padStart(3, "0")}.jsonl`), [
        claudeToolUse("2026-08-07T10:01:00.000Z", `todo-${index}`, "TodoWrite", {
          todos: [{ content: `Subagent ${index}`, status: "completed" }],
        }),
      ]);
    }
    const first = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
    assert.ok(first.snapshot.total > 0);

    const originalReadSync = fs.readSync;
    let bytesRead = 0;
    mock.method(fs, "readSync", (...args) => {
      const count = Reflect.apply(originalReadSync, fs, args);
      bytesRead += count;
      return count;
    });
    const second = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
    assert.deepEqual(second.snapshot, first.snapshot);
    assert.equal(
      bytesRead,
      0,
      `expected every transcript to be served from cache, read ${bytesRead}`
    );
  });

  it("re-parses a same-inode rewrite that shrinks below the cached size but not the offset", () => {
    const root = tempRoot();
    const transcript = path.join(root, "shrink-above-offset.jsonl");
    const session = { id: "shrink-above-offset", provider: "claude" };
    const firstLine = `${JSON.stringify(
      claudeToolUse("2026-08-07T10:00:00.000Z", "first", "TodoWrite", {
        todos: [{ content: "Before rewrite", status: "completed" }],
      })
    )}\n`;
    // A trailing fragment leaves the cached offset at the end of the first
    // line while the cached size is larger.
    fs.writeFileSync(transcript, `${firstLine}${"{".padEnd(4096, " ")}`);
    const originalStat = fs.statSync(transcript);
    const first = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
    assert.equal(first.snapshot.items[0].text, "Before rewrite");

    const rewrittenLine = `${JSON.stringify(
      claudeToolUse("2026-08-07T10:01:00.000Z", "rewritten", "TodoWrite", {
        todos: [{ content: "After rewrite", status: "pending" }],
      })
    )}\n`;
    fs.writeFileSync(transcript, `${rewrittenLine}${" ".repeat(512)}\n`);
    const rewrittenStat = fs.statSync(transcript);
    assert.equal(rewrittenStat.ino, originalStat.ino);
    assert.ok(rewrittenStat.size > Buffer.byteLength(firstLine));
    assert.ok(rewrittenStat.size < originalStat.size);

    const warm = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
    clearTaskProgressCache();
    const cold = extractSessionTaskProgress({ session, mainTranscriptPath: transcript });
    assert.deepEqual(withoutSourceLine(warm.snapshot), withoutSourceLine(cold.snapshot));
    assert.equal(warm.snapshot.total, 1);
    assert.equal(warm.snapshot.items[0].text, "After rewrite");
  });

  it("parses a line that begins exactly at the fresh-tail cutoff", () => {
    const root = tempRoot();
    const transcript = path.join(root, "exact-tail-boundary.jsonl");
    const prefix = `${"x".repeat(63)}\n`;
    const taskLine = `${JSON.stringify(
      claudeToolUse("2026-08-07T10:00:00.000Z", "boundary", "TodoWrite", {
        todos: [{ content: "Starts at the cutoff", status: "completed" }],
      })
    )}\n`;
    fs.writeFileSync(transcript, `${prefix}${taskLine}`);
    const descriptor = fs.openSync(transcript, "r+");
    try {
      fs.writeSync(descriptor, "\n", Buffer.byteLength(prefix) + 32 * 1024 * 1024 - 1, "utf8");
    } finally {
      fs.closeSync(descriptor);
    }
    assert.equal(fs.statSync(transcript).size - 32 * 1024 * 1024, Buffer.byteLength(prefix));

    const result = extractSessionTaskProgress({
      session: { id: "exact-tail-boundary", provider: "claude" },
      mainTranscriptPath: transcript,
    });

    assert.equal(result.snapshot.total, 1);
    assert.equal(result.snapshot.items[0].text, "Starts at the cutoff");
  });

  it("resets incremental state after truncation and inode rotation", () => {
    const root = tempRoot();
    const transcript = path.join(root, "reset-incremental-state.jsonl");
    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:00:00.000Z", "old", "TodoWrite", {
        todos: [
          { content: "Old one", status: "completed" },
          { content: "Old two", status: "completed" },
        ],
      }),
    ]);
    const originalStat = fs.statSync(transcript);
    const first = extractSessionTaskProgress({
      session: { id: "reset-incremental-state", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(first.snapshot.total, 2);

    writeJsonl(transcript, [
      claudeToolUse("2026-08-07T10:01:00.000Z", "truncated", "TodoWrite", {
        todos: [{ content: "After truncation", status: "pending" }],
      }),
    ]);
    const truncatedStat = fs.statSync(transcript);
    assert.equal(truncatedStat.ino, originalStat.ino);
    assert.ok(truncatedStat.size < originalStat.size);
    const afterTruncation = extractSessionTaskProgress({
      session: { id: "reset-incremental-state", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(afterTruncation.snapshot.total, 1);
    assert.equal(afterTruncation.snapshot.items[0].text, "After truncation");

    const replacement = `${transcript}.replacement`;
    writeJsonl(replacement, [
      claudeToolUse("2026-08-07T10:02:00.000Z", "rotated", "TodoWrite", {
        todos: [{ content: "After rotation", status: "completed" }],
      }),
    ]);
    fs.renameSync(replacement, transcript);
    assert.notEqual(fs.statSync(transcript).ino, truncatedStat.ino);
    const afterRotation = extractSessionTaskProgress({
      session: { id: "reset-incremental-state", provider: "claude" },
      mainTranscriptPath: transcript,
    });
    assert.equal(afterRotation.snapshot.total, 1);
    assert.equal(afterRotation.snapshot.completed, 1);
    assert.equal(afterRotation.snapshot.items[0].text, "After rotation");
  });

  it("evicts observations and pending calls outside the incremental byte window", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "0";
    try {
      const root = tempRoot();
      const transcript = path.join(root, "incremental-byte-window.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "early", "TaskUpdate", {
          task_id: "early",
          subject: "Early task",
          status: "pending",
        }),
        claudeToolUse("2026-08-07T10:00:01.000Z", "old-list", "TaskList", {}),
      ]);
      extractSessionTaskProgress({
        session: { id: "incremental-byte-window", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      const originalReadSync = fs.readSync;
      let bytesRead = 0;
      mock.method(fs, "readSync", (...args) => {
        const count = Reflect.apply(originalReadSync, fs, args);
        bytesRead += count;
        return count;
      });

      for (let index = 1; index <= 3; index++) {
        const sizeBeforeAppend = fs.statSync(transcript).size;
        const descriptor = fs.openSync(transcript, "r+");
        try {
          const separatorPosition = fs.fstatSync(descriptor).size + 11 * 1024 * 1024;
          fs.writeSync(descriptor, "\n", separatorPosition, "utf8");
          fs.writeSync(
            descriptor,
            `${JSON.stringify(
              claudeToolUse(`2026-08-07T10:0${index}:00.000Z`, `later-${index}`, "TaskUpdate", {
                task_id: `later-${index}`,
                subject: `Later task ${index}`,
                status: index === 3 ? "completed" : "pending",
              })
            )}\n`,
            separatorPosition + 1,
            "utf8"
          );
        } finally {
          fs.closeSync(descriptor);
        }
        const appendedBytes = fs.statSync(transcript).size - sizeBeforeAppend;
        bytesRead = 0;
        extractSessionTaskProgress({
          session: { id: "incremental-byte-window", provider: "claude" },
          mainTranscriptPath: transcript,
        });
        assert.equal(bytesRead, appendedBytes, `increment ${index} must parse only appended bytes`);
      }

      const windowed = extractSessionTaskProgress({
        session: { id: "incremental-byte-window", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.deepEqual(
        windowed.snapshot.items.map((item) => item.id),
        ["later-1", "later-2", "later-3"]
      );
      assert.equal(JSON.stringify(windowed).includes("_byte"), false);

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolResult("2026-08-07T10:05:00.000Z", "old-list", {
            tasks: [{ id: "stale", subject: "Stale result", status: "completed" }],
          })
        )}\n`
      );
      const afterLateResult = extractSessionTaskProgress({
        session: { id: "incremental-byte-window", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.deepEqual(
        afterLateResult.snapshot.items.map((item) => item.id),
        ["later-1", "later-2", "later-3"]
      );
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });
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
    // TTL 0 restores immediate parsing on growth; the default TTL's
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
    // must not parse per request — the second read inside the window sees
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

  it("uses a fixed parse TTL even when requests keep arriving", () => {
    const priorTtl = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
    process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = "300";
    let now = 1_000_000;
    mock.method(Date, "now", () => now);
    try {
      const root = tempRoot();
      const transcript = path.join(root, "fixed-growing-ttl.jsonl");
      writeJsonl(transcript, [
        claudeToolUse("2026-08-07T10:00:00.000Z", "todo-1", "TodoWrite", {
          todos: [{ content: "Original", status: "in_progress" }],
        }),
      ]);
      extractSessionTaskProgress({
        session: { id: "fixed-growing-ttl", provider: "claude" },
        mainTranscriptPath: transcript,
      });

      fs.appendFileSync(
        transcript,
        `${JSON.stringify(
          claudeToolUse("2026-08-07T10:01:00.000Z", "todo-2", "TodoWrite", {
            todos: [{ content: "Appended", status: "completed" }],
          })
        )}\n`
      );

      for (const elapsed of [0, 100, 200]) {
        now = 1_000_000 + elapsed;
        const result = extractSessionTaskProgress({
          session: { id: "fixed-growing-ttl", provider: "claude" },
          mainTranscriptPath: transcript,
        });
        assert.equal(result.snapshot.items[0].text, "Original");
      }

      now = 1_000_299;
      const beforeExpiry = extractSessionTaskProgress({
        session: { id: "fixed-growing-ttl", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(beforeExpiry.snapshot.items[0].text, "Original");

      now = 1_000_300;
      const atExpiry = extractSessionTaskProgress({
        session: { id: "fixed-growing-ttl", provider: "claude" },
        mainTranscriptPath: transcript,
      });
      assert.equal(atExpiry.snapshot.items[0].text, "Appended");
    } finally {
      if (priorTtl === undefined) delete process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
      else process.env.DASHBOARD_TASK_SUMMARY_TTL_MS = priorTtl;
    }
  });

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
