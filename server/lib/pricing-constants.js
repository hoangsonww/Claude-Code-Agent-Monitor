/**
 * @file Feature-level pricing constants and modifier math, centralized so the
 * cost calculator stays readable and every rate has one source of truth. These
 * mirror Anthropic's published pricing page. Per-model token rates live in the
 * editable `model_pricing` table; the values here are feature/modifier rates
 * that are uniform across models and therefore kept as code constants.
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
  WEB_SEARCH_PER_1K_SEARCHES,
  WEB_FETCH_PER_REQUEST,
  CODE_EXEC_PER_HOUR,
  CODE_EXEC_MIN_MINUTES,
  CODE_EXEC_FREE_HOURS,
  estimateCodeExecHours,
};
