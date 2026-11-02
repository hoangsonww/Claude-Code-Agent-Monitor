/**
 * @file cursor-store-transcript.test.js
 * @description The chat store, not the lossy JSONL export, is the conversation
 * the dashboard shows: user queries stay in order and tool results pair with
 * the calls that produced them.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const {
  cursorVisibleTexts,
  readCursorStoreFile,
  snapshotCursorStore,
  cursorStoreSnapshotPending,
} = require("../lib/cursor-store-transcript");

function hash(id) {
  return Buffer.from(id.padEnd(32, "0").slice(0, 32));
}

describe("Cursor store transcript", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-store-"));
  const dbPath = path.join(root, "store.db");

  after(() => fs.rmSync(root, { recursive: true, force: true }));

  it("keeps the typed query and drops the image preamble", () => {
    assert.deepEqual(
      cursorVisibleTexts([
        { type: "text", text: "<image_files>saved to disk</image_files>" },
        {
          type: "text",
          text: "<timestamp>Sunday, Nov 1, 2026, 8:45 PM (UTC-8)</timestamp> <user_query>fix the overflow</user_query>",
        },
      ]),
      ["fix the overflow"]
    );
  });

  it("reads tool calls and their results in store order", () => {
    const db = new Database(dbPath);
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)");
    db.exec("CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB)");
    const user = hash("user-message-blob-id-0001");
    const assistant = hash("assistant-tool-blob-id-002");
    const tool = hash("tool-result-blob-id-00003");
    const rootId = hash("root-blob-id-0000000000004");
    const insert = db.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
    insert.run(
      user.toString("hex"),
      JSON.stringify({
        role: "user",
        content: [
          { type: "text", text: "<image_files>ignored</image_files>" },
          { type: "text", text: "<user_query>fix the overflow</user_query>" },
        ],
      })
    );
    insert.run(
      assistant.toString("hex"),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "reasoning", text: "" },
          { type: "tool-call", toolCallId: "call-1", toolName: "Read", args: { path: "a.js" } },
        ],
      })
    );
    insert.run(
      tool.toString("hex"),
      JSON.stringify({
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "call-1", toolName: "Read", result: "file body" },
        ],
      })
    );
    const root = Buffer.concat([
      Buffer.from([0x0a, 0x20]),
      user,
      Buffer.from([0x0a, 0x20]),
      assistant,
      Buffer.from([0x0a, 0x20]),
      tool,
    ]);
    insert.run(rootId.toString("hex"), root);
    db.prepare("INSERT INTO meta (key, value) VALUES ('0', ?)").run(
      JSON.stringify({ latestRootBlobId: rootId.toString("hex") })
    );
    db.close();

    const messages = readCursorStoreFile(dbPath);
    assert.equal(messages.length, 3);
    assert.equal(messages[0].content[0].text, "fix the overflow");
    assert.equal(messages[1].content[0].type, "tool_use");
    assert.equal(messages[1].content[0].id, "call-1");
    assert.equal(messages[2].sender, "tool");
    assert.equal(messages[2].content[0].id, "call-1");
    assert.equal(messages[2].content[0].output, "file body");
  });

  it("retries a failed store snapshot until the attempt limit", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-snap-retry-"));
    const previousHome = process.env.DASHBOARD_CURSOR_HOME;
    const previousData = process.env.DASHBOARD_DATA_DIR;
    process.env.DASHBOARD_CURSOR_HOME = home;
    process.env.DASHBOARD_DATA_DIR = home;
    const sessionId = "snapretry1";
    const chat = path.join(home, "chats", "workspace", sessionId);
    fs.mkdirSync(chat, { recursive: true });
    fs.writeFileSync(path.join(chat, "store.db"), "");
    // A file where the snapshot directory should be makes mkdirSync throw.
    fs.writeFileSync(path.join(home, "cursor-transcripts"), "occupied");
    try {
      assert.equal(snapshotCursorStore(sessionId), false);
      assert.equal(cursorStoreSnapshotPending(sessionId), true);
      snapshotCursorStore(sessionId);
      snapshotCursorStore(sessionId);
      snapshotCursorStore(sessionId);
      assert.equal(snapshotCursorStore(sessionId), false);
      assert.equal(cursorStoreSnapshotPending(sessionId), false);
    } finally {
      if (previousHome === undefined) delete process.env.DASHBOARD_CURSOR_HOME;
      else process.env.DASHBOARD_CURSOR_HOME = previousHome;
      if (previousData === undefined) delete process.env.DASHBOARD_DATA_DIR;
      else process.env.DASHBOARD_DATA_DIR = previousData;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
