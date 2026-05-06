/**
 * @file SQLite CRUD for launcher_allowed_cwds. Path-traversal hardening:
 * absolute paths only, must exist as a directory at insert time.
 */
const fs = require("node:fs");
const path = require("node:path");
const { db } = require("../db");

function normalize(p) {
  if (!p || typeof p !== "string") throw new Error("path required");
  if (!path.isAbsolute(p)) throw new Error("path must be absolute");
  const resolved = path.resolve(p);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`path does not exist: ${resolved}`);
  }
  if (!stat.isDirectory()) throw new Error("path must be a directory");
  return resolved;
}

function add(p, source = "manual") {
  const resolved = normalize(p);
  db.prepare(
    `INSERT OR IGNORE INTO launcher_allowed_cwds (path, source, added_at) VALUES (?, ?, ?)`,
  ).run(resolved, source, Date.now());
  return resolved;
}

function list() {
  return db
    .prepare(`SELECT path, source, added_at, last_used_at FROM launcher_allowed_cwds ORDER BY COALESCE(last_used_at, added_at) DESC`)
    .all();
}

function isAllowed(p) {
  if (!p || typeof p !== "string") return false;
  const resolved = path.resolve(p);
  const row = db.prepare(`SELECT 1 FROM launcher_allowed_cwds WHERE path = ?`).get(resolved);
  return !!row;
}

function markUsed(p) {
  const resolved = path.resolve(p);
  db.prepare(`UPDATE launcher_allowed_cwds SET last_used_at = ? WHERE path = ?`).run(Date.now(), resolved);
}

function remove(p) {
  const resolved = path.resolve(p);
  db.prepare(`DELETE FROM launcher_allowed_cwds WHERE path = ?`).run(resolved);
}

module.exports = { add, list, isAllowed, markUsed, remove };
