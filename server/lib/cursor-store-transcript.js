/**
 * @file cursor-store-transcript.js
 * @description Reads Cursor's chat `store.db` as the conversation source.
 * The agent-transcripts JSONL is a lossy export: tool calls have no ids and
 * no results, so the viewer leaves every tool pending, and prompt history is
 * a newest-first shorthand that does not match those lines. The store keeps
 * the ordered thread, including `tool-call` / `tool-result` pairs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { findCursorChatDir, getCursorSnapshotDir } = require("./cursor-home");

const TEXT_LIMIT = 10240;

function truncate(str, maxLen = TEXT_LIMIT) {
  if (typeof str !== "string" || str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}[truncated]`;
}

function truncateObj(obj) {
  if (!obj || typeof obj !== "object") return {};
  const json = JSON.stringify(obj);
  if (json.length <= TEXT_LIMIT) return obj;
  return { _truncated: truncate(json) };
}

/** Keep the typed user query and drop Cursor's image-preamble sibling block. */
function cursorVisibleTexts(blocks) {
  const texts = [];
  for (const block of blocks || []) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    const raw = block.text.trim();
    if (!raw) continue;
    const userQuery = raw.match(/<user_query>([\s\S]*?)<\/user_query>/i);
    if (userQuery) {
      const text = userQuery[1].trim();
      if (text) texts.push({ query: true, text });
      continue;
    }
    if (/<image_files>/i.test(raw)) continue;
    texts.push({ query: false, text: raw });
  }
  const queries = texts.filter((entry) => entry.query);
  return (queries.length ? queries : texts).map((entry) => entry.text);
}

function blobIds(root) {
  const ids = [];
  if (!Buffer.isBuffer(root)) return ids;
  let i = 0;
  while (i + 2 <= root.length) {
    if (root[i] === 0x0a && root[i + 1] === 0x20 && i + 34 <= root.length) {
      ids.push(root.subarray(i + 2, i + 34).toString("hex"));
      i += 34;
    } else {
      i += 1;
    }
  }
  return ids;
}

function mapStoreBlob(blob, blobId) {
  const contentIn = Array.isArray(blob?.content) ? blob.content : [];
  if (blob.role === "user") {
    const texts = cursorVisibleTexts(contentIn);
    if (!texts.length) return null;
    return {
      id: `cursor-store:${blobId}`,
      type: "user",
      sender: "user",
      timestamp: null,
      content: texts.map((text) => ({ type: "text", text: truncate(text) })),
    };
  }
  if (blob.role === "assistant") {
    const content = [];
    for (const block of contentIn) {
      if (block?.type === "reasoning" && typeof block.text === "string" && block.text.trim()) {
        content.push({ type: "thinking", text: truncate(block.text) });
      } else if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
        content.push({ type: "text", text: truncate(block.text) });
      } else if (block?.type === "tool-call") {
        content.push({
          type: "tool_use",
          name: block.toolName || "unknown",
          id: typeof block.toolCallId === "string" ? block.toolCallId : null,
          input: truncateObj(block.args),
        });
      }
    }
    if (!content.length) return null;
    const model = blob.providerOptions?.cursor?.modelName;
    return {
      id: `cursor-store:${blobId}`,
      type: "assistant",
      sender: "assistant",
      timestamp: null,
      content,
      ...(typeof model === "string" && model ? { model } : {}),
    };
  }
  if (blob.role === "tool") {
    const content = [];
    for (const block of contentIn) {
      if (block?.type !== "tool-result") continue;
      const output =
        typeof block.result === "string" ? block.result : JSON.stringify(block.result ?? "");
      content.push({
        type: "tool_result",
        id: typeof block.toolCallId === "string" ? block.toolCallId : null,
        name: block.toolName || undefined,
        output: truncate(output),
        is_error: /^Exit code: (?!0\b)/.test(output),
      });
    }
    if (!content.length) return null;
    return {
      id: `cursor-store:${blobId}`,
      type: "user",
      sender: "tool",
      timestamp: null,
      content,
    };
  }
  return null;
}

function readMeta(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = '0'").get();
  if (!row?.value) return null;
  const value = String(row.value);
  try {
    return JSON.parse(value);
  } catch {
    try {
      return JSON.parse(Buffer.from(value, "hex").toString("utf8"));
    } catch {
      return null;
    }
  }
}

/** Ordered conversation DTOs from one Cursor `store.db`, or null when unreadable. */
function readCursorStoreFile(dbPath) {
  let db;
  try {
    const Database = require("better-sqlite3");
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 250 });
    const meta = readMeta(db);
    const rootId = meta?.latestRootBlobId;
    if (typeof rootId !== "string" || !rootId) return null;
    const root = db.prepare("SELECT data FROM blobs WHERE id = ?").get(rootId);
    if (!root?.data) return null;
    const ids = blobIds(Buffer.from(root.data));
    if (!ids.length) return null;
    const load = db.prepare("SELECT data FROM blobs WHERE id = ?");
    const messages = [];
    for (const id of ids) {
      const row = load.get(id);
      if (!row?.data) continue;
      const data = Buffer.from(row.data);
      if (data[0] !== 0x7b) continue;
      let blob;
      try {
        blob = JSON.parse(data.toString("utf8"));
      } catch {
        continue;
      }
      const message = mapStoreBlob(blob, id);
      if (message) messages.push(message);
    }
    return messages.length ? messages : null;
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // The live store can disappear between open and close.
    }
  }
}

/** Live chat store, then the dashboard snapshot taken before Cursor deletes it. */
function readCursorStoreMessages(sessionId) {
  const liveDir = findCursorChatDir(sessionId);
  const live = liveDir && path.join(liveDir, "store.db");
  const snap = path.join(getCursorSnapshotDir(), sessionId, "store.db");
  const dbPath = live && fs.existsSync(live) ? live : fs.existsSync(snap) ? snap : null;
  if (!dbPath) return null;
  return readCursorStoreFile(dbPath);
}

const lastStoreSnapshot = new Map();
const STORE_SNAPSHOT_RETRY_LIMIT = 5;
const snapshotFailures = new Map();

/** True while a failed store backup still has attempts left. */
function cursorStoreSnapshotPending(sessionId) {
  const entry = snapshotFailures.get(sessionId);
  return !!entry && entry.count > 0 && entry.count < STORE_SNAPSHOT_RETRY_LIMIT;
}

function noteStoreSnapshotFailure(sessionId, stamp) {
  lastStoreSnapshot.delete(sessionId);
  const previous = snapshotFailures.get(sessionId);
  const count = previous && previous.stamp === stamp ? previous.count + 1 : 1;
  snapshotFailures.set(sessionId, { stamp, count });
}

function noteStoreSnapshotSuccess(sessionId) {
  snapshotFailures.delete(sessionId);
}

/** Consistent backup of the live store so Conversation survives Cursor cleanup. */
function snapshotCursorStore(sessionId) {
  const now = Date.now();
  if (now - (lastStoreSnapshot.get(sessionId) || 0) < 60_000) return false;
  const liveDir = findCursorChatDir(sessionId);
  const source = liveDir && path.join(liveDir, "store.db");
  if (!source || !fs.existsSync(source)) return false;
  let stamp = "";
  try {
    const stat = fs.statSync(source);
    stamp = `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return false;
  }
  let db;
  try {
    const destDir = path.join(getCursorSnapshotDir(), sessionId);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, "store.db");
    lastStoreSnapshot.set(sessionId, now);
    const Database = require("better-sqlite3");
    db = new Database(source, { readonly: true, fileMustExist: true, timeout: 250 });
    const backup = db.backup(dest);
    const close = () => {
      try {
        db.close();
      } catch {
        // Already closed.
      }
    };
    if (backup && typeof backup.then === "function") {
      backup.then(
        () => {
          noteStoreSnapshotSuccess(sessionId);
          close();
        },
        () => {
          noteStoreSnapshotFailure(sessionId, stamp);
          close();
        }
      );
    } else {
      noteStoreSnapshotSuccess(sessionId);
      close();
    }
    return true;
  } catch {
    noteStoreSnapshotFailure(sessionId, stamp);
    try {
      db?.close();
    } catch {
      // Ignore a store Cursor still holds open.
    }
    return false;
  }
}

module.exports = {
  cursorVisibleTexts,
  readCursorStoreFile,
  readCursorStoreMessages,
  snapshotCursorStore,
  cursorStoreSnapshotPending,
};
