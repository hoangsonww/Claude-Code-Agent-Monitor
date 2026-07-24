/**
 * @file Express router for remote data sources — other machines whose Claude
 * Code history this dashboard pulls in over SSH (see server/lib/remote-sync.js).
 *
 *   GET    /api/remote-sources          — list configured sources + status
 *   POST   /api/remote-sources          — add a source
 *   PATCH  /api/remote-sources/:id      — edit a source (partial)
 *   DELETE /api/remote-sources/:id      — remove a source (config + staging);
 *                                          ?purge=true also deletes its imported
 *                                          sessions (destructive, opt-in)
 *   POST   /api/remote-sources/:id/test — probe SSH connectivity
 *   POST   /api/remote-sources/:id/sync — sync now
 *
 * No secrets are stored or accepted here — authentication defers entirely to the
 * host's SSH stack. All inputs are validated in remote-sync.validateSourceInput
 * before touching the DB or any command.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const crypto = require("crypto");
const fs = require("fs");

const { stmts, db } = require("../db");
const { broadcast } = require("../websocket");
const {
  validateSourceInput,
  ValidationError,
  testConnection,
  syncSource,
  syncAllEnabled,
  stagingDir,
} = require("../lib/remote-sync");

const router = Router();

/**
 * Shape a DB row for the API: bool `enabled`, parsed counts, and the live number
 * of sessions currently attributed to this source (`session_count`) so the UI
 * can show how much data each machine has contributed.
 */
function serialize(row, sessionCount = 0) {
  let lastCounts = null;
  try {
    lastCounts = row.last_sync_counts ? JSON.parse(row.last_sync_counts) : null;
  } catch {
    lastCounts = null;
  }
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    ssh_port: row.ssh_port,
    identity_file: row.identity_file,
    remote_home: row.remote_home,
    enabled: !!row.enabled,
    status: row.status,
    last_error: row.last_error,
    last_sync_at: row.last_sync_at,
    last_sync_counts: lastCounts,
    session_count: sessionCount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Map of source id -> current session count, in one grouped query. */
function sessionCountsBySource() {
  const rows = db.prepare("SELECT source, COUNT(*) AS c FROM sessions GROUP BY source").all();
  const map = new Map();
  for (const r of rows) map.set(r.source, r.c);
  return map;
}

function handleValidation(res, err) {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { code: err.code, message: err.message } });
    return true;
  }
  return false;
}

// GET / — list all sources, each with its live session count.
router.get("/", (_req, res) => {
  const rows = stmts.listRemoteSources.all();
  const counts = sessionCountsBySource();
  res.json({ sources: rows.map((r) => serialize(r, counts.get(r.id) || 0)) });
});

// POST / — create a source.
router.post("/", (req, res) => {
  let v;
  try {
    v = validateSourceInput(req.body || {}, false);
  } catch (err) {
    if (handleValidation(res, err)) return;
    throw err;
  }
  const id = `src_${crypto.randomBytes(6).toString("hex")}`;
  const enabled = v.enabled === undefined ? 1 : v.enabled;
  stmts.insertRemoteSource.run(
    id,
    v.label,
    v.host,
    v.sshPort ?? null,
    v.identityFile ?? null,
    v.remoteHome ?? null,
    enabled
  );
  const row = stmts.getRemoteSource.get(id);
  broadcast("remote_source.status", { id, status: row.status });
  res.status(201).json({ source: serialize(row) });
});

// POST /sync-all — sync every enabled source now (sequential; per-source
// failures are isolated). Defined before the /:id routes; "sync-all" is a
// single path segment so it never collides with "/:id/sync".
router.post("/sync-all", async (_req, res) => {
  const results = await syncAllEnabled(require("../db"), { broadcast });
  res.json({ ok: true, synced: results.length, results });
});

// PATCH /:id — partial update.
router.patch("/:id", (req, res) => {
  const existing = stmts.getRemoteSource.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Source not found" } });
  }
  let v;
  try {
    v = validateSourceInput(req.body || {}, true);
  } catch (err) {
    if (handleValidation(res, err)) return;
    throw err;
  }
  // COALESCE-based stmt keeps unspecified fields; port/identity/home are written
  // verbatim (nullable), so a PATCH that omits them leaves them unchanged only
  // when we pass the existing value through.
  stmts.updateRemoteSource.run(
    v.label ?? null,
    v.host ?? null,
    v.sshPort !== undefined ? v.sshPort : existing.ssh_port,
    v.identityFile !== undefined ? v.identityFile : existing.identity_file,
    v.remoteHome !== undefined ? v.remoteHome : existing.remote_home,
    v.enabled === undefined ? null : v.enabled,
    req.params.id
  );
  const row = stmts.getRemoteSource.get(req.params.id);
  broadcast("remote_source.status", { id: row.id, status: row.status });
  res.json({ source: serialize(row) });
});

// DELETE /:id — remove config + staging dir. ?purge=true also deletes the
// sessions this source imported (destructive, opt-in).
router.delete("/:id", (req, res) => {
  const existing = stmts.getRemoteSource.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Source not found" } });
  }
  const purge = req.query.purge === "true" || req.query.purge === "1";
  let purged = 0;
  if (purge) {
    // FK ON DELETE CASCADE removes the sessions' agents/events/token_usage too.
    const info = db.prepare("DELETE FROM sessions WHERE source = ?").run(req.params.id);
    purged = info.changes || 0;
  } else {
    // Keep the imported rows but detach them from the (now gone) source id so
    // they fall back to the local view instead of a dangling filter value.
    db.prepare("UPDATE sessions SET source = 'local' WHERE source = ?").run(req.params.id);
  }
  stmts.deleteRemoteSource.run(req.params.id);
  // Reclaim the mirrored staging dir.
  try {
    fs.rmSync(stagingDir(req.params.id), { recursive: true, force: true });
  } catch {
    /* non-fatal */
  }
  broadcast("remote_source.status", { id: req.params.id, status: "deleted" });
  res.json({ ok: true, purged });
});

// POST /:id/test — probe connectivity (does not import).
router.post("/:id/test", async (req, res) => {
  const row = stmts.getRemoteSource.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Source not found" } });
  }
  const result = await testConnection(row);
  res.json(result);
});

// POST /:id/sync — sync now.
router.post("/:id/sync", async (req, res) => {
  const row = stmts.getRemoteSource.get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Source not found" } });
  }
  try {
    const result = await syncSource(require("../db"), row, { broadcast });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: { code: "SYNC_FAILED", message: err.message } });
  }
});

module.exports = router;
