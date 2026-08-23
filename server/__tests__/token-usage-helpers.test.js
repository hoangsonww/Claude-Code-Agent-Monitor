/**
 * @file Unit coverage for `server/lib/token-usage.js` — the helper module both
 * ingestion paths share, so a drift here silently changes every token total and
 * every cost in the dashboard.
 *
 * Covers the pricing-dimension normalizers, bucket construction, `usage` field
 * extraction (including the legacy shapes older transcripts still use), and the
 * accumulate/subtract/remember trio that implements per-`message.id` usage
 * reconciliation. `subtractBucket` in particular must be an EXACT inverse of
 * `accumulateBucket`: reconciliation retracts a message's earlier contribution
 * with it, so any asymmetry would leak tokens into or out of a bucket.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  BUCKET_SEP,
  USAGE_RECONCILE_WINDOW,
  normalizeSpeed,
  normalizeGeo,
  normalizeTier,
  bucketKey,
  emptyBucket,
  extractUsageFields,
  accumulateBucket,
  subtractBucket,
  rememberUsageContribution,
} = require("../lib/token-usage");

const NUMERIC = [
  "input",
  "output",
  "cacheRead",
  "cacheWrite",
  "cacheWrite1h",
  "webSearch",
  "webFetch",
  "codeExec",
];

describe("pricing-dimension normalizers", () => {
  it("treats only speed 'fast' as the fast tier", () => {
    assert.equal(normalizeSpeed({ speed: "fast" }), "fast");
    assert.equal(normalizeSpeed({ speed: "standard" }), "standard");
    assert.equal(normalizeSpeed({ speed: "turbo" }), "standard");
    assert.equal(normalizeSpeed({}), "standard");
    assert.equal(normalizeSpeed(null), "standard");
    assert.equal(normalizeSpeed(undefined), "standard");
  });

  it("treats only inference_geo 'us' as the data-residency tier", () => {
    assert.equal(normalizeGeo({ inference_geo: "us" }), "us");
    assert.equal(normalizeGeo({ inference_geo: "global" }), "global");
    // Older transcripts report this literal when routing was not recorded.
    assert.equal(normalizeGeo({ inference_geo: "not_available" }), "global");
    assert.equal(normalizeGeo({ inference_geo: "eu" }), "global");
    assert.equal(normalizeGeo({}), "global");
    assert.equal(normalizeGeo(null), "global");
  });

  it("treats only service_tier 'batch' as rate-changing", () => {
    assert.equal(normalizeTier({ service_tier: "batch" }), "batch");
    assert.equal(normalizeTier({ service_tier: "standard" }), "standard");
    // 'priority' does not change the per-token rate, so it prices as standard.
    assert.equal(normalizeTier({ service_tier: "priority" }), "standard");
    assert.equal(normalizeTier({}), "standard");
    assert.equal(normalizeTier(null), "standard");
  });
});

describe("bucket construction", () => {
  it("builds a composite key from all four pricing dimensions", () => {
    const key = bucketKey("claude-opus-4-8", "fast", "us", "batch");
    assert.equal(key, ["claude-opus-4-8", "fast", "us", "batch"].join(BUCKET_SEP));
  });

  it("keeps buckets distinct when only one dimension differs", () => {
    const base = bucketKey("m", "standard", "global", "standard");
    assert.notEqual(base, bucketKey("m", "fast", "global", "standard"));
    assert.notEqual(base, bucketKey("m", "standard", "us", "standard"));
    assert.notEqual(base, bucketKey("m", "standard", "global", "batch"));
    assert.notEqual(base, bucketKey("m2", "standard", "global", "standard"));
  });

  it("uses a separator that cannot occur inside a model id", () => {
    assert.equal(BUCKET_SEP, String.fromCharCode(1));
    // A model id containing the separator is not representable, so no
    // realistic id can forge a different bucket's key.
    assert.ok(!"claude-opus-4-8".includes(BUCKET_SEP));
  });

  it("creates a zeroed bucket that carries its dimensions", () => {
    const b = emptyBucket("m", "fast", "us", "batch");
    assert.deepEqual(
      { model: b.model, speed: b.speed, geo: b.geo, tier: b.tier },
      { model: "m", speed: "fast", geo: "us", tier: "batch" }
    );
    for (const f of NUMERIC) assert.equal(b[f], 0, `${f} must start at zero`);
  });
});

describe("extractUsageFields", () => {
  it("returns an all-zero shape for a missing or non-object usage", () => {
    for (const bad of [null, undefined, "usage", 42]) {
      const f = extractUsageFields(bad);
      for (const k of NUMERIC) assert.equal(f[k], 0, `${k} for ${String(bad)}`);
    }
  });

  it("defaults every absent numeric field to zero", () => {
    const f = extractUsageFields({});
    for (const k of NUMERIC) assert.equal(f[k], 0);
  });

  it("reads the flat token counts", () => {
    const f = extractUsageFields({
      input_tokens: 11,
      output_tokens: 22,
      cache_read_input_tokens: 33,
    });
    assert.equal(f.input, 11);
    assert.equal(f.output, 22);
    assert.equal(f.cacheRead, 33);
  });

  it("prefers the explicit cache-creation total over the breakdown sum", () => {
    // The explicit total is authoritative; the breakdown only splits it.
    const f = extractUsageFields({
      cache_creation_input_tokens: 500,
      cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
    });
    assert.equal(f.cacheWrite, 500);
    assert.equal(f.cacheWrite1h, 200);
  });

  it("falls back to the breakdown sum when no explicit total is present", () => {
    const f = extractUsageFields({
      cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
    });
    assert.equal(f.cacheWrite, 300);
    assert.equal(f.cacheWrite1h, 200);
  });

  it("treats the legacy shape (no breakdown) as entirely 5m", () => {
    const f = extractUsageFields({ cache_creation_input_tokens: 400 });
    assert.equal(f.cacheWrite, 400);
    assert.equal(f.cacheWrite1h, 0, "no breakdown means nothing is known to be 1h");
  });

  it("never lets the 1h subset exceed the recorded total", () => {
    // Guards a malformed record from producing a negative 5m portion
    // (cache_write - cache_write_1h) at pricing time.
    const f = extractUsageFields({
      cache_creation_input_tokens: 100,
      cache_creation: { ephemeral_1h_input_tokens: 900 },
    });
    assert.equal(f.cacheWrite, 100);
    assert.equal(f.cacheWrite1h, 100);
    assert.ok(f.cacheWrite - f.cacheWrite1h >= 0);
  });

  it("ignores a non-object cache_creation", () => {
    const f = extractUsageFields({ cache_creation_input_tokens: 70, cache_creation: "nope" });
    assert.equal(f.cacheWrite, 70);
    assert.equal(f.cacheWrite1h, 0);
  });

  it("reads server-tool request counts when present", () => {
    const f = extractUsageFields({
      server_tool_use: {
        web_search_requests: 3,
        web_fetch_requests: 4,
        code_execution_requests: 5,
      },
    });
    assert.equal(f.webSearch, 3);
    assert.equal(f.webFetch, 4);
    assert.equal(f.codeExec, 5);
  });

  it("yields zero tool requests when server_tool_use is absent or malformed", () => {
    for (const usage of [{}, { server_tool_use: null }, { server_tool_use: 7 }]) {
      const f = extractUsageFields(usage);
      assert.equal(f.webSearch, 0);
      assert.equal(f.webFetch, 0);
      assert.equal(f.codeExec, 0);
    }
  });
});

describe("accumulateBucket / subtractBucket", () => {
  const sample = {
    input: 1,
    output: 2,
    cacheRead: 3,
    cacheWrite: 4,
    cacheWrite1h: 5,
    webSearch: 6,
    webFetch: 7,
    codeExec: 8,
  };

  it("adds every numeric field in place and returns the target", () => {
    const target = emptyBucket("m", "standard", "global", "standard");
    const returned = accumulateBucket(target, sample);
    assert.equal(returned, target, "must return the same object it mutated");
    for (const k of NUMERIC) assert.equal(target[k], sample[k]);
  });

  it("accumulates repeatedly", () => {
    const target = emptyBucket("m", "standard", "global", "standard");
    accumulateBucket(target, sample);
    accumulateBucket(target, sample);
    accumulateBucket(target, sample);
    for (const k of NUMERIC) assert.equal(target[k], sample[k] * 3);
  });

  it("treats absent source fields as zero", () => {
    const target = emptyBucket("m", "standard", "global", "standard");
    accumulateBucket(target, { input: 5 });
    assert.equal(target.input, 5);
    for (const k of NUMERIC.filter((x) => x !== "input")) assert.equal(target[k], 0);
  });

  it("subtracts every numeric field in place and returns the target", () => {
    const target = emptyBucket("m", "standard", "global", "standard");
    accumulateBucket(target, sample);
    const returned = subtractBucket(target, sample);
    assert.equal(returned, target);
    for (const k of NUMERIC) assert.equal(target[k], 0);
  });

  it("is an EXACT inverse of accumulateBucket", () => {
    // Reconciliation retracts a message's earlier contribution with this, so
    // accumulate-then-subtract must restore the bucket bit for bit.
    const target = emptyBucket("m", "standard", "global", "standard");
    const other = { ...sample, input: 100, output: 250 };
    accumulateBucket(target, other);
    accumulateBucket(target, sample);
    const snapshot = { ...target };
    accumulateBucket(target, sample);
    subtractBucket(target, sample);
    for (const k of NUMERIC) assert.equal(target[k], snapshot[k], `${k} must round-trip`);
  });

  it("goes negative rather than clamping, so a cross-parse retraction can net out", () => {
    // The live path retracts into a bucket that may only exist in the CACHED
    // result; the transient negative is netted out by the merge step, so the
    // helper itself must not clamp at zero.
    const target = emptyBucket("m", "standard", "global", "standard");
    subtractBucket(target, sample);
    assert.equal(target.output, -sample.output);
    assert.equal(target.cacheRead, -sample.cacheRead);
  });

  it("preserves the bucket's pricing dimensions across both operations", () => {
    const target = emptyBucket("m", "fast", "us", "batch");
    accumulateBucket(target, sample);
    subtractBucket(target, sample);
    assert.deepEqual(
      { model: target.model, speed: target.speed, geo: target.geo, tier: target.tier },
      { model: "m", speed: "fast", geo: "us", tier: "batch" }
    );
  });

  it("treats absent fields as zero when subtracting", () => {
    const target = emptyBucket("m", "standard", "global", "standard");
    accumulateBucket(target, sample);
    subtractBucket(target, { input: 1 });
    assert.equal(target.input, 0);
    assert.equal(target.output, sample.output, "untouched fields must not change");
  });
});

describe("rememberUsageContribution", () => {
  it("records a contribution and returns the map", () => {
    const map = new Map();
    const value = { key: "k", fields: { output: 1 } };
    assert.equal(rememberUsageContribution(map, "id", value), map);
    assert.equal(map.get("id"), value);
  });

  it("replaces the value for a repeated id instead of duplicating it", () => {
    const map = new Map();
    rememberUsageContribution(map, "id", { n: 1 });
    rememberUsageContribution(map, "id", { n: 2 });
    assert.equal(map.size, 1);
    assert.deepEqual(map.get("id"), { n: 2 });
  });

  it("evicts oldest-first once past maxEntries", () => {
    const map = new Map();
    for (let i = 0; i < 6; i++) rememberUsageContribution(map, `m${i}`, { n: i }, 3);
    assert.deepEqual([...map.keys()], ["m3", "m4", "m5"]);
  });

  it("moves a refreshed id to the newest position", () => {
    const map = new Map();
    rememberUsageContribution(map, "a", { n: 1 }, 2);
    rememberUsageContribution(map, "b", { n: 2 }, 2);
    rememberUsageContribution(map, "a", { n: 3 }, 2); // refresh 'a'
    rememberUsageContribution(map, "c", { n: 4 }, 2); // should evict 'b'
    assert.deepEqual([...map.keys()], ["a", "c"]);
  });

  it("supports a window of one", () => {
    const map = new Map();
    rememberUsageContribution(map, "a", { n: 1 }, 1);
    rememberUsageContribution(map, "b", { n: 2 }, 1);
    assert.deepEqual([...map.keys()], ["b"]);
  });

  it("defaults to the shared window constant", () => {
    assert.equal(USAGE_RECONCILE_WINDOW, 1000);
    const map = new Map();
    for (let i = 0; i < USAGE_RECONCILE_WINDOW + 5; i++) {
      rememberUsageContribution(map, `m${i}`, { n: i });
    }
    assert.equal(map.size, USAGE_RECONCILE_WINDOW);
    assert.ok(!map.has("m0"), "the oldest ids are evicted");
    assert.ok(map.has(`m${USAGE_RECONCILE_WINDOW + 4}`), "the newest id is retained");
  });

  it("stores the contribution by reference without copying it", () => {
    // The reconciler subtracts exactly the object it stored, so a defensive
    // copy here would silently change what gets retracted.
    const map = new Map();
    const fields = { output: 5 };
    rememberUsageContribution(map, "id", { key: "k", fields });
    assert.equal(map.get("id").fields, fields);
  });
});
