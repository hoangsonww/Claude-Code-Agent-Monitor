/**
 * @file Regression tests for the model_pricing seed data and the Sonnet 5 rate
 * correction. `claude-opus-5`, `claude-fable-5-1` and `claude-mythos-5-1` had no
 * pricing rule at all (every such session priced at $0 and listed under
 * "unpriced" in the API response), and Sonnet 5 fell back to a stale $3/$15
 * standard once its launch promo lapsed. These pin the rows, the specificity
 * rule the 5.1 patterns depend on, and the in-place correction that reaches
 * databases created before the fix. Rates are transcribed from Anthropic's
 * published rate card, not derived from the code under test.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const STAMP = `model-pricing-seed-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

const { db, stmts, correctSonnet5StandardRate } = require("../db");
const { calculateCost } = require("../routes/pricing");

after(() => {
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("model_pricing seed — claude-opus-5", () => {
  it("is present on a fresh DB with Anthropic's published rates", () => {
    const row = db
      .prepare("SELECT * FROM model_pricing WHERE model_pattern = 'claude-opus-5%'")
      .get();
    assert.ok(
      row,
      "claude-opus-5% must have a pricing rule — its absence priced every opus-5 session at $0"
    );
    assert.equal(row.input_per_mtok, 5);
    assert.equal(row.output_per_mtok, 25);
    assert.equal(row.cache_read_per_mtok, 0.5);
    assert.equal(row.cache_write_per_mtok, 6.25);
    assert.equal(row.cache_write_1h_per_mtok, 10);
    assert.equal(row.fast_input_per_mtok, 10);
    assert.equal(row.fast_output_per_mtok, 50);
  });

  it("the '%' wildcard matches both 'claude-opus-5' and the observed 'claude-opus-5[1m]' model string — same price, not a separate tier", () => {
    // Both spellings, not just the [1m] one: a regression in bare
    // claude-opus-5 resolution would otherwise slip through.
    for (const model of ["claude-opus-5", "claude-opus-5[1m]"]) {
      const like = db
        .prepare("SELECT model_pattern FROM model_pricing WHERE ? LIKE model_pattern")
        .get(model);
      assert.ok(like, `${model} must resolve to a pricing rule via LIKE-matching`);
      assert.equal(like.model_pattern, "claude-opus-5%", `${model} must use the opus-5 rule`);
    }
  });
});

describe("model_pricing seed — models that had no rule or a stale rate", () => {
  // [pattern, input, output, cacheRead, cacheWrite5m, cacheWrite1h]
  const EXPECTED = [
    ["claude-fable-5-1%", 10, 50, 0.25, 12.5, 20],
    ["claude-mythos-5-1%", 10, 50, 0.25, 12.5, 20],
    ["claude-fable-5%", 10, 50, 1, 12.5, 20],
    ["claude-mythos-5%", 10, 50, 1, 12.5, 20],
    ["claude-opus-5%", 5, 25, 0.5, 6.25, 10],
    ["claude-opus-4-5%", 5, 25, 0.5, 6.25, 10],
    ["claude-sonnet-5%", 2, 10, 0.2, 2.5, 4],
  ];

  for (const [pattern, input, output, cacheRead, cacheWrite, cacheWrite1h] of EXPECTED) {
    it(`seeds ${pattern} at the published rate card`, () => {
      const row = db.prepare("SELECT * FROM model_pricing WHERE model_pattern = ?").get(pattern);
      assert.ok(row, `${pattern} must have a pricing rule — without one it prices at $0`);
      assert.equal(row.input_per_mtok, input, `${pattern} input`);
      assert.equal(row.output_per_mtok, output, `${pattern} output`);
      assert.equal(row.cache_read_per_mtok, cacheRead, `${pattern} cache read`);
      assert.equal(row.cache_write_per_mtok, cacheWrite, `${pattern} 5m cache write`);
      assert.equal(row.cache_write_1h_per_mtok, cacheWrite1h, `${pattern} 1h cache write`);
    });
  }

  it("prices Fable/Mythos 5.1 by their own rule, not the 5 rule they also LIKE-match", () => {
    // "claude-fable-5-1" matches BOTH claude-fable-5% and claude-fable-5-1%.
    // calculateCost sorts by pattern length descending so the specific rule
    // wins; without that, 5.1 would silently bill cache reads at $1 (the 5
    // rate) instead of $0.25 — a 4x over-report on cached input.
    const rules = db.prepare("SELECT * FROM model_pricing").all();
    const sorted = [...rules].sort((a, b) => b.model_pattern.length - a.model_pattern.length);
    const ruleFor = (model) =>
      sorted.find((p) => new RegExp("^" + p.model_pattern.replace(/%/g, ".*") + "$").test(model));

    for (const [model, expected, cacheRead] of [
      ["claude-fable-5-1", "claude-fable-5-1%", 0.25],
      ["claude-mythos-5-1", "claude-mythos-5-1%", 0.25],
      ["claude-fable-5", "claude-fable-5%", 1],
      ["claude-mythos-5", "claude-mythos-5%", 1],
    ]) {
      const rule = ruleFor(model);
      assert.ok(rule, `${model} must resolve to a pricing rule`);
      assert.equal(rule.model_pattern, expected, `${model} must use its own rule`);
      assert.equal(rule.cache_read_per_mtok, cacheRead, `${model} cache read`);
    }
  });

  it("stmts.matchPricing orders by specificity, so its LIMIT 1 is deterministic", () => {
    // `LIMIT 1` without `ORDER BY` makes the chosen row UNDEFINED when several
    // patterns match — and 5.1 matches both `claude-fable-5-1%` and
    // `claude-fable-5%`, which differ on cache reads ($0.25 vs $1). SQLite
    // currently happens to return the specific row, so a runtime-only
    // assertion would pass with or without the fix and guard nothing. The
    // defect is the missing ordering itself, so that is what is asserted.
    assert.match(
      stmts.matchPricing.source.replace(/\s+/g, " "),
      /ORDER BY LENGTH\(model_pattern\) DESC\s+LIMIT 1/,
      "matchPricing must order by pattern length so the most specific rule wins"
    );
  });

  it("stmts.matchPricing resolves the most specific overlapping pattern", () => {
    // Companion to the ordering assertion above: this pins the outcome callers
    // depend on. It documents intent and catches a flipped sort direction.
    for (const [model, expected, cacheRead] of [
      ["claude-fable-5-1", "claude-fable-5-1%", 0.25],
      ["claude-mythos-5-1", "claude-mythos-5-1%", 0.25],
      ["claude-fable-5", "claude-fable-5%", 1],
      ["claude-mythos-5", "claude-mythos-5%", 1],
      ["claude-opus-5", "claude-opus-5%", 0.5],
      ["claude-opus-5[1m]", "claude-opus-5%", 0.5],
    ]) {
      const row = stmts.matchPricing.get(model);
      assert.ok(row, `${model} must match a pricing rule`);
      assert.equal(row.model_pattern, expected, `${model} must use its own rule`);
      assert.equal(row.cache_read_per_mtok, cacheRead, `${model} cache read`);
    }
  });

  it("leaves no current Claude model unpriced", () => {
    const rules = db.prepare("SELECT * FROM model_pricing").all();
    const sorted = [...rules].sort((a, b) => b.model_pattern.length - a.model_pattern.length);
    const unpriced = [
      "claude-fable-5-1",
      "claude-mythos-5-1",
      "claude-fable-5",
      "claude-mythos-5",
      "claude-opus-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-5",
      "claude-sonnet-5",
      "claude-haiku-4-5",
    ].filter(
      (model) =>
        !sorted.some((p) => new RegExp("^" + p.model_pattern.replace(/%/g, ".*") + "$").test(model))
    );
    assert.deepEqual(unpriced, [], "every current model must match a pricing rule");
  });
});

describe("historical usage reprices from the corrected rules", () => {
  // Cost is computed from token_usage on every request and never stored, so
  // fixing a rule retroactively fixes every past session. This asserts the
  // arithmetic end to end for the three models the fix touches.
  const MTOK = 1_000_000;
  const bucket = (model) => ({
    model,
    speed: "standard",
    inference_geo: "global",
    service_tier: "standard",
    context_size: "short",
    input_tokens: MTOK,
    output_tokens: MTOK,
    cache_read_tokens: MTOK,
    cache_write_tokens: 0,
    cache_write_1h_tokens: 0,
  });

  it("prices 1M in / 1M out / 1M cache-read at the published rate for each model", () => {
    const rules = db.prepare("SELECT * FROM model_pricing").all();
    const rows = ["claude-opus-5", "claude-fable-5-1", "claude-sonnet-5"].map(bucket);
    const result = calculateCost(rows, rules, null);

    assert.deepEqual(result.unpriced_models ?? [], [], "no model may be unpriced");
    const costOf = (model) => result.breakdown.find((b) => b.model === model).cost;

    // opus-5:   5 + 25 + 0.50 = 30.50   (was $0 — no rule at all)
    assert.equal(costOf("claude-opus-5"), 30.5);
    // fable-5.1: 10 + 50 + 0.25 = 60.25 (was 61.00 at the Fable 5 cache rate)
    assert.equal(costOf("claude-fable-5-1"), 60.25);
    // sonnet-5:  2 + 10 + 0.20 = 12.20  (was 18.30 at the stale $3/$15)
    assert.equal(costOf("claude-sonnet-5"), 12.2);
  });
});

describe("Sonnet 5 rate correction on pre-existing databases", () => {
  const setSonnet5 = (values) =>
    db
      .prepare(
        `UPDATE model_pricing SET input_per_mtok = ?, output_per_mtok = ?,
           cache_read_per_mtok = ?, cache_write_per_mtok = ?, cache_write_1h_per_mtok = ?
         WHERE model_pattern = 'claude-sonnet-5%'`
      )
      .run(...values);
  const readSonnet5 = () =>
    db.prepare("SELECT * FROM model_pricing WHERE model_pattern = 'claude-sonnet-5%'").get();

  it("rewrites a row still holding the stale $3/$15 standard", () => {
    // The startup top-up is INSERT OR IGNORE — it never touches an existing
    // row — so without this correction an upgraded install keeps over-reporting
    // Sonnet 5 by 50% until someone hits "Reset Defaults".
    setSonnet5([3, 15, 0.3, 3.75, 6]);

    correctSonnet5StandardRate(db);

    const row = readSonnet5();
    assert.equal(row.input_per_mtok, 2);
    assert.equal(row.output_per_mtok, 10);
    assert.equal(row.cache_read_per_mtok, 0.2);
    assert.equal(row.cache_write_per_mtok, 2.5);
    assert.equal(row.cache_write_1h_per_mtok, 4);
  });

  it("never overwrites rates the user edited themselves", () => {
    const custom = [7, 21, 0.7, 8.75, 14];
    setSonnet5(custom);

    correctSonnet5StandardRate(db);

    const row = readSonnet5();
    assert.deepEqual(
      [
        row.input_per_mtok,
        row.output_per_mtok,
        row.cache_read_per_mtok,
        row.cache_write_per_mtok,
        row.cache_write_1h_per_mtok,
      ],
      custom,
      "a user-customized Sonnet 5 rate must survive the correction untouched"
    );
  });

  it("is idempotent — re-running changes nothing", () => {
    setSonnet5([3, 15, 0.3, 3.75, 6]);
    assert.equal(correctSonnet5StandardRate(db).changes, 1, "first run corrects the row");
    assert.equal(correctSonnet5StandardRate(db).changes, 0, "second run is a no-op");
  });
});
