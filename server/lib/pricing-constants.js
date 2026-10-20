/**
 * @file Feature-level pricing constants and modifier math, centralized so the
 * cost calculator stays readable and every rate has one source of truth. These
 * mirror Anthropic's published pricing page. Per-model token rates live in the
 * editable `model_pricing` table; the values here are feature/modifier rates
 * that are uniform across models and therefore kept as code constants, plus the
 * SQL that reads the Claude Code version (per token row, else the session's)
 * for version-gated intro rates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// ── Prompt-caching multipliers (relative to base input price) ───────────────
// Stored model rates already encode these for the standard tier, but fast-mode
// cache rates are derived from the fast input base using the same ratios, so we
// keep the multipliers here for that derivation and for documentation.
const CACHE_READ_MULTIPLIER = 0.1; // cache hit / refresh
const CACHE_WRITE_5M_MULTIPLIER = 1.25; // 5-minute ephemeral write
const CACHE_WRITE_1H_MULTIPLIER = 2.0; // 1-hour ephemeral write

// ── Cross-cutting rate modifiers ────────────────────────────────────────────
const DATA_RESIDENCY_US_MULTIPLIER = 1.1; // inference_geo === "us"
const BATCH_DISCOUNT_MULTIPLIER = 0.5; // service_tier === "batch" (50% off)

// ── Long-prompt rate tiers ──────────────────────────────────────────────────
// Models whose published rate card depends on prompt length. A request whose
// prompt (input + cache reads + cache writes) exceeds `limit` tokens is stamped
// context_size = "long" at ingestion and priced at the rule's long_* rates
// (cache rates scale with the long input base, like fast mode). Only models
// listed here are ever stamped "long", so every other model's buckets — and the
// token_usage rows already stored for them — are unaffected.
// claude-haiku-5-5: $0.10/$0.50 up to 100K prompt tokens, $0.50/$2.50 above.
const CLAUDE_LONG_CONTEXT_TIERS = [{ pattern: /^claude-haiku-5-5/i, limit: 100000 }];

// ── Server-tool surcharges (billed in addition to tokens) ───────────────────
const WEB_SEARCH_PER_1K_SEARCHES = 10.0; // $10 per 1,000 web_search_requests
const WEB_FETCH_PER_REQUEST = 0.0; // web fetch has no surcharge — tokens only

// Code execution: billed by container-time, not request count. Transcripts only
// expose request counts, so we estimate at the documented 5-minute minimum per
// request. It is FREE when the same request also used web search or web fetch.
// Each org gets a monthly free allowance; below it, code execution costs $0.
const CODE_EXEC_PER_HOUR = 0.05; // $0.05 per container-hour beyond the free tier
const CODE_EXEC_MIN_MINUTES = 5; // 5-minute minimum billed per request
const CODE_EXEC_FREE_HOURS = 1550; // free hours per org per month

/**
 * SQL expression for the Claude Code version a session recorded
 * (`sessions.metadata.version`: the first `version` in its transcript), which
 * prices rules that carry an `intro_until_version` cutoff. NULL when absent or
 * when metadata is not valid JSON. `alias` is the sessions table alias, if any.
 */
function sessionCcVersionSql(alias) {
  const col = alias ? `${alias}.metadata` : "metadata";
  return `CASE WHEN json_valid(${col}) THEN json_extract(${col}, '$.version') END`;
}

/**
 * SQL expression for the Claude Code version a token_usage row is priced by:
 * the row's own `cc_version` (the version that made those requests), else the
 * session's recorded version for rows not split by version (''). `tokenAlias`
 * and `sessionAlias` are the token_usage and sessions table aliases.
 */
function tokenCcVersionSql(tokenAlias, sessionAlias) {
  return `COALESCE(NULLIF(${tokenAlias}.cc_version, ''), ${sessionCcVersionSql(sessionAlias)})`;
}

/**
 * The same choice in JS, for a `SELECT tu.*` row that also selected the
 * session's version as `session_cc_version`: sets `cc_version` to the version
 * the row is priced by.
 */
function withTokenCcVersion(row) {
  const { session_cc_version: sessionVersion, ...rest } = row;
  return { ...rest, cc_version: row.cc_version || sessionVersion || null };
}

/**
 * Estimated billable code-execution hours for a bucket.
 * Returns 0 when the bucket also used web search or web fetch (code execution is
 * free in that case) or when there were no code-execution requests.
 */
function estimateCodeExecHours(codeExecRequests, webSearchRequests, webFetchRequests) {
  if (!codeExecRequests || codeExecRequests <= 0) return 0;
  if ((webSearchRequests || 0) > 0 || (webFetchRequests || 0) > 0) return 0; // free with search/fetch
  return (codeExecRequests * CODE_EXEC_MIN_MINUTES) / 60;
}

module.exports = {
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_5M_MULTIPLIER,
  CACHE_WRITE_1H_MULTIPLIER,
  DATA_RESIDENCY_US_MULTIPLIER,
  BATCH_DISCOUNT_MULTIPLIER,
  CLAUDE_LONG_CONTEXT_TIERS,
  WEB_SEARCH_PER_1K_SEARCHES,
  WEB_FETCH_PER_REQUEST,
  CODE_EXEC_PER_HOUR,
  CODE_EXEC_MIN_MINUTES,
  CODE_EXEC_FREE_HOURS,
  estimateCodeExecHours,
  sessionCcVersionSql,
  tokenCcVersionSql,
  withTokenCcVersion,
};
