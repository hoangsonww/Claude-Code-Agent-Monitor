/**
 * @file Express router for the local-first backup feature: a richer superset of
 * the legacy raw /api/settings/export dump. It exports a versioned, manifested
 * backup bundle, validates an uploaded bundle, previews a restore with zero
 * mutation (dry-run), and applies an idempotent, transactionally-atomic
 * restore. The merge engine lives in server/lib/backup.js; this router is the
 * thin HTTP surface around it.
 *
 *   GET  /api/backup/export      — download the full bundle as JSON
 *   POST /api/backup/validate    — structural + compatibility check
 *   POST /api/backup/dry-run     — per-table merge preview, no writes
 *   POST /api/backup/restore     — apply the merge in one transaction
 *
 * Bundles exceed the global 1mb JSON limit, so the three POST routes get a
 * route-local express.json({ limit: "64mb" }) parser — the global limit set in
 * server/index.js is left untouched. Restore/dry-run options arrive as query
 * params; the bundle is the POST body.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const express = require("express");
const dbModule = require("../db");
const { buildBundle, validateBundle, planRestore, applyRestore } = require("../lib/backup");

const router = Router();

// Route-local body parser sized for full backup bundles. Scoped to the POST
// routes ONLY — the global express.json({ limit: "1mb" }) in server/index.js is
// deliberately left alone so every other endpoint keeps its tight limit.
const bundleJson = express.json({ limit: "64mb" });

/**
 * Wrap a handler so any thrown error becomes a structured 500 instead of an
 * unhandled rejection / hung request. Mirrors the inline try/catch + `error:
 * { code, message }` shape used across the existing routers.
 */
function safe(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      res.status(500).json({
        error: { code: "BACKUP_FAILED", message: err?.message || String(err) },
      });
    }
  };
}

/** Normalize the pricing_strategy query param to a known value. */
function resolveStrategy(req) {
  return req.query.pricing_strategy === "use_incoming" ? "use_incoming" : "keep_local";
}

// GET /api/backup/export — full bundle as a JSON download.
router.get(
  "/export",
  safe((_req, res) => {
    const bundle = buildBundle(dbModule);
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="agent-monitor-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.json(bundle);
  })
);

// POST /api/backup/validate — structural + compatibility check (no mutation).
router.post(
  "/validate",
  bundleJson,
  safe((req, res) => {
    res.json(validateBundle(req.body));
  })
);

// POST /api/backup/dry-run — per-table merge preview, ZERO mutation.
router.post(
  "/dry-run",
  bundleJson,
  safe((req, res) => {
    const result = planRestore(dbModule, req.body, { pricingStrategy: resolveStrategy(req) });
    res.json(result);
  })
);

// POST /api/backup/restore — apply the merge in a single transaction. A
// corrupt/incompatible bundle is rejected with a structured 400 before any
// write; the transaction guarantees nothing commits on a mid-merge error.
router.post(
  "/restore",
  bundleJson,
  safe((req, res) => {
    const validation = validateBundle(req.body);
    if (!validation.compatible) {
      return res.status(400).json({
        error: {
          code: "INCOMPATIBLE_BUNDLE",
          message: "backup bundle is invalid or incompatible",
          issues: validation.issues,
        },
      });
    }
    const result = applyRestore(dbModule, req.body, { pricingStrategy: resolveStrategy(req) });
    res.json({ ok: true, ...result });
  })
);

module.exports = router;
