/**
 * @file Imports historical Codex rollout transcripts through the live ingestor,
 * preserving token accounting, tools, lifecycle state, native titles, and a
 * durable snapshot for external folders and browser uploads.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { stmts } = require("../db");
const { isLocalHistoryOwner } = require("./session-origin");
const { getDataDir } = require("./claude-home");
const { getCodexSessionsDir } = require("./codex-home");
const { findCodexTranscripts, ingestCodexTranscript } = require("./codex-ingest");
const { writeSnapshot } = require("./snapshot-store");

const SNAPSHOT_DIR = () => path.join(getDataDir(), "codex-transcripts");

/**
 * Resolve the durable Codex thread id from session metadata. A UUID in the
 * filename must agree when session metadata is present. Metadata-free legacy
 * transcripts retain the filename fallback used by ingestion; ownership is
 * checked separately before any snapshot or DB write.
 * Remote sync uses this same resolver before tagging newly ingested sessions,
 * so local, uploaded, and SSH-mirrored histories agree on ownership.
 */
function getCodexTranscriptSessionId(transcriptPath) {
  const filenameMatch = path
    .basename(transcriptPath)
    .match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i);
  const validatedId = (record) => {
    const id = record?.type === "session_meta" ? record?.payload?.id : null;
    if (typeof id !== "string" || !id) return undefined;
    return filenameMatch && filenameMatch[1].toLowerCase() !== id.toLowerCase() ? null : id;
  };
  // Native rollouts start with a small metadata record: avoid loading the
  // entire history for every ownership scan. Non-native layouts fall back.
  let fd;
  try {
    fd = fs.openSync(transcriptPath, "r");
    const head = Buffer.alloc(64 * 1024);
    const bytes = fs.readSync(fd, head, 0, head.length, 0);
    const id = validatedId(JSON.parse(head.toString("utf8", 0, bytes).split("\n")[0]));
    if (id !== undefined) return id;
  } catch {
    /* Use the existing metadata scan below for non-native layouts. */
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  try {
    const body = fs.readFileSync(transcriptPath, "utf8");
    for (const line of body.split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const id = validatedId(record);
      if (id !== undefined) return id;
    }
  } catch {
    // The caller records the unreadable transcript as a non-fatal error.
  }
  return filenameMatch?.[1] || null;
}

/**
 * Copy an imported rollout into the dashboard-owned snapshot dir and return
 * the snapshot path (the session's `transcript_path`). Goes through the shared
 * snapshot store: atomic, never shrinks an existing copy. Returns null when
 * the session's snapshot was pruned by the retention cap and the rollout has
 * not changed since (snapshot-retention.js tombstone) — the caller skips it so
 * a periodic remote re-sync does not regrow it. Throws on a write failure.
 */
function snapshotCodexTranscript(sourcePath, sessionId) {
  const result = writeSnapshot({
    root: SNAPSHOT_DIR(),
    sessionId,
    source: sourcePath,
    relPath: `${sessionId}.jsonl`,
  });
  if (result.reason && result.reason.startsWith("error:")) {
    throw new Error(`Codex snapshot failed (${result.reason.slice(6)})`);
  }
  if (result.reason === "source-missing") throw new Error("Codex rollout disappeared");
  return result.path;
}

function readNativeTitles(root) {
  const titles = new Map();
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name === "session_index.jsonl") {
        try {
          for (const line of fs.readFileSync(target, "utf8").split("\n")) {
            if (!line.trim()) continue;
            const record = JSON.parse(line);
            const id = typeof record?.id === "string" ? record.id : null;
            const title = typeof record?.thread_name === "string" ? record.thread_name.trim() : "";
            if (id && title) titles.set(id, title);
          }
        } catch {
          // A partial or malformed title index must not block its rollouts.
        }
      }
    }
  }
  return titles;
}

/**
 * Import Codex rollouts from any directory. Default-home imports retain the
 * live transcript path; imports from an archive, another machine, or browser
 * upload use dashboard-owned snapshots so session detail remains available.
 *
 * `options.isExcludedSession(id)` is true for a thread id owned by another source
 * (remote sync passes it): such rollouts are skipped before the snapshot is
 * written, so a mirrored copy never touches a session this tree does not own.
 * `options.originSource` ({id, key}) stamps new rows with that source and origin
 * key in the very INSERT that creates them.
 */
async function importCodexFromDirectory(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const retainLivePath = options.retainLivePath === true;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const isExcluded = (id) => {
    if (!options.originSource && !isLocalHistoryOwner(stmts.getSession.get(id), "codex"))
      return true;
    if (typeof options.isExcludedSession !== "function") return false;
    return !!options.isExcludedSession(id);
  };
  const transcripts = findCodexTranscripts(resolvedRoot, { includeAllJsonl: true });
  const titles = readNativeTitles(resolvedRoot);
  const counters = {
    imported: 0,
    skipped: 0,
    backfilled: 0,
    errors: 0,
    sessionsSeen: 0,
    filesScanned: transcripts.length,
    excluded: 0,
    excludedIds: [],
    excludedSubagentFiles: 0,
  };
  const excludedSeen = new Set();
  const seenSessionIds = new Set();

  onProgress({ phase: "scan", processed: 0, total: transcripts.length });
  for (let index = 0; index < transcripts.length; index++) {
    const sourcePath = transcripts[index];
    try {
      const sessionId = getCodexTranscriptSessionId(sourcePath);
      // session_index.jsonl and unrelated JSONL files can coexist with a
      // Codex archive. They are not rollouts, so ignore them without calling
      // them parse errors.
      if (!sessionId) {
        counters.skipped++;
        continue;
      }
      if (isExcluded(sessionId)) {
        // Unique thread ids; several rollout files of one id count once.
        if (!excludedSeen.has(sessionId)) {
          excludedSeen.add(sessionId);
          counters.excluded++;
          if (counters.excludedIds.length < 50) counters.excludedIds.push(sessionId);
        }
        continue;
      }
      if (!seenSessionIds.has(sessionId)) {
        seenSessionIds.add(sessionId);
        counters.sessionsSeen++;
      }

      const expectedPath = retainLivePath
        ? sourcePath
        : path.join(SNAPSHOT_DIR(), `${sessionId}.jsonl`);
      for (const cursor of [stmts.getCodexIngestState, stmts.getCodexToolIngestState]) {
        const state = cursor.get(expectedPath);
        if (state?.session_id && state.session_id !== sessionId) {
          throw new Error("Codex import cursor identity mismatch");
        }
      }
      const transcriptPath = retainLivePath
        ? sourcePath
        : snapshotCodexTranscript(sourcePath, sessionId);
      if (!transcriptPath) {
        counters.skipped++;
        continue;
      }
      const existing = stmts.getSession.get(sessionId);
      // Different file paths for one Codex session have independent byte
      // cursors. Import an existing *canonical* path for new bytes, but never
      // replay an alternate copy over a live session and inflate its deltas.
      if (
        existing &&
        existing.provider === "codex" &&
        path.resolve(existing.transcript_path || "") !== path.resolve(transcriptPath)
      ) {
        counters.skipped++;
        continue;
      }

      const result = ingestCodexTranscript(transcriptPath, {
        root: retainLivePath ? resolvedRoot : SNAPSHOT_DIR(),
        originSource: options.originSource,
        expectedSessionId: sessionId,
        isExcludedSession: isExcluded,
      });
      if (result.created) counters.imported++;
      else if (result.changed) counters.backfilled++;
      else counters.skipped++;

      const importedTitle = titles.get(sessionId);
      if (importedTitle && result.session && result.session.name !== importedTitle) {
        stmts.updateSessionName.run(importedTitle, sessionId, importedTitle);
      }
    } catch {
      counters.errors++;
    }

    onProgress({
      phase: "parse",
      processed: index + 1,
      total: transcripts.length,
      current: path.basename(sourcePath),
      counters: {
        imported: counters.imported,
        skipped: counters.skipped,
        backfilled: counters.backfilled,
        errors: counters.errors,
      },
    });
    if (index > 0 && index % 25 === 0) await new Promise((resolve) => setImmediate(resolve));
  }

  onProgress({ phase: "complete", counters });
  return counters;
}

function getCodexImportSnapshotDir() {
  return SNAPSHOT_DIR();
}

module.exports = {
  getCodexImportSnapshotDir,
  getCodexTranscriptSessionId,
  importCodexFromDirectory,
  snapshotCodexTranscript,
};
