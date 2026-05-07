/**
 * @file HTTP routes for the routines feature. Gated behind ORCHESTRATOR_ENABLED
 * (returns 404 otherwise) — routines spawn agents through the orchestrator's
 * spawner, so the feature can't function without the flag.
 *
 * Routes:
 *   GET    /api/routines                    list routines
 *   POST   /api/routines                    create
 *   GET    /api/routines/:id                read (with last 25 runs + webhookUrl)
 *   PATCH  /api/routines/:id                update
 *   DELETE /api/routines/:id                delete (cascade to runs)
 *   POST   /api/routines/:id/run            manual trigger
 *   POST   /api/routines/:id/webhook        webhook trigger (token-gated)
 *   PATCH  /api/routines/:id/status         active|disabled toggle
 */
const express = require("express");
const crypto = require("node:crypto");
const routines = require("../lib/routines");
const cwds = require("../lib/cwds");
const scheduler = require("../lib/routine-scheduler");

const router = express.Router();
const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "routines disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 in your .env to enable.",
    });
  }
  next();
});

router.get("/", (req, res) => {
  const includeDisabled = req.query.includeDisabled === "true";
  res.json({ routines: routines.list({ includeDisabled }).map(redactToken) });
});

router.post("/", (req, res) => {
  const body = req.body || {};
  if (!cwds.isAllowed(body.cwd)) {
    return res.status(400).json({ error: "cwd not in allowlist" });
  }
  try {
    const r = routines.create(body);
    res.status(201).json({ routine: redactToken(r) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const r = routines.get(req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  const runs = routines.listRuns(r.id, 25);
  res.json({
    routine: redactToken(r),
    runs,
    webhookUrl: `/api/routines/${r.id}/webhook?token=${r.webhookToken}`,
    webhookToken: r.webhookToken,
  });
});

router.patch("/:id", (req, res) => {
  const body = req.body || {};
  if (body.cwd && !cwds.isAllowed(body.cwd)) {
    return res.status(400).json({ error: "cwd not in allowlist" });
  }
  try {
    const r = routines.update(req.params.id, body);
    res.json({ routine: redactToken(r) });
  } catch (err) {
    if (err.message === "not found") return res.status(404).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  routines.remove(req.params.id);
  res.json({ ok: true });
});

router.patch("/:id/status", async (req, res) => {
  const status = req.body?.status;
  try {
    const r = routines.setStatus(req.params.id, status);
    res.json({ routine: redactToken(r) });
  } catch (err) {
    if (err.message === "not found") return res.status(404).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/run", async (req, res) => {
  const r = routines.get(req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  try {
    const out = await scheduler.fireOnce(req.params.id, "manual");
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/webhook", async (req, res) => {
  const r = routines.get(req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  const provided = (req.query.token || req.headers["x-webhook-token"] || "").toString();
  if (!constantTimeEqualsHex(provided, r.webhookToken)) {
    return res.status(401).json({ error: "invalid token" });
  }
  if (r.status !== "active") {
    return res.status(409).json({ error: "routine is disabled" });
  }
  try {
    const out = await scheduler.fireOnce(req.params.id, "webhook");
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Equal-length, constant-time hex compare. Mismatched lengths fail fast. */
function constantTimeEqualsHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let aBuf;
  let bBuf;
  try {
    aBuf = Buffer.from(a, "hex");
    bBuf = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (aBuf.length !== bBuf.length || aBuf.length === 0) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/** Strip the webhook token from list/update responses — only revealed by GET /:id. */
function redactToken(r) {
  if (!r) return r;
  const { webhookToken: _omit, ...rest } = r;
  void _omit;
  return rest;
}

module.exports = router;
