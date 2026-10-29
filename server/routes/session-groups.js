/**
 * @file Session group CRUD for dashboard-local, user-assigned organization.
 * Group deletion only unassigns sessions; it never deletes session history.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { randomUUID } = require("node:crypto");
const { Router } = require("express");
const { db } = require("../db");
const { broadcast } = require("../websocket");

const router = Router();

function validName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 100 ? name : null;
}

router.get("/", (_req, res) => {
  const groups = db.prepare("SELECT * FROM session_groups ORDER BY name COLLATE NOCASE, id").all();
  res.json({ groups });
});

router.post("/", (req, res) => {
  const name = validName(req.body?.name);
  if (!name) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_INPUT", message: "Group name must be 1–100 characters" } });
  }
  if (db.prepare("SELECT id FROM session_groups WHERE name = ? COLLATE NOCASE").get(name)) {
    return res
      .status(409)
      .json({ error: { code: "ALREADY_EXISTS", message: "Group name already exists" } });
  }
  const id = randomUUID();
  db.prepare("INSERT INTO session_groups (id, name) VALUES (?, ?)").run(id, name);
  const group = db.prepare("SELECT * FROM session_groups WHERE id = ?").get(id);
  broadcast("session_groups_changed", { group_id: id });
  res.status(201).json({ group });
});

router.patch("/:id", (req, res) => {
  const name = validName(req.body?.name);
  if (!name) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_INPUT", message: "Group name must be 1–100 characters" } });
  }
  const group = db.prepare("SELECT * FROM session_groups WHERE id = ?").get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
  }
  const duplicate = db
    .prepare("SELECT id FROM session_groups WHERE name = ? COLLATE NOCASE AND id != ?")
    .get(name, group.id);
  if (duplicate) {
    return res
      .status(409)
      .json({ error: { code: "ALREADY_EXISTS", message: "Group name already exists" } });
  }
  db.prepare(
    "UPDATE session_groups SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ).run(name, group.id);
  broadcast("session_groups_changed", { group_id: group.id });
  res.json({ group: db.prepare("SELECT * FROM session_groups WHERE id = ?").get(group.id) });
});

router.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM session_groups WHERE id = ?").run(req.params.id);
  if (!result.changes) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Group not found" } });
  }
  broadcast("session_groups_changed", { group_id: req.params.id });
  res.json({ deleted: true });
});

module.exports = router;
