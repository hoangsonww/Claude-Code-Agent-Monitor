/**
 * @file HTTP surface for the cwd allowlist. Gated by ORCHESTRATOR_ENABLED.
 */
const express = require("express");
const router = express.Router();
const cwds = require("../lib/cwds");

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

router.get("/", (_req, res) => res.json(cwds.list()));

router.post("/", (req, res) => {
  try {
    const resolved = cwds.add(req.body?.path, req.body?.source || "manual");
    res.status(201).json({ path: resolved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/", (req, res) => {
  try {
    cwds.remove(req.body?.path);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
