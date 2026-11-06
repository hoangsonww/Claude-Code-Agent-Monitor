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
  readCursorStoreMessages,
  snapshotCursorStore,
} = require("../lib/cursor-store-transcript");
const {
  closeCursorStoreCompactor,
  compactLegacyCursorStores,
} = require("../lib/cursor-store-compactor");

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

/** Add large, opaque, and repeated current-root references to one fixture. */
function addRawReferences(filePath, label) {
  const store = new Database(filePath);
  const rootId = hash(`${label}-root`).toString("hex");
  const assistantId = hash(`${label}-assistant`);
  const longId = hash(`${label}-long`);
  const opaqueId = hash(`${label}-opaque`);
  const longData = Buffer.from(
    JSON.stringify({
      role: "assistant",
      content: [{ type: "text", text: "x".repeat(24 * 1024) }],
    })
  );
  const opaqueData = Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x01, 0x02, 0x03]);
  const insert = store.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
  insert.run(longId.toString("hex"), longData);
  insert.run(opaqueId.toString("hex"), opaqueData);
  const currentRoot = Buffer.from(
    store.prepare("SELECT data FROM blobs WHERE id = ?").get(rootId).data
  );
  store
    .prepare("UPDATE blobs SET data = ? WHERE id = ?")
    .run(
      Buffer.concat([
        currentRoot,
        Buffer.from([0x0a, 0x20]),
        assistantId,
        Buffer.from([0x0a, 0x20]),
        longId,
        Buffer.from([0x0a, 0x20]),
        opaqueId,
      ]),
      rootId
    );
  store.close();
  return {
    longId: longId.toString("hex"),
    longData,
    opaqueId: opaqueId.toString("hex"),
    opaqueData,
  };
}

after(async () => {
  await closeCursorStoreCompactor();
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("compact Cursor store snapshots", () => {
  it("keeps current raw conversation blobs without copying unreachable store history", () => {
    const sessionId = "cursor-compact-live";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore);
    const raw = addRawReferences(liveStore, "current");
    const originalSize = fs.statSync(liveStore).size;

    const originalMode = fs.statSync(liveStore).mode & 0o777;
    fs.chmodSync(liveStore, 0o444);
    try {
      assert.equal(snapshotCursorStore(sessionId), true);
    } finally {
      fs.chmodSync(liveStore, originalMode);
    }
    const compact = path.join(getCursorSnapshotDir(), sessionId, COMPACT_STORE_NAME);
    assert.equal(fs.existsSync(compact), true);
    assert.ok(fs.statSync(compact).size < originalSize / 8);
    const compactDb = new Database(compact, { readonly: true, fileMustExist: true });
    assert.deepEqual(
      Buffer.from(compactDb.prepare("SELECT data FROM blobs WHERE id = ?").get(raw.longId).data),
      raw.longData
    );
    assert.deepEqual(
      Buffer.from(compactDb.prepare("SELECT data FROM blobs WHERE id = ?").get(raw.opaqueId).data),
      raw.opaqueData
    );
    compactDb.close();
    assert.equal(
      readCursorStoreMessages(sessionId).filter(
        (message) => message.id === `cursor-store:${hash("current-assistant").toString("hex")}`
      ).length,
      2,
      "repeated references remain repeated in root order"
    );

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

  it("migrates a legacy full store off-thread only after a valid compact copy exists", async () => {
    const sessionId = "cursor-compact-legacy";
    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    createStore(legacy, "legacy");

    assert.equal(snapshotCursorStore(sessionId), false);
    assert.equal(
      fs.existsSync(legacy),
      true,
      "serving-thread calls must leave legacy-only work alone"
    );

    let settled = false;
    const migration = compactLegacyCursorStores().then((result) => {
      settled = true;
      return result;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false, "migration must not run on the serving event loop");
    const result = await migration;
    const compact = path.join(snapshotDir, COMPACT_STORE_NAME);
    assert.ok(result.compacted >= 1);
    assert.equal(fs.existsSync(compact), true);
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(readCursorStoreMessages(sessionId)[0].content[0].text, "legacy prompt");
  });

  it("preserves a richer legacy root before deleting it beside a current live store", () => {
    const sessionId = "cursor-compact-reconcile";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore, "current only");
    assert.equal(snapshotCursorStore(sessionId), true);

    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    createStore(legacy, "legacy only");
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      assert.equal(snapshotCursorStore(sessionId), true);
    } finally {
      Date.now = realNow;
    }
    assert.equal(fs.existsSync(legacy), false);

    fs.rmSync(liveDir, { recursive: true, force: true });
    const prompts = readCursorStoreMessages(sessionId)
      .filter((message) => message.sender === "user")
      .map((message) => message.content[0].text);
    assert.deepEqual(prompts, ["legacy only prompt", "current only prompt"]);
  });

  it("keeps compact-only references when only the legacy source remains", async () => {
    const sessionId = "cursor-compact-preserve-existing";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore, "compact only");
    assert.equal(snapshotCursorStore(sessionId), true);

    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    createStore(path.join(snapshotDir, "store.db"), "legacy after cleanup");
    fs.rmSync(liveDir, { recursive: true, force: true });

    const result = await compactLegacyCursorStores();
    assert.ok(result.compacted >= 1);
    const prompts = readCursorStoreMessages(sessionId)
      .filter((message) => message.sender === "user")
      .map((message) => message.content[0].text);
    assert.deepEqual(prompts, ["legacy after cleanup prompt", "compact only prompt"]);
  });

  it("repairs a matching-stamp compact store whose conversation blobs are missing", () => {
    const sessionId = "cursor-compact-repair";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore, "repair");
    assert.equal(snapshotCursorStore(sessionId), true);
    const compact = path.join(getCursorSnapshotDir(), sessionId, COMPACT_STORE_NAME);
    const compactDb = new Database(compact);
    compactDb
      .prepare("DELETE FROM blobs WHERE id = ?")
      .run(hash("repair-assistant").toString("hex"));
    compactDb.close();

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 61_000;
      assert.equal(snapshotCursorStore(sessionId), true);
    } finally {
      Date.now = realNow;
    }
    assert.equal(readCursorStoreMessages(sessionId).length, 3);
  });

  it("preserves a raw-only root even when the current parser renders no messages", () => {
    const sessionId = "cursor-compact-raw-only";
    const liveDir = path.join(process.env.DASHBOARD_CURSOR_HOME, "chats", "workspace", sessionId);
    const liveStore = path.join(liveDir, "store.db");
    createStore(liveStore, "raw only");
    const store = new Database(liveStore);
    for (const kind of ["user", "assistant", "tool"]) {
      store
        .prepare("UPDATE blobs SET data = ? WHERE id = ?")
        .run(Buffer.from([0x00, kind.length, 0xff]), hash(`raw only-${kind}`).toString("hex"));
    }
    store.close();

    assert.equal(snapshotCursorStore(sessionId), true);
    fs.rmSync(liveDir, { recursive: true, force: true });
    assert.equal(readCursorStoreMessages(sessionId), null);
    assert.equal(
      fs.existsSync(path.join(getCursorSnapshotDir(), sessionId, COMPACT_STORE_NAME)),
      true
    );
  });

  it("bounds unreadable-store retries without blocking later migrations", async () => {
    const sessionId = "cursor-compact-invalid";
    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(legacy, "not sqlite");
    const original = fs.readFileSync(legacy);

    await compactLegacyCursorStores();
    assert.equal(fs.existsSync(legacy), true);
    assert.deepEqual(fs.readFileSync(legacy), original);
    assert.equal(fs.existsSync(path.join(snapshotDir, COMPACT_STORE_NAME)), false);

    for (let attempt = 1; attempt < 5; attempt++) await compactLegacyCursorStores();
    assert.equal((await compactLegacyCursorStores()).scanned, 0);
    assert.deepEqual(fs.readFileSync(legacy), original);

    const validSessionId = "cursor-compact-after-invalid";
    const validSnapshotDir = path.join(getCursorSnapshotDir(), validSessionId);
    createStore(path.join(validSnapshotDir, "store.db"), "after invalid");
    const next = await compactLegacyCursorStores({ limit: 1 });
    assert.equal(next.compacted, 1);
    assert.equal(fs.existsSync(path.join(validSnapshotDir, COMPACT_STORE_NAME)), true);
  });

  it("rejects session identifiers that could escape the snapshot root", () => {
    assert.equal(snapshotCursorStore("../outside"), false);
    assert.equal(readCursorStoreMessages("../outside"), null);
  });

  it("backs off scheduled no-work scans but periodically detects new legacy stores", async () => {
    const idle = await compactLegacyCursorStores({ limit: 4, scheduled: true });
    assert.equal(idle.scanned, 0);

    const sessionId = "cursor-compact-after-backoff";
    const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
    const legacy = path.join(snapshotDir, "store.db");
    createStore(legacy, "after backoff");
    const deferred = await compactLegacyCursorStores({ limit: 4, scheduled: true });
    assert.equal(deferred.deferred, true);
    assert.equal(fs.existsSync(legacy), true);

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 5 * 60 * 1000 + 1;
      const migrated = await compactLegacyCursorStores({ limit: 4, scheduled: true });
      assert.equal(migrated.compacted, 1);
    } finally {
      Date.now = realNow;
    }
    assert.equal(fs.existsSync(path.join(snapshotDir, COMPACT_STORE_NAME)), true);
    assert.equal(fs.existsSync(legacy), false);
  });
});
