/**
 * @file Regression test for the model_pricing seed data. `claude-opus-5` had
 * no pricing rule at all (every opus-5 session priced at $0, "unpriced" in
 * the API response) — this pins the row so it can't silently disappear again.
 * Rates verified against Anthropic's own published pricing before writing
 * this test, not derived from the code under test.
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

const { db } = require("../db");

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
    const like = db
      .prepare("SELECT model_pattern FROM model_pricing WHERE ? LIKE model_pattern")
      .get("claude-opus-5[1m]");
    assert.ok(like, "claude-opus-5[1m] must resolve to a pricing rule via LIKE-matching");
    assert.equal(like.model_pattern, "claude-opus-5%");
  });
});
