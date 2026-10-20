/**
 * @file Tests for splitting token usage by the Claude Code version that made
 * each request, so a version-gated intro rate (Sonnet 5.5's cache read: $0.20
 * through Claude Code 2.1.295, $0.10 from 2.1.296) prices a session resumed
 * across releases message by message instead of by the session's first
 * version. Covers both transcript parsers, writeTokenBuckets' high-water mark
 * across a bucket's version rows (folding a pre-version '' row without
 * counting it twice), the startup re-split, the cost endpoints, and the schema
 * migration on a pre-upgrade database.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `token-cc-version-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", "-tmp-token-cc-version");
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const TranscriptCache = require("../lib/transcript-cache");
const { writeTokenBuckets, emptyBucket, compareCcVersions } = require("../lib/token-usage");
const { agentOwnCost } = require("../routes/pricing");
const { parseSessionFile, reconcileTokens } = require("../../scripts/import-history");

const SONNET = "claude-sonnet-5-5";
const MTOK = 1_000_000;

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

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get(new URL(urlPath, BASE), (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
      })
      .on("error", reject);
  });
}

/** One Sonnet 5.5 response of `cacheRead` cache-read tokens, written by `version`. */
const assistantLine = (id, version, cacheRead = MTOK) =>
  JSON.stringify({
    type: "assistant",
    version,
    timestamp: "2026-10-10T10:00:00.000Z",
    message: {
      id,
      model: SONNET,
      usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: cacheRead },
      content: [{ type: "text", text: "x" }],
    },
  });

function writeTranscript(sessionId, lines) {
  const p = path.join(PROJECT_DIR, `${sessionId}.jsonl`);
  fs.writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

function seedSession(id, { version, startedAt = "2026-10-10T09:00:00.000Z" } = {}) {
  stmts.insertSession.run(
    id,
    "t",
    "completed",
    "/tmp/token-cc-version",
    SONNET,
    version ? JSON.stringify({ version }) : null
  );
  db.prepare("UPDATE sessions SET started_at = ? WHERE id = ?").run(startedAt, id);
}

/** The session's rows as `{version: [live cache_read, baseline cache_read]}`. */
function cacheReadRows(sessionId) {
  const out = {};
  for (const r of db
    .prepare(
      "SELECT cc_version, cache_read_tokens, baseline_cache_read FROM token_usage WHERE session_id = ?"
    )
    .all(sessionId)) {
    out[r.cc_version] = [r.cache_read_tokens, r.baseline_cache_read];
  }
  return out;
}

const cacheReads = (version, n) => ({
  ...emptyBucket(SONNET, "standard", "global", "standard", "short", version),
  cacheRead: n,
});

function legacyRow(sessionId, cacheRead) {
  stmts.replaceTokenUsage.run(
    sessionId,
    SONNET,
    "standard",
    "global",
    "standard",
    "short",
    0,
    0,
    cacheRead,
    0,
    0,
    0,
    0,
    0
  );
}

describe("transcript parsers split usage by Claude Code version", () => {
  const lines = [
    assistantLine("m1", "2.1.286"),
    assistantLine("m2", "2.1.296"),
    assistantLine("m3", "2.1.296"),
  ];

  const byVersion = (tokensByModel) =>
    Object.fromEntries(Object.values(tokensByModel).map((b) => [b.ccVersion, b.cacheRead]));

  it("TranscriptCache keys each message by its own version, across an incremental read", () => {
    const p = writeTranscript("split-cache", lines.slice(0, 1));
    const cache = new TranscriptCache();
    assert.deepEqual(byVersion(cache.extract(p).tokensByModel), { "2.1.286": MTOK });
    fs.appendFileSync(p, lines.slice(1).join("\n") + "\n");
    assert.deepEqual(byVersion(cache.extract(p).tokensByModel), {
      "2.1.286": MTOK,
      "2.1.296": 2 * MTOK,
    });
  });

  it("the importer's parser splits the same way", async () => {
    const parsed = await parseSessionFile(writeTranscript("split-import", lines));
    assert.deepEqual(byVersion(parsed.tokensByModel), {
      "2.1.286": MTOK,
      "2.1.296": 2 * MTOK,
    });
  });

  it("entries without a dotted-number version stay unsplit ('')", () => {
    const p = writeTranscript("split-none", [
      assistantLine("n1", undefined),
      assistantLine("n2", "not-a-version"),
    ]);
    assert.deepEqual(byVersion(new TranscriptCache().extract(p).tokensByModel), {
      "": 2 * MTOK,
    });
  });
});

describe("writeTokenBuckets", () => {
  it("with one version, matches replaceTokenUsage's high-water mark", () => {
    seedSession("wtb-single");
    seedSession("wtb-single-ref");
    for (const n of [100, 60, 130]) {
      writeTokenBuckets(stmts, "wtb-single", [cacheReads("", n)]);
      legacyRow("wtb-single-ref", n);
    }
    assert.deepEqual(cacheReadRows("wtb-single"), cacheReadRows("wtb-single-ref"));
    assert.deepEqual(cacheReadRows("wtb-single"), { "": [130, 0] });
  });

  it("folds a pre-version row into versioned rows without counting it twice", () => {
    seedSession("wtb-fold");
    // Before the split: 2M transcript cache reads plus a 1M cost-state top-up.
    legacyRow("wtb-fold", 2 * MTOK);
    stmts.addTokenUsageBaseline.run(
      "wtb-fold",
      SONNET,
      "standard",
      "global",
      "standard",
      "short",
      "",
      0,
      0,
      MTOK,
      0,
      0,
      0
    );

    writeTokenBuckets(stmts, "wtb-fold", [
      cacheReads("2.1.296", MTOK),
      cacheReads("2.1.286", MTOK),
    ]);
    assert.deepEqual(
      cacheReadRows("wtb-fold"),
      { "2.1.286": [MTOK, MTOK / 2], "2.1.296": [MTOK, MTOK / 2] },
      "the transcript's split is stored as is; the extra is shared by each version's usage"
    );

    // A narrower writer (fewer tokens than stored) keeps the bucket total.
    writeTokenBuckets(stmts, "wtb-fold", [
      cacheReads("2.1.286", MTOK / 2),
      cacheReads("2.1.296", MTOK),
    ]);
    assert.deepEqual(cacheReadRows("wtb-fold"), {
      "2.1.286": [MTOK / 2, MTOK / 2],
      "2.1.296": [MTOK, MTOK],
    });
  });

  it("shares the extra out in whole tokens that sum exactly", () => {
    seedSession("wtb-round");
    legacyRow("wtb-round", 10);
    writeTokenBuckets(stmts, "wtb-round", [cacheReads("2.1.286", 1), cacheReads("2.1.296", 2)]);
    assert.deepEqual(cacheReadRows("wtb-round"), { "2.1.286": [1, 2], "2.1.296": [2, 5] });
  });

  it("puts extra of a field no version recorded on the latest version", () => {
    seedSession("wtb-latest");
    stmts.addTokenUsageBaseline.run(
      "wtb-latest",
      SONNET,
      "standard",
      "global",
      "standard",
      "short",
      "",
      0,
      0,
      0,
      0,
      0,
      3
    );
    writeTokenBuckets(stmts, "wtb-latest", [cacheReads("2.1.286", 1), cacheReads("2.1.296", 1)]);
    const searches = db
      .prepare(
        "SELECT cc_version, baseline_web_search FROM token_usage WHERE session_id = 'wtb-latest'"
      )
      .all();
    assert.deepEqual(searches, [
      { cc_version: "2.1.286", baseline_web_search: 0 },
      { cc_version: "2.1.296", baseline_web_search: 3 },
    ]);
  });

  it("reset writes the live counts as the whole truth", () => {
    seedSession("wtb-reset");
    legacyRow("wtb-reset", 5 * MTOK);
    writeTokenBuckets(stmts, "wtb-reset", [cacheReads("2.1.296", MTOK)], { reset: true });
    assert.deepEqual(cacheReadRows("wtb-reset"), { "2.1.296": [MTOK, 0] });
  });

  it("orders versions numerically, unknown first", () => {
    assert.deepEqual(["2.1.100", "", "2.1.99", "2.0.500"].sort(compareCcVersions), [
      "",
      "2.0.500",
      "2.1.99",
      "2.1.100",
    ]);
  });
});

describe("startup re-split of pre-version rows", () => {
  it("splits a session resumed across 2.1.296 by version, keeping its totals", async () => {
    const SID = "40000000-0000-0000-0000-000000000001";
    seedSession(SID, { version: "2.1.286" });
    db.prepare("UPDATE sessions SET transcript_path = ? WHERE id = ?").run(
      writeTranscript(SID, [assistantLine("r1", "2.1.286"), assistantLine("r2", "2.1.296")]),
      SID
    );
    legacyRow(SID, 2 * MTOK);
    assert.equal((await get(`/api/pricing/cost/${SID}`)).body.total_cost, 0.4);

    await reconcileTokens(dbModule, { all: true, sessionIds: [SID] });
    assert.deepEqual(cacheReadRows(SID), { "2.1.286": [MTOK, 0], "2.1.296": [MTOK, 0] });
    assert.equal(
      (await get(`/api/pricing/cost/${SID}`)).body.total_cost,
      0.3,
      "$0.20 for the 2.1.286 message, $0.10 for the 2.1.296 one"
    );
  });
});

describe("cost endpoints price each row by its own version", () => {
  it("per-session cost, the sessions list, and the global total agree", async () => {
    // Resumed across the repricing: one message on each side of it.
    seedSession("cost-mixed", { version: "2.1.286" });
    writeTokenBuckets(stmts, "cost-mixed", [
      cacheReads("2.1.286", MTOK),
      cacheReads("2.1.296", MTOK),
    ]);
    // Unsplit rows on the same day price by their own session's version; the
    // global total must not merge them into one group.
    seedSession("cost-legacy-old", { version: "2.1.286" });
    legacyRow("cost-legacy-old", MTOK);
    seedSession("cost-legacy-new", { version: "2.1.296" });
    legacyRow("cost-legacy-new", MTOK);

    const expected = { "cost-mixed": 0.3, "cost-legacy-old": 0.2, "cost-legacy-new": 0.1 };
    for (const [id, cost] of Object.entries(expected)) {
      assert.equal((await get(`/api/pricing/cost/${id}`)).body.total_cost, cost, id);
    }
    const list = (await get("/api/sessions?limit=500")).body.sessions;
    for (const [id, cost] of Object.entries(expected)) {
      assert.equal(list.find((s) => s.id === id).cost, cost, `${id} in the list`);
    }
    const listTotal = list.reduce((sum, s) => sum + (s.cost || 0), 0);
    const global = (await get("/api/pricing/cost")).body.total_cost;
    assert.ok(Math.abs(global - listTotal) < 1e-6, `global ${global} = list ${listTotal}`);
  });

  it("a subagent's own cost uses its rows' versions, else the session's", () => {
    const rules = stmts.listPricing.all();
    const agent = (ccVersion) => ({
      started_at: "2026-10-10T10:00:00.000Z",
      metadata: JSON.stringify({
        tokens: [
          {
            model: SONNET,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: MTOK,
            cache_write_tokens: 0,
            cache_write_1h_tokens: 0,
            cc_version: ccVersion,
          },
        ],
      }),
    });
    assert.equal(agentOwnCost(agent("2.1.296"), rules, "2.1.286"), 0.1);
    assert.equal(agentOwnCost(agent(""), rules, "2.1.286"), 0.2);
  });
});

describe("pre-upgrade database", () => {
  it("rebuilds token_usage with cc_version in the key, keeping every row as ''", () => {
    const { DatabaseSync } = require("node:sqlite");
    const { execFileSync } = require("node:child_process");
    const file = path.join(TMP_ROOT, "legacy.db");
    const run = (script) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          ["-e", `const {db}=require(${JSON.stringify(require.resolve("../db"))}); ${script}`],
          {
            env: { ...process.env, DASHBOARD_DB_PATH: file, DASHBOARD_DATA_DIR: TMP_ROOT },
            encoding: "utf8",
          }
        ).trim()
      );
    run("console.log('{}'); db.close();");

    // Downgrade token_usage to what an older release created, with one row.
    const legacy = new DatabaseSync(file);
    legacy.exec("PRAGMA foreign_keys = OFF");
    legacy.exec(`
      DROP TABLE token_usage;
      CREATE TABLE token_usage (
        session_id TEXT NOT NULL, model TEXT NOT NULL DEFAULT 'unknown',
        speed TEXT NOT NULL DEFAULT 'standard', inference_geo TEXT NOT NULL DEFAULT 'global',
        service_tier TEXT NOT NULL DEFAULT 'standard',
        context_size TEXT NOT NULL DEFAULT 'short' CHECK(context_size IN ('short','long')),
        input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
        web_search_requests INTEGER NOT NULL DEFAULT 0, web_fetch_requests INTEGER NOT NULL DEFAULT 0,
        code_execution_requests INTEGER NOT NULL DEFAULT 0,
        baseline_input INTEGER NOT NULL DEFAULT 0, baseline_output INTEGER NOT NULL DEFAULT 0,
        baseline_cache_read INTEGER NOT NULL DEFAULT 0, baseline_cache_write INTEGER NOT NULL DEFAULT 0,
        baseline_cache_write_1h INTEGER NOT NULL DEFAULT 0, baseline_web_search INTEGER NOT NULL DEFAULT 0,
        baseline_web_fetch INTEGER NOT NULL DEFAULT 0, baseline_code_execution INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (session_id, model, speed, inference_geo, service_tier, context_size),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      INSERT INTO sessions (id, name, status) VALUES ('legacy-s', 't', 'completed');
      INSERT INTO token_usage (session_id, model, cache_read_tokens, baseline_cache_read)
        VALUES ('legacy-s', '${SONNET}', 700, 300);
    `);
    legacy.close();

    const after = run(`console.log(JSON.stringify({
      rows: db.prepare("SELECT cc_version, cache_read_tokens, baseline_cache_read FROM token_usage").all(),
      key: db.prepare("PRAGMA table_info(token_usage)").all().filter((c) => c.pk).map((c) => c.name),
    })); db.close();`);
    assert.deepEqual(after.rows, [
      { cc_version: "", cache_read_tokens: 700, baseline_cache_read: 300 },
    ]);
    assert.deepEqual(after.key, [
      "session_id",
      "model",
      "speed",
      "inference_geo",
      "service_tier",
      "context_size",
      "cc_version",
    ]);
  });
});
