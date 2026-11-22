/**
 * @file Express router for spending budgets: CRUD over the cost_budgets table
 * plus GET /status, which measures real spend inside each budget's current
 * period against its limit and returns a linear burn-down forecast.
 *
 * No new cost math lives here: spend is computed by the production pricing
 * calculator (routes/pricing.calculateProviderCost) over the same date-bucketed
 * token query /api/pricing/cost uses, scoped to the budget's project/provider
 * and windowed to the period. The period/forecast arithmetic is the pure,
 * unit-tested lib/budget-forecast.js. This PR delivers budget tracking,
 * forecasting, and visualization; wiring a `budget_threshold` alert rule type
 * into the alert sweep is a planned follow-up.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const { stmts, readCostQuery } = require("../db");
const { calculateProviderCost } = require("./pricing");
const { PERIODS, periodBounds, forecast } = require("../lib/budget-forecast");

const router = Router();

const SCOPE_TYPES = ["global", "project", "provider"];

function serializeBudget(row) {
  return {
    ...row,
    enabled: row.enabled === 1,
  };
}

/** Escape LIKE wildcards in a user value so a `%` or `_` in a cwd is literal. */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

/**
 * Validate a create/update body. `partial` allows missing fields (PATCH). On
 * success returns `{ ok: true, value }` with normalized fields; otherwise
 * `{ ok: false, message }`.
 */
function validateBudget(body, { partial = false } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const out = {};

  if (!partial || b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim())
      return { ok: false, message: "name is required" };
    out.name = b.name.trim();
  }
  if (!partial || b.scope_type !== undefined) {
    if (!SCOPE_TYPES.includes(b.scope_type))
      return { ok: false, message: `scope_type must be one of: ${SCOPE_TYPES.join(", ")}` };
    out.scope_type = b.scope_type;
  }
  if (!partial || b.period !== undefined) {
    if (!PERIODS.includes(b.period))
      return { ok: false, message: `period must be one of: ${PERIODS.join(", ")}` };
    out.period = b.period;
  }
  if (!partial || b.limit_usd !== undefined) {
    const n = Number(b.limit_usd);
    if (!Number.isFinite(n) || n <= 0)
      return { ok: false, message: "limit_usd must be a positive number" };
    out.limit_usd = n;
  }
  if (b.warn_at_percent !== undefined) {
    const n = Number(b.warn_at_percent);
    if (!Number.isInteger(n) || n < 1 || n > 100)
      return { ok: false, message: "warn_at_percent must be an integer 1-100" };
    out.warn_at_percent = n;
  }
  if (b.enabled !== undefined) out.enabled = b.enabled ? 1 : 0;

  // scope_value is required for project/provider, and ignored (null) for global.
  const effectiveScope = out.scope_type ?? b.scope_type;
  if (effectiveScope !== undefined) {
    if (effectiveScope === "global") {
      out.scope_value = null;
    } else if (b.scope_value !== undefined) {
      if (typeof b.scope_value !== "string" || !b.scope_value.trim())
        return { ok: false, message: `scope_value is required for a ${effectiveScope} budget` };
      out.scope_value = b.scope_value.trim();
    } else if (!partial) {
      return { ok: false, message: `scope_value is required for a ${effectiveScope} budget` };
    }
  }

  return { ok: true, value: out };
}

// GET /api/budgets - list every configured budget.
router.get("/", (_req, res) => {
  res.json({ budgets: stmts.listCostBudgets.all().map(serializeBudget) });
});

// GET /api/budgets/status - spend vs. limit + burn-down forecast per budget.
router.get("/status", async (req, res, next) => {
  try {
    const rawOffset = parseInt(req.query.tz_offset, 10);
    const tzOffsetMin = Number.isFinite(rawOffset) ? rawOffset : 0;
    const tzModifier = `${-tzOffsetMin} minutes`;
    const nowMs = Date.now();
    const includeDisabled = req.query.include_disabled === "true";

    const budgets = stmts.listCostBudgets
      .all()
      .map(serializeBudget)
      .filter((b) => includeDisabled || b.enabled);

    const statuses = [];
    for (const budget of budgets) {
      const bounds = periodBounds(budget.period, nowMs, tzOffsetMin);
      const spent = await spendForBudget(budget, tzModifier, bounds.startDay, bounds.todayDay);
      if (res.destroyed) return;
      const fc = forecast({
        spent,
        limit: budget.limit_usd,
        warnAtPercent: budget.warn_at_percent,
        startMs: bounds.startMs,
        endMs: bounds.endMs,
        nowMs,
      });
      statuses.push({
        id: budget.id,
        name: budget.name,
        scope_type: budget.scope_type,
        scope_value: budget.scope_value,
        period: budget.period,
        warn_at_percent: budget.warn_at_percent,
        enabled: budget.enabled,
        ...fc,
      });
    }
    res.json({ budgets: statuses });
  } catch (error) {
    next(error);
  }
});

/**
 * Sum real spend for one budget inside [startDay, todayDay] (local days),
 * scoped by project cwd-prefix or provider. Reuses the production pricing
 * calculator over the same token query /cost uses.
 */
async function spendForBudget(budget, tzModifier, startDay, todayDay) {
  const clauses = ["DATE(s.started_at, ?) >= ?", "DATE(s.started_at, ?) <= ?"];
  const params = [tzModifier, startDay, tzModifier, todayDay];

  if (budget.scope_type === "project" && budget.scope_value) {
    // Exact project, or any nested directory under it — the cwd roll-up the
    // Sessions directory filter already does.
    clauses.push("(s.cwd = ? OR s.cwd LIKE ? ESCAPE '\\')");
    params.push(budget.scope_value, `${escapeLike(budget.scope_value)}/%`);
  } else if (budget.scope_type === "provider" && budget.scope_value) {
    clauses.push("s.provider = ?");
    params.push(budget.scope_value);
  }

  const whereClause = `WHERE ${clauses.join(" AND ")}`;
  const { dailyTokens, rules, gptRules, cursorRules } = await readCostQuery(
    `SELECT
      DATE(s.started_at, ?) as date,
      s.provider as provider,
      tu.model as model,
      tu.speed as speed,
      tu.inference_geo as inference_geo,
      tu.service_tier as service_tier,
      tu.context_size as context_size,
      SUM(tu.input_tokens + tu.baseline_input) as input_tokens,
      SUM(tu.output_tokens + tu.baseline_output) as output_tokens,
      SUM(tu.cache_read_tokens + tu.baseline_cache_read) as cache_read_tokens,
      SUM(tu.cache_write_tokens + tu.baseline_cache_write) as cache_write_tokens,
      SUM(tu.cache_write_1h_tokens + tu.baseline_cache_write_1h) as cache_write_1h_tokens,
      SUM(tu.web_search_requests + tu.baseline_web_search) as web_search_requests,
      SUM(tu.web_fetch_requests + tu.baseline_web_fetch) as web_fetch_requests,
      SUM(tu.code_execution_requests + tu.baseline_code_execution) as code_execution_requests
    FROM token_usage tu
    JOIN sessions s ON s.id = tu.session_id
    ${whereClause}
    GROUP BY 1, s.provider, tu.model, tu.speed, tu.inference_geo, tu.service_tier, tu.context_size`,
    // SELECT's DATE() tz modifier first, then the WHERE params (each date clause
    // carries its own tz modifier ahead of the bound day).
    [tzModifier, ...params]
  );
  return calculateProviderCost(dailyTokens, rules, gptRules, cursorRules).total_cost;
}

// POST /api/budgets - create a budget.
router.post("/", (req, res) => {
  const v = validateBudget(req.body, { partial: false });
  if (!v.ok) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: v.message } });
  }
  const id = uuidv4();
  stmts.insertCostBudget.run(
    id,
    v.value.name,
    v.value.scope_type,
    v.value.scope_value ?? null,
    v.value.period,
    v.value.limit_usd,
    v.value.warn_at_percent ?? 80,
    v.value.enabled ?? 1
  );
  res.status(201).json({ budget: serializeBudget(stmts.getCostBudget.get(id)) });
});

// PATCH /api/budgets/:id - partial update.
router.patch("/:id", (req, res) => {
  const existing = stmts.getCostBudget.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Budget not found" } });
  }
  const v = validateBudget(req.body, { partial: true });
  if (!v.ok) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: v.message } });
  }
  const next = v.value;
  // scope_value is written directly (not COALESCE) so a global budget can clear
  // it; resolve the effective value from the merged scope_type.
  const scopeType = next.scope_type ?? existing.scope_type;
  let scopeValue;
  if (scopeType === "global") scopeValue = null;
  else if (next.scope_value !== undefined) scopeValue = next.scope_value;
  else scopeValue = existing.scope_value;

  stmts.updateCostBudget.run(
    next.name ?? null,
    next.scope_type ?? null,
    scopeValue,
    next.period ?? null,
    next.limit_usd ?? null,
    next.warn_at_percent ?? null,
    next.enabled ?? null,
    req.params.id
  );
  res.json({ budget: serializeBudget(stmts.getCostBudget.get(req.params.id)) });
});

// DELETE /api/budgets/:id - remove a budget.
router.delete("/:id", (req, res) => {
  const existing = stmts.getCostBudget.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Budget not found" } });
  }
  stmts.deleteCostBudget.run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
