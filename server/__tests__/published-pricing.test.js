/**
 * @file Published OpenAI and Claude rate-card regression tests, including
 * upgrade corrections, custom-rate preservation, and real model-id matching.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "published-pricing-"));
process.env.DASHBOARD_DB_PATH = path.join(tmp, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = tmp;
const { db, stmts, correctPublishedPricing, seedGptPricing } = require("../db");
const { calculateGptCost, calculateCost } = require("../routes/pricing");
after(() => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
const bucket = (model, extra = {}) => ({
  model,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  ...extra,
});

// Transcribed independently from the user-supplied standard USD/MTok cards.
const openai = [
  ["gpt-6-astra", 10, 1, 12.5, 50],
  ["gpt-5.6-sol", 4, 0.4, 5, 20],
  ["gpt-5.6-terra", 2, 0.2, 2.5, 12],
  ["gpt-5.6-luna", 0.2, 0.02, 0.25, 1.2],
  ["gpt-5.5", 5, 0.5, 0, 30],
  ["gpt-5.5-pro", 30, 0, 0, 180],
  ["gpt-5.4", 2.5, 0.25, 0, 15],
  ["gpt-5.4-pro", 30, 0, 0, 180],
  ["gpt-5.4-mini", 0.75, 0.075, 0, 4.5],
  ["gpt-5.4-nano", 0.2, 0.02, 0, 1.25],
  ["gpt-5.2", 1.75, 0.175, 0, 14],
  ["gpt-5.2-pro", 21, 0, 0, 168],
  ["gpt-5.1", 1.25, 0.125, 0, 10],
  ["gpt-5", 1.25, 0.125, 0, 10],
  ["gpt-5-mini", 0.25, 0.025, 0, 2],
  ["gpt-5-nano", 0.05, 0.005, 0, 0.4],
  ["gpt-5-pro", 15, 0, 0, 120],
  ["gpt-4.1", 2, 0.5, 0, 8],
  ["gpt-4.1-mini", 0.4, 0.1, 0, 1.6],
  ["gpt-4.1-nano", 0.1, 0.025, 0, 0.4],
  ["gpt-4o", 2.5, 1.25, 0, 10],
  ["gpt-4o-mini", 0.15, 0.075, 0, 0.6],
  ["o4-mini", 1.1, 0.275, 0, 4.4],
  ["o3", 2, 0.5, 0, 8],
  ["o3-mini", 1.1, 0.55, 0, 4.4],
  ["o3-pro", 20, 0, 0, 80],
  ["o1", 15, 7.5, 0, 60],
  ["o1-pro", 150, 0, 0, 600],
  ["gpt-4o-2024-05-13", 5, 0, 0, 15],
  ["gpt-4-turbo-2024-04-09", 10, 0, 0, 30],
  ["gpt-4-0613", 30, 0, 0, 60],
  ["gpt-3.5-turbo", 0.5, 0, 0, 1.5],
  ["gpt-3.5-turbo-0125", 0.5, 0, 0, 1.5],
  ["gpt-3.5-turbo-1106", 1, 0, 0, 2],
  ["gpt-3.5-turbo-instruct", 1.5, 0, 0, 2],
  ["davinci-002", 2, 0, 0, 2],
  ["babbage-002", 0.4, 0, 0, 0.4],
];
const claude = [
  ["claude-fable-5-1", 10, 50, 0.25, 12.5, 20],
  ["claude-mythos-5-1", 10, 50, 0.25, 12.5, 20],
  ["claude-fable-5", 10, 50, 1, 12.5, 20],
  ["claude-mythos-5", 10, 50, 1, 12.5, 20],
  ...["5", "4-8", "4-7", "4-6", "4-5"].map((v) => [`claude-opus-${v}`, 5, 25, 0.5, 6.25, 10]),
  ["claude-opus-4-1", 15, 75, 1.5, 18.75, 30],
  ["claude-opus-4-20250514", 15, 75, 1.5, 18.75, 30],
  ["claude-sonnet-5", 2, 10, 0.2, 2.5, 4],
  ["claude-sonnet-4-6", 3, 15, 0.3, 3.75, 6],
  ["claude-sonnet-4-5", 3, 15, 0.3, 3.75, 6],
  ["claude-sonnet-4-20250514", 3, 15, 0.3, 3.75, 6],
  ["claude-haiku-4-5", 1, 5, 0.1, 1.25, 2],
  ["claude-3-5-haiku", 0.8, 4, 0.08, 1, 1.6],
];
describe("published standard prices", () => {
  for (const [model, ...rates] of openai)
    it(model, () => {
      const rules = stmts.listGptPricing.all();
      const fields = ["input_tokens", "cache_read_tokens", "cache_write_tokens", "output_tokens"];
      fields.forEach((field, i) => {
        const result = calculateGptCost([bucket(model, { [field]: 1e6 })], rules);
        assert.equal(result.total_cost, rates[i], `${model} ${field}`);
        assert.deepEqual(result.unpriced_models || [], []);
      });
    });
  for (const [model, ...rates] of claude)
    it(model, () => {
      const rules = stmts.listPricing.all();
      const fields = [
        "input_tokens",
        "output_tokens",
        "cache_read_tokens",
        "cache_write_tokens",
        "cache_write_1h_tokens",
      ];
      fields.forEach((field, i) => {
        const result = calculateCost(
          [
            bucket(model, {
              [field]: 1e6,
              ...(field === "cache_write_1h_tokens" ? { cache_write_tokens: 1e6 } : {}),
            }),
          ],
          rules,
          "2026-09-15"
        );
        assert.equal(result.total_cost, rates[i], `${model} ${field}`);
        assert.deepEqual(result.unpriced_models || [], []);
      });
    });
});
describe("context and Fast pricing", () => {
  const long = [
    ["gpt-6-astra", 20, 2, 25, 75],
    ["gpt-5.6-sol", 8, 0.8, 10, 30],
    ["gpt-5.6-terra", 4, 0.4, 5, 18],
    ["gpt-5.6-luna", 0.4, 0.04, 0.5, 1.8],
    ["gpt-5.5", 10, 1, 0, 45],
    ["gpt-5.5-pro", 60, 0, 0, 270],
    ["gpt-5.4", 5, 0.5, 0, 22.5],
    ["gpt-5.4-pro", 60, 0, 0, 270],
  ];
  for (const [model, ...rates] of long)
    it(`${model} standard long`, () => {
      const r = calculateGptCost(
        [
          bucket(model, {
            context_size: "long",
            input_tokens: 1e6,
            cache_read_tokens: 1e6,
            cache_write_tokens: 1e6,
            output_tokens: 1e6,
          }),
        ],
        stmts.listGptPricing.all()
      );
      assert.equal(r.total_cost, Math.round(rates.reduce((a, b) => a + b, 0) * 1e4) / 1e4);
      assert.deepEqual(r.unpriced_models || [], []);
    });
  it("prices an actual Astra long request at $6.075", () => {
    assert.equal(
      calculateGptCost(
        [
          bucket("gpt-6-astra", {
            context_size: "long",
            input_tokens: 300000,
            output_tokens: 1000,
          }),
        ],
        stmts.listGptPricing.all()
      ).total_cost,
      6.075
    );
  });
  for (const [model, short, long] of [
    ["gpt-6-astra", 147, 244],
    ["gpt-5.6-sol", 58.8, 97.6],
    ["gpt-5.6-terra", 33.4, 54.8],
    ["gpt-5.6-luna", 3.34, 5.48],
  ]) {
    it(`${model} Fast short and long`, () => {
      for (const [context_size, total] of [
        ["short", short],
        ["long", long],
      ]) {
        assert.equal(
          calculateGptCost(
            [
              bucket(model, {
                speed: "fast",
                context_size,
                input_tokens: 1e6,
                output_tokens: 1e6,
                cache_read_tokens: 1e6,
                cache_write_tokens: 1e6,
              }),
            ],
            stmts.listGptPricing.all()
          ).total_cost,
          total
        );
      }
    });
  }
  it("leaves unpublished Fast long tiers unpriced", () => {
    const r = calculateGptCost(
      [bucket("gpt-5.4-mini", { speed: "fast", context_size: "long", input_tokens: 1e6 })],
      stmts.listGptPricing.all()
    );
    assert.equal(r.total_cost, 0);
    assert.equal(r.unpriced_models.length, 1);
  });
  it("Opus 4.6 falls back to standard while 4.8 and 5 use current Fast rates", () => {
    for (const [model, total] of [
      ["claude-opus-4-6", 36.75],
      ["claude-opus-4-8", 73.5],
      ["claude-opus-5", 73.5],
    ]) {
      assert.equal(
        calculateCost(
          [
            bucket(model, {
              speed: "fast",
              input_tokens: 1e6,
              output_tokens: 1e6,
              cache_read_tokens: 1e6,
              cache_write_tokens: 1e6,
            }),
          ],
          stmts.listPricing.all()
        ).total_cost,
        total
      );
    }
    assert.equal(
      stmts.listPricing.all().find((r) => r.model_pattern === "claude-opus-4-7%")
        .fast_input_per_mtok,
      0
    );
  });
});
describe("installed database corrections", () => {
  const oldSol = [5, 0.5, 6.25, 30, 10, 1, 12.5, 45, 10, 1, 12.5, 60];
  it("corrects the old Sol and Astra seeds, is idempotent, and preserves custom edits", () => {
    stmts.upsertGptPricing.run("gpt-5.6-sol%", "Sol", ...oldSol);
    db.prepare(
      "UPDATE gpt_model_pricing SET long_input_per_mtok=0,long_cached_input_per_mtok=0,long_cache_write_per_mtok=0,long_output_per_mtok=0 WHERE model_pattern='gpt-6-astra%'"
    ).run();
    correctPublishedPricing(db, true);
    assert.equal(stmts.getGptPricing.get("gpt-5.6-sol%").short_output_per_mtok, 20);
    assert.equal(stmts.getGptPricing.get("gpt-6-astra%").long_output_per_mtok, 75);
    const before = stmts.listGptPricing.all();
    correctPublishedPricing(db);
    assert.deepEqual(stmts.listGptPricing.all(), before);
    stmts.upsertGptPricing.run(
      "gpt-5.6-sol%",
      "Custom Sol",
      ...oldSol.map((v, i) => (i === 0 ? 7 : v))
    );
    stmts.setGptFastLongPricing.run(0, 0, 0, 0, "gpt-5.6-sol%");
    correctPublishedPricing(db);
    seedGptPricing(db);
    assert.equal(stmts.getGptPricing.get("gpt-5.6-sol%").short_input_per_mtok, 7);
    assert.equal(stmts.getGptPricing.get("gpt-5.6-sol%").fast_long_input_per_mtok, 0);
  });
  it("removes only untouched legacy Opus Fast premiums", () => {
    db.prepare(
      "UPDATE model_pricing SET fast_input_per_mtok=30,fast_output_per_mtok=150 WHERE model_pattern IN ('claude-opus-4-6%','claude-opus-4-7%')"
    ).run();
    db.prepare(
      "UPDATE model_pricing SET input_per_mtok=7 WHERE model_pattern='claude-opus-4-7%'"
    ).run();
    correctPublishedPricing(db);
    const rows = stmts.listPricing.all();
    assert.equal(rows.find((r) => r.model_pattern === "claude-opus-4-6%").fast_input_per_mtok, 0);
    assert.equal(rows.find((r) => r.model_pattern === "claude-opus-4-7%").fast_input_per_mtok, 30);
  });
});

describe("pre-upgrade database startup", () => {
  it("adds Fast long columns, corrects old defaults, preserves custom rows and later edits across restarts", () => {
    const { DatabaseSync } = require("node:sqlite");
    const { execFileSync } = require("node:child_process");
    const file = path.join(tmp, "legacy.db");
    const legacy = new DatabaseSync(file);
    const fields = ["short", "long", "fast"].flatMap((prefix) =>
      ["input", "cached_input", "cache_write", "output"].map((kind) => `${prefix}_${kind}_per_mtok`)
    );
    legacy.exec(`CREATE TABLE gpt_model_pricing (model_pattern TEXT PRIMARY KEY,
      display_name TEXT NOT NULL, ${fields.map((field) => `${field} REAL NOT NULL DEFAULT 0`).join(",")},
      updated_at TEXT NOT NULL DEFAULT '2026-09-01')`);
    const insert =
      legacy.prepare(`INSERT INTO gpt_model_pricing (model_pattern,display_name,${fields.join(",")})
      VALUES (${Array(14).fill("?").join(",")})`);
    insert.run("gpt-5.6-sol%", "Sol", 5, 0.5, 6.25, 30, 10, 1, 12.5, 45, 10, 1, 12.5, 60);
    insert.run("gpt-5.6-terra%", "Custom Terra", 77, 0.2, 2.5, 12, 4, 0.4, 5, 18, 4, 0.4, 5, 24);
    legacy.close();
    const run = (edit = false) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            "-e",
            `
      const {db,stmts}=require(${JSON.stringify(require.resolve("../db"))});
      const result=stmts.listGptPricing.all();
      ${edit ? 'stmts.setGptFastLongPricing.run(0,0,0,0,"gpt-5.6-sol%");' : ""}
      console.log(JSON.stringify(result)); db.close();
    `,
          ],
          {
            env: { ...process.env, DASHBOARD_DB_PATH: file, DASHBOARD_DATA_DIR: tmp },
            encoding: "utf8",
          }
        ).trim()
      );
    const first = run(true);
    assert.equal(first.find((r) => r.model_pattern === "gpt-5.6-sol%").short_input_per_mtok, 4);
    assert.equal(
      first.find((r) => r.model_pattern === "gpt-5.6-sol%").fast_long_output_per_mtok,
      60
    );
    assert.equal(first.find((r) => r.model_pattern === "gpt-5.6-terra%").short_input_per_mtok, 77);
    assert.equal(
      first.find((r) => r.model_pattern === "gpt-5.6-terra%").fast_long_output_per_mtok,
      24
    );
    const second = run();
    assert.equal(
      second.find((r) => r.model_pattern === "gpt-5.6-sol%").fast_long_output_per_mtok,
      0
    );
  });
});

describe("pricing pattern syntax", () => {
  it("treats regex punctuation literally and only expands percent wildcards", () => {
    const rule = { model_pattern: "fixture.model[1m]%", input_per_mtok: 7 };
    const priced = calculateCost(
      [bucket("fixture.model[1m]-snapshot", { input_tokens: 1e6 })],
      [rule]
    );
    assert.equal(priced.total_cost, 7);
    const unmatched = calculateCost(
      [bucket("fixtureXmodelm-snapshot", { input_tokens: 1e6 })],
      [rule]
    );
    assert.equal(unmatched.total_cost, 0);
    assert.equal(unmatched.unpriced_models.length, 1);
  });
});
