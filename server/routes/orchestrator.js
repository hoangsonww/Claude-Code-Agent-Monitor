/**
 * @file HTTP routes for the local agent orchestrator. Disabled by default —
 * gated behind ORCHESTRATOR_ENABLED=1 so that simply having the code present
 * cannot accidentally launch `claude` subprocesses.
 */

const express = require("express");
const { spawnAgent, killAgent, getAgent, listAgents } = require("../lib/spawner");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

// Gate everything behind the env flag. Returning 404 (not 403) makes the
// surface invisible when disabled.
router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "orchestrator disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 in your .env or shell environment to enable.",
    });
  }
  next();
});

router.get("/", (_req, res) => {
  res.json({ enabled: ENABLED, agents: listAgents() });
});

router.post("/spawn", (req, res) => {
  const { prompt, preset, cwd } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  try {
    const handle = spawnAgent({
      profile: preset || {},
      perLaunch: { prompt, cwd },
    });
    res.json({
      id: handle.id,
      pid: handle.pid,
      status: handle.status,
      startedAt: handle.startedAt,
    });
  } catch (err) {
    if (err.code === "EConcurrencyLimit") {
      return res.status(429).json({ error: err.message, running: err.running });
    }
    if (err.code === "EConfigInvalid") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/agents/:id", (req, res) => {
  const handle = getAgent(req.params.id);
  if (!handle) return res.status(404).json({ error: "agent not found" });
  res.json({
    id: handle.id,
    pid: handle.pid,
    status: handle.status,
    startedAt: handle.startedAt,
    endedAt: handle.endedAt,
    exitCode: handle.exitCode,
    error: handle.error,
    stdoutPreview: handle.stdoutBuffer.slice(-2000),
    stderrPreview: handle.stderrBuffer.slice(-2000),
  });
});

router.delete("/agents/:id", (req, res) => {
  const ok = killAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: "agent not found" });
  res.json({ ok: true });
});

module.exports = router;
