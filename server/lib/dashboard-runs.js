/**
 * @file dashboard-runs.js
 * @description Persistence layer for Claude Code and Codex runs spawned via
 * the dashboard's /api/run endpoint. The in-memory handle maps reap handles
 * 5 min after exit, which is fine for live re-attach but loses historical
 * data. This module mirrors every spawn / status transition into a sqlite row
 * so the Run Agent page can show a full history and resume either provider.
 *
 * All db operations are wrapped in try/catch so a failure here can never
 * take down a live run — persistence is a side benefit, not a blocker.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { db } = require("../db");

const PROMPT_PREVIEW_LIMIT = 500;

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO dashboard_runs (
    id, session_id, provider, mode, cwd, model, permission_mode, sandbox, effort,
    resume_session_id, prompt_preview, status, exit_code, started_at, ended_at
  ) VALUES (
    @id, @session_id, @provider, @mode, @cwd, @model, @permission_mode, @sandbox, @effort,
    @resume_session_id, @prompt_preview, @status, @exit_code, @started_at, @ended_at
  )
`);

const updateStmt = db.prepare(`
  UPDATE dashboard_runs
  SET session_id = COALESCE(@session_id, session_id),
      status = COALESCE(@status, status),
      exit_code = COALESCE(@exit_code, exit_code),
      ended_at = COALESCE(@ended_at, ended_at)
  WHERE id = @id
`);

const listStmt = db.prepare(`
  SELECT id, session_id, provider, mode, cwd, model, permission_mode, sandbox, effort,
         resume_session_id, prompt_preview, status, exit_code,
         started_at, ended_at
  FROM dashboard_runs
  ORDER BY started_at DESC
  LIMIT @limit
`);

const getStmt = db.prepare(`
  SELECT id, session_id, provider, mode, cwd, model, permission_mode, sandbox, effort,
         resume_session_id, prompt_preview, status, exit_code,
         started_at, ended_at
  FROM dashboard_runs WHERE id = @id
`);

/**
 * Insert a new run record at spawn time. Idempotent on `id`.
 */
function recordRun(handle) {
  try {
    const startedAt = new Date(handle.startedAt || Date.now()).toISOString();
    const endedAt = handle.endedAt ? new Date(handle.endedAt).toISOString() : null;
    const prompt = typeof handle.prompt === "string" ? handle.prompt : "";
    insertStmt.run({
      id: handle.id,
      session_id: handle.sessionId || null,
      provider: handle.provider || "claude",
      mode: handle.mode,
      cwd: handle.cwd || "",
      model: handle.model || null,
      permission_mode: handle.permissionMode || null,
      sandbox: handle.sandbox || null,
      effort: handle.effort || null,
      resume_session_id: handle.resumeSessionId || null,
      prompt_preview: prompt.slice(0, PROMPT_PREVIEW_LIMIT) || null,
      status: handle.status || "spawning",
      exit_code: typeof handle.exitCode === "number" ? handle.exitCode : null,
      started_at: startedAt,
      ended_at: endedAt,
    });
  } catch {
    /* persistence is best-effort */
  }
}

/**
 * Patch an existing run record. Pass null/undefined for fields you don't
 * want to overwrite — COALESCE in SQL leaves the existing value untouched.
 */
function patchRun({ id, sessionId, status, exitCode, endedAt }) {
  try {
    updateStmt.run({
      id,
      session_id: sessionId ?? null,
      status: status ?? null,
      exit_code: typeof exitCode === "number" ? exitCode : null,
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
    });
  } catch {
    /* ignore */
  }
}

function listRuns({ limit = 50 } = {}) {
  try {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 50)));
    return listStmt.all({ limit: safeLimit });
  } catch {
    return [];
  }
}

function getRun(id) {
  try {
    return getStmt.get({ id }) || null;
  } catch {
    return null;
  }
}

const reconcileStmt = db.prepare(`
  UPDATE dashboard_runs
  SET status = 'abandoned',
      ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE status IN ('running', 'spawning')
`);

/**
 * On server boot, any rows still flagged `running` or `spawning` are
 * orphans — the spawner only persists those statuses for handles it knows
 * about, and the in-memory map was just wiped by the restart. Mark them as
 * `abandoned` so the UI doesn't display them as live and the user can
 * resume them like any other completed past run.
 *
 * Returns the number of rows updated.
 */
function reconcileOrphans() {
  try {
    const info = reconcileStmt.run();
    return info.changes || 0;
  } catch {
    return 0;
  }
}

module.exports = { recordRun, patchRun, listRuns, getRun, reconcileOrphans };
