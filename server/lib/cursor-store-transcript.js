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
const MAX_ROOT_BYTES = 2 * 1024 * 1024;
const MAX_ROOT_REFERENCES = 30_000;
const LIVE_STORE_NAME = "store.db";
const COMPACT_STORE_NAME = "store.compact.db";
const COMPACT_STORE_VERSION = "1";
const lastStoreSnapshot = new Map();
const lastStoreSnapshotStamp = new Map();
const pendingStoreSnapshots = new Map();
const snapshotFailures = new Map();
const storeMessageCache = new Map();
const storeStructureCache = new Map();
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

/** Cache one bounded raw-structure validation without retaining message blobs. */
function cacheStoreStructure(dbPath, stamp, valid) {
  storeStructureCache.delete(dbPath);
  storeStructureCache.set(dbPath, { stamp, valid });
  while (storeStructureCache.size > STORE_CACHE_LIMIT) {
    storeStructureCache.delete(storeStructureCache.keys().next().value);
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

/** Preserve Cursor's JSON-or-hex metadata encoding while replacing its active root. */
function encodeMetaValue(raw, metadata) {
  const json = JSON.stringify(metadata);
  return String(raw).trimStart().startsWith("{") ? json : Buffer.from(json, "utf8").toString("hex");
}

/**
 * Read only a store's bounded root structure. Referenced message blobs stay in
 * SQLite and are copied with `INSERT ... SELECT`, so one opaque or unusually
 * large message cannot inflate the Node heap.
 */
function readStoreRoot(dbPath) {
  let db;
  try {
    const Database = getStoreDatabase();
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 250 });
    const metaRow = db.prepare("SELECT value FROM meta WHERE key = '0'").get();
    const metadata = parseMetaValue(metaRow?.value);
    const rootId = metadata?.latestRootBlobId;
    if (!metaRow?.value || typeof rootId !== "string" || !rootId) return null;
    const rootSize = Number(
      db.prepare("SELECT length(data) AS size FROM blobs WHERE id = ?").get(rootId)?.size
    );
    if (!rootSize || rootSize > MAX_ROOT_BYTES) return null;
    const rootRow = db.prepare("SELECT data FROM blobs WHERE id = ?").get(rootId);
    if (!rootRow?.data) return null;
    const rootData = Buffer.from(rootRow.data);
    const references = rootBlobIds(rootData);
    if (!references.length || references.length > MAX_ROOT_REFERENCES) return null;
    return { metaValue: metaRow.value, metadata, rootId, rootData, references };
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // A live store may rotate after its bounded root was read.
    }
  }
}

/**
 * Validate that a compact store has one bounded root and every raw blob that
 * root references. This deliberately accepts blobs the current parser cannot
 * render, preserving them for future Cursor-format support.
 */
function compactStoreHasConversation(dbPath) {
  const stamp = cursorStoreStamp(dbPath);
  if (!stamp) return false;
  const cached = storeStructureCache.get(dbPath);
  if (cached?.stamp === stamp) return cached.valid;
  const root = readStoreRoot(dbPath);
  if (!root) {
    cacheStoreStructure(dbPath, stamp, false);
    return false;
  }
  let db;
  let valid = false;
  try {
    const Database = getStoreDatabase();
    db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 250 });
    const exists = db.prepare("SELECT 1 AS present FROM blobs WHERE id = ?");
    valid = [...new Set(root.references)].every((id) => Boolean(exists.get(id)?.present));
  } catch {
    valid = false;
  } finally {
    try {
      db?.close();
    } catch {
      valid = false;
    }
  }
  cacheStoreStructure(dbPath, stamp, valid);
  return valid;
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
  const liveDir = findCursorChatDir(sessionId);
  const live = liveDir && path.join(liveDir, LIVE_STORE_NAME);
  const snapshotDir = path.join(getCursorSnapshotDir(), sessionId);
  const compact = path.join(snapshotDir, COMPACT_STORE_NAME);
  const legacy = path.join(snapshotDir, LIVE_STORE_NAME);
  const source = live && fs.existsSync(live) ? live : fs.existsSync(legacy) ? legacy : null;
  if (!source) return false;
  const currentStamp = cursorStoreStamp(source);
  if (!currentStamp) return false;
  const legacyStamp = source !== legacy && fs.existsSync(legacy) ? cursorStoreStamp(legacy) : null;
  const workStamp = snapshotWorkStamp(currentStamp, legacyStamp);
  const failure = snapshotFailures.get(sessionId);
  if (failure?.stamp === workStamp && failure.count >= STORE_SNAPSHOT_RETRY_LIMIT) {
    return false;
  }
  if (pendingStoreSnapshots.has(sessionId)) return true;
  const metadata = readCompactStoreMetadata(compact);
  const needsSnapshot =
    metadata?.source_stamp !== currentStamp ||
    (legacyStamp && metadata?.legacy_stamp !== legacyStamp) ||
    !compactStoreHasConversation(compact) ||
    fs.existsSync(legacy);
  if (!needsSnapshot) return false;
  return true;
}

function noteSnapshotFailure(sessionId, stamp) {
  lastStoreSnapshot.delete(sessionId);
  const previous = snapshotFailures.get(sessionId);
  snapshotFailures.set(sessionId, {
    stamp,
    count: previous?.stamp === stamp ? previous.count + 1 : 1,
  });
}

/** Bind retry accounting to both the live source and any legacy data being preserved. */
function snapshotWorkStamp(sourceStamp, legacyStamp) {
  return legacyStamp ? `${sourceStamp}|legacy:${legacyStamp}` : sourceStamp;
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
    storeStructureCache.delete(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Build a valid protobuf root containing one field-1 reference per id. */
function encodeRootReferences(references) {
  if (!references.length || references.length > MAX_ROOT_REFERENCES) return null;
  const root = Buffer.alloc(references.length * 34);
  for (let index = 0; index < references.length; index++) {
    const id = Buffer.from(references[index], "hex");
    if (id.length !== 32) return null;
    const offset = index * 34;
    root[offset] = 0x0a;
    root[offset + 1] = 0x20;
    id.copy(root, offset + 2);
  }
  return root;
}

/**
 * Reconcile an older full-store root with the current live root. The legacy
 * order remains intact; only live occurrences beyond the legacy multiset are
 * appended. Repeated references inside either root therefore survive.
 */
function buildCompactPlan(sourcePath, legacyPath = null) {
  const source = readStoreRoot(sourcePath);
  if (!source) return null;
  const legacy = legacyPath ? readStoreRoot(legacyPath) : null;
  if (legacyPath && !legacy) return null;
  if (!legacy) {
    return {
      metaValue: source.metaValue,
      rootId: source.rootId,
      rootData: source.rootData,
      references: source.references,
      origins: new Map([...new Set(source.references)].map((id) => [id, "source_store"])),
      sourcePath,
      legacyPath: null,
    };
  }

  const legacyRemaining = new Map();
  for (const id of legacy.references) {
    legacyRemaining.set(id, (legacyRemaining.get(id) || 0) + 1);
  }
  const liveExtras = [];
  for (const id of source.references) {
    const remaining = legacyRemaining.get(id) || 0;
    if (remaining > 0) legacyRemaining.set(id, remaining - 1);
    else liveExtras.push(id);
  }
  const references = [...legacy.references, ...liveExtras];
  const rootData = encodeRootReferences(references);
  if (!rootData || rootData.length > MAX_ROOT_BYTES) return null;
  const rootId = crypto.createHash("sha256").update(rootData).digest("hex");
  const sourceIds = new Set(source.references);
  const origins = new Map();
  for (const id of new Set(references)) {
    origins.set(id, sourceIds.has(id) ? "source_store" : "legacy_store");
  }
  return {
    metaValue: encodeMetaValue(source.metaValue, {
      ...source.metadata,
      latestRootBlobId: rootId,
    }),
    rootId,
    rootData,
    references,
    origins,
    sourcePath,
    legacyPath,
  };
}

/** Attach one trusted local snapshot source under a fixed internal alias. */
function attachStore(db, alias, dbPath) {
  db.prepare(`ATTACH DATABASE ? AS ${alias}`).run(dbPath);
}

/** Build a bounded id-only table used to copy and compare blobs inside SQLite. */
function prepareExpectedBlobs(db, plan) {
  db.exec("CREATE TEMP TABLE expected_blobs (id TEXT PRIMARY KEY, origin TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO expected_blobs (id, origin) VALUES (?, ?)");
  db.transaction(() => {
    for (const [id, origin] of plan.origins) insert.run(id, origin);
  })();
}

/** Copy every referenced BLOB in SQLite so large opaque values never enter JS. */
function copyExpectedBlobs(db, plan) {
  for (const alias of ["source_store", "legacy_store"]) {
    if (alias === "legacy_store" && !plan.legacyPath) continue;
    db.exec(`INSERT OR IGNORE INTO blobs (id, data)
      SELECT source.id, source.data
      FROM ${alias}.blobs source
      JOIN expected_blobs expected ON expected.id = source.id
      WHERE expected.origin = '${alias}'`);
  }
}

/** Compare the installed compact BLOBs to their sources without materializing them. */
function rawBlobsMatch(db, plan) {
  const root = db.prepare("SELECT data FROM blobs WHERE id = ?").get(plan.rootId);
  if (!root?.data || !Buffer.from(root.data).equals(plan.rootData)) return false;
  for (const alias of ["source_store", "legacy_store"]) {
    if (alias === "legacy_store" && !plan.legacyPath) continue;
    const row = db
      .prepare(
        `SELECT COUNT(*) AS expected,
                COUNT(compact.id) AS copied,
                SUM(CASE
                  WHEN compact.id IS NULL OR source.id IS NULL OR compact.data != source.data
                  THEN 1 ELSE 0 END) AS mismatched
         FROM expected_blobs expected
         LEFT JOIN blobs compact ON compact.id = expected.id
         LEFT JOIN ${alias}.blobs source ON source.id = expected.id
         WHERE expected.origin = ?`
      )
      .get(alias);
    if (row.expected !== row.copied || Number(row.mismatched) !== 0) return false;
  }
  return true;
}

/** Reopen and verify the installed file against both still-present sources. */
function verifyCompactStore(dbPath, plan) {
  let db;
  try {
    const Database = getStoreDatabase();
    db = new Database(dbPath, { fileMustExist: true, timeout: 250 });
    attachStore(db, "source_store", plan.sourcePath);
    if (plan.legacyPath) attachStore(db, "legacy_store", plan.legacyPath);
    prepareExpectedBlobs(db, plan);
    return rawBlobsMatch(db, plan);
  } catch {
    return false;
  } finally {
    try {
      db?.close();
    } catch {
      // The caller retains every source after any failed read-back.
    }
  }
}

/**
 * Copy the source root, plus any legacy-only references, into a compact SQLite
 * database. Cursor stores obsolete content-addressed roots in the live database;
 * retaining every unreachable blob made a few dozen snapshots use gigabytes.
 * The compact database keeps every selected raw blob byte-for-byte, so both the
 * existing reader and future parsers retain the recoverable conversation.
 */
function writeCompactStore(
  source,
  destination,
  sourceStamp,
  { legacy = null, legacyStamp = null } = {}
) {
  const Database = getStoreDatabase();
  const temp = tempCompactStorePath(destination);
  let compactDb;
  try {
    const plan = buildCompactPlan(source, legacy);
    if (!plan) return { ok: false, reason: legacy ? "legacy-unreadable" : "no-root" };
    if (
      cursorStoreStamp(source) !== sourceStamp ||
      (legacy && cursorStoreStamp(legacy) !== legacyStamp)
    ) {
      return { ok: false, reason: "source-changed" };
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    compactDb = new Database(temp);
    compactDb.exec(
      "PRAGMA journal_mode = DELETE; " +
        "PRAGMA synchronous = FULL; " +
        "CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT); " +
        "CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB); " +
        "CREATE TABLE ccam_snapshot (key TEXT PRIMARY KEY, value TEXT)"
    );
    attachStore(compactDb, "source_store", source);
    if (legacy) attachStore(compactDb, "legacy_store", legacy);
    prepareExpectedBlobs(compactDb, plan);
    compactDb.transaction(() => {
      compactDb.prepare("INSERT INTO meta (key, value) VALUES ('0', ?)").run(plan.metaValue);
      compactDb
        .prepare("INSERT INTO blobs (id, data) VALUES (?, ?)")
        .run(plan.rootId, plan.rootData);
      copyExpectedBlobs(compactDb, plan);
      compactDb
        .prepare("INSERT INTO ccam_snapshot (key, value) VALUES (?, ?)")
        .run("format_version", COMPACT_STORE_VERSION);
      compactDb
        .prepare("INSERT INTO ccam_snapshot (key, value) VALUES (?, ?)")
        .run("source_stamp", sourceStamp);
      if (legacyStamp) {
        compactDb
          .prepare("INSERT INTO ccam_snapshot (key, value) VALUES (?, ?)")
          .run("legacy_stamp", legacyStamp);
      }
    })();
    compactDb.exec("PRAGMA main.optimize");
    if (!rawBlobsMatch(compactDb, plan)) return { ok: false, reason: "verify-failed" };
    compactDb.close();
    compactDb = null;

    if (
      cursorStoreStamp(source) !== sourceStamp ||
      (legacy && cursorStoreStamp(legacy) !== legacyStamp)
    ) {
      return { ok: false, reason: "source-changed" };
    }
    fs.renameSync(temp, destination);
    storeMessageCache.delete(temp);
    storeMessageCache.delete(destination);
    storeStructureCache.delete(temp);
    storeStructureCache.delete(destination);
    if (
      readCompactStoreMetadata(destination)?.source_stamp !== sourceStamp ||
      (legacyStamp && readCompactStoreMetadata(destination)?.legacy_stamp !== legacyStamp) ||
      !verifyCompactStore(destination, plan) ||
      !compactStoreHasConversation(destination)
    ) {
      return { ok: false, reason: "installed-verify-failed" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `error:${(err && err.code) || "unknown"}` };
  } finally {
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
  const legacyToPreserve = source !== legacy && fs.existsSync(legacy) ? legacy : null;
  const legacyStamp = legacyToPreserve ? cursorStoreStamp(legacyToPreserve) : null;
  if (legacyToPreserve && !legacyStamp) return false;
  const workStamp = snapshotWorkStamp(stamp, legacyStamp);
  const metadata = readCompactStoreMetadata(destination);
  const current =
    metadata?.source_stamp === stamp &&
    (!legacyStamp || metadata?.legacy_stamp === legacyStamp) &&
    compactStoreHasConversation(destination);
  if (current) {
    if (fs.existsSync(legacy) && !removeStoreFile(legacy)) {
      noteSnapshotFailure(sessionId, workStamp);
      return false;
    }
    snapshotFailures.delete(sessionId);
    pendingStoreSnapshots.delete(sessionId);
    lastStoreSnapshotStamp.set(sessionId, workStamp);
    return false;
  }
  const failure = snapshotFailures.get(sessionId);
  if (failure?.stamp === workStamp && failure.count >= STORE_SNAPSHOT_RETRY_LIMIT) return false;
  if (now - (lastStoreSnapshot.get(sessionId) || 0) < 60_000) {
    if (lastStoreSnapshotStamp.get(sessionId) !== workStamp) {
      pendingStoreSnapshots.set(sessionId, workStamp);
    }
    return false;
  }
  lastStoreSnapshot.set(sessionId, now);
  const result = writeCompactStore(source, destination, stamp, {
    legacy: legacyToPreserve,
    legacyStamp,
  });
  if (!result.ok) {
    noteSnapshotFailure(sessionId, workStamp);
    return false;
  }
  snapshotFailures.delete(sessionId);
  pendingStoreSnapshots.delete(sessionId);
  lastStoreSnapshotStamp.set(sessionId, workStamp);
  if (fs.existsSync(legacy) && !removeStoreFile(legacy)) {
    noteSnapshotFailure(sessionId, workStamp);
    return false;
  }
  return true;
}

/** Migrate legacy full-store snapshots even after Cursor removed the live chat. */
function compactLegacyCursorStoresSync({ limit = Infinity } = {}) {
  let entries = [];
  try {
    entries = fs.readdirSync(getCursorSnapshotDir(), { withFileTypes: true });
  } catch {
    return { scanned: 0, compacted: 0, remaining: 0 };
  }
  const legacy = entries.filter((entry) => {
    if (!entry.isDirectory() || !isSafeCursorId(entry.name)) return false;
    const legacyStore = path.join(getCursorSnapshotDir(), entry.name, LIVE_STORE_NAME);
    if (!fs.existsSync(legacyStore)) return false;
    const liveDir = findCursorChatDir(entry.name);
    return !liveDir || !fs.existsSync(path.join(liveDir, LIVE_STORE_NAME));
  });
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
  compactLegacyCursorStoresSync,
  cursorStoreSnapshotPending,
  cursorVisibleTexts,
  readCursorStoreFile,
  readCursorStoreMessages,
  resolveCursorStoreModel,
  snapshotCursorStore,
};
