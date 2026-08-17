/**
 * @file Verifies Codex rollout transcript parsing for human turns, persisted
 * images, custom exec tool calls, paired outputs, and backward pagination.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-codex-transcript-"));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");

const { db } = require("../db");
const { readCodexTranscript } = require("../routes/sessions");
const ROLLOUT = path.join(TMP, "rollout.jsonl");

function record(type, payload) {
  return { timestamp: "2026-08-01T12:00:00.000Z", type, payload };
}

after(() => {
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("Codex transcript reader", () => {
  it("shows human turns and custom exec calls instead of a wait-only stream", async () => {
    const records = [
      record("session_meta", { id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c" }),
      record("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Investigate the title sync" }],
      }),
      record("event_msg", { type: "user_message", message: "Investigate the title sync" }),
      record("response_item", {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "I am tracing the session index." }],
      }),
      record("response_item", {
        type: "custom_tool_call",
        name: "exec",
        call_id: "exec-1",
        input: 'const result = await tools.exec_command({ cmd: "rg session_index" });',
      }),
      record("response_item", {
        type: "custom_tool_call_output",
        call_id: "exec-1",
        output: [{ type: "input_text", text: "session_index.jsonl found" }],
      }),
      record("response_item", {
        type: "function_call",
        name: "wait",
        call_id: "wait-1",
        arguments: '{"cell_id":"123"}',
      }),
      record("response_item", {
        type: "function_call_output",
        call_id: "wait-1",
        output: "completed",
      }),
      record("event_msg", { type: "user_message", message: "Now show the result." }),
    ];
    fs.writeFileSync(ROLLOUT, records.map((entry) => JSON.stringify(entry)).join("\n") + "\n");

    const all = await readCodexTranscript(ROLLOUT, {
      limit: 20,
      afterLine: null,
      beforeLine: null,
      offset: 0,
    });
    assert.equal(all.messages.length, 7, "response/event user copies are deduplicated");
    assert.deepEqual(
      all.messages
        .filter((message) => message.sender === "user")
        .map((message) => message.content[0].text),
      ["Investigate the title sync", "Now show the result."]
    );
    const toolNames = all.messages
      .flatMap((message) => message.content)
      .filter((content) => content.type === "tool_use")
      .map((content) => content.name);
    assert.deepEqual(toolNames, ["exec", "wait"]);
    const execCall = all.messages
      .flatMap((message) => message.content)
      .find((content) => content.type === "tool_use" && content.name === "exec");
    assert.match(execCall.input.code, /session_index/);
    const execResult = all.messages
      .flatMap((message) => message.content)
      .find((content) => content.type === "tool_result" && content.id === "exec-1");
    assert.equal(execResult.output, "session_index.jsonl found");

    // A response item can flush before the matching user_message event. When
    // the client asks for records after that response line, the event must not
    // re-append the same human turn as a live duplicate.
    const afterResponse = await readCodexTranscript(ROLLOUT, {
      limit: 20,
      afterLine: 2,
      beforeLine: null,
      offset: 0,
    });
    assert.deepEqual(
      afterResponse.messages
        .filter((message) => message.sender === "user")
        .map((message) => message.content[0].text),
      ["Now show the result."]
    );

    const latest = await readCodexTranscript(ROLLOUT, {
      limit: 2,
      afterLine: null,
      beforeLine: null,
      offset: 0,
    });
    assert.equal(latest.has_more, true);
    const older = await readCodexTranscript(ROLLOUT, {
      limit: 2,
      afterLine: null,
      beforeLine: latest.first_line,
      offset: 0,
    });
    assert.deepEqual(
      older.messages.map((message) => message.content[0].type),
      ["tool_result", "tool_use"]
    );
    assert.equal(older.messages[1].content[0].name, "wait");
  });

  it("renders a persisted image once and drops its duplicate durable user event", async () => {
    const image =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+4JQhWQAAAABJRU5ErkJggg==";
    const caption = "The contrast on this card is too low.";
    const records = [
      record("response_item", {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: '<image name="card" path="/tmp/card.png">' },
          { type: "input_image", image_url: image, detail: "high" },
          { type: "input_text", text: "</image>" },
          { type: "input_text", text: caption },
        ],
      }),
      record("event_msg", { type: "user_message", message: caption }),
    ];
    fs.writeFileSync(ROLLOUT, records.map((entry) => JSON.stringify(entry)).join("\n") + "\n");

    const result = await readCodexTranscript(ROLLOUT, {
      limit: 20,
      afterLine: null,
      beforeLine: null,
      offset: 0,
    });
    const humanTurns = result.messages.filter((message) => message.sender === "user");
    assert.equal(humanTurns.length, 1, "the response/event pair is one real human turn");
    assert.equal(humanTurns[0].content.find((content) => content.type === "text").text, caption);
    const imageBlock = humanTurns[0].content.find((content) => content.type === "image");
    assert.ok(imageBlock?.src?.startsWith("data:image/png;base64,"));
    assert.ok(
      !humanTurns[0].content.some(
        (content) => content.type === "text" && /<image|\/tmp\/card/.test(content.text || "")
      ),
      "the transcript never exposes the CLI's raw image path wrapper"
    );
  });
});
