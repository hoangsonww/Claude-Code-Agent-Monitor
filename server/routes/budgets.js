/**
 * @file Express router for spend budgets. Lets the dashboard create, read,
 * update, and delete USD spending limits per rolling period (daily / weekly /
 * monthly). GET responses include live current-period spend so the UI can draw
 * progress without a second round-trip. Threshold alerts are fired separately
 * by the budget scheduler.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db } = require("../db");
const {
  VALID_PERIODS,
  DEFAULT_THRESHOLDS,
  parseThresholds,
  evaluateAll,
  evaluateBudget,
} = require("../lib/budgets");

const router = Router();

function badRequest(res, message) {
  return res.status(400).json({ error: { code: "INVALID_INPUT", message } });
}

/**
 * Validate the shared budget fields used by POST/PUT. Returns either
 * `{ error }` or a normalised `{ value }` with the cleaned fields present in
 * the body (partial for PUT).
 */
function validateBody(body, { partial }) {
  const out = {};

  if (!partial || body.period !== undefined) {
    if (!VALID_PERIODS.includes(body.period)) {
      return { error: `period must be one of: ${VALID_PERIODS.join(", ")}` };
    }
    out.period = body.period;
  }

  if (!partial || body.limit_usd !== undefined) {
    const limit = Number(body.limit_usd);
    if (!Number.isFinite(limit) || limit <= 0) {
      return { error: "limit_usd must be a positive number" };
    }
    out.limit_usd = limit;
  }

  if (body.label !== undefined) {
    if (body.label !== null && typeof body.label !== "string") {
      return { error: "label must be a string or null" };
    }
    out.label = body.label ? String(body.label).slice(0, 120) : null;
  }

  if (body.alert_thresholds !== undefined) {
    if (!Array.isArray(body.alert_thresholds)) {
      return { error: "alert_thresholds must be an array of percentages (1-100)" };
    }
    out.alert_thresholds = parseThresholds(body.alert_thresholds);
  }

  if (body.enabled !== undefined) {
    out.enabled = body.enabled ? 1 : 0;
  }

  return { value: out };
}

// GET /api/budgets — list budgets with live current-period spend.
router.get("/", (_req, res) => {
  const now = new Date();
  res.json({ budgets: evaluateAll(db, now), generated_at: now.toISOString() });
});

// POST /api/budgets — create a budget.
router.post("/", (req, res) => {
  const { value, error } = validateBody(req.body || {}, { partial: false });
  if (error) return badRequest(res, error);

  const thresholds = value.alert_thresholds ?? [...DEFAULT_THRESHOLDS];
  const enabled = value.enabled ?? 1;

  const info = db
    .prepare(
      "INSERT INTO budgets (period, limit_usd, enabled, label, alert_thresholds) VALUES (?, ?, ?, ?, ?)"
    )
    .run(value.period, value.limit_usd, enabled, value.label ?? null, JSON.stringify(thresholds));

  const row = db.prepare("SELECT * FROM budgets WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ budget: evaluateBudget(db, row, new Date()) });
});

// PUT /api/budgets/:id — update an existing budget.
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, "id must be an integer");

  const existing = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Budget not found" } });
  }

  const { value, error } = validateBody(req.body || {}, { partial: true });
  if (error) return badRequest(res, error);
  if (Object.keys(value).length === 0) {
    return badRequest(res, "no updatable fields provided");
  }

  const next = {
    period: value.period ?? existing.period,
    limit_usd: value.limit_usd ?? existing.limit_usd,
    enabled: value.enabled ?? existing.enabled,
    label: value.label !== undefined ? value.label : existing.label,
    alert_thresholds:
      value.alert_thresholds !== undefined
        ? JSON.stringify(value.alert_thresholds)
        : existing.alert_thresholds,
  };

  db.prepare(
    `UPDATE budgets
     SET period = ?, limit_usd = ?, enabled = ?, label = ?, alert_thresholds = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`
  ).run(next.period, next.limit_usd, next.enabled, next.label, next.alert_thresholds, id);

  const row = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
  res.json({ budget: evaluateBudget(db, row, new Date()) });
});

// DELETE /api/budgets/:id — remove a budget (and its alert state via cascade).
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return badRequest(res, "id must be an integer");

  const existing = db.prepare("SELECT id FROM budgets WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Budget not found" } });
  }
  // budget_alert_state has ON DELETE CASCADE, but clear explicitly in case the
  // host disabled foreign-key enforcement.
  db.prepare("DELETE FROM budget_alert_state WHERE budget_id = ?").run(id);
  db.prepare("DELETE FROM budgets WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
