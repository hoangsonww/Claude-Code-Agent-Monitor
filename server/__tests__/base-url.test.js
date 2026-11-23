/**
 * @file Verifies normalization and request matching for the dashboard base URL.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { injectBaseUrlIntoHtml, normalizeBaseUrl, stripBaseUrl } = require("../lib/base-url");

describe("dashboard base URL", () => {
  it("normalizes an optional path prefix", () => {
    assert.equal(normalizeBaseUrl(""), "");
    assert.equal(normalizeBaseUrl("dashboard/"), "/dashboard");
    assert.equal(normalizeBaseUrl("/team/agents/"), "/team/agents");
  });

  it("rejects absolute URLs and traversal segments", () => {
    assert.throws(() => normalizeBaseUrl("https://example.com/dashboard"), /URL path/);
    assert.throws(() => normalizeBaseUrl("/dashboard/../admin"), /dot path segments/);
    assert.throws(() => normalizeBaseUrl("/dashboard\\admin"), /URL path/);
  });

  it("strips only an exact prefix path boundary", () => {
    assert.equal(stripBaseUrl("/dashboard/api/health", "/dashboard"), "/api/health");
    assert.equal(stripBaseUrl("/dashboard", "/dashboard"), "/");
    assert.equal(stripBaseUrl("/dashboarding/api/health", "/dashboard"), null);
  });

  it("injects runtime base paths into the HTML base tag and client config", () => {
    const html = '<base href="./" data-dashboard-base /><meta name="dashboard-base-url" content="__DASHBOARD_BASE_URL__" />';
    assert.equal(
      injectBaseUrlIntoHtml(html, "/dashboard"),
      '<base href="/dashboard/" data-dashboard-base /><meta name="dashboard-base-url" content="/dashboard" />'
    );
    assert.equal(
      injectBaseUrlIntoHtml(html, ""),
      '<base href="/" data-dashboard-base /><meta name="dashboard-base-url" content="" />'
    );
  });

});
