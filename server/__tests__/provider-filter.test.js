/**
 * @file Unit tests for the shared provider allowlist used by dashboard-wide
 * `?providers=` filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { parseProviders } = require("../lib/provider-filter");

function req(providers) {
  return { query: { providers } };
}

describe("parseProviders", () => {
  it("accepts 'grok' (regression, PR #335 -- VALID_PROVIDERS previously lacked it)", () => {
    // Before this fix, an unrecognized value was silently stripped and, if
    // nothing valid remained, parseProviders returned null (= "no filter",
    // i.e. show every session) instead of erroring or scoping down -- so a
    // Grok-only filter would have silently become "show everything".
    assert.deepEqual(parseProviders(req("grok")), ["grok"]);
  });

  it("mixed claude,codex,grok keeps all three", () => {
    assert.deepEqual(parseProviders(req("claude,codex,grok")), ["claude", "codex", "grok"]);
  });

  it("a genuinely unknown provider is still stripped, falling back to no filter", () => {
    assert.equal(parseProviders(req("gemini")), null);
  });

  it("absent query param means no filter", () => {
    assert.equal(parseProviders({ query: {} }), null);
  });
});
