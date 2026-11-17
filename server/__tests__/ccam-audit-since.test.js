/**
 * @file Unit tests for `ccam audit`'s --since parser (cli/commands/audit.js):
 * minute/hour/day/week windows resolve to an ISO lower bound, "all" means no
 * bound, and anything else is a usage error rather than a silent default.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sinceToIso, indexingProgress } = require("../../cli/commands/audit");

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

describe("ccam audit indexing warning", () => {
  const complete = { complete: true, last_event_id: 100, max_event_id: 100 };
  const partial = { complete: false, last_event_id: 40, max_event_id: 100 };

  it("stays silent only when both responses are complete", () => {
    assert.equal(indexingProgress({ indexing: complete }, { indexing: complete }), null);
  });

  it("warns when the summary is incomplete even if the list is complete", () => {
    // The regression the fix targets: /summary can lag /tools, so a `critical 0`
    // tile must not be shown beside a still-indexing summary without a notice.
    assert.deepEqual(indexingProgress({ indexing: partial }, { indexing: complete }), { pct: 40 });
  });

  it("warns when the list is incomplete even if the summary is complete", () => {
    assert.deepEqual(indexingProgress({ indexing: complete }, { indexing: partial }), { pct: 40 });
  });

  it("reports the laggard's progress when both are incomplete", () => {
    assert.deepEqual(
      indexingProgress(
        { indexing: { complete: false, last_event_id: 70, max_event_id: 100 } },
        { indexing: partial }
      ),
      { pct: 40 }
    );
  });
});
