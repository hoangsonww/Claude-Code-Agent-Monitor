// server/routes/profiles.js
/**
 * @file HTTP CRUD over the profiles lib + import/export. Gated by
 * ORCHESTRATOR_ENABLED. Validation errors return 400 with a clear list.
 */
const express = require("express");
const router = express.Router();
const profiles = require("../lib/profiles");

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

router.get("/", (_req, res) => res.json(profiles.list()));

router.post("/import", (req, res) => {
  try {
    res.status(201).json(profiles.importJson(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/", (req, res) => {
  try {
    const created = profiles.create(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    res.status(err.message.includes("UNIQUE") ? 409 : 400).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const p = profiles.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

router.put("/:id", (req, res) => {
  try {
    res.json(profiles.update(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.message === "not found" ? 404 : 400).json({ error: err.message });
  }
});

router.patch("/:id", (req, res) => {
  try {
    res.json(profiles.update(req.params.id, req.body || {}));
  } catch (err) {
    res.status(err.message === "not found" ? 404 : 400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  profiles.delete(req.params.id);
  res.status(204).end();
});

router.post("/:id/duplicate", (req, res) => {
  try {
    res.status(201).json(profiles.duplicate(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/:id/export", (req, res) => {
  try {
    res.setHeader("Content-Disposition", `attachment; filename="profile-${req.params.id}.json"`);
    res.json(profiles.exportJson(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
