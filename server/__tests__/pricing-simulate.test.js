/**
 * @file Unit tests for the pure "what-if" repricing simulator helpers
 * (server/lib/pricing-simulate.js): glob matching, transform validation,
 * row transformation (non-mutating), delta summarisation, and the simulate
 * orchestration against an injected calculator.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  simulate,
  applyTransforms,
  validateTransforms,
  summarizeDelta,
  globToRegExp,
  matchGlob,
} = require("../lib/pricing-simulate");

// A tiny stand-in for the production calculator: opus costs 15, sonnet 3, each
// row priced flat. Enough to assert the orchestration without the rate engine.
function fakeCalc(rows) {
  const price = (m) => (/opus/i.test(m) ? 15 : /sonnet/i.test(m) ? 3 : 1);
  let total = 0;
  const bd = new Map();
  for (const r of rows) {
    const c = price(r.model);
    total += c;
    bd.set(r.model, (bd.get(r.model) || 0) + c);
  }
  return {
    total_cost: total,
    breakdown: [...bd.entries()].map(([model, cost]) => ({ model, cost })),
    unpriced_models: [],
  };
}

describe("pricing-simulate: glob matching", () => {
  it("treats * as the only wildcard and escapes regex metacharacters", () => {
    assert.ok(globToRegExp("claude-opus-*").test("claude-opus-4-8"));
    assert.ok(!globToRegExp("claude-opus-*").test("claude-sonnet-5"));
    // A dot in the pattern is literal, not "any char".
    assert.ok(globToRegExp("gpt-5.1").test("gpt-5.1"));
    assert.ok(!globToRegExp("gpt-5.1").test("gpt-5x1"));
  });

  it("empty/missing glob matches everything", () => {
    assert.ok(matchGlob("", "anything"));
    assert.ok(matchGlob(undefined, "anything"));
    assert.ok(matchGlob(null, "anything"));
  });
});

describe("pricing-simulate: validateTransforms", () => {
  it("accepts an empty or missing list", () => {
    assert.deepEqual(validateTransforms(undefined), { ok: true, transforms: [] });
    assert.equal(validateTransforms([]).ok, true);
  });

  it("rejects a non-array", () => {
    assert.equal(validateTransforms({}).ok, false);
  });

  it("rejects an unknown transform type", () => {
    const v = validateTransforms([{ type: "nope" }]);
    assert.equal(v.ok, false);
    assert.match(v.message, /must be one of/);
  });

  it("requires from/to on remap_model", () => {
    assert.equal(validateTransforms([{ type: "remap_model", from: "a" }]).ok, false);
    assert.equal(validateTransforms([{ type: "remap_model", to: "b" }]).ok, false);
    assert.equal(validateTransforms([{ type: "remap_model", from: "a", to: "b" }]).ok, true);
  });

  it("constrains dimension values to the engine vocabulary", () => {
    assert.equal(validateTransforms([{ type: "set_speed", value: "turbo" }]).ok, false);
    assert.equal(validateTransforms([{ type: "set_speed", value: "fast" }]).ok, true);
    assert.equal(validateTransforms([{ type: "set_geo", value: "mars" }]).ok, false);
    assert.equal(validateTransforms([{ type: "set_tier", value: "batch" }]).ok, true);
  });

  it("requires a YYYY-MM-DD as_of on expire_intro_rates", () => {
    assert.equal(validateTransforms([{ type: "expire_intro_rates", as_of: "2026" }]).ok, false);
    assert.equal(
      validateTransforms([{ type: "expire_intro_rates", as_of: "2026-09-01" }]).ok,
      true
    );
  });
});

describe("pricing-simulate: applyTransforms", () => {
  const rows = [
    { model: "claude-opus-4-8", speed: "standard", inference_geo: "global", date: "2026-10-01" },
    { model: "claude-sonnet-5", speed: "standard", inference_geo: "global", date: "2026-10-01" },
  ];

  it("remaps only matching models and never mutates the input", () => {
    const out = applyTransforms(rows, [
      { type: "remap_model", from: "claude-opus-*", to: "claude-haiku-5" },
    ]);
    assert.equal(out[0].model, "claude-haiku-5");
    assert.equal(out[1].model, "claude-sonnet-5");
    // originals untouched
    assert.equal(rows[0].model, "claude-opus-4-8");
  });

  it("sets a dimension across the scope, or only matching models when filtered", () => {
    assert.deepEqual(
      applyTransforms(rows, [{ type: "set_speed", value: "fast" }]).map((r) => r.speed),
      ["fast", "fast"]
    );
    assert.deepEqual(
      applyTransforms(rows, [{ type: "set_speed", value: "fast", model: "claude-opus-*" }]).map(
        (r) => r.speed
      ),
      ["fast", "standard"]
    );
  });

  it("expire_intro_rates overrides the effective pricing date", () => {
    const out = applyTransforms(rows, [{ type: "expire_intro_rates", as_of: "2026-12-01" }]);
    assert.equal(out[0].date, "2026-12-01");
    assert.equal(out[1].date, "2026-12-01");
  });

  it("applies transforms in order (chained)", () => {
    const out = applyTransforms(rows, [
      { type: "remap_model", from: "claude-opus-*", to: "claude-sonnet-5" },
      { type: "set_speed", value: "fast", model: "claude-sonnet-*" },
    ]);
    assert.equal(out[0].model, "claude-sonnet-5");
    assert.equal(out[0].speed, "fast"); // remapped then matched by the sonnet filter
  });
});

describe("pricing-simulate: summarizeDelta", () => {
  it("accounts for both sides of a remap and sorts by magnitude", () => {
    const d = summarizeDelta(
      [{ model: "claude-opus-4-8", cost: 15 }],
      [{ model: "claude-sonnet-5", cost: 3 }]
    );
    const opus = d.find((x) => x.model === "claude-opus-4-8");
    const sonnet = d.find((x) => x.model === "claude-sonnet-5");
    assert.equal(opus.delta, -15);
    assert.equal(opus.delta_pct, -100);
    assert.equal(sonnet.delta, 3);
    assert.equal(sonnet.delta_pct, null); // no actual cost to divide by
    // largest absolute delta first
    assert.equal(d[0].model, "claude-opus-4-8");
  });
});

describe("pricing-simulate: simulate", () => {
  const rows = [
    { model: "claude-opus-4-8", date: "2026-10-01" },
    { model: "claude-opus-4-8", date: "2026-10-02" },
  ];

  it("reprices under transforms and reports the delta", () => {
    const out = simulate(
      { rows, transforms: [{ type: "remap_model", from: "claude-opus-*", to: "claude-sonnet-5" }] },
      fakeCalc
    );
    assert.equal(out.actual.total_cost, 30);
    assert.equal(out.simulated.total_cost, 6);
    assert.equal(out.delta.total, -24);
    assert.equal(out.delta.total_pct, -80);
    assert.ok(out.assumptions[0].includes("cost model"));
  });

  it("an empty transform list reprices to exactly the actual figure", () => {
    const out = simulate({ rows, transforms: [] }, fakeCalc);
    assert.equal(out.simulated.total_cost, out.actual.total_cost);
    assert.equal(out.delta.total, 0);
  });

  it("throws if no calculator is injected", () => {
    assert.throws(() => simulate({ rows: [] }), /requires a calc function/);
  });
});
