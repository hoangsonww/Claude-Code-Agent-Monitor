// server/routes/orchestrator.js
/**
 * @file HTTP routes for the local agent orchestrator. Disabled by default —
 * gated behind ORCHESTRATOR_ENABLED=1.
 */
const express = require("express");
const { spawnAgent, sendMessage, killAgent, getAgent, listAgents, respawnAgent } = require("../lib/spawner");
const profiles = require("../lib/profiles");
const cwds = require("../lib/cwds");
const launches = require("../lib/launches");
const { resolveEnvForNames } = require("../lib/launcher-secrets");

const router = express.Router();
const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "orchestrator disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 in your .env to enable.",
    });
  }
  next();
});

// Sub-routers
router.use("/profiles", require("./profiles"));
router.use("/cwds", require("./cwds"));

router.get("/", (_req, res) => res.json({ enabled: ENABLED, agents: listAgents() }));

router.post("/spawn", (req, res) => {
  const { prompt, cwd, profileId, configOverride, resumeSessionId, forkSession, continue: cont, sessionId } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!cwd) return res.status(400).json({ error: "cwd is required" });
  if (!cwds.isAllowed(cwd)) return res.status(400).json({ error: "cwd not in allowlist" });

  let baseConfig = {};
  if (profileId) {
    const p = profiles.get(profileId);
    if (!p) return res.status(404).json({ error: "profile not found" });
    baseConfig = p.config || {};
  }
  const config = { ...baseConfig, ...(configOverride || {}) };
  const envExtra = resolveEnvForNames(config.envVarNames || []);
  // Strip envVarNames before passing to spawner; it is not a real flag.
  const cleanConfig = { ...config };
  delete cleanConfig.envVarNames;

  try {
    const handle = spawnAgent({
      profile: cleanConfig,
      perLaunch: { prompt, cwd, resumeSessionId, forkSession, continue: cont, sessionId },
      envExtra,
    });
    if (profileId) profiles.markUsed(profileId);
    cwds.markUsed(cwd);
    launches.record({
      id: handle.id,
      profileId: profileId || null,
      sessionId: resumeSessionId || null,
      cwd,
      argv: handle.argv,
      injectedEnvNames: config.envVarNames || [],
      status: "spawning",
    });
    res.json({ id: handle.id, pid: handle.pid, status: handle.status, startedAt: handle.startedAt });
  } catch (err) {
    if (err.code === "EConcurrencyLimit") return res.status(429).json({ error: err.message, running: err.running });
    if (err.code === "EConfigInvalid") return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post("/agents/:id/message", (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || !text) return res.status(400).json({ error: "text required" });
  try {
    res.json(sendMessage(req.params.id, text));
  } catch (err) {
    res.status(err.message.includes("not found") ? 404 : 400).json({ error: err.message });
  }
});

router.post("/agents/:id/respawn", async (req, res) => {
  const { config, prompt } = req.body || {};
  if (typeof prompt !== "string") return res.status(400).json({ error: "prompt required" });
  const old = getAgent(req.params.id);
  if (!old) return res.status(404).json({ error: "agent not found" });
  const cleanConfig = { ...(config || {}) };
  delete cleanConfig.envVarNames;
  try {
    const handle = await respawnAgent({
      id: req.params.id,
      profile: cleanConfig,
      perLaunch: {
        prompt,
        cwd: old.cwd,
        resumeSessionId: old.perLaunch?.resumeSessionId,
        forkSession: old.perLaunch?.forkSession,
      },
    });
    res.json({ id: handle.id, pid: handle.pid, status: handle.status, startedAt: handle.startedAt });
  } catch (err) {
    if (err.code === "EConfigInvalid") return res.status(400).json({ error: err.message });
    if (err.code === "EConcurrencyLimit") return res.status(429).json({ error: err.message, running: err.running });
    if (err.message === "agent not found") return res.status(404).json({ error: err.message });
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
    stdoutPreview: (handle.stdoutBuffer || "").slice(-2000),
    stderrPreview: (handle.stderrBuffer || "").slice(-2000),
  });
});

router.delete("/agents/:id", (req, res) => {
  const ok = killAgent(req.params.id);
  if (!ok) return res.status(404).json({ error: "agent not found" });
  res.json({ ok: true });
});

module.exports = router;
