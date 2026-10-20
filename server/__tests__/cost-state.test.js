/**
 * @file Tests for reconciling token totals against Claude's own `cost-state`
 * record (server/lib/cost-state.js).
 *
 * Claude Code bills API calls that never produce a transcript message — the
 * `/compact` summarisation request and the secondary-model (Haiku) call WebFetch
 * runs over each fetched page — so totals derived from assistant `usage` alone
 * run a few percent below Claude's. The `cost-state` entry it appends on save
 * carries the authoritative per-model totals.
 *
 * Covers: parsing the entry, the pure top-up arithmetic (raise only, never
 * lower), applying it to stored rows (idempotent, session-scoped, survives the
 * high-water fold of later transcript growth), TranscriptCache capture (full and
 * incremental reads), the live hook path, and the reconcile sweep including the
 * `costStateOnly` backfill mode.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `cost-state-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", "-tmp-cost-state");
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const TranscriptCache = require("../lib/transcript-cache");
const {
  parseCostStateEntry,
  modelMatchKey,
  computeCostStateTopUps,
  applyCostState,
} = require("../lib/cost-state");
const { parseSessionFile, reconcileTokens } = require("../../scripts/import-history");

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

const SONNET = "claude-sonnet-5-5";
const HAIKU = "claude-haiku-5-5";

// What the transcript's assistant messages add up to.
const TRANSCRIPT_USAGE = {
  input_tokens: 10,
  output_tokens: 100,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 200 },
};

// What Claude billed: the transcript totals plus a /compact request on Sonnet,
// and Haiku calls (WebFetch) that left no assistant message at all.
const COST_STATE_USAGE = {
  [SONNET]: {
    inputTokens: 30,
    outputTokens: 130,
    cacheReadInputTokens: 1150,
    cacheCreationInputTokens: 205,
    thinkingTokens: 60,
    webSearchRequests: 0,
    costUSD: 0.01,
  },
  [HAIKU]: {
    inputTokens: 500,
    outputTokens: 40,
    cacheReadInputTokens: 700,
    cacheCreationInputTokens: 30,
    thinkingTokens: 10,
    webSearchRequests: 0,
    costUSD: 0.01,
  },
};

function costStateLine(sessionId, modelUsage = COST_STATE_USAGE) {
  return JSON.stringify({ type: "cost-state", sessionId, totalCostUSD: 0.02, modelUsage });
}

function assistantLine(msgId, model = SONNET, usage = TRANSCRIPT_USAGE) {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-10-20T10:00:00.000Z",
    cwd: "/tmp/cost-state",
    message: { id: msgId, model, usage, content: [{ type: "text", text: "x" }] },
  });
}

function insertSession(id) {
  try {
    stmts.insertSession.run(id, "t", "active", "/tmp/cost-state", null, null);
  } catch {
    /* already present */
  }
}

function writeTranscript(sessionId, lines) {
  const p = path.join(PROJECT_DIR, `${sessionId}.jsonl`);
  fs.writeFileSync(p, lines.join("\n") + "\n");
  return p;
}

/** Effective (live + baseline) totals for one model, summed over its buckets. */
function effective(sessionId, model) {
  const sum = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 };
  for (const r of stmts.getTokensBySession.all(sessionId).filter((x) => x.model === model)) {
    sum.input += r.input_tokens;
    sum.output += r.output_tokens;
    sum.cacheRead += r.cache_read_tokens;
    sum.cacheWrite += r.cache_write_tokens;
    sum.cacheWrite1h += r.cache_write_1h_tokens;
  }
  return sum;
}

/** Store what the transcript-only parser would have written for the Sonnet message. */
function writeTranscriptOnlyRows(sessionId, scale = 1) {
  stmts.replaceTokenUsage.run(
    sessionId,
    SONNET,
    "standard",
    "global",
    "standard",
    "short",
    10 * scale,
    100 * scale,
    1000 * scale,
    200 * scale,
    200 * scale,
    0,
    0,
    0
  );
}

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = JSON.stringify(body);
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, body: b }));
      }
    );
    r.on("error", reject);
    r.write(payload);
    r.end();
  });
}

describe("parseCostStateEntry", () => {
  it("reads per-model totals and ignores thinkingTokens (a subset of output)", () => {
    const parsed = parseCostStateEntry(JSON.parse(costStateLine("s-1")));
    assert.equal(parsed.sessionId, "s-1");
    assert.deepEqual(parsed.models[SONNET], {
      input: 30,
      output: 130,
      cacheRead: 1150,
      cacheWrite: 205,
      webSearch: 0,
    });
    assert.equal(parsed.models[HAIKU].input, 500);
  });

  it("returns null for anything that is not a usable cost-state record", () => {
    assert.equal(parseCostStateEntry(null), null);
    assert.equal(parseCostStateEntry({ type: "assistant" }), null);
    assert.equal(parseCostStateEntry({ type: "cost-state" }), null);
    assert.equal(parseCostStateEntry({ type: "cost-state", modelUsage: {} }), null);
    assert.equal(parseCostStateEntry({ type: "cost-state", modelUsage: { m: "x" } }), null);
  });

  it("coerces junk counts to zero instead of propagating NaN or negatives", () => {
    const parsed = parseCostStateEntry({
      type: "cost-state",
      modelUsage: { m: { inputTokens: -5, outputTokens: "7", cacheReadInputTokens: NaN } },
    });
    assert.deepEqual(parsed.models.m, {
      input: 0,
      output: 7,
      cacheRead: 0,
      cacheWrite: 0,
      webSearch: 0,
    });
  });
});

describe("modelMatchKey", () => {
  it("ignores case, a context-window tag, and a snapshot date", () => {
    assert.equal(modelMatchKey("Claude-Opus-4-5-20251101"), "claude-opus-4-5");
    assert.equal(modelMatchKey("claude-sonnet-4-5[1m]"), "claude-sonnet-4-5");
    assert.equal(modelMatchKey(SONNET), SONNET);
  });

  it("treats Bedrock and Vertex spellings of a model as the same model", () => {
    const key = "claude-haiku-4-5";
    assert.equal(modelMatchKey("claude-haiku-4-5-20251001"), key);
    assert.equal(modelMatchKey("anthropic.claude-haiku-4-5-20251001-v1:0"), key);
    assert.equal(modelMatchKey("us.anthropic.claude-haiku-4-5-20251001-v1:0"), key);
    assert.equal(modelMatchKey("claude-haiku-4-5@20251001"), key);
  });

  it("keeps genuinely different models apart", () => {
    assert.notEqual(modelMatchKey("claude-sonnet-5"), modelMatchKey("claude-sonnet-5-5"));
    assert.notEqual(modelMatchKey("claude-haiku-4-5"), modelMatchKey("claude-haiku-5-5"));
  });
});

describe("computeCostStateTopUps", () => {
  const row = (over = {}) => ({
    model: SONNET,
    speed: "standard",
    inference_geo: "global",
    service_tier: "standard",
    context_size: "short",
    input_tokens: 10,
    output_tokens: 100,
    cache_read_tokens: 1000,
    cache_write_tokens: 200,
    cache_write_1h_tokens: 200,
    web_search_requests: 0,
    ...over,
  });
  const claim = (over = {}) => ({
    sessionId: null,
    models: {
      [SONNET]: { input: 30, output: 130, cacheRead: 1150, cacheWrite: 205, webSearch: 0, ...over },
    },
  });

  it("adds only the shortfall, field by field", () => {
    const [t] = computeCostStateTopUps([row()], claim());
    assert.deepEqual(
      [t.input, t.output, t.cacheRead, t.cacheWrite],
      [20, 30, 150, 5],
      "each field is raised to Claude's figure"
    );
  });

  it("never lowers a field that already exceeds Claude's figure", () => {
    const [t] = computeCostStateTopUps([row({ output_tokens: 999 })], claim());
    assert.equal(t.output, 0);
    assert.equal(t.input, 20, "other fields still top up");
    assert.deepEqual(
      computeCostStateTopUps(
        [row({ output_tokens: 999 })],
        claim({ input: 1, cacheRead: 1, cacheWrite: 1, output: 1 })
      ),
      []
    );
  });

  it("sums across a model's buckets and credits the largest standard one", () => {
    const small = row({
      speed: "fast",
      input_tokens: 5,
      output_tokens: 5,
      cache_read_tokens: 5,
      cache_write_tokens: 5,
      cache_write_1h_tokens: 0,
    });
    const [t] = computeCostStateTopUps([small, row()], claim());
    assert.equal(t.speed, "standard", "tops up the bucket with the most traffic");
    assert.equal(t.input, 30 - 15, "effective input is the sum over both buckets");
  });

  it("counts workflow rows toward the total but never credits them", () => {
    const wf = row({
      service_tier: "workflow",
      input_tokens: 1000,
      output_tokens: 1000,
      cache_read_tokens: 1000,
      cache_write_tokens: 1000,
    });
    const [t] = computeCostStateTopUps(
      [wf, row()],
      claim({ input: 2000, output: 2000, cacheRead: 3000, cacheWrite: 2000 })
    );
    assert.equal(t.tier, "standard");
    assert.equal(t.input, 2000 - 1010);
  });

  it("creates a standard bucket for a model the transcript never recorded", () => {
    const [t] = computeCostStateTopUps([row()], {
      sessionId: null,
      models: { [HAIKU]: { input: 500, output: 40, cacheRead: 700, cacheWrite: 30, webSearch: 0 } },
    });
    assert.equal(t.model, HAIKU);
    assert.deepEqual([t.speed, t.geo, t.tier, t.ctx], ["standard", "global", "standard", "short"]);
    assert.equal(
      t.cacheWrite1h,
      30,
      "no writes of its own → takes the session's 1h share (Sonnet's writes are all 1h)"
    );
  });

  it("takes the session's 1h share for a model with no recorded writes", () => {
    const sonnetHalf1h = row({ cache_write_tokens: 400, cache_write_1h_tokens: 100 });
    const haikuNoWrites = row({ model: HAIKU, cache_write_tokens: 0, cache_write_1h_tokens: 0 });
    const topUps = computeCostStateTopUps([sonnetHalf1h, haikuNoWrites], {
      sessionId: null,
      models: {
        [HAIKU]: { input: 10, output: 100, cacheRead: 1000, cacheWrite: 40, webSearch: 0 },
      },
    });
    assert.equal(topUps.length, 1);
    assert.equal(topUps[0].cacheWrite, 40);
    assert.equal(topUps[0].cacheWrite1h, 10, "the session's 25% 1h share");
  });

  it("prices unrecorded writes as 5m only when the session has no cache writes at all", () => {
    const [t] = computeCostStateTopUps(
      [row({ cache_write_tokens: 0, cache_write_1h_tokens: 0 })],
      claim({ cacheWrite: 50 })
    );
    assert.equal(t.cacheWrite, 50);
    assert.equal(t.cacheWrite1h, 0, "no history anywhere to infer a 1h share from");
  });

  it("splits unrecorded cache writes by the model's existing 1h share", () => {
    const half = row({ cache_write_tokens: 200, cache_write_1h_tokens: 100 });
    const [t] = computeCostStateTopUps([half], claim({ cacheWrite: 300 }));
    assert.equal(t.cacheWrite, 100);
    assert.equal(t.cacheWrite1h, 50);
  });

  it("merges a model's tagged and untagged cost-state entries before comparing", () => {
    // Claude lists the 1M-context variant as its own key; both land in the same
    // stored buckets, so only their SUM (30 + 10 = 40) is Claude's figure.
    const split = {
      sessionId: null,
      models: {
        [SONNET]: { input: 30, output: 130, cacheRead: 1150, cacheWrite: 205, webSearch: 0 },
        [`${SONNET}[1m]`]: { input: 10, output: 20, cacheRead: 50, cacheWrite: 5, webSearch: 0 },
      },
    };
    const topUps = computeCostStateTopUps([row()], split);
    assert.equal(topUps.length, 1, "one model, one top-up");
    assert.deepEqual(
      [topUps[0].input, topUps[0].output, topUps[0].cacheRead, topUps[0].cacheWrite],
      [30, 50, 200, 10]
    );
  });

  it("names a model it has to create without the context-window tag", () => {
    const [t] = computeCostStateTopUps([], {
      sessionId: null,
      models: {
        "claude-haiku-4-5[1m]": { input: 5, output: 0, cacheRead: 0, cacheWrite: 0, webSearch: 0 },
      },
    });
    assert.equal(t.model, "claude-haiku-4-5");
  });

  it("tops up an existing Bedrock-named bucket instead of adding a second one", () => {
    const bedrock = row({ model: "anthropic.claude-haiku-4-5-20251001-v1:0" });
    const [t] = computeCostStateTopUps([bedrock], {
      sessionId: null,
      models: {
        "claude-haiku-4-5-20251001": {
          input: 25,
          output: 100,
          cacheRead: 1000,
          cacheWrite: 200,
          webSearch: 0,
        },
      },
    });
    assert.equal(t.model, "anthropic.claude-haiku-4-5-20251001-v1:0");
    assert.equal(t.input, 15, "only the shortfall, not Claude's whole 25");
  });

  it("matches a differently-spelled model name instead of double counting it", () => {
    const tagged = row({ model: "claude-sonnet-5-5[1m]" });
    const [t] = computeCostStateTopUps([tagged], claim());
    assert.equal(t.model, "claude-sonnet-5-5[1m]", "the existing bucket is topped up");
    assert.equal(t.input, 20, "not the full 30 as if the model were new");
  });
});

describe("applyCostState", () => {
  it("raises stored totals to Claude's and is idempotent", () => {
    const SID = "apply-1";
    insertSession(SID);
    writeTranscriptOnlyRows(SID);
    const cs = parseCostStateEntry(JSON.parse(costStateLine(SID)));

    assert.equal(applyCostState(stmts, SID, cs), 2, "Sonnet and Haiku both need a top-up");
    assert.deepEqual(effective(SID, SONNET), {
      input: 30,
      output: 130,
      cacheRead: 1150,
      cacheWrite: 205,
      cacheWrite1h: 205,
    });
    assert.deepEqual(
      effective(SID, HAIKU),
      {
        input: 500,
        output: 40,
        cacheRead: 700,
        cacheWrite: 30,
        cacheWrite1h: 30,
      },
      "Haiku has no writes of its own, so it takes the session's all-1h share"
    );

    assert.equal(applyCostState(stmts, SID, cs), 0, "second application changes nothing");
    assert.equal(effective(SID, SONNET).input, 30);
  });

  it("never lowers totals when Claude's record is behind the stored figures", () => {
    const SID = "apply-lower";
    insertSession(SID);
    writeTranscriptOnlyRows(SID, 10);
    const cs = parseCostStateEntry(JSON.parse(costStateLine(SID)));
    applyCostState(stmts, SID, cs);
    assert.equal(effective(SID, SONNET).output, 1000, "stored 1000 > Claude's 130 → untouched");
  });

  it("ignores a record stamped with a different session id", () => {
    const SID = "apply-foreign";
    insertSession(SID);
    writeTranscriptOnlyRows(SID);
    const cs = parseCostStateEntry(JSON.parse(costStateLine("some-other-session")));
    assert.equal(applyCostState(stmts, SID, cs), 0);
    assert.equal(effective(SID, SONNET).input, 10);
  });

  it("is a no-op without a record", () => {
    assert.equal(applyCostState(stmts, "apply-none", null), 0);
  });

  it("keeps the topped-up total while the transcript later catches up, then lets it grow", () => {
    const SID = "apply-growth";
    insertSession(SID);
    writeTranscriptOnlyRows(SID);
    const cs = parseCostStateEntry(JSON.parse(costStateLine(SID)));
    applyCostState(stmts, SID, cs);
    assert.equal(effective(SID, SONNET).cacheRead, 1150);

    // Transcript grows by 100 (still under Claude's 1150): the high-water fold
    // absorbs it into the top-up, so the total holds at Claude's figure.
    stmts.replaceTokenUsage.run(
      SID,
      SONNET,
      "standard",
      "global",
      "standard",
      "short",
      10,
      100,
      1100,
      200,
      200,
      0,
      0,
      0
    );
    applyCostState(stmts, SID, cs);
    assert.equal(effective(SID, SONNET).cacheRead, 1150);

    // Past Claude's figure, the transcript is simply the larger number again.
    stmts.replaceTokenUsage.run(
      SID,
      SONNET,
      "standard",
      "global",
      "standard",
      "short",
      10,
      100,
      1300,
      200,
      200,
      0,
      0,
      0
    );
    applyCostState(stmts, SID, cs);
    assert.equal(effective(SID, SONNET).cacheRead, 1300);
  });
});

describe("TranscriptCache — cost-state capture", () => {
  it("surfaces the cost-state of a full read", () => {
    const SID = "cache-full";
    const p = writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);
    const result = new TranscriptCache().extract(p);
    assert.equal(result.costState.sessionId, SID);
    assert.equal(result.costState.models[HAIKU].input, 500);
    assert.equal(
      result.tokensByModel[Object.keys(result.tokensByModel)[0]].input,
      10,
      "assistant usage is untouched"
    );
  });

  it("returns a result for a transcript that holds nothing but a cost-state", () => {
    const SID = "cache-only";
    const p = writeTranscript(SID, [costStateLine(SID)]);
    const result = new TranscriptCache().extract(p);
    assert.ok(result, "a lone cost-state must not be dropped as 'empty'");
    assert.equal(result.tokensByModel, null);
    assert.equal(result.costState.models[SONNET].output, 130);
  });

  it("lets a later cost-state win across an incremental read", () => {
    const SID = "cache-incremental";
    const p = writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);
    const cache = new TranscriptCache();
    assert.equal(cache.extract(p).costState.models[SONNET].output, 130);

    fs.appendFileSync(
      p,
      costStateLine(SID, { [SONNET]: { ...COST_STATE_USAGE[SONNET], outputTokens: 777 } }) + "\n"
    );
    assert.equal(cache.extract(p).costState.models[SONNET].output, 777);

    fs.appendFileSync(p, assistantLine("m2") + "\n");
    assert.equal(
      cache.extract(p).costState.models[SONNET].output,
      777,
      "kept when a chunk has none"
    );
  });

  it("is null when the transcript has no cost-state", () => {
    const p = writeTranscript("cache-none", [assistantLine("m1")]);
    assert.equal(new TranscriptCache().extract(p).costState, null);
  });
});

describe("live hook path", () => {
  it("tops a session up to Claude's totals when its transcript carries a cost-state", async () => {
    const SID = "20000000-0000-0000-0000-000000000001";
    const p = writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);

    const res = await post("/api/hooks/event", {
      hook_type: "SessionEnd",
      data: { session_id: SID, cwd: "/tmp/cost-state", transcript_path: p },
    });
    assert.equal(res.status, 200);

    assert.deepEqual(effective(SID, SONNET), {
      input: 30,
      output: 130,
      cacheRead: 1150,
      cacheWrite: 205,
      cacheWrite1h: 205,
    });
    assert.equal(
      effective(SID, HAIKU).input,
      500,
      "Haiku calls with no assistant message are recorded"
    );
  });

  it("does not move totals for a transcript without a cost-state", async () => {
    const SID = "20000000-0000-0000-0000-000000000002";
    const p = writeTranscript(SID, [assistantLine("m1")]);
    await post("/api/hooks/event", {
      hook_type: "SessionEnd",
      data: { session_id: SID, cwd: "/tmp/cost-state", transcript_path: p },
    });
    assert.equal(effective(SID, SONNET).input, 10);
    assert.equal(effective(SID, HAIKU).input, 0);
  });
});

describe("import-history", () => {
  it("parseSessionFile captures the cost-state (last wins)", async () => {
    const SID = "parse-1";
    const p = writeTranscript(SID, [
      assistantLine("m1"),
      costStateLine(SID, { [SONNET]: { ...COST_STATE_USAGE[SONNET], outputTokens: 5 } }),
      costStateLine(SID),
    ]);
    const session = await parseSessionFile(p);
    assert.equal(session.costState.models[SONNET].output, 130);
  });

  describe("reconcileTokens", () => {
    it("tops up as part of a normal sweep", async () => {
      const SID = "reconcile-normal";
      insertSession(SID);
      writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);

      await reconcileTokens(dbModule, { all: true, sessionIds: [SID] });
      assert.equal(effective(SID, SONNET).output, 130);
      assert.equal(effective(SID, HAIKU).input, 500);
    });

    it("re-applies after a baseline reset, which would otherwise erase the top-up", async () => {
      const SID = "reconcile-reset";
      insertSession(SID);
      writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);
      await reconcileTokens(dbModule, { all: true, sessionIds: [SID] });

      await reconcileTokens(dbModule, { all: true, resetBaselines: true, sessionIds: [SID] });
      assert.equal(effective(SID, SONNET).cacheRead, 1150);
      assert.equal(effective(SID, HAIKU).cacheRead, 700);
    });

    it("costStateOnly leaves the transcript-derived rows alone and only adds the shortfall", async () => {
      const SID = "reconcile-only";
      insertSession(SID);
      writeTranscript(SID, [assistantLine("m1"), costStateLine(SID)]);
      writeTranscriptOnlyRows(SID);
      // A stale bucket a full re-derivation would have dropped.
      stmts.replaceTokenUsage.run(
        SID,
        "claude-retired-1",
        "standard",
        "global",
        "standard",
        "short",
        0,
        555,
        0,
        0,
        0,
        0,
        0,
        0
      );

      const counters = await reconcileTokens(dbModule, {
        all: true,
        costStateOnly: true,
        sessionIds: [SID],
      });
      assert.equal(counters.sessionsTouched, 1);
      assert.equal(effective(SID, SONNET).output, 130);
      assert.equal(effective(SID, HAIKU).input, 500);
      assert.equal(
        effective(SID, "claude-retired-1").output,
        555,
        "costStateOnly never rewrites other rows"
      );

      const again = await reconcileTokens(dbModule, {
        all: true,
        costStateOnly: true,
        sessionIds: [SID],
      });
      assert.equal(again.sessionsTouched, 0, "re-running the backfill is a no-op");
    });
  });
});
