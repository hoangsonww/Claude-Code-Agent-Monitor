/**
 * @file Imports historical Codex rollout transcripts through the live ingestor,
 * preserving token accounting, tools, lifecycle state, native titles, and a
 * durable snapshot for external folders and browser uploads.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { stmts } = require("../db");
const { getDataDir } = require("./claude-home");
const { getCodexSessionsDir } = require("./codex-home");
const { findCodexTranscripts, ingestCodexTranscript } = require("./codex-ingest");

const SNAPSHOT_DIR = () => path.join(getDataDir(), "codex-transcripts");

/**
 * Resolve the durable Codex thread id from a rollout filename, falling back to
 * its session metadata when an imported archive used a non-standard filename.
 * Remote sync uses this same resolver before tagging newly ingested sessions,
 * so local, uploaded, and SSH-mirrored histories agree on ownership.
 */
function getCodexTranscriptSessionId(transcriptPath) {
  const filenameMatch = path
    .basename(transcriptPath)
    .match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i);
  if (filenameMatch) return filenameMatch[1];
  try {
    const body = fs.readFileSync(transcriptPath, "utf8");
    for (const line of body.split("\n")) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const id = record?.type === "session_meta" ? record?.payload?.id : null;
      if (typeof id === "string" && id) return id;
    }
  } catch {
    // The caller records the unreadable transcript as a non-fatal error.
  }
  return null;
}

function copyIfNewer(sourcePath, destinationPath) {
  const sourceSize = fs.statSync(sourcePath).size;
  let destinationSize = -1;
  try {
    destinationSize = fs.statSync(destinationPath).size;
  } catch {
    /* destination does not exist yet */
  }
  if (destinationSize >= sourceSize) return destinationPath;
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

function snapshotCodexTranscript(sourcePath, sessionId) {
  return copyIfNewer(sourcePath, path.join(SNAPSHOT_DIR(), `${sessionId}.jsonl`));
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
 */
async function importCodexFromDirectory(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  const retainLivePath = options.retainLivePath === true;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const transcripts = findCodexTranscripts(resolvedRoot, { includeAllJsonl: true });
  const titles = readNativeTitles(resolvedRoot);
  const counters = {
    imported: 0,
    skipped: 0,
    backfilled: 0,
    errors: 0,
    sessionsSeen: 0,
    filesScanned: transcripts.length,
  };
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
      if (!seenSessionIds.has(sessionId)) {
        seenSessionIds.add(sessionId);
        counters.sessionsSeen++;
      }

      const transcriptPath = retainLivePath
        ? sourcePath
        : snapshotCodexTranscript(sourcePath, sessionId);
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
