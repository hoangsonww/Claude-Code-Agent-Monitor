/**
 * @file Express router for managing pricing rules and calculating costs based on token usage. It provides endpoints to list, create/update, and delete pricing rules, as well as calculate total costs across all sessions or for a specific session. The cost calculation matches token usage against the most specific applicable pricing rule based on model patterns.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");
const { parseProviders, providerColumnClause } = require("../lib/provider-filter");
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

function matchesModelPattern(pattern, model) {
  const expression = String(pattern || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*");
  return new RegExp(`^${expression}$`).test(String(model || ""));
}

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
function ratesForBucket(rule, row, asOf) {
  const r = rule || {};

  // Time-limited introductory rates. Prefer the usage row's own date (so
  // historical usage keeps the rate it was billed at and future usage picks up
  // the standard rate), else the caller-provided asOf, else today. Dates are
  // compared as YYYY-MM-DD strings (both intro_until and the daily date use that
  // shape), so slice any full ISO timestamp to its day.
  const day = String(row.date || asOf || new Date().toISOString()).slice(0, 10);
  const useIntro = !!r.intro_until && day <= r.intro_until;
  const pick = (introVal, stdVal) => (useIntro && (introVal || 0) > 0 ? introVal : stdVal || 0);

  let rIn = pick(r.intro_input_per_mtok, r.input_per_mtok);
  let rOut = pick(r.intro_output_per_mtok, r.output_per_mtok);
  let rRead = pick(r.intro_cache_read_per_mtok, r.cache_read_per_mtok);
  let r5m = pick(r.intro_cache_write_per_mtok, r.cache_write_per_mtok);
  let r1h = pick(r.intro_cache_write_1h_per_mtok, r.cache_write_1h_per_mtok);

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
function calculateCost(tokenRows, pricingRules, asOf) {
  const sortedRules = [...pricingRules].sort(
    (a, b) => b.model_pattern.length - a.model_pattern.length
  );

  let tokenCost = 0;
  let webSearchCost = 0;
  let codeExecHours = 0;
  // Breakdown is aggregated per (model, speed, geo, tier) tuple, not per input
  // row. This lets callers feed date-split rows (e.g. the daily-usage query,
  // one row per date × model) so each row is priced at its own date's rate,
  // while the breakdown still collapses to one entry per model. For callers that
  // already pass one row per tuple (aggregate total, per-session), it's a no-op.
  const breakdownMap = new Map();
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

    const { rIn, rOut, rRead, r5m, r1h } = ratesForBucket(rule, row, asOf);
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

    const key = `${row.model}|${row.speed || "standard"}|${row.inference_geo || "global"}|${row.service_tier || "standard"}`;
    const agg = breakdownMap.get(key) || {
      model: row.model,
      speed: row.speed || "standard",
      inference_geo: row.inference_geo || "global",
      service_tier: row.service_tier || "standard",
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cache_write_1h_tokens: 0,
      web_search_requests: 0,
      web_fetch_requests: 0,
      code_execution_requests: 0,
      _cost: 0,
      matched_rule: rule?.model_pattern || null,
    };
    agg.input_tokens += row.input_tokens || 0;
    agg.output_tokens += row.output_tokens || 0;
    agg.cache_read_tokens += row.cache_read_tokens || 0;
    agg.cache_write_tokens += row.cache_write_tokens || 0;
    agg.cache_write_1h_tokens += cw1h;
    agg.web_search_requests += row.web_search_requests || 0;
    agg.web_fetch_requests += row.web_fetch_requests || 0;
    agg.code_execution_requests += row.code_execution_requests || 0;
    agg._cost += tCost + wsCost;
    breakdownMap.set(key, agg);
  }
  const breakdown = [...breakdownMap.values()].map(({ _cost, ...b }) => ({
    ...b,
    cost: round4(_cost),
  }));

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

/**
 * Calculate Codex/OpenAI usage. Codex rollout counters keep fresh input,
 * cached input, cache writes, and output in separate fields, which maps
 * directly to OpenAI's published GPT rate card. `context_size` is stamped at
 * ingestion from each request's input token count (short <= 272K).
 */
function calculateGptCost(tokenRows, pricingRules) {
  const sortedRules = [...pricingRules].sort(
    (a, b) => b.model_pattern.length - a.model_pattern.length
  );
  const breakdownMap = new Map();
  const unpriced = new Map();
  let total = 0;

  for (const row of tokenRows) {
    const rule = sortedRules.find((candidate) =>
      matchesModelPattern(candidate.model_pattern, row.model)
    );
    const contextSize = row.context_size === "long" ? "long" : "short";
    const isFast = row.speed === "fast";
    const prefix = isFast ? "fast" : contextSize;
    const rates = rule
      ? {
          input: Number(rule[`${prefix}_input_per_mtok`]) || 0,
          cached: Number(rule[`${prefix}_cached_input_per_mtok`]) || 0,
          write: Number(rule[`${prefix}_cache_write_per_mtok`]) || 0,
          output: Number(rule[`${prefix}_output_per_mtok`]) || 0,
        }
      : null;
    const isPriced = !!rates && Object.values(rates).some((rate) => rate > 0);

    const inputs = Number(row.input_tokens) || 0;
    const cached = Number(row.cache_read_tokens) || 0;
    const writes = Number(row.cache_write_tokens) || 0;
    const outputs = Number(row.output_tokens) || 0;
    const bucketCost = isPriced
      ? (inputs / 1e6) * rates.input +
        (cached / 1e6) * rates.cached +
        (writes / 1e6) * rates.write +
        (outputs / 1e6) * rates.output
      : 0;
    total += bucketCost;

    if (!isPriced) {
      const key = `${row.model}|${isFast ? "fast" : contextSize}`;
      const entry = unpriced.get(key) || {
        model: row.model,
        speed: row.speed || "standard",
        context_size: contextSize,
        reason: !rule
          ? "No GPT pricing rule matches this model"
          : "No published rate for this context or speed tier",
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      };
      entry.input_tokens += inputs;
      entry.output_tokens += outputs;
      entry.cache_read_tokens += cached;
      entry.cache_write_tokens += writes;
      unpriced.set(key, entry);
    }

    const key = `${row.model}|${row.speed || "standard"}|${contextSize}`;
    const entry = breakdownMap.get(key) || {
      provider: "codex",
      model: row.model,
      speed: row.speed || "standard",
      context_size: contextSize,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cache_write_1h_tokens: 0,
      web_search_requests: 0,
      web_fetch_requests: 0,
      code_execution_requests: 0,
      matched_rule: rule?.model_pattern || null,
      _cost: 0,
    };
    entry.input_tokens += inputs;
    entry.output_tokens += outputs;
    entry.cache_read_tokens += cached;
    entry.cache_write_tokens += writes;
    entry._cost += bucketCost;
    breakdownMap.set(key, entry);
  }

  return {
    total_cost: round4(total),
    breakdown: [...breakdownMap.values()].map(({ _cost, ...entry }) => ({
      ...entry,
      cost: round4(_cost),
    })),
    feature_costs: {
      web_search_cost: 0,
      web_fetch_cost: 0,
      code_execution_cost: 0,
      code_execution_hours_estimated: 0,
      code_execution_free_hours: CODE_EXEC_FREE_HOURS,
    },
    unpriced_models: [...unpriced.values()],
  };
}

/** Combine Claude and Codex accounting without ever applying one provider's rate card to the other. */
function calculateProviderCost(tokenRows, claudePricingRules, gptPricingRules, asOf) {
  const claudeRows = tokenRows.filter((row) => row.provider !== "codex");
  const codexRows = tokenRows.filter((row) => row.provider === "codex");
  const claude = calculateCost(claudeRows, claudePricingRules, asOf);
  const codex = calculateGptCost(codexRows, gptPricingRules);

  return {
    total_cost: round4(claude.total_cost + codex.total_cost),
    breakdown: [...claude.breakdown, ...codex.breakdown],
    feature_costs: claude.feature_costs,
    unpriced_models: [...claude.unpriced_models, ...codex.unpriced_models],
  };
}

function calculateDailyCosts(dailyTokenRows, pricingRules, gptPricingRules) {
  const rowsByDate = new Map();
  for (const row of dailyTokenRows) {
    const rows = rowsByDate.get(row.date) || [];
    rows.push({
      model: row.model,
      provider: row.provider,
      speed: row.speed,
      inference_geo: row.inference_geo,
      service_tier: row.service_tier,
      context_size: row.context_size,
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
    .map(([date, rows]) => ({
      date,
      cost: calculateProviderCost(rows, pricingRules, gptPricingRules, date).total_cost,
    }));
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
    // Time-limited introductory rates (all optional). A caller that omits every
    // intro field leaves any existing promo untouched (see introProvided below).
    intro_input_per_mtok,
    intro_output_per_mtok,
    intro_cache_read_per_mtok,
    intro_cache_write_per_mtok,
    intro_cache_write_1h_per_mtok,
    intro_until,
  } = req.body;
  if (!model_pattern || !display_name) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "model_pattern and display_name are required" },
    });
  }

  // Every rate field must be a non-negative finite number when present. A
  // typo'd value (Number("abc") → NaN) or a negative rate would otherwise be
  // written straight into model_pricing and silently corrupt every downstream
  // cost calculation until someone noticed and fixed the row by hand.
  const RATE_FIELDS = [
    "input_per_mtok",
    "output_per_mtok",
    "cache_read_per_mtok",
    "cache_write_per_mtok",
    "cache_write_1h_per_mtok",
    "fast_input_per_mtok",
    "fast_output_per_mtok",
    "intro_input_per_mtok",
    "intro_output_per_mtok",
    "intro_cache_read_per_mtok",
    "intro_cache_write_per_mtok",
    "intro_cache_write_1h_per_mtok",
  ];
  for (const field of RATE_FIELDS) {
    const raw = req.body[field];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: `${field} must be a non-negative number` },
      });
    }
  }
  // Absent/empty rates default to 0; numeric strings are coerced so a rate can
  // never be bound into the DB as text.
  const num = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));

  // Only touch the intro columns when the caller actually sent at least one
  // intro field. This keeps the endpoint backward-compatible: existing clients
  // that PUT just the standard rates never clobber a promo, while the Settings
  // UI (which always sends the full intro block) is authoritative for it.
  const introKeys = [
    "intro_input_per_mtok",
    "intro_output_per_mtok",
    "intro_cache_read_per_mtok",
    "intro_cache_write_per_mtok",
    "intro_cache_write_1h_per_mtok",
    "intro_until",
  ];
  const introProvided = introKeys.some((k) => req.body[k] !== undefined);

  // Normalize / validate intro_until: an empty value clears the promo (NULL);
  // a present value must be a YYYY-MM-DD date so the date-string comparisons in
  // ratesForBucket stay correct.
  let normalizedIntroUntil = null;
  if (introProvided) {
    const raw = typeof intro_until === "string" ? intro_until.trim() : intro_until;
    if (raw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "intro_until must be a YYYY-MM-DD date" },
        });
      }
      normalizedIntroUntil = raw;
    }
  }

  const writeRule = db.transaction(() => {
    stmts.upsertPricing.run(
      model_pattern,
      display_name,
      num(input_per_mtok),
      num(output_per_mtok),
      num(cache_read_per_mtok),
      num(cache_write_per_mtok),
      num(cache_write_1h_per_mtok),
      num(fast_input_per_mtok),
      num(fast_output_per_mtok)
    );
    if (introProvided) {
      // A cleared promo (no date) zeroes the intro rates too so a stale value
      // can't resurface if a date is re-added later without re-entering rates.
      const keepRates = !!normalizedIntroUntil;
      stmts.setIntroPricing.run(
        keepRates ? num(intro_input_per_mtok) : 0,
        keepRates ? num(intro_output_per_mtok) : 0,
        keepRates ? num(intro_cache_read_per_mtok) : 0,
        keepRates ? num(intro_cache_write_per_mtok) : 0,
        keepRates ? num(intro_cache_write_1h_per_mtok) : 0,
        normalizedIntroUntil,
        model_pattern
      );
    }
  });
  writeRule();

  const rule = stmts.getPricing.get(model_pattern);
  res.json({ pricing: rule });
});

// GET /api/pricing/gpt - List the separate OpenAI/Codex rate card.
router.get("/gpt", (_req, res) => {
  res.json({ pricing: stmts.listGptPricing.all() });
});

// PUT /api/pricing/gpt - Create or update an OpenAI/Codex pricing row.
router.put("/gpt", (req, res) => {
  const { model_pattern, display_name } = req.body;
  if (!model_pattern || !display_name) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "model_pattern and display_name are required" },
    });
  }

  const rateFields = [
    "short_input_per_mtok",
    "short_cached_input_per_mtok",
    "short_cache_write_per_mtok",
    "short_output_per_mtok",
    "long_input_per_mtok",
    "long_cached_input_per_mtok",
    "long_cache_write_per_mtok",
    "long_output_per_mtok",
    "fast_input_per_mtok",
    "fast_cached_input_per_mtok",
    "fast_cache_write_per_mtok",
    "fast_output_per_mtok",
  ];
  for (const field of rateFields) {
    const raw = req.body[field];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: `${field} must be a non-negative number` },
      });
    }
  }
  const valueOf = (field) => {
    const raw = req.body[field];
    return raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
  };

  stmts.upsertGptPricing.run(model_pattern, display_name, ...rateFields.map(valueOf));
  res.json({ pricing: stmts.getGptPricing.get(model_pattern) });
});

router.delete("/gpt/:pattern", (req, res) => {
  const pattern = req.params.pattern;
  if (!stmts.getGptPricing.get(pattern)) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "GPT pricing rule not found" } });
  }
  stmts.deleteGptPricing.run(pattern);
  res.json({ ok: true });
});

// DELETE /api/pricing/:pattern - Delete a pricing rule
router.delete("/:pattern", (req, res) => {
  // Express has already percent-decoded route params, so a client that
  // properly encodeURIComponent()s a pattern like "claude-opus-4-6%" hands us
  // the raw "%" here — a second decodeURIComponent() then throws URIError
  // (malformed escape) and the route 500s. Try the legacy double-decode for
  // backward compatibility, but fall back to the already-decoded value.
  let pattern;
  try {
    pattern = decodeURIComponent(req.params.pattern);
  } catch {
    pattern = req.params.pattern;
  }
  const existing = stmts.getPricing.get(pattern);
  if (!existing) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Pricing rule not found" } });
  }
  stmts.deletePricing.run(pattern);
  res.json({ ok: true });
});

// GET /api/pricing/cost - Get total cost across all sessions.
// Honors the global data-scope: `?sources=<csv>` narrows the aggregate to those
// origin machines (see server/lib/source-filter.js), matching the sessions /
// stats / analytics endpoints so the Dashboard "total cost" tracks the selector.
router.get("/cost", (req, res) => {
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const tzModifier = Number.isFinite(rawOffset) ? `${-rawOffset} minutes` : "+0 minutes";
  const sourceScope = sourceColumnClause(parseSources(req), "s.source");
  const providerScope = providerColumnClause(parseProviders(req), "s.provider");
  const clauses = [sourceScope.clause, providerScope.clause].filter(Boolean);
  const params = [...sourceScope.params, ...providerScope.params];
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const dailyTokens = db
    .prepare(
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
      GROUP BY 1, s.provider, tu.model, tu.speed, tu.inference_geo, tu.service_tier, tu.context_size`
    )
    .all(tzModifier, ...params);
  const rules = stmts.listPricing.all();
  const gptRules = stmts.listGptPricing.all();
  // Price the date-split rows so each day's usage bills at the rate effective on
  // that date (e.g. Sonnet 5's intro discount before 2026-08-31, standard after).
  // Coverage equals the undated aggregate — token_usage cascades with sessions,
  // so the INNER JOIN drops nothing — and the breakdown re-collapses per model.
  const result = calculateProviderCost(dailyTokens, rules, gptRules);
  const daily_costs = calculateDailyCosts(dailyTokens, rules, gptRules);
  res.json({ ...result, daily_costs });
});

// GET /api/pricing/cost/:sessionId - Get cost for a specific session
router.get("/cost/:sessionId", (req, res) => {
  const rawOffset = parseInt(req.query.tz_offset, 10);
  const tzModifier = Number.isFinite(rawOffset) ? `${-rawOffset} minutes` : "+0 minutes";

  const session = db
    .prepare("SELECT provider, source, DATE(started_at, ?) as date FROM sessions WHERE id = ?")
    .get(tzModifier, req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  const providers = parseProviders(req);
  const sources = parseSources(req);
  if (
    (providers && !providers.includes(session.provider || "claude")) ||
    (sources && !sources.includes(session.source || "local"))
  ) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  const tokenRows = stmts.getTokensBySession
    .all(req.params.sessionId)
    .map((row) => ({ ...row, provider: session.provider || "claude" }));
  const rules = stmts.listPricing.all();
  const gptRules = stmts.listGptPricing.all();
  // Price the session as of its start date so a session that ran during a promo
  // window keeps that rate (e.g. Sonnet 5 intro through 2026-08-31).
  const result = calculateProviderCost(tokenRows, rules, gptRules, session.date);
  const daily_costs = session ? [{ date: session.date, cost: result.total_cost }] : [];
  res.json({ ...result, daily_costs });
});

/**
 * Compute a single agent's own cost from the token buckets stashed in its
 * metadata by the importer (agent.metadata.tokens). Returns 0 when the agent has
 * no per-agent usage recorded (e.g. main agents — whose cost is the session
 * total — compaction pseudo-agents, or live subagents not yet backfilled from
 * their transcript). Priced with the agent's start date so a promo/standard
 * cutover is respected, exactly like session cost.
 */
function agentOwnCost(agent, pricingRules) {
  if (!agent || !agent.metadata) return 0;
  let meta;
  try {
    meta = JSON.parse(agent.metadata);
  } catch {
    return 0;
  }
  const rows = Array.isArray(meta.tokens) ? meta.tokens : null;
  if (!rows || rows.length === 0) return 0;
  const asOf = agent.started_at ? String(agent.started_at).slice(0, 10) : undefined;
  return calculateCost(rows, pricingRules, asOf).total_cost;
}

/**
 * Return a shallow copy of each agent row with a computed `cost` field — the
 * agent's OWN cost (see agentOwnCost). Pricing rules are read once for the whole
 * batch. Used by the agent-list endpoints so subagent cards can show their real
 * cost instead of the session total.
 */
function attachAgentCosts(agents) {
  if (!Array.isArray(agents) || agents.length === 0) return agents;
  const rules = stmts.listPricing.all();
  return agents.map((a) => ({ ...a, cost: agentOwnCost(a, rules) }));
}

module.exports = router;
module.exports.calculateCost = calculateCost;
module.exports.calculateGptCost = calculateGptCost;
module.exports.calculateProviderCost = calculateProviderCost;
module.exports.agentOwnCost = agentOwnCost;
module.exports.attachAgentCosts = attachAgentCosts;
