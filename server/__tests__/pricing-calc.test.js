/**
 * @file Unit tests for the enhanced pricing calculator and the shared token-usage
 * normalizer: 5m/1h cache-write split, server-tool surcharges, and the per-bucket
 * pricing modifiers (fast mode, US data residency, Batch API).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { calculateCost } = require("../routes/pricing");
const {
  normalizeSpeed,
  normalizeGeo,
  normalizeTier,
  extractUsageFields,
} = require("../lib/token-usage");

const M = 1_000_000;

// One Opus-4.8-shaped rule with fast pricing, used across the cost tests.
const RULES = [
  {
    model_pattern: "claude-opus-4-8%",
    display_name: "Claude Opus 4.8",
    input_per_mtok: 5,
    output_per_mtok: 25,
    cache_read_per_mtok: 0.5,
    cache_write_per_mtok: 6.25,
    cache_write_1h_per_mtok: 10,
    fast_input_per_mtok: 10,
    fast_output_per_mtok: 50,
  },
];

function bucket(extra) {
  return {
    model: "claude-opus-4-8",
    speed: "standard",
    inference_geo: "global",
    service_tier: "standard",
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cache_write_1h_tokens: 0,
    web_search_requests: 0,
    web_fetch_requests: 0,
    code_execution_requests: 0,
    ...extra,
  };
}

describe("token-usage normalizer", () => {
  it("normalizes pricing dimensions, collapsing unknowns to standard/global", () => {
    assert.equal(normalizeSpeed({ speed: "fast" }), "fast");
    assert.equal(normalizeSpeed({ speed: "standard" }), "standard");
    assert.equal(normalizeSpeed({}), "standard");
    assert.equal(normalizeGeo({ inference_geo: "us" }), "us");
    assert.equal(normalizeGeo({ inference_geo: "not_available" }), "global");
    assert.equal(normalizeGeo({}), "global");
    assert.equal(normalizeTier({ service_tier: "batch" }), "batch");
    assert.equal(normalizeTier({ service_tier: "priority" }), "standard");
  });

  it("splits 5m vs 1h cache writes from cache_creation breakdown", () => {
    const f = extractUsageFields({
      input_tokens: 100,
      output_tokens: 200,
      cache_read_input_tokens: 50,
      cache_creation_input_tokens: 80,
      cache_creation: { ephemeral_5m_input_tokens: 30, ephemeral_1h_input_tokens: 50 },
      server_tool_use: {
        web_search_requests: 2,
        web_fetch_requests: 1,
        code_execution_requests: 3,
      },
    });
    assert.equal(f.input, 100);
    assert.equal(f.output, 200);
    assert.equal(f.cacheRead, 50);
    assert.equal(f.cacheWrite, 80);
    assert.equal(f.cacheWrite1h, 50);
    assert.equal(f.webSearch, 2);
    assert.equal(f.webFetch, 1);
    assert.equal(f.codeExec, 3);
  });

  it("treats the old shape (no breakdown / no tool use) as all-5m, zero tools", () => {
    const f = extractUsageFields({
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 5,
      cache_creation_input_tokens: 40,
    });
    assert.equal(f.cacheWrite, 40);
    assert.equal(f.cacheWrite1h, 0); // backward compatible: priced at the 5m rate
    assert.equal(f.webSearch, 0);
    assert.equal(f.codeExec, 0);
  });
});

describe("calculateCost — token rates", () => {
  it("prices standard input/output/read/5m/1h correctly", () => {
    const r = calculateCost(
      [
        bucket({
          input_tokens: M,
          output_tokens: M,
          cache_read_tokens: M,
          cache_write_tokens: M,
          cache_write_1h_tokens: 0,
        }),
      ],
      RULES
    );
    // 5 + 25 + 0.5 + 6.25(5m) = 36.75
    assert.equal(r.total_cost, 36.75);
  });

  it("splits a mixed cache_write into 5m and 1h portions", () => {
    const r = calculateCost(
      [bucket({ cache_write_tokens: M, cache_write_1h_tokens: 0.4 * M })],
      RULES
    );
    // 0.6M @ 6.25 + 0.4M @ 10 = 3.75 + 4 = 7.75
    assert.equal(r.total_cost, 7.75);
  });

  it("falls back to zero cost when no rule matches and surfaces the unpriced model", () => {
    const r = calculateCost([bucket({ model: "gpt-4o", input_tokens: M })], RULES);
    assert.equal(r.total_cost, 0);
    assert.equal(r.breakdown[0].matched_rule, null);
    assert.equal(r.unpriced_models.length, 1);
    assert.equal(r.unpriced_models[0].model, "gpt-4o");
    assert.equal(r.unpriced_models[0].input_tokens, M);
  });
});

describe("calculateCost — modifiers", () => {
  it("applies fast-mode premium (input/output) and scales cache from fast input", () => {
    const r = calculateCost(
      [
        bucket({
          speed: "fast",
          input_tokens: M,
          output_tokens: M,
          cache_write_tokens: M,
          cache_write_1h_tokens: M,
        }),
      ],
      RULES
    );
    // fast input 10, output 50, 1h-write = 10 * (10/5) = 20 => 80
    assert.equal(r.total_cost, 80);
  });

  it("applies the US data-residency 1.1x multiplier", () => {
    const r = calculateCost(
      [
        bucket({
          inference_geo: "us",
          input_tokens: M,
          output_tokens: M,
          cache_write_tokens: M,
          cache_write_1h_tokens: M,
        }),
      ],
      RULES
    );
    // (5 + 25 + 10) * 1.1 = 44
    assert.equal(r.total_cost, 44);
  });

  it("applies the Batch API 50% discount", () => {
    const r = calculateCost(
      [
        bucket({
          service_tier: "batch",
          input_tokens: M,
          output_tokens: M,
          cache_write_tokens: M,
          cache_write_1h_tokens: M,
        }),
      ],
      RULES
    );
    // (5 + 25 + 10) * 0.5 = 20
    assert.equal(r.total_cost, 20);
  });
});

describe("calculateCost — server-tool surcharges", () => {
  it("charges web search at $10 / 1,000 searches", () => {
    const r = calculateCost([bucket({ web_search_requests: 2500 })], RULES);
    assert.equal(r.total_cost, 25);
    assert.equal(r.feature_costs.web_search_cost, 25);
  });

  it("charges nothing for web fetch", () => {
    const r = calculateCost([bucket({ web_fetch_requests: 9999 })], RULES);
    assert.equal(r.total_cost, 0);
    assert.equal(r.feature_costs.web_fetch_cost, 0);
  });

  it("treats code execution as free under the monthly allowance", () => {
    const r = calculateCost([bucket({ code_execution_requests: 100 })], RULES);
    assert.equal(r.feature_costs.code_execution_cost, 0); // well under 1550 free hours
    assert.ok(r.feature_costs.code_execution_hours_estimated > 0);
  });

  it("treats code execution as free when used alongside web search", () => {
    const r = calculateCost(
      [bucket({ code_execution_requests: 1000000, web_search_requests: 1 })],
      RULES
    );
    // free-with-search => 0 estimated hours despite huge request count (search surcharge only)
    assert.equal(r.feature_costs.code_execution_hours_estimated, 0);
    assert.equal(r.feature_costs.code_execution_cost, 0);
  });

  it("charges code execution beyond the free allowance", () => {
    // 12 requests/hour at the 5-min minimum; exceed 1550 free hours to force a charge.
    const requests = (1550 + 100) * 12; // 100 billable hours over the allowance
    const r = calculateCost([bucket({ code_execution_requests: requests })], RULES);
    assert.equal(r.feature_costs.code_execution_cost, 5); // 100 hrs * $0.05
  });
});
