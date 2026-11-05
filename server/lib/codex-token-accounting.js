/**
 * @file Pure cumulative Codex token accounting shared by ingestion and guarded
 * historical output repair. Reasoning is an output breakdown, never added twice.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const CONTEXT_SHORT_LIMIT = 272000;
const FIELDS = [
  "input_tokens",
  "cached_input_tokens",
  "cache_write_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
];
const number = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

function codexTokenDelta(total, previous = {}) {
  const current = Object.fromEntries(FIELDS.map((key) => [key, number(total[key])]));
  const regressed = FIELDS.some((key) => current[key] < number(previous[key]));
  const delta = Object.fromEntries(
    FIELDS.map((key) => [key, regressed ? 0 : Math.max(0, current[key] - number(previous[key]))])
  );
  return {
    current,
    input: Math.max(
      0,
      delta.input_tokens - delta.cached_input_tokens - delta.cache_write_input_tokens
    ),
    cached: delta.cached_input_tokens,
    write: delta.cache_write_input_tokens,
    output: delta.output_tokens,
    legacyOutput: delta.output_tokens + delta.reasoning_output_tokens,
    context: delta.input_tokens > CONTEXT_SHORT_LIMIT ? "long" : "short",
  };
}

module.exports = { codexTokenDelta, CONTEXT_SHORT_LIMIT };
