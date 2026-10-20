/**
 * @file Shared helpers for normalizing Claude transcript `usage` records into
 * per-bucket token tallies. Used by BOTH ingestion paths — the live server-side
 * parser (`server/lib/transcript-cache.js`) and the history importer
 * (`scripts/import-history.js`) — so the two stay in lockstep.
 *
 * A "bucket" is the unit cost is computed against: tokens are grouped by
 * (model, speed, inference_geo, service_tier) because those four dimensions
 * change the per-token RATE (fast mode, US data residency, Batch API). The
 * dimensions are normalized to the small set of values that actually move
 * price; anything unknown collapses to the standard/global default so old
 * transcripts (which lack `speed` / `inference_geo` / `cache_creation`
 * breakdown / `server_tool_use`) price exactly as they did before.
 *
 * A fifth dimension, `ctx` ("short" | "long"), splits a model's usage by
 * per-request prompt size, but only for models whose rate card has a long-prompt
 * tier (CLAUDE_LONG_CONTEXT_TIERS). Every other model is always "short", so its
 * bucket keys and stored rows are identical to before.
 *
 * A sixth, `ccVersion`, records the Claude Code version of the process that
 * made the request (the transcript entry's `version`), so a rate that Claude
 * Code changed between releases prices each message by the version that billed
 * it. `writeTokenBuckets` writes one bucket's version rows as a unit.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { CLAUDE_LONG_CONTEXT_TIERS } = require("./pricing-constants");

// Separator for composite bucket keys — U+0001 (SOH) cannot occur in a model id.
const BUCKET_SEP = String.fromCharCode(1);

/** Pricing-relevant speed. Anything other than the fast research-preview tier is standard. */
function normalizeSpeed(usage) {
  return usage && usage.speed === "fast" ? "fast" : "standard";
}

/**
 * Pricing-relevant inference geography. Only US-pinned routing carries the 1.1x
 * data-residency premium; "global", "not_available", and absent all map to the
 * standard "global" rate.
 */
function normalizeGeo(usage) {
  return usage && usage.inference_geo === "us" ? "us" : "global";
}

/** Pricing-relevant service tier. Only "batch" changes the rate (50% off). */
function normalizeTier(usage) {
  return usage && usage.service_tier === "batch" ? "batch" : "standard";
}

/**
 * Prompt-size class of a single request: "long" when the model has a long-prompt
 * rate tier and this request's prompt (fresh input + cache reads + cache writes)
 * exceeds its limit, otherwise "short". `fields` is extractUsageFields() output.
 */
function contextSizeFor(model, fields) {
  const tier = CLAUDE_LONG_CONTEXT_TIERS.find((t) => t.pattern.test(String(model || "")));
  if (!tier || !fields) return "short";
  const prompt = (fields.input || 0) + (fields.cacheRead || 0) + (fields.cacheWrite || 0);
  return prompt > tier.limit ? "long" : "short";
}

/**
 * The Claude Code version a transcript entry was written by ("2.1.296"), or ""
 * when it carries none or something that is not a dotted number — "" rows price
 * by the session's recorded version instead.
 */
function normalizeCcVersion(version) {
  if (typeof version !== "string") return "";
  const v = version.trim();
  return /^\d+(\.\d+){0,3}$/.test(v) ? v : "";
}

/** Orders Claude Code versions numerically ("2.1.99" < "2.1.100"); "" sorts first. */
function compareCcVersions(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return a < b ? -1 : 1;
}

/**
 * Composite bucket key — stable string usable as an object property. The
 * default "short" context and an unknown version add no segment, keeping
 * pre-existing keys unchanged.
 */
function bucketKey(model, speed, geo, tier, ctx = "short", ccVersion = "") {
  const parts = [model, speed, geo, tier];
  if (ctx === "long") parts.push("long");
  const version = normalizeCcVersion(ccVersion);
  if (version) parts.push(`v${version}`);
  return parts.join(BUCKET_SEP);
}

/** A zeroed bucket carrying its pricing dimensions. */
function emptyBucket(model, speed, geo, tier, ctx = "short", ccVersion = "") {
  return {
    model,
    speed,
    geo,
    tier,
    ctx: ctx === "long" ? "long" : "short",
    ccVersion: normalizeCcVersion(ccVersion),
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0, // TOTAL ephemeral cache-creation tokens (5m + 1h)
    cacheWrite1h: 0, // subset of cacheWrite that is the 1h tier; 5m = cacheWrite - cacheWrite1h
    webSearch: 0, // server_tool_use.web_search_requests (billed per 1k)
    webFetch: 0, // server_tool_use.web_fetch_requests (free; tracked for visibility)
    codeExec: 0, // server_tool_use.code_execution_requests (time-billed; estimated)
  };
}

/**
 * Pull the numeric token / request fields out of a single `usage` record.
 * Tolerant of the older shape: when `cache_creation` breakdown is absent the
 * whole cache-write amount is treated as 5m (cacheWrite1h = 0), and a missing
 * `server_tool_use` yields zero tool requests.
 */
function extractUsageFields(usage) {
  if (!usage || typeof usage !== "object") {
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWrite1h: 0,
      webSearch: 0,
      webFetch: 0,
      codeExec: 0,
    };
  }
  const cc =
    usage.cache_creation && typeof usage.cache_creation === "object" ? usage.cache_creation : null;
  const ephem5m = cc ? cc.ephemeral_5m_input_tokens || 0 : 0;
  const ephem1h = cc ? cc.ephemeral_1h_input_tokens || 0 : 0;
  // Prefer the explicit total; fall back to the breakdown sum when only that is present.
  const cacheWrite =
    usage.cache_creation_input_tokens != null
      ? usage.cache_creation_input_tokens || 0
      : ephem5m + ephem1h;
  // Never let the 1h subset exceed the recorded total (guards malformed records).
  const cacheWrite1h = Math.min(ephem1h, cacheWrite);
  const stu =
    usage.server_tool_use && typeof usage.server_tool_use === "object"
      ? usage.server_tool_use
      : null;
  return {
    input: usage.input_tokens || 0,
    output: usage.output_tokens || 0,
    cacheRead: usage.cache_read_input_tokens || 0,
    cacheWrite,
    cacheWrite1h,
    webSearch: stu ? stu.web_search_requests || 0 : 0,
    webFetch: stu ? stu.web_fetch_requests || 0 : 0,
    codeExec: stu ? stu.code_execution_requests || 0 : 0,
  };
}

/** Add the numeric fields of `src` into `target` in place. */
function accumulateBucket(target, src) {
  target.input += src.input || 0;
  target.output += src.output || 0;
  target.cacheRead += src.cacheRead || 0;
  target.cacheWrite += src.cacheWrite || 0;
  target.cacheWrite1h += src.cacheWrite1h || 0;
  target.webSearch += src.webSearch || 0;
  target.webFetch += src.webFetch || 0;
  target.codeExec += src.codeExec || 0;
  return target;
}

/**
 * Default size of the per-message reconciliation window (see
 * `rememberUsageContribution`). A single API response's records are written
 * ADJACENTLY: measured across a 295-transcript corpus, all 13,115 duplicate
 * usage records sat exactly one distinct message.id apart — the span was never
 * greater than 1. A 1000-entry tail window therefore reconciles every real
 * transcript with a ~1000x margin while keeping memory flat on
 * multi-hundred-MiB files. Past the window a message's earlier record can no
 * longer be retracted, which over-counts that one record rather than drifting
 * without bound.
 */
const USAGE_RECONCILE_WINDOW = 1000;

/**
 * Inverse of accumulateBucket. Used to retract a message's earlier usage
 * contribution when a later record for the same message.id carries the
 * final (larger) usage — streaming writes partial usage first. A bucket may
 * go transiently negative when the retracted contribution was counted in a
 * previous incremental parse; the merge step nets it out.
 */
function subtractBucket(target, src) {
  target.input -= src.input || 0;
  target.output -= src.output || 0;
  target.cacheRead -= src.cacheRead || 0;
  target.cacheWrite -= src.cacheWrite || 0;
  target.cacheWrite1h -= src.cacheWrite1h || 0;
  target.webSearch -= src.webSearch || 0;
  target.webFetch -= src.webFetch || 0;
  target.codeExec -= src.codeExec || 0;
  return target;
}

/**
 * Record `contribution` as the usage currently counted for `messageId`, so a
 * later record for the same id can retract it via subtractBucket. Re-inserts
 * on update (Map iterates in insertion order) and evicts the oldest entries
 * past `maxEntries`, keeping the window a bounded tail. Both ingestion paths
 * call this so their reconciliation windows behave identically.
 */
function rememberUsageContribution(
  map,
  messageId,
  contribution,
  maxEntries = USAGE_RECONCILE_WINDOW
) {
  map.delete(messageId);
  map.set(messageId, contribution);
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
  return map;
}

const COUNT_FIELDS = [
  "input",
  "output",
  "cacheRead",
  "cacheWrite",
  "cacheWrite1h",
  "webSearch",
  "webFetch",
  "codeExec",
];

/**
 * Split each field of `excess` over the version rows (ascending `ordered`) in
 * proportion to their live counts, so the parts sum exactly: Claude Code's
 * unrecorded calls (/compact, WebFetch) happen alongside each process's
 * recorded ones. A field with no live count to go by goes to the latest
 * version. Returns one baseline per version.
 */
function spreadExcess(excess, ordered, versions) {
  const out = new Map(ordered.map((v) => [v, Object.fromEntries(COUNT_FIELDS.map((f) => [f, 0]))]));
  for (const f of COUNT_FIELDS) {
    const total = excess[f];
    if (total <= 0) continue;
    const weights = ordered.map((v) => Math.max(versions.get(v)[f], 0));
    const sum = weights.reduce((a, w) => a + w, 0);
    if (sum <= 0) {
      out.get(ordered[ordered.length - 1])[f] = total;
      continue;
    }
    let given = 0;
    let largest = 0;
    ordered.forEach((v, i) => {
      const part = Math.floor((total * weights[i]) / sum);
      out.get(v)[f] = part;
      given += part;
      if (weights[i] >= weights[largest]) largest = i;
    });
    out.get(ordered[largest])[f] += total - given;
  }
  return out;
}

/**
 * Write a session's transcript-derived buckets (emptyBucket shape) to
 * token_usage, one stored row per Claude Code version.
 *
 * The high-water mark that replaceTokenUsage keeps per row is kept here per
 * bucket — (model, speed, geo, tier, ctx) summed over its version rows:
 *
 *   excess := max(old bucket total - new live total, 0)   (per field)
 *   rows   := one per version with its new live counts, plus its share of
 *             `excess` (spreadExcess) as its baseline
 *   ⇒ bucket total = max(old total, new live total)
 *
 * So splitting a bucket by version never counts a token twice: a row written
 * before versions existed (cc_version '') is folded into the versioned rows on
 * the next rewrite, and usage the stored total holds beyond this transcript
 * (cost-state top-ups, a wider-scope writer) is shared out by each version's
 * usage. With one version it is exactly replaceTokenUsage. `options.reset`
 * writes the live counts as the whole truth (no excess), like resetTokenUsage.
 * Callers own the transaction. Returns the number of rows written.
 */
function writeTokenBuckets(stmts, sessionId, buckets, options = {}) {
  const groups = new Map();
  for (const b of buckets || []) {
    if (!b || !b.model) continue;
    const ctx = b.ctx === "long" ? "long" : "short";
    const key = bucketKey(b.model, b.speed, b.geo, b.tier, ctx);
    let group = groups.get(key);
    if (!group) {
      group = { args: [sessionId, b.model, b.speed, b.geo, b.tier, ctx], versions: new Map() };
      groups.set(key, group);
    }
    const version = normalizeCcVersion(b.ccVersion);
    const live = group.versions.get(version) || Object.fromEntries(COUNT_FIELDS.map((f) => [f, 0]));
    for (const f of COUNT_FIELDS) live[f] += b[f] || 0;
    group.versions.set(version, live);
  }

  let written = 0;
  for (const { args, versions } of groups.values()) {
    const excess = Object.fromEntries(COUNT_FIELDS.map((f) => [f, 0]));
    if (!options.reset) {
      const stored = stmts.getTokenBucketVersions.all(...args);
      for (const f of COUNT_FIELDS) {
        const before = stored.reduce((sum, row) => sum + (row[f] || 0), 0);
        let after = 0;
        for (const live of versions.values()) after += live[f];
        excess[f] = Math.max(before - after, 0);
      }
    }
    stmts.deleteTokenBucketVersions.run(...args);
    const ordered = [...versions.keys()].sort(compareCcVersions);
    const baselines = spreadExcess(excess, ordered, versions);
    for (const version of ordered) {
      const live = versions.get(version);
      const baseline = baselines.get(version);
      stmts.insertTokenUsageRow.run(
        ...args,
        version,
        ...COUNT_FIELDS.map((f) => live[f]),
        ...COUNT_FIELDS.map((f) => baseline[f])
      );
      written++;
    }
  }
  return written;
}

module.exports = {
  BUCKET_SEP,
  USAGE_RECONCILE_WINDOW,
  normalizeSpeed,
  normalizeGeo,
  normalizeTier,
  normalizeCcVersion,
  compareCcVersions,
  contextSizeFor,
  bucketKey,
  emptyBucket,
  writeTokenBuckets,
  extractUsageFields,
  accumulateBucket,
  subtractBucket,
  rememberUsageContribution,
};
