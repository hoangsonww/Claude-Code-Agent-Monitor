/**
 * @file Express router for the Import History feature.
 *
 * Provider-aware Claude Code and Codex history import. Each entry point uses
 * the exact same ingestion pipeline as its provider's live sync, preserving
 * tokens, per-model costs, tool events, lifecycle state, and session titles.
 *
 *   GET  /api/import/guide       — OS-aware instructions + default paths
 *   POST /api/import/rescan      — re-scan the selected provider's default dir
 *   POST /api/import/scan-path   — scan an arbitrary absolute directory path
 *   POST /api/import/upload      — multipart: JSONLs and/or archives
 *
 * Progress is broadcast over the existing websocket as `import.progress`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { broadcast } = require("../websocket");
const {
  importAllSessions,
  importFromDirectory,
  collectJsonlFiles,
} = require("../../scripts/import-history");
const { importCodexFromDirectory } = require("../lib/codex-import");
const {
  mkTempDir,
  rmTempDir,
  extractInto,
  detectKind,
  ExtractionLimitError,
} = require("../lib/archive");

const router = Router();

const { getClaudeHome, getProjectsDir } = require("../lib/claude-home");
const { getCodexHome, getCodexSessionsDir } = require("../lib/codex-home");
const { findCodexTranscripts } = require("../lib/codex-ingest");

// Upload limits — deliberately generous because transcripts can be large.
// Configurable at runtime via env for deployments that need tighter bounds.
const MAX_UPLOAD_BYTES = parseInt(
  process.env.CCAM_IMPORT_MAX_BYTES || String(1024 * 1024 * 1024), // 1 GB default
  10
);
const MAX_UPLOAD_FILES = parseInt(process.env.CCAM_IMPORT_MAX_FILES || "2000", 10);

/**
 * Lazily build a multer upload middleware. Kept lazy so the server still
 * boots if `multer` isn't installed yet — only /upload fails in that case.
 *
 * Each request gets its own staging directory created on the `req` object
 * during the first call to `destination`. Multer invokes `destination` once
 * per uploaded file, all within the same request, so a sentinel on `req`
 * avoids creating multiple dirs per request while guaranteeing isolation
 * across concurrent requests.
 */
function getUploader() {
  let multer;
  try {
    multer = require("multer");
  } catch {
    return null;
  }
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      if (!req._ccamUploadDir) req._ccamUploadDir = mkTempDir("ccam-upload-");
      cb(null, req._ccamUploadDir);
    },
    filename: (_req, file, cb) => {
      // Preserve the original name for kind-detection later, but prefix with
      // a random token so collisions between two uploads with the same name
      // don't clobber each other.
      const rand = require("crypto").randomBytes(4).toString("hex");
      cb(null, `${rand}__${file.originalname}`);
    },
  });
  return multer({
    storage,
    limits: {
      files: MAX_UPLOAD_FILES,
      fileSize: MAX_UPLOAD_BYTES,
      fields: 32,
    },
    fileFilter: (req, file, cb) => {
      const kind = detectKind(file.originalname);
      if (kind === "unknown") {
        // Track rejected filenames on the request so we can surface the count
        // in the response — users wonder why their upload "partially worked".
        if (!req._ccamRejected) req._ccamRejected = [];
        req._ccamRejected.push(file.originalname);
        cb(null, false);
      } else {
        cb(null, true);
      }
    },
  });
}

/**
 * Throttle progress broadcasts so we don't flood the websocket on large imports.
 */
function makeProgressBroadcaster(importId) {
  let lastSent = 0;
  return (progress) => {
    const now = Date.now();
    if (progress.phase === "complete" || now - lastSent > 150) {
      lastSent = now;
      broadcast("import.progress", { importId, ...progress });
    }
  };
}

function countsSummary(counters) {
  return {
    imported: counters.imported || 0,
    skipped: counters.skipped || 0,
    backfilled: counters.backfilled || 0,
    errors: counters.errors || 0,
    sessions_seen: counters.sessionsSeen || 0,
    files_scanned: counters.filesScanned || 0,
  };
}

function requestedProvider(req) {
  const value = req.body?.provider ?? req.query?.provider ?? "claude";
  return value === "claude" || value === "codex" ? value : null;
}

function rejectUnsupportedProvider(res) {
  return res.status(400).json({
    error: {
      code: "INVALID_PROVIDER",
      message: "`provider` must be either `claude` or `codex`",
    },
  });
}

function countCodexHistory(root) {
  const files = findCodexTranscripts(root);
  return {
    projects: new Set(files.map((file) => path.dirname(file))).size,
    jsonl_files: files.length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/import/guide — step-by-step instructions the UI renders verbatim.
// ────────────────────────────────────────────────────────────────────────────
router.get("/guide", (req, res) => {
  const provider = requestedProvider(req);
  if (!provider) return rejectUnsupportedProvider(res);
  const platform = process.platform;
  if (provider === "codex") {
    const codexHome = getCodexHome();
    const sessionsDir = getCodexSessionsDir();
    const codexHomeDisplay = codexHome.replace(os.homedir(), "~");
    const sessionsDisplay = path.join(codexHomeDisplay, "sessions");
    const defaults = {
      darwin: sessionsDisplay,
      linux: sessionsDisplay,
      win32: sessionsDisplay.replace(/\//g, "\\"),
    };
    const archiveCmd = {
      darwin: `tar -czf codex-history.tar.gz -C ${codexHomeDisplay} sessions`,
      linux: `tar -czf codex-history.tar.gz -C ${codexHomeDisplay} sessions`,
      win32: `tar -czf codex-history.tar.gz -C "${codexHomeDisplay.replace(/\//g, "\\")}" sessions`,
    };
    const exists = fs.existsSync(sessionsDir);
    const stats = exists ? countCodexHistory(sessionsDir) : { projects: 0, jsonl_files: 0 };
    return res.json({
      provider,
      platform,
      default_projects_dir: sessionsDir,
      default_projects_dir_display: defaults[platform] || sessionsDir,
      default_projects_dir_exists: exists,
      default_projects_dir_stats: stats,
      archive_command: archiveCmd[platform] || archiveCmd.linux,
      supported_extensions: [".jsonl", ".meta.json", ".zip", ".tar", ".tar.gz", ".tgz", ".gz"],
      max_upload_bytes: MAX_UPLOAD_BYTES,
      max_upload_files: MAX_UPLOAD_FILES,
      steps: [
        {
          id: "locate",
          title: "Locate your Codex history",
          body: `Codex stores append-only rollout transcripts under ${defaults[platform] || defaults.linux}. Each rollout records user messages, assistant output, tool calls, lifecycle events, and token snapshots.`,
        },
        {
          id: "archive",
          title: "Bundle it for transfer (optional)",
          body: `If you're importing from another machine, archive the sessions folder first:\n\n    ${archiveCmd[platform] || archiveCmd.linux}\n\nMove codex-history.tar.gz to this machine however you like (AirDrop, scp, USB, cloud storage). Include session_index.jsonl too if you want archived native /rename titles.`,
        },
        {
          id: "choose",
          title: "Pick an import mode",
          body: "Rescan default: re-read this machine's ~/.codex/sessions. From folder: scan a copied or extracted Codex directory. Upload: drag-drop rollout JSONL files or an archive directly into the browser.",
        },
        {
          id: "verify",
          title: "Verify tokens and cost",
          body: "Imports are idempotent. Codex token snapshots and response-item tool calls are ingested through the same cursors as real-time monitoring, so duplicate scans never add usage twice.",
        },
      ],
    });
  }
  const claudeHome = getClaudeHome();
  const claudeHomeDisplay = claudeHome.replace(os.homedir(), "~");
  const projectsDisplay = path.join(claudeHomeDisplay, "projects");
  const defaults = {
    darwin: projectsDisplay,
    linux: projectsDisplay,
    win32: projectsDisplay.replace(/\//g, "\\"),
  };
  const archiveBase = claudeHomeDisplay;
  const archiveCmd = {
    darwin: `tar -czf claude-history.tar.gz -C ${archiveBase} projects`,
    linux: `tar -czf claude-history.tar.gz -C ${archiveBase} projects`,
    win32: `tar -czf claude-history.tar.gz -C "${projectsDisplay.replace(/\//g, "\\")}" projects`,
  };
  const exists = fs.existsSync(getProjectsDir());
  let projectCount = 0;
  let fileCount = 0;
  if (exists) {
    try {
      const dirs = fs
        .readdirSync(getProjectsDir(), { withFileTypes: true })
        .filter((d) => d.isDirectory());
      projectCount = dirs.length;
      for (const d of dirs) {
        try {
          fileCount += fs
            .readdirSync(path.join(getProjectsDir(), d.name))
            .filter((f) => f.endsWith(".jsonl")).length;
        } catch {
          /* non-fatal */
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  res.json({
    provider,
    platform,
    default_projects_dir: getProjectsDir(),
    default_projects_dir_display: defaults[platform] || getProjectsDir(),
    default_projects_dir_exists: exists,
    default_projects_dir_stats: { projects: projectCount, jsonl_files: fileCount },
    archive_command: archiveCmd[platform] || archiveCmd.linux,
    supported_extensions: [".jsonl", ".meta.json", ".zip", ".tar", ".tar.gz", ".tgz", ".gz"],
    max_upload_bytes: MAX_UPLOAD_BYTES,
    max_upload_files: MAX_UPLOAD_FILES,
    steps: [
      {
        id: "locate",
        title: "Locate your Claude Code history",
        body: `Claude Code stores every session as a JSONL transcript under ${defaults[platform] || defaults.linux}. Each subdirectory is named after the working directory where the session started (with slashes replaced by dashes).`,
      },
      {
        id: "archive",
        title: "Bundle it for transfer (optional)",
        body: `If you're importing from another machine, archive the whole projects folder first:\n\n    ${archiveCmd[platform] || archiveCmd.linux}\n\nMove claude-history.tar.gz to this machine however you like (AirDrop, scp, USB, cloud storage).`,
      },
      {
        id: "choose",
        title: "Pick an import mode",
        body: "Rescan default: re-read ~/.claude/projects on this machine and import anything new. From folder: point the dashboard at any directory you've extracted history into. Upload: drag-drop JSONL files or an archive directly into the browser.",
      },
      {
        id: "verify",
        title: "Verify tokens and cost",
        body: "Imports are idempotent: re-running is always safe. Token counts are deduplicated per session ID, with compaction baselines preserved so cost never double-counts. After import, open Analytics → Cost to confirm the breakdown.",
      },
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/import/rescan — default ~/.claude/projects directory.
// ────────────────────────────────────────────────────────────────────────────
router.post("/rescan", async (req, res) => {
  const importId = `rescan-${Date.now()}`;
  const provider = requestedProvider(req);
  if (!provider) return rejectUnsupportedProvider(res);
  try {
    broadcast("import.progress", { importId, phase: "start", source: "default", provider });
    const dbModule = require("../db");
    const onProgress = makeProgressBroadcaster(importId);
    const result =
      provider === "codex"
        ? await importCodexFromDirectory(getCodexSessionsDir(), {
            onProgress,
            retainLivePath: true,
          })
        : await importAllSessions(dbModule);
    broadcast("import.progress", {
      importId,
      phase: "complete",
      source: "default",
      provider,
      counters: result,
    });
    res.json({ ok: true, source: "default", provider, ...countsSummary(result) });
  } catch (err) {
    broadcast("import.progress", { importId, phase: "error", provider, error: err.message });
    res.status(500).json({ error: { code: "IMPORT_FAILED", message: err.message } });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/import/scan-path — arbitrary absolute directory.
// ────────────────────────────────────────────────────────────────────────────
router.post("/scan-path", async (req, res) => {
  const importId = `scan-${Date.now()}`;
  const provider = requestedProvider(req);
  if (!provider) return rejectUnsupportedProvider(res);
  const rawPath = (req.body && req.body.path) || "";
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_INPUT", message: "`path` is required" } });
  }

  // Expand ~ to the user's home directory for convenience.
  const expanded = rawPath.startsWith("~") ? path.join(os.homedir(), rawPath.slice(1)) : rawPath;
  if (!path.isAbsolute(expanded)) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "`path` must be an absolute path" },
    });
  }

  let stat;
  try {
    stat = fs.statSync(expanded);
  } catch (err) {
    return res.status(400).json({
      error: { code: "PATH_NOT_FOUND", message: `Path does not exist: ${expanded}` },
    });
  }
  if (!stat.isDirectory()) {
    return res.status(400).json({
      error: { code: "NOT_A_DIRECTORY", message: `Path is not a directory: ${expanded}` },
    });
  }

  try {
    const onProgress = makeProgressBroadcaster(importId);
    broadcast("import.progress", {
      importId,
      phase: "start",
      source: "path",
      provider,
      path: expanded,
    });
    const dbModule = require("../db");
    const counters =
      provider === "codex"
        ? await importCodexFromDirectory(expanded, { onProgress })
        : await importFromDirectory(dbModule, expanded, { onProgress });
    const summary = countsSummary(counters);
    broadcast("import.progress", {
      importId,
      phase: "complete",
      source: "path",
      provider,
      counters: summary,
    });
    res.json({ ok: true, source: "path", provider, path: expanded, ...summary });
  } catch (err) {
    broadcast("import.progress", { importId, phase: "error", provider, error: err.message });
    res.status(500).json({ error: { code: "IMPORT_FAILED", message: err.message } });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/import/upload — multipart: JSONL files and/or archives.
// ────────────────────────────────────────────────────────────────────────────
const uploader = getUploader();
const uploadMiddleware = uploader
  ? uploader.array("files", MAX_UPLOAD_FILES)
  : (_req, _res, next) => next();

router.post("/upload", uploadMiddleware, async (req, res) => {
  const importId = `upload-${Date.now()}`;
  const provider = requestedProvider(req);
  const files = Array.isArray(req.files) ? req.files : [];
  const rejectedNames = Array.isArray(req._ccamRejected) ? req._ccamRejected : [];
  const reqUploadDir = req._ccamUploadDir || null;
  // Multer runs before provider validation. Reclaim its request directory even
  // when a manually constructed request supplies an unsupported provider.
  if (!provider) {
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* non-fatal */
      }
    }
    if (reqUploadDir) rmTempDir(reqUploadDir);
    return rejectUnsupportedProvider(res);
  }
  if (!uploader) {
    return res.status(500).json({
      error: {
        code: "UPLOADER_UNAVAILABLE",
        message: "File upload requires `multer`. Run `npm install` to pick up new deps.",
      },
    });
  }

  if (files.length === 0) {
    // Clean up the upload dir if multer created one before rejecting all files.
    if (reqUploadDir) rmTempDir(reqUploadDir);
    return res.status(400).json({
      error: {
        code: "NO_FILES",
        message:
          rejectedNames.length > 0
            ? `No supported files in upload. ${rejectedNames.length} file(s) rejected (unsupported extension).`
            : "No files received",
      },
      rejected_files: rejectedNames,
    });
  }

  const workDir = mkTempDir("ccam-import-work-");
  let extractedCount = 0;
  let skippedEntries = 0;

  try {
    broadcast("import.progress", {
      importId,
      phase: "extract",
      source: "upload",
      provider,
      total: files.length,
      processed: 0,
    });

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const result = await extractInto(f.path, workDir, f.originalname);
        extractedCount += result.extracted;
        skippedEntries += result.skipped;
      } catch (err) {
        if (err instanceof ExtractionLimitError) {
          broadcast("import.progress", {
            importId,
            phase: "error",
            provider,
            error: err.message,
          });
          return res.status(413).json({
            error: { code: err.code, message: err.message },
            offending_file: f.originalname,
          });
        }
        skippedEntries += 1;
        broadcast("import.progress", {
          importId,
          phase: "extract_error",
          current: f.originalname,
          error: err.message,
        });
      }
      broadcast("import.progress", {
        importId,
        phase: "extract",
        source: "upload",
        provider,
        processed: i + 1,
        total: files.length,
        current: f.originalname,
      });
    }

    // Even if extraction yielded zero files, the user may have uploaded a single
    // JSONL that was copied directly — `collectJsonlFiles` will find it.
    const jsonlPresent = collectJsonlFiles(workDir).length;
    if (jsonlPresent === 0) {
      return res.status(400).json({
        error: {
          code: "NO_JSONL",
          message:
            "No .jsonl files were found in the uploaded content. Supported inputs: .jsonl, .meta.json, .zip, .tar, .tar.gz, .tgz, .gz.",
        },
        extracted: extractedCount,
        skipped_entries: skippedEntries,
      });
    }

    const onProgress = makeProgressBroadcaster(importId);
    const dbModule = require("../db");
    const counters =
      provider === "codex"
        ? await importCodexFromDirectory(workDir, { onProgress })
        : await importFromDirectory(dbModule, workDir, { onProgress });
    const summary = countsSummary(counters);

    broadcast("import.progress", {
      importId,
      phase: "complete",
      source: "upload",
      provider,
      counters: summary,
    });

    res.json({
      ok: true,
      source: "upload",
      provider,
      files_received: files.length,
      rejected_files: rejectedNames,
      entries_extracted: extractedCount,
      entries_skipped: skippedEntries,
      ...summary,
    });
  } catch (err) {
    broadcast("import.progress", { importId, phase: "error", provider, error: err.message });
    res.status(500).json({ error: { code: "IMPORT_FAILED", message: err.message } });
  } finally {
    // Always reclaim disk: the per-request staging dir, the extraction work
    // dir, and any loose multer files (usually subsumed by the staging dir,
    // but we unlink explicitly in case multer kept them elsewhere).
    rmTempDir(workDir);
    for (const f of files) {
      try {
        fs.unlinkSync(f.path);
      } catch {
        /* non-fatal */
      }
    }
    if (reqUploadDir) rmTempDir(reqUploadDir);
  }
});

module.exports = router;
