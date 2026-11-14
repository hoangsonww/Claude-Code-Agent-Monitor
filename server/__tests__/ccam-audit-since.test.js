/**
 * @file Unit tests for `ccam audit`'s --since parser (cli/commands/audit.js):
 * minute/hour/day/week windows resolve to an ISO lower bound, "all" means no
 * bound, and anything else is a usage error rather than a silent default.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sinceToIso } = require("../../cli/commands/audit");

describe("ccam audit --since", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  it("resolves m/h/d/w windows", () => {
    assert.equal(sinceToIso("30m", now), "2026-11-14T11:30:00.000Z");
    assert.equal(sinceToIso("24h", now), "2026-11-13T12:00:00.000Z");
    assert.equal(sinceToIso("7d", now), "2026-11-07T12:00:00.000Z");
    assert.equal(sinceToIso("2W", now), "2026-10-31T12:00:00.000Z");
  });
  it("treats all / undefined as unbounded", () => {
    assert.equal(sinceToIso("all", now), undefined);
    assert.equal(sinceToIso(undefined, now), undefined);
  });
  it("rejects anything else", () => {
    for (const bad of ["yesterday", "7", "d7", "-1d", "1y"]) {
      assert.throws(() => sinceToIso(bad, now), /Invalid --since/, bad);
    }
  });
});
