/**
 * @file Append-only audit log for orchestrator launches. argv_json stores
 * { argv, envNames } — env values are NEVER recorded.
 */
const { db } = require("../db");

function record({ id, profileId = null, sessionId = null, cwd, argv = [], injectedEnvNames = [], status = "spawning" }) {
  const payload = JSON.stringify({ argv, envNames: injectedEnvNames });
  db.prepare(
    `INSERT INTO launcher_launches (id, profile_id, session_id, cwd, argv_json, started_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, profileId, sessionId, cwd, payload, Date.now(), status);
}

function attachSessionId(id, sessionId) {
  db.prepare(`UPDATE launcher_launches SET session_id = ? WHERE id = ?`).run(sessionId, id);
}

function complete(id, { exitCode, status }) {
  db.prepare(
    `UPDATE launcher_launches SET ended_at = ?, exit_code = ?, status = ? WHERE id = ?`,
  ).run(Date.now(), exitCode ?? null, status, id);
}

function get(id) {
  return db.prepare(`SELECT * FROM launcher_launches WHERE id = ?`).get(id);
}

function listRecent(limit = 50) {
  return db
    .prepare(`SELECT * FROM launcher_launches ORDER BY started_at DESC LIMIT ?`)
    .all(limit);
}

module.exports = { record, attachSessionId, complete, get, listRecent };
