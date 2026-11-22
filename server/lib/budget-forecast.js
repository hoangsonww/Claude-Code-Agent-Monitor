/**
 * @file Pure period-window and burn-down math for cost budgets. Given a budget
 * period (daily/weekly/monthly), the current time, and the spend so far, it
 * computes the period bounds, the burn rate, a linear projection of the
 * end-of-period spend, and the projected exhaustion moment.
 *
 * Deliberately free of the database and the pricing engine: the route computes
 * `spent` from the real cost query and hands it here, so the forecast can be
 * unit-tested against a fixed clock with no I/O. Weeks are Sunday-aligned to
 * match the dashboard's activity heatmaps.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const DAY_MS = 86_400_000;
const PERIODS = Object.freeze(["daily", "weekly", "monthly"]);

/** Local calendar parts for a UTC millisecond, shifted by the viewer's tz. */
function localParts(ms, tzOffsetMin) {
  const d = new Date(ms - tzOffsetMin * 60_000);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    da: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

/** UTC millisecond for local midnight of the given local Y/M/D. */
function utcFromLocalMidnight(y, mo, da, tzOffsetMin) {
  return Date.UTC(y, mo, da) + tzOffsetMin * 60_000;
}

/** Format a UTC millisecond as its local YYYY-MM-DD day. */
function localDay(ms, tzOffsetMin) {
  const p = localParts(ms, tzOffsetMin);
  return `${p.y}-${String(p.mo + 1).padStart(2, "0")}-${String(p.da).padStart(2, "0")}`;
}

/**
 * Compute the [startMs, endMs) bounds of the period containing `nowMs`, in the
 * viewer's timezone, plus the local day strings for the first day of the period
 * and "today" (the last day with any spend, used to bound the cost query).
 *
 * @param {"daily"|"weekly"|"monthly"} period
 * @param {number} nowMs
 * @param {number} [tzOffsetMin] minutes east-of-UTC as JS getTimezoneOffset
 *   returns them (UTC-3 → 180). Defaults to 0 (UTC).
 */
function periodBounds(period, nowMs, tzOffsetMin = 0) {
  const p = localParts(nowMs, tzOffsetMin);
  let startMs;
  let endMs;
  if (period === "daily") {
    startMs = utcFromLocalMidnight(p.y, p.mo, p.da, tzOffsetMin);
    endMs = startMs + DAY_MS;
  } else if (period === "weekly") {
    // Sunday-aligned week (dow 0 = Sunday), matching the heatmaps.
    startMs = utcFromLocalMidnight(p.y, p.mo, p.da - p.dow, tzOffsetMin);
    endMs = startMs + 7 * DAY_MS;
  } else if (period === "monthly") {
    startMs = utcFromLocalMidnight(p.y, p.mo, 1, tzOffsetMin);
    endMs = utcFromLocalMidnight(p.y, p.mo + 1, 1, tzOffsetMin);
  } else {
    throw new Error(`unknown period: ${period}`);
  }
  return {
    startMs,
    endMs,
    startDay: localDay(startMs, tzOffsetMin),
    // "today" in local time — the last day the spend query needs to include.
    todayDay: localDay(nowMs, tzOffsetMin),
  };
}

const round4 = (n) => Math.round(n * 10000) / 10000;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build the burn-down status for one budget. `spent` is the real spend inside
 * the period (computed by the caller from the pricing engine). The projection
 * is a straight linear fit over the elapsed fraction of the period.
 *
 * @param {{spent:number, limit:number, warnAtPercent:number, startMs:number, endMs:number, nowMs:number}} input
 * @returns {object} status fields for the API/UI
 */
function forecast({ spent, limit, warnAtPercent = 80, startMs, endMs, nowMs }) {
  const safeSpent = Math.max(0, Number(spent) || 0);
  const safeLimit = Math.max(0, Number(limit) || 0);
  const periodHours = Math.max(0, (endMs - startMs) / 3_600_000);
  // Clamp elapsed to the period: before it starts → 0; after it ends → full.
  const elapsedHours = Math.min(periodHours, Math.max(0, (nowMs - startMs) / 3_600_000));
  const elapsedFraction = periodHours > 0 ? elapsedHours / periodHours : 0;

  // Burn rate needs a non-zero elapsed window; with none yet, it's undefined
  // (null) rather than a divide-by-zero spike.
  const burnRate = elapsedHours > 0 ? safeSpent / elapsedHours : null;
  // Linear projection of the whole period's spend from the current rate.
  const projectedEnd = burnRate === null ? null : round4(burnRate * periodHours);

  const percentUsed = safeLimit > 0 ? round2((safeSpent / safeLimit) * 100) : null;

  // When will cumulative spend hit the limit, at the current rate? Only
  // meaningful if we're burning and haven't already crossed.
  let projectedExhaustionAt = null;
  if (burnRate && burnRate > 0 && safeSpent < safeLimit) {
    const hoursToLimit = safeLimit / burnRate;
    const exhaustMs = startMs + hoursToLimit * 3_600_000;
    // Only report an exhaustion that lands within this period; a date beyond
    // period end means "won't run out this period".
    if (exhaustMs <= endMs) projectedExhaustionAt = new Date(exhaustMs).toISOString();
  }

  let status;
  if (safeLimit > 0 && safeSpent >= safeLimit) status = "over";
  else if (percentUsed !== null && percentUsed >= warnAtPercent) status = "warn";
  else if (projectedEnd !== null && safeLimit > 0 && projectedEnd > safeLimit)
    status = "projected_over";
  else status = "ok";

  return {
    spent_usd: round4(safeSpent),
    limit_usd: round4(safeLimit),
    percent_used: percentUsed,
    period_start: new Date(startMs).toISOString(),
    period_end: new Date(endMs).toISOString(),
    elapsed_fraction: round4(elapsedFraction),
    burn_rate_usd_per_hour: burnRate === null ? null : round4(burnRate),
    projected_end_usd: projectedEnd,
    projected_exhaustion_at: projectedExhaustionAt,
    status,
  };
}

module.exports = {
  PERIODS,
  periodBounds,
  forecast,
  localDay,
};
