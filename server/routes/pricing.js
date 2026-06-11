/**
 * @file Express router for managing pricing rules and calculating costs based on token usage. It provides endpoints to list, create/update, and delete pricing rules, as well as calculate total costs across all sessions or for a specific session. The cost calculation matches token usage against the most specific applicable pricing rule based on model patterns.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const {
  WEB_SEARCH_PER_1K_SEARCHES,
  CODE_EXEC_PER_HOUR,
  CODE_EXEC_FREE_HOURS,
  estimateCodeExecHours,
  DATA_RESIDENCY_US_MULTIPLIER,
  BATCH_DISCOUNT_MULTIPLIER,
} = require("../lib/pricing-constants");

const router = Router();

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Resolve the effective per-MTok rates for a token bucket, applying the pricing
 * modifiers carried on the bucket (fast mode, US data residency, Batch API).
 *   - Fast mode: premium input/output rates; cache rates scale with the fast
 *     input base (the standard caching multipliers ride on top of fast pricing).
 *   - Data residency "us": 1.1x across every category.
 *   - Batch tier: 50% off across every category.
 * Older buckets default to speed=standard / geo=global / tier=standard, so they
 * resolve to exactly the standard rates — historical sessions price unchanged.
 */
function ratesForBucket(rule, row) {
  const r = rule || {};
  let rIn = r.input_per_mtok || 0;
  let rOut = r.output_per_mtok || 0;
  let rRead = r.cache_read_per_mtok || 0;
  let r5m = r.cache_write_per_mtok || 0;
  let r1h = r.cache_write_1h_per_mtok || 0;

  if (row.speed === "fast" && (r.fast_input_per_mtok || 0) > 0) {
    const baseIn = r.input_per_mtok || 0;
    const factor = baseIn > 0 ? r.fast_input_per_mtok / baseIn : 1;
    rIn = r.fast_input_per_mtok;
    rOut = (r.fast_output_per_mtok || 0) > 0 ? r.fast_output_per_mtok : rOut * factor;
    rRead *= factor;
    r5m *= factor;
    r1h *= factor;
  }
  if (row.inference_geo === "us") {
    const m = DATA_RESIDENCY_US_MULTIPLIER;
    rIn *= m;
    rOut *= m;
    rRead *= m;
    r5m *= m;
    r1h *= m;
  }
  if (row.service_tier === "batch") {
    const m = BATCH_DISCOUNT_MULTIPLIER;
    rIn *= m;
    rOut *= m;
    rRead *= m;
    r5m *= m;
    r1h *= m;
  }
  return { rIn, rOut, rRead, r5m, r1h };
}

// Calculate cost for a set of token buckets against pricing rules. Each bucket
// is (model, speed, inference_geo, service_tier) with token counts plus the 1h
// cache-write split and server-tool request counts. Cost = token cost (rate-
// modified) + web-search surcharge ($10/1k) + estimated code-execution time
// (free when used with web search/fetch; org free-hours allowance applied once).
function calculateCost(tokenRows, pricingRules) {
  const sortedRules = [...pricingRules].sort(
    (a, b) => b.model_pattern.length - a.model_pattern.length
  );

  let tokenCost = 0;
  let webSearchCost = 0;
  let codeExecHours = 0;
  const breakdown = [];
  // Track buckets that matched NO pricing rule. Their cost is $0, which would
  // silently under-report the true total — surface them so the number is honest
  // and the user knows to add a rule (e.g. a brand-new model id).
  const unpriced = new Map();

  for (const row of tokenRows) {
    const rule = sortedRules.find((p) => {
      const pattern = p.model_pattern.replace(/%/g, ".*");
      return new RegExp("^" + pattern + "$").test(row.model);
    });

    if (!rule) {
      const u = unpriced.get(row.model) || {
        model: row.model,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      };
      u.input_tokens += row.input_tokens || 0;
      u.output_tokens += row.output_tokens || 0;
      u.cache_read_tokens += row.cache_read_tokens || 0;
      u.cache_write_tokens += row.cache_write_tokens || 0;
      unpriced.set(row.model, u);
    }

    const { rIn, rOut, rRead, r5m, r1h } = ratesForBucket(rule, row);
    const cw1h = row.cache_write_1h_tokens || 0;
    const cw5m = Math.max(0, (row.cache_write_tokens || 0) - cw1h);
    const tCost =
      (row.input_tokens / 1e6) * rIn +
      (row.output_tokens / 1e6) * rOut +
      (row.cache_read_tokens / 1e6) * rRead +
      (cw5m / 1e6) * r5m +
      (cw1h / 1e6) * r1h;

    const wsCost = ((row.web_search_requests || 0) / 1000) * WEB_SEARCH_PER_1K_SEARCHES;
    const ceHours = estimateCodeExecHours(
      row.code_execution_requests,
      row.web_search_requests,
      row.web_fetch_requests
    );

    tokenCost += tCost;
    webSearchCost += wsCost;
    codeExecHours += ceHours;

    breakdown.push({
      model: row.model,
      speed: row.speed || "standard",
      inference_geo: row.inference_geo || "global",
      service_tier: row.service_tier || "standard",
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_read_tokens: row.cache_read_tokens,
      cache_write_tokens: row.cache_write_tokens,
      cache_write_1h_tokens: cw1h,
      web_search_requests: row.web_search_requests || 0,
      web_fetch_requests: row.web_fetch_requests || 0,
      code_execution_requests: row.code_execution_requests || 0,
      cost: round4(tCost + wsCost),
      matched_rule: rule?.model_pattern || null,
    });
  }

  // Code execution is billed by container-time, estimated at the 5-minute
  // minimum per request. Apply the org free-hours allowance once, then charge
  // the remainder — so normal usage (well under the allowance) costs $0.
  const chargedHours = Math.max(0, codeExecHours - CODE_EXEC_FREE_HOURS);
  const codeExecCost = chargedHours * CODE_EXEC_PER_HOUR;
  const total = tokenCost + webSearchCost + codeExecCost;

  return {
    total_cost: round4(total),
    breakdown,
    feature_costs: {
      web_search_cost: round4(webSearchCost),
      web_fetch_cost: 0,
      code_execution_cost: round4(codeExecCost),
      code_execution_hours_estimated: round4(codeExecHours),
      code_execution_free_hours: CODE_EXEC_FREE_HOURS,
    },
    // Models with usage but no matching pricing rule (cost not counted).
    unpriced_models: [...unpriced.values()],
  };
}

function calculateDailyCosts(dailyTokenRows, pricingRules) {
  const rowsByDate = new Map();
  for (const row of dailyTokenRows) {
    const rows = rowsByDate.get(row.date) || [];
    rows.push({
      model: row.model,
      speed: row.speed,
      inference_geo: row.inference_geo,
      service_tier: row.service_tier,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_read_tokens: row.cache_read_tokens,
      cache_write_tokens: row.cache_write_tokens,
      cache_write_1h_tokens: row.cache_write_1h_tokens,
      web_search_requests: row.web_search_requests,
      web_fetch_requests: row.web_fetch_requests,
      code_execution_requests: row.code_execution_requests,
    });
    rowsByDate.set(row.date, rows);
  }

  return [...rowsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({ date, cost: calculateCost(rows, pricingRules).total_cost }));
}

// GET /api/pricing - List all pricing rules
router.get("/", (_req, res) => {
  const rules = stmts.listPricing.all();
  res.json({ pricing: rules });
});

// PUT /api/pricing - Create or update a pricing rule
router.put("/", (req, res) => {
  const {
    model_pattern,
    display_name,
    input_per_mtok,
    output_per_mtok,
    cache_read_per_mtok,
    cache_write_per_mtok,
    cache_write_1h_per_mtok,
    fast_input_per_mtok,
    fast_output_per_mtok,
  } = req.body;
  if (!model_pattern || !display_name) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "model_pattern and display_name are required" },
    });
  }

  stmts.upsertPricing.run(
    model_pattern,
    display_name,
    input_per_mtok ?? 0,
    output_per_mtok ?? 0,
    cache_read_per_mtok ?? 0,
    cache_write_per_mtok ?? 0,
    cache_write_1h_per_mtok ?? 0,
    fast_input_per_mtok ?? 0,
    fast_output_per_mtok ?? 0
  );

  const rule = stmts.getPricing.get(model_pattern);
  res.json({ pricing: rule });
});

// DELETE /api/pricing/:pattern - Delete a pricing rule
router.delete("/:pattern", (req, res) => {
  const pattern = decodeURIComponent(req.params.pattern);
  const existing = stmts.getPricing.get(pattern);
  if (!existing) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Pricing rule not found" } });
  }
  stmts.deletePricing.run(pattern);
  res.json({ ok: true });
});

// GET /api/pricing/cost - Get total cost across all sessions
router.get("/cost", (req, res) => {
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const tzModifier = Number.isFinite(rawOffset) ? `${-rawOffset} minutes` : "+0 minutes";

  const allTokens = db
    .prepare(
      `SELECT model, speed, inference_geo, service_tier,
        SUM(input_tokens + baseline_input) as input_tokens,
        SUM(output_tokens + baseline_output) as output_tokens,
        SUM(cache_read_tokens + baseline_cache_read) as cache_read_tokens,
        SUM(cache_write_tokens + baseline_cache_write) as cache_write_tokens,
        SUM(cache_write_1h_tokens + baseline_cache_write_1h) as cache_write_1h_tokens,
        SUM(web_search_requests + baseline_web_search) as web_search_requests,
        SUM(web_fetch_requests + baseline_web_fetch) as web_fetch_requests,
        SUM(code_execution_requests + baseline_code_execution) as code_execution_requests
      FROM token_usage GROUP BY model, speed, inference_geo, service_tier`
    )
    .all();
  const dailyTokens = db
    .prepare(
      `SELECT
        DATE(s.started_at, ?) as date,
        tu.model as model,
        tu.speed as speed,
        tu.inference_geo as inference_geo,
        tu.service_tier as service_tier,
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
      GROUP BY 1, tu.model, tu.speed, tu.inference_geo, tu.service_tier`
    )
    .all(tzModifier);
  const rules = stmts.listPricing.all();
  const result = calculateCost(allTokens, rules);
  const daily_costs = calculateDailyCosts(dailyTokens, rules);
  res.json({ ...result, daily_costs });
});

// GET /api/pricing/cost/:sessionId - Get cost for a specific session
router.get("/cost/:sessionId", (req, res) => {
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const tzModifier = Number.isFinite(rawOffset) ? `${-rawOffset} minutes` : "+0 minutes";

  const tokenRows = stmts.getTokensBySession.all(req.params.sessionId);
  const rules = stmts.listPricing.all();
  const result = calculateCost(tokenRows, rules);
  const started = db
    .prepare("SELECT DATE(started_at, ?) as date FROM sessions WHERE id = ?")
    .get(tzModifier, req.params.sessionId);
  const daily_costs = started ? [{ date: started.date, cost: result.total_cost }] : [];
  res.json({ ...result, daily_costs });
});

module.exports = router;
module.exports.calculateCost = calculateCost;
