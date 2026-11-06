/**
 * @file Regression tests for compact Cursor native-store snapshots and the
 * safe migration of legacy full-database backups.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
let Database;
try {
  Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch {
  Database = require("../compat-sqlite");
}

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-store-snapshot-"));
process.env.DASHBOARD_DATA_DIR = path.join(ROOT, "data");
process.env.DASHBOARD_CURSOR_HOME = path.join(ROOT, ".cursor");

const { getCursorSnapshotDir } = require("../lib/cursor-home");
const {
  COMPACT_STORE_NAME,
  compactLegacyCursorStores,
  readCursorStoreMessages,
  snapshotCursorStore,
} = require("../lib/cursor-store-transcript");

function hash(label) {
  return Buffer.from(label.padEnd(32, "0").slice(0, 32));
}

function createStore(filePath, label = "current") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const store = new Database(filePath);
  store.exec(
    "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); " +
      "CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB)"
  );
  const user = hash(`${label}-user`);
  const assistant = hash(`${label}-assistant`);
  const tool = hash(`${label}-tool`);
  const root = hash(`${label}-root`);
  const insert = store.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
  insert.run(
    user.toString("hex"),
    JSON.stringify({
      role: "user",
      content: [{ type: "text", text: `<user_query>${label} prompt</user_query>` }],
    })
  );
  insert.run(
    assistant.toString("hex"),
    JSON.stringify({
      role: "assistant",
      content: [
        {
          type: "text",
          text: `${label} response`,
          providerOptions: { cursor: { modelName: "cursor-grok-4.7" } },
        },
        { type: "tool-call", toolName: "Read", toolCallId: "call-1", args: { path: "/tmp" } },
      ],
    })
  );
  insert.run(
    tool.toString("hex"),
    JSON.stringify({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolName: "Read",
          toolCallId: "call-1",
          result: "file contents",
        },
      ],
    })
  );
  insert.run(
    root.toString("hex"),
    Buffer.concat([
      Buffer.from([0x0a, 0x20]),
      user,
      Buffer.from([0x0a, 0x20]),
      assistant,
      Buffer.from([0x0a, 0x20]),
      tool,
    ])
  );
  store
    .prepare("INSERT INTO meta (key, value) VALUES ('0', ?)")
    .run(JSON.stringify({ latestRootBlobId: root.toString("hex") }));
  for (let index = 0; index < 8; index++) {
    insert.run(Buffer.alloc(32, index + 1).toString("hex"), Buffer.alloc(1024 * 1024, index));
  }
  store.close();
}

after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("compact Cursor store snapshots", () => {
  it("keeps current raw conversation blobs without copying unreachable store history", () => {
    const sessionId = "cursor-compact-live";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore);
    const originalSize = fs.statSync(liveStore).size;

    assert.equal(snapshotCursorStore(sessionId), true);
    const compact = path.join(getCursorSnapshotDir(), sessionId, COMPACT_STORE_NAME);
    assert.equal(fs.existsSync(compact), true);
    assert.ok(fs.statSync(compact).size < originalSize / 8);

    fs.rmSync(liveStore);
    createStore(liveStore, "updated");
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      assert.equal(snapshotCursorStore(sessionId), true);
    } finally {
      Date.now = realNow;
    }

    fs.rmSync(liveDir, { recursive: true, force: true });
    const messages = readCursorStoreMessages(sessionId);
    assert.deepEqual(
      messages.map((message) => message.sender),
      ["user", "assistant", "tool"]
    );
    assert.equal(messages[0].content[0].text, "updated prompt");
    assert.equal(messages[1].model, "cursor-grok-4.7");
    assert.equal(messages[1].content[1].name, "Read");
    assert.equal(messages[2].content[0].output, "file contents");
  });

  it("migrates a legacy full store only after a readable compact copy exists", () => {
    const sessionId = "cursor-compact-legacy";
    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    createStore(legacy, "legacy");

    const result = compactLegacyCursorStores();
    const compact = path.join(snapshotDir, COMPACT_STORE_NAME);
    assert.ok(result.compacted >= 1);
    assert.equal(fs.existsSync(compact), true);
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(readCursorStoreMessages(sessionId)[0].content[0].text, "legacy prompt");
  });

  it("bounds unreadable-store retries without blocking later migrations", () => {
    const sessionId = "cursor-compact-invalid";
    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(legacy, "not sqlite");

    compactLegacyCursorStores();
    assert.equal(fs.existsSync(legacy), true);
    assert.equal(fs.existsSync(path.join(snapshotDir, COMPACT_STORE_NAME)), false);

    for (let attempt = 1; attempt < 5; attempt++) compactLegacyCursorStores();
    assert.equal(compactLegacyCursorStores().scanned, 0);

    const validSessionId = "cursor-compact-after-invalid";
    const validSnapshotDir = path.join(getCursorSnapshotDir(), validSessionId);
    createStore(path.join(validSnapshotDir, "store.db"), "after invalid");
    const next = compactLegacyCursorStores({ limit: 1 });
    assert.equal(next.compacted, 1);
    assert.equal(fs.existsSync(path.join(validSnapshotDir, COMPACT_STORE_NAME)), true);
  });

  it("rejects session identifiers that could escape the snapshot root", () => {
    assert.equal(snapshotCursorStore("../outside"), false);
    assert.equal(readCursorStoreMessages("../outside"), null);
  });
});
