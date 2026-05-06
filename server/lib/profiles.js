// server/lib/profiles.js
/**
 * @file SQLite CRUD for launcher_profiles. Validates ProfileConfig on every
 * write; never persists invalid shapes. Offers JSON export/import for
 * shareable artifacts.
 */
const { randomUUID } = require("node:crypto");
const { db } = require("../db");
const { validateProfileConfig } = require("./profile-schema");

const SELECT = `SELECT id, name, description, config_json, default_cwd,
  created_at, updated_at, last_used_at FROM launcher_profiles`;

function row2profile(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    config: JSON.parse(r.config_json),
    defaultCwd: r.default_cwd,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastUsedAt: r.last_used_at,
  };
}

function create({ name, description, config, defaultCwd }) {
  const v = validateProfileConfig(config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  if (!/^[\w\- .]{1,64}$/.test(name)) throw new Error("name invalid");
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO launcher_profiles (id, name, description, config_json, default_cwd, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, description || null, JSON.stringify(config || {}), defaultCwd || null, now, now);
  return get(id);
}

function get(id) {
  return row2profile(db.prepare(`${SELECT} WHERE id = ?`).get(id));
}

function getByName(name) {
  return row2profile(db.prepare(`${SELECT} WHERE name = ?`).get(name));
}

function list() {
  return db
    .prepare(`${SELECT} ORDER BY COALESCE(last_used_at, updated_at) DESC`)
    .all()
    .map(row2profile);
}

function update(id, patch) {
  const cur = get(id);
  if (!cur) throw new Error("not found");
  const next = {
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    config: patch.config ? { ...cur.config, ...patch.config } : cur.config,
    defaultCwd: patch.defaultCwd !== undefined ? patch.defaultCwd : cur.defaultCwd,
  };
  const v = validateProfileConfig(next.config);
  if (!v.ok) throw new Error(v.errors.join("; "));
  db.prepare(
    `UPDATE launcher_profiles
     SET name = ?, description = ?, config_json = ?, default_cwd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(next.name, next.description || null, JSON.stringify(next.config), next.defaultCwd || null, Date.now(), id);
  return get(id);
}

function markUsed(id) {
  db.prepare(`UPDATE launcher_profiles SET last_used_at = ? WHERE id = ?`).run(Date.now(), id);
}

function remove(id) {
  db.prepare(`DELETE FROM launcher_profiles WHERE id = ?`).run(id);
}

function exportJson(id) {
  const p = get(id);
  if (!p) throw new Error("not found");
  return {
    name: p.name,
    description: p.description,
    config: p.config,
    defaultCwd: p.defaultCwd,
    schemaVersion: 1,
  };
}

function importJson(payload) {
  if (!payload || typeof payload !== "object") throw new Error("invalid import");
  const baseName = payload.name || "imported";
  let name = baseName;
  let n = 2;
  while (getByName(name)) name = `${baseName} (${n++})`;
  return create({
    name,
    description: payload.description,
    config: payload.config || {},
    defaultCwd: payload.defaultCwd,
  });
}

function duplicate(id) {
  const src = get(id);
  if (!src) throw new Error("not found");
  return importJson({ ...exportJson(id), name: `${src.name} (copy)` });
}

module.exports = {
  create, get, getByName, list, update, markUsed,
  delete: remove, exportJson, importJson, duplicate,
};
