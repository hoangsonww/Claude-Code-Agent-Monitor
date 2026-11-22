/**
 * @file Unit tests for the pure budget period-window and burn-down forecast
 * math (server/lib/budget-forecast.js): daily/weekly(Sunday)/monthly bounds in
 * a viewer timezone, linear projection, exhaustion timing, and status tiers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { periodBounds, forecast, PERIODS } = require("../lib/budget-forecast");

describe("budget-forecast: periodBounds", () => {
  it("daily bounds are local midnight to +24h", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    const b = periodBounds("daily", now, 0);
    assert.equal(b.startDay, "2026-11-15");
    assert.equal(b.todayDay, "2026-11-15");
    assert.equal(new Date(b.startMs).toISOString(), "2026-11-15T00:00:00.000Z");
    assert.equal(b.endMs - b.startMs, 86_400_000);
  });

  it("weekly is Sunday-aligned", () => {
    // 2026-11-15 is a Sunday; 2026-11-18 is the following Wednesday.
    assert.equal(
      periodBounds("weekly", Date.parse("2026-11-15T12:00:00Z"), 0).startDay,
      "2026-11-15"
    );
    assert.equal(
      periodBounds("weekly", Date.parse("2026-11-18T12:00:00Z"), 0).startDay,
      "2026-11-15"
    );
    assert.equal(
      periodBounds("weekly", Date.parse("2026-11-18T12:00:00Z"), 0).endMs -
        periodBounds("weekly", Date.parse("2026-11-18T12:00:00Z"), 0).startMs,
      7 * 86_400_000
    );
  });

  it("monthly spans the calendar month", () => {
    const b = periodBounds("monthly", Date.parse("2026-11-15T12:00:00Z"), 0);
    assert.equal(new Date(b.startMs).toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(new Date(b.endMs).toISOString(), "2026-12-01T00:00:00.000Z");
  });

  it("respects the viewer timezone for the day boundary", () => {
    // 01:00Z in UTC-3 is still the previous local day.
    const b = periodBounds("daily", Date.parse("2026-11-15T01:00:00Z"), 180);
    assert.equal(b.startDay, "2026-11-14");
    assert.equal(b.todayDay, "2026-11-14");
  });

  it("throws on an unknown period", () => {
    assert.throws(() => periodBounds("yearly", Date.now(), 0), /unknown period/);
  });

  it("exposes the supported period list", () => {
    assert.deepEqual([...PERIODS], ["daily", "weekly", "monthly"]);
  });
});

describe("budget-forecast: forecast", () => {
  const start = Date.parse("2026-11-01T00:00:00Z");
  const end = Date.parse("2026-12-01T00:00:00Z");

  it("projects over the limit from a linear burn rate", () => {
    const now = Date.parse("2026-11-15T12:00:00Z"); // ~48.3% through the month
    const f = forecast({
      spent: 50,
      limit: 100,
      warnAtPercent: 80,
      startMs: start,
      endMs: end,
      nowMs: now,
    });
    assert.equal(f.percent_used, 50);
    assert.ok(f.projected_end_usd > 100);
    assert.equal(f.status, "projected_over");
    assert.ok(f.projected_exhaustion_at && f.projected_exhaustion_at < new Date(end).toISOString());
  });

  it("flags warn when already past the warn threshold", () => {
    const now = Date.parse("2026-11-20T00:00:00Z");
    const f = forecast({
      spent: 85,
      limit: 100,
      warnAtPercent: 80,
      startMs: start,
      endMs: end,
      nowMs: now,
    });
    assert.equal(f.status, "warn");
  });

  it("flags over once spend reaches the limit", () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const f = forecast({
      spent: 120,
      limit: 100,
      warnAtPercent: 80,
      startMs: start,
      endMs: end,
      nowMs: now,
    });
    assert.equal(f.status, "over");
    // Already over → no future exhaustion moment.
    assert.equal(f.projected_exhaustion_at, null);
  });

  it("stays ok and reports no exhaustion for light, on-track spend", () => {
    const now = Date.parse("2026-11-20T00:00:00Z"); // ~63% elapsed
    const f = forecast({
      spent: 10,
      limit: 100,
      warnAtPercent: 80,
      startMs: start,
      endMs: end,
      nowMs: now,
    });
    assert.equal(f.status, "ok");
    // Projected end well under the limit → exhaustion is beyond the period.
    assert.equal(f.projected_exhaustion_at, null);
    assert.ok(f.projected_end_usd < 100);
  });

  it("has no burn rate before any time has elapsed", () => {
    const f = forecast({
      spent: 0,
      limit: 100,
      warnAtPercent: 80,
      startMs: start,
      endMs: start,
      nowMs: start,
    });
    assert.equal(f.burn_rate_usd_per_hour, null);
    assert.equal(f.projected_end_usd, null);
    assert.equal(f.status, "ok");
  });

  it("percent_used is null for a zero limit rather than dividing by zero", () => {
    const now = Date.parse("2026-11-15T00:00:00Z");
    const f = forecast({
      spent: 5,
      limit: 0,
      warnAtPercent: 80,
      startMs: start,
      endMs: end,
      nowMs: now,
    });
    assert.equal(f.percent_used, null);
  });
});
