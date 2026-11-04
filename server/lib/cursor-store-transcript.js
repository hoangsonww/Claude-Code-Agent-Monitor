/**
 * @file Reads Cursor's native chat store and snapshots it before Cursor's
 * retention cleanup. The store is the only local source that preserves ordered
 * tool calls/results and the concrete model behind Cursor's `default` alias.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { findCursorChatDir, getCursorSnapshotDir } = require("./cursor-home");

const TEXT_LIMIT = 10240;
const MODEL_SUFFIX_MATCH_MIN_LENGTH = 16;
const STORE_SNAPSHOT_RETRY_LIMIT = 5;
const STORE_CACHE_LIMIT = 64;
const lastStoreSnapshot = new Map();
const lastStoreSnapshotStamp = new Map();
const pendingStoreSnapshots = new Map();
const snapshotFailures = new Map();
const storeMessageCache = new Map();
let StoreDatabase = null;

function getStoreDatabase() {
  if (StoreDatabase) return StoreDatabase;
  try {
    const Candidate = require("better-sqlite3");
    new Candidate(":memory:").close();
    StoreDatabase = Candidate;
  } catch {
    StoreDatabase = require("../compat-sqlite");
  }
  return StoreDatabase;
}

function fileStamp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "-";
  }
}

function cursorStoreStamp(dbPath) {
  const main = fileStamp(dbPath);
  if (main === "-") return null;
  return `${main}|${fileStamp(`${dbPath}-wal`)}`;
}

function cloneMessages(messages) {
  if (!messages) return null;
  return messages.map((message) => ({
    ...message,
    content: message.content.map((block) => ({ ...block })),
  }));
}

function cacheStoreMessages(dbPath, stamp, messages) {
  storeMessageCache.delete(dbPath);
  storeMessageCache.set(dbPath, { stamp, messages: cloneMessages(messages) });
  while (storeMessageCache.size > STORE_CACHE_LIMIT) {
    storeMessageCache.delete(storeMessageCache.keys().next().value);
  }
}

function truncate(value, maxLen = TEXT_LIMIT) {
  if (typeof value !== "string" || value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}[truncated]`;
}

function truncateObj(value) {
  if (!value || typeof value !== "object") return {};
  const json = JSON.stringify(value);
  return json.length <= TEXT_LIMIT ? value : { _truncated: truncate(json) };
}

function parseCursorTimestamp(text) {
  const match = typeof text === "string" && text.match(/<timestamp>([\s\S]*?)<\/timestamp>/i);
  if (!match) return null;
  const normalized = match[1].replace(/\(UTC([+-]\d{1,2})\)/i, (_value, offset) => {
    const hours = Number(offset);
    return `GMT${hours >= 0 ? "+" : "-"}${String(Math.abs(hours)).padStart(2, "0")}00`;
  });
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Keep the typed user query while excluding Cursor's image-preamble block. */
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
    const text = raw.replace(/<timestamp>[\s\S]*?<\/timestamp>/i, "").trim();
    if (text) texts.push({ query: false, text });
  }
  const queries = texts.filter((entry) => entry.query);
  return (queries.length ? queries : texts).map((entry) => entry.text);
}

function rootBlobIds(root) {
  const ids = [];
  if (!Buffer.isBuffer(root)) return ids;
  for (let index = 0; index + 34 <= root.length; index++) {
    if (root[index] !== 0x0a || root[index + 1] !== 0x20) continue;
    ids.push(root.subarray(index + 2, index + 34).toString("hex"));
    index += 33;
  }
  return ids;
}

function blockModel(content, blob) {
  const candidates = [
    blob?.providerOptions?.cursor?.modelName,
    ...content.map((block) => block?.providerOptions?.cursor?.modelName),
  ];
  return candidates.find((model) => typeof model === "string" && model.trim()) || null;
}

function mapStoreBlob(blob, blobId) {
  const contentIn = Array.isArray(blob?.content) ? blob.content : [];
  if (blob?.role === "user") {
    const texts = cursorVisibleTexts(contentIn);
    if (!texts.length) return null;
    const timestamp = contentIn.map((block) => parseCursorTimestamp(block?.text)).find(Boolean);
    return {
      id: `cursor-store:${blobId}`,
      type: "user",
      sender: "user",
      timestamp: timestamp || null,
      content: texts.map((text) => ({ type: "text", text: truncate(text) })),
    };
  }
  if (blob?.role === "assistant") {
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
    const model = blockModel(contentIn, blob);
    return {
      id: `cursor-store:${blobId}`,
      type: "assistant",
      sender: "assistant",
      timestamp: null,
      content,
      ...(model ? { model } : {}),
    };
  }
  if (blob?.role === "tool") {
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

/** Return ordered conversation DTOs from one Cursor `store.db`. */
function readCursorStoreFile(dbPath) {
  const stamp = cursorStoreStamp(dbPath);
  if (!stamp) return null;
  const cached = storeMessageCache.get(dbPath);
  if (cached?.stamp === stamp) {
    storeMessageCache.delete(dbPath);
    storeMessageCache.set(dbPath, cached);
    return cloneMessages(cached.messages);
  }
  let db;
  try {
    const Database = getStoreDatabase();
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 250 });
    const rootId = readMeta(db)?.latestRootBlobId;
    if (typeof rootId !== "string" || !rootId) {
      cacheStoreMessages(dbPath, stamp, null);
      return null;
    }
    const root = db.prepare("SELECT data FROM blobs WHERE id = ?").get(rootId);
    const ids = rootBlobIds(root?.data ? Buffer.from(root.data) : null);
    if (!ids.length) {
      cacheStoreMessages(dbPath, stamp, null);
      return null;
    }
    const load = db.prepare("SELECT data FROM blobs WHERE id = ?");
    const messages = [];
    for (const id of ids) {
      const row = load.get(id);
      if (!row?.data) continue;
      const raw = Buffer.from(row.data);
      if (raw[0] !== 0x7b) continue;
      try {
        const message = mapStoreBlob(JSON.parse(raw.toString("utf8")), id);
        if (message) messages.push(message);
      } catch {
        // Encrypted and partially-written blobs are expected while Cursor runs.
      }
    }
    const result = messages.length ? messages : null;
    cacheStoreMessages(dbPath, stamp, result);
    return cloneMessages(result);
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // Cursor can rotate the live store between open and close.
    }
  }
}

function cursorStorePaths(sessionIds) {
  const ids = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
  return ids
    .flatMap((sessionId) => {
      const liveDir = findCursorChatDir(sessionId);
      return [
        liveDir && path.join(liveDir, "store.db"),
        path.join(getCursorSnapshotDir(), sessionId, "store.db"),
      ];
    })
    .filter(Boolean)
    .filter((candidate, index, all) => all.indexOf(candidate) === index);
}

/** Prefer the richest readable live/snapshotted store, not merely the newest path. */
function readCursorStoreMessages(sessionIds) {
  let richest = null;
  for (const dbPath of cursorStorePaths(sessionIds)) {
    if (!fs.existsSync(dbPath)) continue;
    const messages = readCursorStoreFile(dbPath);
    if (messages && (!richest || messages.length > richest.length)) richest = messages;
  }
  return richest;
}

function normalizeModel(model) {
  return typeof model === "string" ? model.trim().replace(/^cursor-/, "") : "";
}

/** Resolve Cursor's `default` alias by matching the returned assistant text in every family store. */
function resolveCursorStoreModel(sessionIds, responseText = null) {
  const expected = typeof responseText === "string" ? responseText.replace(/\s+/g, " ").trim() : "";
  if (!expected) return "";
  for (const dbPath of cursorStorePaths(sessionIds)) {
    if (!fs.existsSync(dbPath)) continue;
    const messages = readCursorStoreFile(dbPath) || [];
    const assistants = messages.filter(
      (message) => message.sender === "assistant" && message.model
    );
    const matched = assistants.findLast((message) => {
      const actual = message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .replace(/\s+/g, " ")
        .trim();
      if (!actual) return false;
      if (actual === expected) return true;
      return (
        Math.min(actual.length, expected.length) >= MODEL_SUFFIX_MATCH_MIN_LENGTH &&
        (actual.endsWith(expected) || expected.endsWith(actual))
      );
    });
    if (matched) return normalizeModel(matched.model);
  }
  return "";
}

function cursorStoreSnapshotPending(sessionId) {
  const entry = snapshotFailures.get(sessionId);
  if (pendingStoreSnapshots.has(sessionId)) return true;
  if (!entry || entry.count <= 0) return false;
  const source = cursorStorePaths(sessionId)[0];
  const currentStamp = source ? cursorStoreStamp(source) : null;
  return (
    entry.count < STORE_SNAPSHOT_RETRY_LIMIT || (!!currentStamp && currentStamp !== entry.stamp)
  );
}

function noteSnapshotFailure(sessionId, stamp) {
  lastStoreSnapshot.delete(sessionId);
  const previous = snapshotFailures.get(sessionId);
  snapshotFailures.set(sessionId, {
    stamp,
    count: previous?.stamp === stamp ? previous.count + 1 : 1,
  });
}

/** Create a consistent backup so conversation details survive Cursor cleanup. */
function snapshotCursorStore(sessionId) {
  const now = Date.now();
  const source = cursorStorePaths(sessionId)[0];
  if (!source || !fs.existsSync(source)) return false;
  const stamp = cursorStoreStamp(source);
  if (!stamp) return false;
  if (now - (lastStoreSnapshot.get(sessionId) || 0) < 60_000) {
    if (lastStoreSnapshotStamp.get(sessionId) !== stamp) {
      pendingStoreSnapshots.set(sessionId, stamp);
    }
    return false;
  }
  let db;
  try {
    const destinationDir = path.join(getCursorSnapshotDir(), sessionId);
    fs.mkdirSync(destinationDir, { recursive: true });
    const destination = path.join(destinationDir, "store.db");
    lastStoreSnapshot.set(sessionId, now);
    const Database = getStoreDatabase();
    db = new Database(source, { readonly: true, fileMustExist: true, timeout: 250 });
    if (typeof db.backup !== "function") {
      throw new Error("The active SQLite driver does not support online backup");
    }
    const backup = db.backup(destination);
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
          snapshotFailures.delete(sessionId);
          pendingStoreSnapshots.delete(sessionId);
          lastStoreSnapshotStamp.set(sessionId, stamp);
          close();
        },
        () => {
          noteSnapshotFailure(sessionId, stamp);
          close();
        }
      );
    } else {
      snapshotFailures.delete(sessionId);
      pendingStoreSnapshots.delete(sessionId);
      lastStoreSnapshotStamp.set(sessionId, stamp);
      close();
    }
    return true;
  } catch {
    noteSnapshotFailure(sessionId, stamp);
    try {
      db?.close();
    } catch {
      // Best effort around a live store.
    }
    return false;
  }
}

module.exports = {
  cursorStoreSnapshotPending,
  cursorVisibleTexts,
  readCursorStoreFile,
  readCursorStoreMessages,
  resolveCursorStoreModel,
  snapshotCursorStore,
};
