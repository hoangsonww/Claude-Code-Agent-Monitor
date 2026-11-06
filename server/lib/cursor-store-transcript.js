/**
 * @file Reads Cursor's native chat store and snapshots it before Cursor's
 * retention cleanup. The store is the only local source that preserves ordered
 * tool calls/results and the concrete model behind Cursor's `default` alias.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { findCursorChatDir, getCursorSnapshotDir, isSafeCursorId } = require("./cursor-home");

const TEXT_LIMIT = 10240;
const MODEL_SUFFIX_MATCH_MIN_LENGTH = 16;
const STORE_SNAPSHOT_RETRY_LIMIT = 5;
const STORE_CACHE_LIMIT = 64;
const LIVE_STORE_NAME = "store.db";
const COMPACT_STORE_NAME = "store.compact.db";
const COMPACT_STORE_VERSION = "1";
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
  return parseMetaValue(row?.value);
}

function parseMetaValue(raw) {
  if (!raw) return null;
  const value = String(raw);
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

/** Read the CCAM metadata carried only by compact Cursor store snapshots. */
function readCompactStoreMetadata(dbPath) {
  if (!fs.existsSync(dbPath)) return null;
  let db;
  try {
    const Database = getStoreDatabase();
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 250 });
    const rows = db.prepare("SELECT key, value FROM ccam_snapshot").all();
    const metadata = Object.fromEntries(rows.map((row) => [row.key, String(row.value)]));
    return metadata.format_version === COMPACT_STORE_VERSION ? metadata : null;
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // A partially migrated snapshot is simply retried later.
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
    .filter(isSafeCursorId)
    .flatMap((sessionId) => {
      const liveDir = findCursorChatDir(sessionId);
      const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
      return [
        liveDir && path.join(liveDir, LIVE_STORE_NAME),
        path.join(snapshotDir, COMPACT_STORE_NAME),
        path.join(snapshotDir, LIVE_STORE_NAME),
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
  if (!isSafeCursorId(sessionId)) return false;
  if (pendingStoreSnapshots.has(sessionId)) return true;
  const liveDir = findCursorChatDir(sessionId);
  const live = liveDir && path.join(liveDir, LIVE_STORE_NAME);
  const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
  const compact = path.join(snapshotDir, COMPACT_STORE_NAME);
  const legacy = path.join(snapshotDir, LIVE_STORE_NAME);
  const source = live && fs.existsSync(live) ? live : fs.existsSync(legacy) ? legacy : null;
  if (!source) return false;
  const currentStamp = cursorStoreStamp(source);
  if (!currentStamp) return false;
  const metadata = readCompactStoreMetadata(compact);
  const needsSnapshot = metadata?.source_stamp !== currentStamp || fs.existsSync(legacy);
  if (!needsSnapshot) return false;
  const failure = snapshotFailures.get(sessionId);
  return !failure || failure.stamp !== currentStamp || failure.count < STORE_SNAPSHOT_RETRY_LIMIT;
}

function noteSnapshotFailure(sessionId, stamp) {
  lastStoreSnapshot.delete(sessionId);
  const previous = snapshotFailures.get(sessionId);
  snapshotFailures.set(sessionId, {
    stamp,
    count: previous?.stamp === stamp ? previous.count + 1 : 1,
  });
}

function tempCompactStorePath(destination) {
  return path.join(
    path.dirname(destination),
    `.${COMPACT_STORE_NAME}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`
  );
}

function removeStoreFile(filePath) {
  try {
    fs.rmSync(filePath, { force: true, maxRetries: 4, retryDelay: 50 });
    storeMessageCache.delete(filePath);
    return true;
  } catch {
    return false;
  }
}

function messagesMatch(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

/**
 * Copy only Cursor's current root and the blobs it references into a compact
 * SQLite database. Cursor stores obsolete content-addressed roots in the live
 * database; retaining those unreachable blobs made a few dozen snapshots use
 * gigabytes. The compact database keeps the exact raw current blobs, so the
 * existing reader and future parsers lose no current-conversation detail.
 */
function writeCompactStore(source, destination, sourceStamp) {
  const Database = getStoreDatabase();
  const temp = tempCompactStorePath(destination);
  let sourceDb;
  let compactDb;
  let expectedMessages = null;
  try {
    sourceDb = new Database(source, { readonly: true, fileMustExist: true, timeout: 250 });
    const extracted = sourceDb.transaction(() => {
      const metaRow = sourceDb.prepare("SELECT value FROM meta WHERE key = '0'").get();
      const rootId = parseMetaValue(metaRow?.value)?.latestRootBlobId;
      if (!metaRow?.value || typeof rootId !== "string" || !rootId) return null;
      const load = sourceDb.prepare("SELECT data FROM blobs WHERE id = ?");
      const rootRow = load.get(rootId);
      if (!rootRow?.data) return null;
      const rootData = Buffer.from(rootRow.data);
      const ids = [...new Set(rootBlobIds(rootData))];
      if (!ids.length) return null;
      const blobs = [];
      const messages = [];
      for (const id of ids) {
        const row = load.get(id);
        if (!row?.data) continue;
        const data = Buffer.from(row.data);
        blobs.push({ id, data });
        if (data[0] !== 0x7b) continue;
        try {
          const message = mapStoreBlob(JSON.parse(data.toString("utf8")), id);
          if (message) messages.push(message);
        } catch {
          // Keep the raw blob even when a live write is not parseable yet.
        }
      }
      return {
        metaValue: metaRow.value,
        rootId,
        rootData,
        blobs,
        messages: messages.length ? messages : null,
      };
    })();
    sourceDb.close();
    sourceDb = null;
    if (!extracted?.messages) return { ok: false, reason: "no-readable-messages" };
    if (cursorStoreStamp(source) !== sourceStamp) {
      return { ok: false, reason: "source-changed" };
    }
    expectedMessages = extracted.messages;

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    compactDb = new Database(temp);
    compactDb.exec(
      "PRAGMA journal_mode = DELETE; " +
        "PRAGMA synchronous = FULL; " +
        "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); " +
        "CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB); " +
        "CREATE TABLE ccam_snapshot (key TEXT PRIMARY KEY, value TEXT)"
    );
    const insertBlob = compactDb.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
    compactDb.transaction(() => {
      compactDb.prepare("INSERT INTO meta (key, value) VALUES ('0', ?)").run(extracted.metaValue);
      insertBlob.run(extracted.rootId, extracted.rootData);
      for (const blob of extracted.blobs) {
        if (blob.id !== extracted.rootId) insertBlob.run(blob.id, blob.data);
      }
      compactDb
        .prepare("INSERT INTO ccam_snapshot (key, value) VALUES (?, ?)")
        .run("format_version", COMPACT_STORE_VERSION);
      compactDb
        .prepare("INSERT INTO ccam_snapshot (key, value) VALUES (?, ?)")
        .run("source_stamp", sourceStamp);
    })();
    compactDb.exec("PRAGMA optimize");
    compactDb.close();
    compactDb = null;

    storeMessageCache.delete(temp);
    if (!messagesMatch(readCursorStoreFile(temp), expectedMessages)) {
      return { ok: false, reason: "verify-failed" };
    }
    if (cursorStoreStamp(source) !== sourceStamp) {
      return { ok: false, reason: "source-changed" };
    }
    fs.renameSync(temp, destination);
    storeMessageCache.delete(temp);
    storeMessageCache.delete(destination);
    if (
      readCompactStoreMetadata(destination)?.source_stamp !== sourceStamp ||
      !messagesMatch(readCursorStoreFile(destination), expectedMessages)
    ) {
      return { ok: false, reason: "installed-verify-failed" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `error:${(err && err.code) || "unknown"}` };
  } finally {
    try {
      sourceDb?.close();
    } catch {
      // Best effort around a live Cursor database.
    }
    try {
      compactDb?.close();
    } catch {
      // Best effort around a failed compact snapshot.
    }
    removeStoreFile(temp);
  }
}

/** Create a compact, verified backup so conversation details survive Cursor cleanup. */
function snapshotCursorStore(sessionId) {
  if (!isSafeCursorId(sessionId)) return false;
  const now = Date.now();
  const liveDir = findCursorChatDir(sessionId);
  const live = liveDir && path.join(liveDir, LIVE_STORE_NAME);
  const destinationDir = path.join(getCursorSnapshotDir(), sessionId);
  const destination = path.join(destinationDir, COMPACT_STORE_NAME);
  const legacy = path.join(destinationDir, LIVE_STORE_NAME);
  const source = live && fs.existsSync(live) ? live : fs.existsSync(legacy) ? legacy : null;
  if (!source) return false;
  const stamp = cursorStoreStamp(source);
  if (!stamp) return false;
  const metadata = readCompactStoreMetadata(destination);
  if (metadata?.source_stamp === stamp && readCursorStoreFile(destination)) {
    if (fs.existsSync(legacy)) removeStoreFile(legacy);
    snapshotFailures.delete(sessionId);
    pendingStoreSnapshots.delete(sessionId);
    lastStoreSnapshotStamp.set(sessionId, stamp);
    return false;
  }
  const failure = snapshotFailures.get(sessionId);
  if (failure?.stamp === stamp && failure.count >= STORE_SNAPSHOT_RETRY_LIMIT) return false;
  if (now - (lastStoreSnapshot.get(sessionId) || 0) < 60_000) {
    if (lastStoreSnapshotStamp.get(sessionId) !== stamp) {
      pendingStoreSnapshots.set(sessionId, stamp);
    }
    return false;
  }
  lastStoreSnapshot.set(sessionId, now);
  const result = writeCompactStore(source, destination, stamp);
  if (!result.ok) {
    noteSnapshotFailure(sessionId, stamp);
    return false;
  }
  snapshotFailures.delete(sessionId);
  pendingStoreSnapshots.delete(sessionId);
  lastStoreSnapshotStamp.set(sessionId, stamp);
  if (fs.existsSync(legacy)) removeStoreFile(legacy);
  return true;
}

/** Migrate legacy full-store snapshots even after Cursor removed the live chat. */
function compactLegacyCursorStores({ limit = Infinity } = {}) {
  let entries = [];
  try {
    entries = fs.readdirSync(getCursorSnapshotDir(), { withFileTypes: true });
  } catch {
    return { scanned: 0, compacted: 0, remaining: 0 };
  }
  const legacy = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      isSafeCursorId(entry.name) &&
      fs.existsSync(path.join(getCursorSnapshotDir(), entry.name, LIVE_STORE_NAME))
  );
  const pending = legacy.filter((entry) => cursorStoreSnapshotPending(entry.name));
  let scanned = 0;
  let compacted = 0;
  for (const entry of pending.slice(0, Math.max(0, limit))) {
    scanned++;
    if (snapshotCursorStore(entry.name)) compacted++;
  }
  return { scanned, compacted, remaining: Math.max(0, pending.length - scanned) };
}

module.exports = {
  COMPACT_STORE_NAME,
  compactLegacyCursorStores,
  cursorStoreSnapshotPending,
  cursorVisibleTexts,
  readCursorStoreFile,
  readCursorStoreMessages,
  resolveCursorStoreModel,
  snapshotCursorStore,
};
