/**
 * @file Tests for the long-prompt rate tier (Claude Haiku 5.5: $0.10/$0.50 up to
 * 100K prompt tokens, $0.50/$2.50 above). Covers the whole path: per-request
 * context classification, the live and importer parsers, rate math, the
 * PUT /api/pricing contract for the long_* columns, the additive migration, and
 * the one-time re-split of sessions stored before the dimension existed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `long-context-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", "-tmp-proj");
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
fs.mkdirSync(process.env.DASHBOARD_DATA_DIR, { recursive: true });
process.env.DASHBOARD_DB_PATH = path.join(process.env.DASHBOARD_DATA_DIR, "dashboard.db");

const dbModule = require("../db");
const { db, stmts } = dbModule;
const { createApp, startServer, repairLongContextTokenTotals } = require("../index");
const { calculateCost } = require("../routes/pricing");
const TranscriptCache = require("../lib/transcript-cache");
const { contextSizeFor } = require("../lib/token-usage");
const { parseSessionFile } = require("../../scripts/import-history");

const HAIKU = "claude-haiku-5-5";
const DATA_DIR = path.dirname(dbModule.DB_PATH);
const V2_MARKER = path.join(DATA_DIR, ".token-repair-v2.done");
const LONG_MARKER = path.join(DATA_DIR, ".token-repair-long-context-v1.done");

let server;
let BASE;

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ── Fixture: one session, three Haiku 5.5 requests ───────────────────────────
const SHORT_USAGE = {
  input_tokens: 10,
  output_tokens: 300,
  cache_read_input_tokens: 40000,
  cache_creation_input_tokens: 5000, // prompt 45,010 → short
};
const LONG_USAGE = {
  input_tokens: 20,
  output_tokens: 500,
  cache_read_input_tokens: 120000,
  cache_creation_input_tokens: 10000, // prompt 130,020 → long
};
// One API response written as two records: streaming flushes partial usage
// first (prompt 60,005 → short), the final record is authoritative (150,005 →
// long). The partial contribution must be retracted from the short bucket.
const STREAM_PARTIAL = { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 60000 };
const STREAM_FINAL = { input_tokens: 5, output_tokens: 400, cache_read_input_tokens: 150000 };

const EXPECTED_SHORT = { input: 10, output: 300, cacheRead: 40000, cacheWrite: 5000 };
const EXPECTED_LONG = { input: 25, output: 900, cacheRead: 270000, cacheWrite: 10000 };

function assistantLine(model, msgId, usage) {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-10-20T10:00:00.000Z",
    cwd: "/tmp/proj",
    message: { id: msgId, model, usage, content: [{ type: "text", text: "x" }] },
  });
}

function haikuTranscript() {
  return (
    [
      assistantLine(HAIKU, "msg_short", SHORT_USAGE),
      assistantLine(HAIKU, "msg_long", LONG_USAGE),
      assistantLine(HAIKU, "msg_stream", STREAM_PARTIAL),
      assistantLine(HAIKU, "msg_stream", STREAM_FINAL),
    ].join("\n") + "\n"
  );
}

function bucketsByCtx(tokensByModel) {
  const out = {};
  for (const b of Object.values(tokensByModel)) out[b.ctx] = b;
  return out;
}

function pick(bucket, fields) {
  return Object.fromEntries(fields.map((f) => [f, bucket[f]]));
}

describe("contextSizeFor", () => {
  it("splits a long-tier model at exactly the 100K prompt limit", () => {
    assert.equal(contextSizeFor(HAIKU, { input: 100000 }), "short");
    assert.equal(contextSizeFor(HAIKU, { input: 100001 }), "long");
  });

  it("counts fresh input, cache reads and cache writes toward the prompt size", () => {
    assert.equal(contextSizeFor(HAIKU, { input: 1, cacheRead: 50000, cacheWrite: 49999 }), "short");
    assert.equal(contextSizeFor(HAIKU, { input: 1, cacheRead: 50000, cacheWrite: 50000 }), "long");
    // Output tokens are not part of the prompt.
    assert.equal(contextSizeFor(HAIKU, { input: 1, output: 900000 }), "short");
  });

  it("matches dated and suffixed model ids", () => {
    assert.equal(contextSizeFor("claude-haiku-5-5-20261001", { input: 200000 }), "long");
    assert.equal(contextSizeFor("claude-haiku-5-5[1m]", { input: 200000 }), "long");
  });

  it("never marks a model without a long tier as long", () => {
    for (const model of ["claude-opus-4-8", "claude-haiku-4-5", "claude-sonnet-5-5"]) {
      assert.equal(contextSizeFor(model, { input: 900000 }), "short", model);
    }
    assert.equal(contextSizeFor(undefined, { input: 900000 }), "short");
  });
});

describe("parsers split a long-tier model's usage by prompt size", () => {
  const FIELDS = ["input", "output", "cacheRead", "cacheWrite"];

  it("TranscriptCache.extract keeps short and long requests in separate buckets", () => {
    const file = path.join(TMP_ROOT, "cache-haiku.jsonl");
    fs.writeFileSync(file, haikuTranscript());
    const result = new TranscriptCache().extract(file);
    const byCtx = bucketsByCtx(result.tokensByModel);
    assert.deepEqual(Object.keys(byCtx).sort(), ["long", "short"]);
    assert.deepEqual(pick(byCtx.short, FIELDS), EXPECTED_SHORT);
    assert.deepEqual(pick(byCtx.long, FIELDS), EXPECTED_LONG);
  });

  it("TranscriptCache merges incremental parses without mixing contexts", () => {
    const file = path.join(TMP_ROOT, "cache-haiku-incr.jsonl");
    const lines = haikuTranscript().trim().split("\n");
    fs.writeFileSync(file, lines.slice(0, 3).join("\n") + "\n");
    const cache = new TranscriptCache();
    cache.extract(file);
    // Append the streaming message's final record: it moves from short to long.
    fs.appendFileSync(file, lines[3] + "\n");
    const byCtx = bucketsByCtx(cache.extract(file).tokensByModel);
    assert.deepEqual(pick(byCtx.short, FIELDS), EXPECTED_SHORT);
    assert.deepEqual(pick(byCtx.long, FIELDS), EXPECTED_LONG);
  });

  it("the history importer produces the same split", async () => {
    const file = path.join(TMP_ROOT, "import-haiku.jsonl");
    fs.writeFileSync(file, haikuTranscript());
    const session = await parseSessionFile(file);
    const byCtx = bucketsByCtx(session.tokensByModel);
    assert.deepEqual(pick(byCtx.short, FIELDS), EXPECTED_SHORT);
    assert.deepEqual(pick(byCtx.long, FIELDS), EXPECTED_LONG);
  });

  it("leaves other models in a single short bucket regardless of prompt size", () => {
    const file = path.join(TMP_ROOT, "cache-opus.jsonl");
    fs.writeFileSync(file, assistantLine("claude-opus-4-8", "msg_big", LONG_USAGE) + "\n");
    const buckets = Object.values(new TranscriptCache().extract(file).tokensByModel);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].ctx, "short");
  });
});

describe("rate math", () => {
  const rules = () => stmts.listPricing.all();
  const bucket = (model, extra = {}) => ({
    model,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    ...extra,
  });
  const price = (model, field, context_size) =>
    calculateCost(
      [
        bucket(model, {
          context_size,
          [field]: 1e6,
          ...(field === "cache_write_1h_tokens" ? { cache_write_tokens: 1e6 } : {}),
        }),
      ],
      rules(),
      "2026-10-20"
    );
  const FIELDS = [
    "input_tokens",
    "output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "cache_write_1h_tokens",
  ];

  it("prices short requests on the <=100K card", () => {
    const expected = [0.1, 0.5, 0.01, 0.125, 0.2];
    FIELDS.forEach((f, i) => assert.equal(price(HAIKU, f, "short").total_cost, expected[i], f));
  });

  it("prices long requests on the >100K card, cache rates scaled with the input base", () => {
    const expected = [0.5, 2.5, 0.05, 0.625, 1];
    FIELDS.forEach((f, i) => assert.equal(price(HAIKU, f, "long").total_cost, expected[i], f));
  });

  it("treats rows without a context_size as short", () => {
    assert.equal(price(HAIKU, "input_tokens", undefined).total_cost, 0.1);
  });

  it("bills standard rates for a rule that has no long tier", () => {
    assert.equal(price("claude-opus-4-8", "input_tokens", "long").total_cost, 5);
  });

  it("keeps one breakdown entry per model across both contexts", () => {
    const result = calculateCost(
      [
        bucket(HAIKU, { context_size: "short", input_tokens: 1e6 }),
        bucket(HAIKU, { context_size: "long", input_tokens: 1e6 }),
      ],
      rules(),
      "2026-10-20"
    );
    assert.equal(result.total_cost, 0.6);
    assert.equal(result.breakdown.length, 1);
    assert.equal(result.breakdown[0].input_tokens, 2e6);
  });
});

describe("PUT /api/pricing long-tier rates", () => {
  const PATTERN = "test-long-model%";
  const put = (body) => request("/api/pricing", { method: "PUT", body });
  const base = { model_pattern: PATTERN, display_name: "Test Long", input_per_mtok: 1 };

  after(() => {
    stmts.deletePricing.run(PATTERN);
  });

  it("seeds the Haiku 5.5 long tier by default", () => {
    const row = stmts.getPricing.get("claude-haiku-5-5%");
    assert.equal(row.long_input_per_mtok, 0.5);
    assert.equal(row.long_output_per_mtok, 2.5);
  });

  it("stores long rates when sent and preserves them when a later PUT omits them", async () => {
    let res = await put({ ...base, long_input_per_mtok: 4, long_output_per_mtok: 8 });
    assert.equal(res.status, 200);
    assert.equal(res.body.pricing.long_input_per_mtok, 4);
    assert.equal(res.body.pricing.long_output_per_mtok, 8);

    res = await put({ ...base, input_per_mtok: 2 });
    assert.equal(res.status, 200);
    assert.equal(res.body.pricing.input_per_mtok, 2);
    assert.equal(res.body.pricing.long_input_per_mtok, 4, "omitted long rates must be kept");
    assert.equal(res.body.pricing.long_output_per_mtok, 8);
  });

  it("clears the tier when explicit zeros are sent", async () => {
    const res = await put({ ...base, long_input_per_mtok: 0, long_output_per_mtok: 0 });
    assert.equal(res.body.pricing.long_input_per_mtok, 0);
    assert.equal(res.body.pricing.long_output_per_mtok, 0);
  });

  it("rejects a negative or non-numeric long rate and writes nothing", async () => {
    for (const bad of [-1, "abc"]) {
      const res = await put({ ...base, long_input_per_mtok: bad });
      assert.equal(res.status, 400, String(bad));
    }
  });

  it("reset-to-defaults restores the Haiku 5.5 long tier", async () => {
    stmts.setLongPricing.run(0, 0, "claude-haiku-5-5%");
    const res = await request("/api/settings/reset-pricing", {
      method: "POST",
      body: { provider: "claude" },
    });
    assert.equal(res.status, 200);
    const row = res.body.pricing.find((r) => r.model_pattern === "claude-haiku-5-5%");
    assert.equal(row.long_input_per_mtok, 0.5);
    assert.equal(row.long_output_per_mtok, 2.5);
  });
});

describe("pre-upgrade database", () => {
  it("adds the long columns, backfills Haiku 5.5, and keeps user-edited long rates", () => {
    const { DatabaseSync } = require("node:sqlite");
    const { execFileSync } = require("node:child_process");
    const file = path.join(TMP_ROOT, "legacy.db");
    const run = () =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            "-e",
            `const {db,stmts}=require(${JSON.stringify(require.resolve("../db"))});
             console.log(JSON.stringify(stmts.getPricing.get("claude-haiku-5-5%"))); db.close();`,
          ],
          {
            env: { ...process.env, DASHBOARD_DB_PATH: file, DASHBOARD_DATA_DIR: TMP_ROOT },
            encoding: "utf8",
          }
        ).trim()
      );

    assert.equal(run().long_input_per_mtok, 0.5, "fresh database gets the default");

    // Downgrade the schema to what an older release created.
    let legacy = new DatabaseSync(file);
    legacy.exec("ALTER TABLE model_pricing DROP COLUMN long_input_per_mtok");
    legacy.exec("ALTER TABLE model_pricing DROP COLUMN long_output_per_mtok");
    legacy.close();
    const upgraded = run();
    assert.equal(upgraded.long_input_per_mtok, 0.5);
    assert.equal(upgraded.long_output_per_mtok, 2.5);

    // A rate the user edited must survive later restarts.
    legacy = new DatabaseSync(file);
    legacy
      .prepare(
        "UPDATE model_pricing SET long_input_per_mtok = 0.7, long_output_per_mtok = 3 WHERE model_pattern = ?"
      )
      .run("claude-haiku-5-5%");
    legacy.close();
    const edited = run();
    assert.equal(edited.long_input_per_mtok, 0.7);
    assert.equal(edited.long_output_per_mtok, 3);
  });
});

describe("one-time long-context token repair", () => {
  const HAIKU_SID = "long-ctx-haiku";
  const OPUS_SID = "long-ctx-opus";

  function seedSession(sessionId, lines) {
    try {
      stmts.insertSession.run(sessionId, "t", "completed", "/tmp/proj", null, null);
    } catch {
      /* already present */
    }
    fs.writeFileSync(path.join(PROJECT_DIR, `${sessionId}.jsonl`), lines);
  }

  /** What the pre-upgrade release stored: every Haiku request in one short row. */
  function seedLegacyRows() {
    db.prepare("DELETE FROM token_usage WHERE session_id IN (?, ?)").run(HAIKU_SID, OPUS_SID);
    seedSession(HAIKU_SID, haikuTranscript());
    stmts.replaceTokenUsage.run(
      HAIKU_SID,
      HAIKU,
      "standard",
      "global",
      "standard",
      "short",
      EXPECTED_SHORT.input + EXPECTED_LONG.input,
      EXPECTED_SHORT.output + EXPECTED_LONG.output,
      EXPECTED_SHORT.cacheRead + EXPECTED_LONG.cacheRead,
      EXPECTED_SHORT.cacheWrite + EXPECTED_LONG.cacheWrite,
      0,
      0,
      0,
      0
    );
    // A folded baseline from an earlier re-parse: the repair must zero it.
    db.prepare(
      "UPDATE token_usage SET baseline_cache_read = 999 WHERE session_id = ? AND model = ?"
    ).run(HAIKU_SID, HAIKU);

    seedSession(OPUS_SID, assistantLine("claude-opus-4-8", "msg_o", LONG_USAGE) + "\n");
    stmts.replaceTokenUsage.run(
      OPUS_SID,
      "claude-opus-4-8",
      "standard",
      "global",
      "standard",
      "short",
      1,
      2,
      3,
      4,
      0,
      0,
      0,
      0
    );
    db.prepare("UPDATE token_usage SET baseline_output = 7 WHERE session_id = ?").run(OPUS_SID);
  }

  function rows(sessionId) {
    return db
      .prepare(
        `SELECT model, context_size, input_tokens, output_tokens, cache_read_tokens,
                cache_write_tokens, baseline_cache_read, baseline_output
           FROM token_usage WHERE session_id = ? ORDER BY context_size`
      )
      .all(sessionId);
  }

  /** The repair is deferred; drive its timer without waiting in real time. */
  async function runRepairNow() {
    const realSetTimeout = global.setTimeout;
    const pending = [];
    global.setTimeout = (fn) => {
      pending.push(fn);
      return { unref() {} };
    };
    try {
      repairLongContextTokenTotals();
    } finally {
      global.setTimeout = realSetTimeout;
    }
    for (const fn of pending) fn();
    await new Promise((resolve) => realSetTimeout(resolve, 300));
  }

  const clear = (file) => {
    try {
      fs.unlinkSync(file);
    } catch {
      /* absent */
    }
  };

  beforeEach(() => {
    clear(LONG_MARKER);
    fs.writeFileSync(V2_MARKER, "done\n");
    db.exec("DROP TABLE IF EXISTS token_usage_pre_long_context_v1");
    seedLegacyRows();
  });

  it("re-splits an existing Haiku 5.5 session and zeroes its baselines", async () => {
    await runRepairNow();

    const [long, short] = rows(HAIKU_SID);
    assert.equal(long.context_size, "long");
    assert.equal(short.context_size, "short");
    assert.deepEqual(
      {
        input: short.input_tokens,
        output: short.output_tokens,
        cacheRead: short.cache_read_tokens,
        cacheWrite: short.cache_write_tokens,
      },
      EXPECTED_SHORT
    );
    assert.deepEqual(
      {
        input: long.input_tokens,
        output: long.output_tokens,
        cacheRead: long.cache_read_tokens,
        cacheWrite: long.cache_write_tokens,
      },
      EXPECTED_LONG
    );
    assert.equal(short.baseline_cache_read, 0, "the folded baseline must not survive");
    assert.equal(long.baseline_cache_read, 0);
  });

  it("does not double-count: the session total equals the transcript total", async () => {
    await runRepairNow();
    const total = stmts.getTokensBySession
      .all(HAIKU_SID)
      .reduce((sum, r) => sum + r.cache_read_tokens, 0);
    assert.equal(total, EXPECTED_SHORT.cacheRead + EXPECTED_LONG.cacheRead);
  });

  it("prices the repaired session on both cards", async () => {
    await runRepairNow();
    const res = await request(`/api/pricing/cost/${HAIKU_SID}`);
    const m = (n, rate) => (n / 1e6) * rate;
    const expected =
      m(EXPECTED_SHORT.input, 0.1) +
      m(EXPECTED_SHORT.output, 0.5) +
      m(EXPECTED_SHORT.cacheRead, 0.01) +
      m(EXPECTED_SHORT.cacheWrite, 0.125) +
      m(EXPECTED_LONG.input, 0.5) +
      m(EXPECTED_LONG.output, 2.5) +
      m(EXPECTED_LONG.cacheRead, 0.05) +
      m(EXPECTED_LONG.cacheWrite, 0.625);
    assert.equal(res.body.total_cost, Math.round(expected * 1e4) / 1e4);
    assert.deepEqual(res.body.unpriced_models, []);
  });

  it("leaves sessions of models without a long tier untouched", async () => {
    const before = rows(OPUS_SID);
    await runRepairNow();
    assert.deepEqual(rows(OPUS_SID), before);
    assert.equal(before[0].baseline_output, 7);
  });

  it("snapshots the pre-repair rows and writes a marker that stops reruns", async () => {
    await runRepairNow();
    const snap = db
      .prepare("SELECT cache_read_tokens FROM token_usage_pre_long_context_v1 WHERE session_id = ?")
      .get(HAIKU_SID);
    assert.equal(snap.cache_read_tokens, EXPECTED_SHORT.cacheRead + EXPECTED_LONG.cacheRead);
    assert.ok(fs.existsSync(LONG_MARKER), "marker must be written after a completed pass");

    seedLegacyRows();
    await runRepairNow();
    assert.equal(rows(HAIKU_SID).length, 1, "a second run must be a no-op");
  });

  it("waits for the v2 repair and honours DASHBOARD_TOKEN_REPAIR=0", async () => {
    clear(V2_MARKER);
    await runRepairNow();
    assert.equal(rows(HAIKU_SID).length, 1, "must not run before the v2 repair has");
    assert.ok(!fs.existsSync(LONG_MARKER));

    fs.writeFileSync(V2_MARKER, "done\n");
    process.env.DASHBOARD_TOKEN_REPAIR = "0";
    try {
      await runRepairNow();
    } finally {
      delete process.env.DASHBOARD_TOKEN_REPAIR;
    }
    assert.equal(rows(HAIKU_SID).length, 1, "opt-out must skip the repair");
    assert.ok(!fs.existsSync(LONG_MARKER));
  });
});
