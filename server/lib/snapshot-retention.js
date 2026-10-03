/**
 * @file Retention policy for the durable transcript snapshot directories
 * (`<dataDir>/transcripts`, `codex-transcripts`, `cursor-transcripts`) —
 * issue #358. The snapshots exist because Claude Code, Codex and Cursor delete
 * their own transcripts after a TTL, so the policy is built around one rule:
 * the dashboard never deletes the only remaining copy of a transcript for a
 * session the user still has unless the user opted in (layer 3 below: a
 * configured cap or a confirmed prune). Growth is bounded in layers:
 *
 *   1. Lossless, always on: snapshots whose original is gone (and has been
 *      idle for a grace period) are gzip-compressed with verification. Codex
 *      snapshots are excluded — they are the ingest source of imported Codex
 *      sessions and are read by byte offset.
 *   2. Unreachable data: snapshots of sessions that were purged from the
 *      database are deleted with them (see deleteSnapshotsForSessions); true
 *      orphans are only removed by an explicit prune with `orphans: true`.
 *   3. Opt-in caps (`DASHBOARD_SNAPSHOT_MAX_AGE_DAYS`,
 *      `DASHBOARD_SNAPSHOT_MAX_BYTES`, both unset by default): whole old,
 *      finished sessions are pruned oldest-first and tombstoned so a re-import
 *      does not regrow them. This is the one deliberate exception to the rule:
 *      a cap may remove the only copy of an old conversation once the
 *      provider expired the original — excluding those would leave the cap
 *      nothing to reclaim. Every prune can be previewed as a dry run.
 *
 * All filesystem work goes through snapshot-store.js (pure Node, OS-neutral).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const store = require("./snapshot-store");
const { getDataDir, getProjectsDir, getTranscriptSnapshotDir } = require("./claude-home");
const { getCursorProjectsDir, getCursorSnapshotDir } = require("./cursor-home");

// A snapshot is compressed only once its original has been gone AND the
// snapshot itself idle this long — a guard against a transcript that is only
// briefly missing (a rename mid-rewrite, a drive that is remounting).
const COMPRESS_GRACE_MS = 24 * 60 * 60 * 1000;
// Small files gain nothing from gzip framing; leave them plain.
const MIN_COMPRESS_BYTES = 4096;
const MAINTENANCE_FIRST_DELAY_MS = 2 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Settings polls /api/settings/info every few seconds and walking a large
// snapshot tree is not free, so the report is cached; this module's own
// writes (compress, prune, purge) invalidate it immediately.
const STORAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const TERMINAL_STATUSES = new Set(["completed", "error", "abandoned"]);
// Finished sessions active this recently are never pruned by the size cap —
// the cap reports `over_cap_bytes` instead of eating the newest history.
const RECENT_PROTECT_MS = 24 * 60 * 60 * 1000;
// Cap on how many candidate rows a plan returns (totals always cover all).
const MAX_PLAN_ROWS = 500;

/** The three snapshot roots. Only Claude and Cursor snapshots are compressible. */
function getSnapshotRoots() {
  return [
    { kind: "claude", root: getTranscriptSnapshotDir(), compressible: true },
    // Same directory as codex-import.js's SNAPSHOT_DIR (not required here to
    // avoid pulling the database into this module's load path).
    { kind: "codex", root: path.join(getDataDir(), "codex-transcripts"), compressible: false },
    { kind: "cursor", root: getCursorSnapshotDir(), compressible: true },
  ];
}

/**
 * Parse a byte size: plain bytes ("1048576") or a number with a binary unit
 * suffix ("500MB", "5GB", "1.5TiB"). Returns null for empty/invalid/<= 0.
 */
function parseByteSize(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*([kmgt]?)i?b?$/i);
  if (!match) return null;
  const units = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
  const bytes = Math.floor(Number(match[1]) * units[match[2].toLowerCase()]);
  return bytes > 0 ? bytes : null;
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Effective policy from the environment. Caps are unset (unlimited) by default. */
function getSnapshotPolicy() {
  const compressRaw = String(process.env.DASHBOARD_SNAPSHOT_COMPRESS ?? "")
    .trim()
    .toLowerCase();
  return {
    compress: !["0", "false", "off", "no"].includes(compressRaw),
    max_age_days: parsePositiveNumber(process.env.DASHBOARD_SNAPSHOT_MAX_AGE_DAYS),
    max_bytes: parseByteSize(process.env.DASHBOARD_SNAPSHOT_MAX_BYTES),
  };
}

let storageCache = null;

function invalidateSnapshotStorage() {
  storageCache = null;
}

/** Per-root sizes plus totals and the active policy. Cached briefly. */
function getSnapshotStorage({ fresh = false } = {}) {
  if (!fresh && storageCache && Date.now() - storageCache.at < STORAGE_CACHE_TTL_MS) {
    return storageCache.value;
  }
  const roots = {};
  let totalBytes = 0;
  let totalFiles = 0;
  for (const { kind, root } of getSnapshotRoots()) {
    const summary = store.summarizeSnapshotRoot(root);
    roots[kind] = summary;
    totalBytes += summary.bytes;
    totalFiles += summary.files;
  }
  const value = {
    total_bytes: totalBytes,
    total_files: totalFiles,
    roots,
    policy: getSnapshotPolicy(),
  };
  storageCache = { at: Date.now(), value };
  return value;
}

/**
 * Session ids whose original transcript is still on disk, or null when the
 * source tree can't be read at all (missing, unmounted, permission denied) —
 * in which case NOTHING may be treated as "original gone".
 */
function liveClaudeSessionIds() {
  const projectsDir = getProjectsDir();
  let projects;
  try {
    projects = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const ids = new Set();
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    let files;
    try {
      files = fs.readdirSync(path.join(projectsDir, project.name));
    } catch {
      // One unreadable project could hide a live original — refuse to guess.
      return null;
    }
    for (const file of files) if (file.endsWith(".jsonl")) ids.add(file.slice(0, -6));
  }
  return ids;
}

function liveCursorSessionIds() {
  const projectsDir = getCursorProjectsDir();
  let projects;
  try {
    projects = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const ids = new Set();
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const transcriptsDir = path.join(projectsDir, project.name, "agent-transcripts");
    let sessions;
    try {
      sessions = fs.readdirSync(transcriptsDir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code === "ENOENT") continue; // project with no agent transcripts
      return null;
    }
    for (const session of sessions) if (session.isDirectory()) ids.add(session.name);
  }
  return ids;
}

function liveSessionIds(kind) {
  if (kind === "claude") return liveClaudeSessionIds();
  if (kind === "cursor") return liveCursorSessionIds();
  return null;
}

let compressionRunning = null;

/**
 * Compress every snapshot whose original is gone. Returns counters; never
 * throws. Single-flight: the on-demand route and the background pass share a
 * running compression instead of racing each other. `now` is injectable for
 * tests.
 */
function compressOrphanedOriginals(options = {}) {
  if (compressionRunning) return compressionRunning;
  compressionRunning = runCompression(options).finally(() => {
    compressionRunning = null;
  });
  return compressionRunning;
}

async function runCompression({ now = Date.now() } = {}) {
  const result = { compressed: 0, bytes_before: 0, bytes_after: 0, failed: 0, skipped_roots: [] };
  for (const { kind, root, compressible } of getSnapshotRoots()) {
    if (!compressible) continue;
    const live = liveSessionIds(kind);
    if (!live) {
      result.skipped_roots.push(kind);
      continue;
    }
    for (const file of store.listSnapshotFiles(root)) {
      if (file.compressed || !file.sessionId || live.has(file.sessionId)) continue;
      if (!file.path.endsWith(".jsonl")) continue;
      if (file.size < MIN_COMPRESS_BYTES) continue;
      if (now - file.mtimeMs < COMPRESS_GRACE_MS) continue;
      const outcome = await store.compressSnapshotFile(file.path);
      if (outcome.ok) {
        result.compressed++;
        result.bytes_before += outcome.bytesBefore;
        result.bytes_after += outcome.bytesAfter;
      } else if (outcome.reason !== "changed-during-compression") {
        result.failed++;
      }
    }
  }
  if (result.compressed) invalidateSnapshotStorage();
  return result;
}

function parseTime(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : null;
}

function loadSessionIndex(db) {
  const index = new Map();
  for (const row of db
    .prepare("SELECT id, status, started_at, updated_at, ended_at FROM sessions")
    .iterate()) {
    const times = [row.started_at, row.updated_at, row.ended_at].map(parseTime).filter(Boolean);
    index.set(row.id, {
      status: row.status,
      lastActivityMs: times.length ? Math.max(...times) : null,
    });
  }
  return index;
}

/**
 * Work out what a prune would remove, without touching anything.
 *
 * @param {object} db better-sqlite3 handle
 * @param {object} opts
 * @param {number|null} [opts.maxAgeDays] prune finished sessions idle longer
 * @param {number|null} [opts.maxBytes]   then prune oldest until under this
 * @param {boolean} [opts.orphans]        also prune snapshots with no session row
 * @param {number} [opts.now]
 */
function planSnapshotPrune(db, { maxAgeDays = null, maxBytes = null, orphans = false, now } = {}) {
  const nowMs = now ?? Date.now();
  const sessions = loadSessionIndex(db);
  const groups = new Map(); // `${kind}\0${sid}` → group
  let totalBytes = 0;
  for (const { kind, root } of getSnapshotRoots()) {
    for (const file of store.listSnapshotFiles(root)) {
      totalBytes += file.size;
      if (!file.sessionId) continue; // unattributable file: never auto-removed
      const key = `${kind}\0${file.sessionId}`;
      let group = groups.get(key);
      if (!group) {
        group = { kind, root, sessionId: file.sessionId, bytes: 0, files: 0, newestMtimeMs: 0 };
        groups.set(key, group);
      }
      group.bytes += file.size;
      group.files++;
      group.newestMtimeMs = Math.max(group.newestMtimeMs, file.mtimeMs);
    }
  }

  const chosen = [];
  const take = (group, reason, lastActivityMs) => {
    group.reason = reason;
    group.lastActivityMs = lastActivityMs;
    chosen.push(group);
  };
  const eligible = [];
  const ageCutoff = maxAgeDays ? nowMs - maxAgeDays * 86400 * 1000 : null;

  for (const group of groups.values()) {
    const session = sessions.get(group.sessionId);
    if (!session) {
      if (orphans) take(group, "orphan", null);
      continue;
    }
    // Never touch a session that could still be running.
    if (!TERMINAL_STATUSES.has(session.status)) continue;
    const lastActivityMs = Math.max(session.lastActivityMs || 0, group.newestMtimeMs);
    if (ageCutoff !== null && lastActivityMs < ageCutoff) {
      take(group, "max_age", lastActivityMs);
    } else if (nowMs - lastActivityMs >= RECENT_PROTECT_MS) {
      eligible.push({ group, lastActivityMs });
    }
  }

  let remaining = totalBytes - chosen.reduce((sum, g) => sum + g.bytes, 0);
  if (maxBytes && remaining > maxBytes) {
    eligible.sort((a, b) => a.lastActivityMs - b.lastActivityMs);
    for (const { group, lastActivityMs } of eligible) {
      if (remaining <= maxBytes) break;
      take(group, "max_bytes", lastActivityMs);
      remaining -= group.bytes;
    }
  }

  chosen.sort((a, b) => (a.lastActivityMs ?? 0) - (b.lastActivityMs ?? 0));
  return {
    total_bytes: totalBytes,
    candidate_sessions: chosen.length,
    candidate_files: chosen.reduce((sum, g) => sum + g.files, 0),
    candidate_bytes: chosen.reduce((sum, g) => sum + g.bytes, 0),
    remaining_bytes: remaining,
    over_cap_bytes: maxBytes && remaining > maxBytes ? remaining - maxBytes : 0,
    candidates: chosen,
  };
}

function publicCandidate(group) {
  return {
    kind: group.kind,
    session_id: group.sessionId,
    reason: group.reason,
    files: group.files,
    bytes: group.bytes,
    last_activity: group.lastActivityMs ? new Date(group.lastActivityMs).toISOString() : null,
  };
}

/**
 * Plan and (unless `dryRun`) apply a prune. Cap-driven removals are
 * tombstoned so a re-import does not recreate them; orphan removals are not
 * (if the session is ever re-imported, it is a session again).
 */
function pruneSnapshots(db, { dryRun = true, maxAgeDays, maxBytes, orphans = false, now } = {}) {
  const plan = planSnapshotPrune(db, { maxAgeDays, maxBytes, orphans, now });
  const response = {
    dry_run: !!dryRun,
    criteria: {
      max_age_days: maxAgeDays || null,
      max_bytes: maxBytes || null,
      orphans: !!orphans,
    },
    total_bytes: plan.total_bytes,
    candidate_sessions: plan.candidate_sessions,
    candidate_files: plan.candidate_files,
    candidate_bytes: plan.candidate_bytes,
    remaining_bytes: plan.remaining_bytes,
    over_cap_bytes: plan.over_cap_bytes,
    candidates: plan.candidates.slice(0, MAX_PLAN_ROWS).map(publicCandidate),
    truncated: plan.candidates.length > MAX_PLAN_ROWS,
    removed_files: 0,
    removed_bytes: 0,
    failed_files: 0,
  };
  if (dryRun) return response;
  for (const group of plan.candidates) {
    const removed = store.deleteSessionSnapshots(group.root, group.sessionId);
    response.removed_files += removed.files;
    response.removed_bytes += removed.bytes;
    response.failed_files += removed.failed;
    if (group.reason !== "orphan") {
      try {
        store.writeTombstone(group.root, group.sessionId);
      } catch {
        /* without a tombstone a re-import may regrow it; the cap re-prunes */
      }
    }
  }
  invalidateSnapshotStorage();
  return response;
}

/**
 * Delete the snapshots of sessions whose database rows are being removed
 * (purge / remote-source purge). Their Conversation tab is unreachable without
 * the row, so the files are dead weight. Never throws.
 */
function deleteSnapshotsForSessions(sessionIds) {
  const result = { files: 0, bytes: 0, failed: 0 };
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return result;
  const roots = getSnapshotRoots();
  for (const sessionId of sessionIds) {
    for (const { root } of roots) {
      try {
        const removed = store.deleteSessionSnapshots(root, sessionId);
        result.files += removed.files;
        result.bytes += removed.bytes;
        result.failed += removed.failed;
      } catch {
        result.failed++;
      }
    }
  }
  if (result.files) invalidateSnapshotStorage();
  return result;
}

let maintenanceRunning = null;

/**
 * One maintenance pass: sweep stale temp files, compress snapshots whose
 * original is gone, then apply the configured caps (if any). Single-flight:
 * a call while a pass is running returns that pass.
 */
function runSnapshotMaintenance(db, { log = console } = {}) {
  if (maintenanceRunning) return maintenanceRunning;
  maintenanceRunning = (async () => {
    const policy = getSnapshotPolicy();
    const summary = { temp_removed: 0, compression: null, prune: null };
    for (const { root } of getSnapshotRoots()) summary.temp_removed += store.cleanupStaleTemp(root);
    if (policy.compress) summary.compression = await compressOrphanedOriginals();
    if (policy.max_age_days || policy.max_bytes) {
      summary.prune = pruneSnapshots(db, {
        dryRun: false,
        maxAgeDays: policy.max_age_days,
        maxBytes: policy.max_bytes,
        orphans: false,
      });
    }
    const c = summary.compression;
    if (c && c.compressed) {
      log.log(
        `Snapshot maintenance: compressed ${c.compressed} transcript snapshot(s) ` +
          `(${c.bytes_before} → ${c.bytes_after} bytes)`
      );
    }
    const p = summary.prune;
    if (p && p.removed_files) {
      log.log(
        `Snapshot maintenance: pruned ${p.candidate_sessions} session snapshot(s) ` +
          `(${p.removed_bytes} bytes) under the configured retention cap`
      );
    }
    return summary;
  })()
    .catch((err) => {
      log.warn("snapshot maintenance failed:", err && err.message);
      return null;
    })
    .finally(() => {
      maintenanceRunning = null;
    });
  return maintenanceRunning;
}

/** Background schedule: first pass shortly after boot, then every 6 hours. */
function startSnapshotMaintenance(db) {
  const run = () => {
    runSnapshotMaintenance(db);
  };
  const first = setTimeout(run, MAINTENANCE_FIRST_DELAY_MS);
  const interval = setInterval(run, MAINTENANCE_INTERVAL_MS);
  first.unref?.();
  interval.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}

module.exports = {
  COMPRESS_GRACE_MS,
  compressOrphanedOriginals,
  deleteSnapshotsForSessions,
  getSnapshotPolicy,
  getSnapshotRoots,
  getSnapshotStorage,
  invalidateSnapshotStorage,
  parseByteSize,
  planSnapshotPrune,
  pruneSnapshots,
  runSnapshotMaintenance,
  startSnapshotMaintenance,
};
