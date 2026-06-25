/**
 * @file Spend-budget evaluation and alerting logic. Computes how much has been
 * spent (in USD) within a rolling period (daily / weekly / monthly), compares it
 * against user-defined limits, and fires threshold alerts at most once per
 * period. All period math is done in UTC so the result is deterministic and
 * matches how token timestamps are stored.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const VALID_PERIODS = ["daily", "weekly", "monthly"];
const DEFAULT_THRESHOLDS = [80, 100];

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Normalise an `alert_thresholds` value (stored as a JSON string, or already an
 * array) into a sorted, de-duplicated list of integer percentages in 1..100.
 * Falls back to the default thresholds when the input is empty or unparseable.
 *
 * @param {string|number[]|null|undefined} raw
 * @returns {number[]}
 */
function parseThresholds(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  if (!Array.isArray(arr)) return [...DEFAULT_THRESHOLDS];
  const cleaned = [
    ...new Set(
      arr.map((v) => Math.round(Number(v))).filter((v) => Number.isFinite(v) && v >= 1 && v <= 100)
    ),
  ].sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : [...DEFAULT_THRESHOLDS];
}

/** Human noun for a period: daily → "day", weekly → "week", monthly → "month". */
function periodNoun(period) {
  if (period === "daily") return "day";
  if (period === "weekly") return "week";
  return "month";
}

/**
 * ISO-8601 week parts for the Monday (UTC midnight) that begins a week.
 * Returns { isoYear, isoWeek } where the year is the one owning the Thursday.
 *
 * @param {Date} mondayUTC
 */
function isoWeekParts(mondayUTC) {
  // The Thursday of the same week decides which year the week belongs to.
  const thursday = new Date(mondayUTC.getTime() + 3 * 86400000);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const jan1Dow = jan1.getUTCDay(); // 0=Sun..6=Sat
  const offsetToThursday = (4 - jan1Dow + 7) % 7;
  const firstThursday = new Date(Date.UTC(isoYear, 0, 1 + offsetToThursday));
  const isoWeek = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { isoYear, isoWeek };
}

/**
 * Compute the [start, end) UTC window and a stable key for the period that
 * contains `now`. The key changes exactly when a new period begins, which is
 * what re-arms alert thresholds.
 *
 * @param {"daily"|"weekly"|"monthly"} period
 * @param {Date} now
 * @returns {{ start: string, end: string, key: string }} ISO timestamps + key
 */
function periodWindow(period, now) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (period === "daily") {
    const start = new Date(Date.UTC(y, m, d));
    const end = new Date(Date.UTC(y, m, d + 1));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      key: `${y}-${pad2(m + 1)}-${pad2(d)}`,
    };
  }

  if (period === "weekly") {
    const dow = now.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const start = new Date(Date.UTC(y, m, d + diffToMonday));
    const end = new Date(start.getTime() + 7 * 86400000);
    const { isoYear, isoWeek } = isoWeekParts(start);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      key: `${isoYear}-W${pad2(isoWeek)}`,
    };
  }

  // monthly
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    key: `${y}-${pad2(m + 1)}`,
  };
}

/** Round to 4 decimal places, matching the precision used by the pricing route. */
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Sum USD spend for token usage whose owning session started within
 * [startISO, endISO). Baseline (post-compaction) token counts are included so
 * the figure matches the /api/pricing/cost total.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {string} startISO
 * @param {string} endISO
 * @returns {number}
 */
function spendInWindow(db, startISO, endISO) {
  // Lazy require avoids a load-order cycle (pricing route also requires db).
  const { calculateCost } = require("../routes/pricing");
  const rows = db
    .prepare(
      `SELECT tu.model AS model,
              SUM(tu.input_tokens + tu.baseline_input) AS input_tokens,
              SUM(tu.output_tokens + tu.baseline_output) AS output_tokens,
              SUM(tu.cache_read_tokens + tu.baseline_cache_read) AS cache_read_tokens,
              SUM(tu.cache_write_tokens + tu.baseline_cache_write) AS cache_write_tokens
       FROM token_usage tu
       JOIN sessions s ON s.id = tu.session_id
       WHERE s.started_at >= ? AND s.started_at < ?
       GROUP BY tu.model`
    )
    .all(startISO, endISO);
  const rules = db.prepare("SELECT * FROM model_pricing").all();
  return calculateCost(rows, rules).total_cost;
}

/** Thresholds already fired for this budget's current period. */
function firedThresholds(db, budgetId, periodKey) {
  return db
    .prepare("SELECT threshold FROM budget_alert_state WHERE budget_id = ? AND period_key = ?")
    .all(budgetId, periodKey)
    .map((r) => r.threshold)
    .sort((a, b) => a - b);
}

/**
 * Evaluate a single budget row against current spend.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {object} b  Raw `budgets` row.
 * @param {Date} now
 * @returns {object} The budget enriched with period window, spend, pct, status.
 */
function evaluateBudget(db, b, now) {
  const win = periodWindow(b.period, now);
  const spent = spendInWindow(db, win.start, win.end);
  const limit = b.limit_usd;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const thresholds = parseThresholds(b.alert_thresholds);
  const warnAt = thresholds.length > 0 ? Math.min(...thresholds) : 100;

  let status = "ok";
  if (pct >= 100) status = "exceeded";
  else if (pct >= warnAt) status = "warning";

  return {
    id: b.id,
    period: b.period,
    limit_usd: limit,
    enabled: Boolean(b.enabled),
    label: b.label ?? null,
    alert_thresholds: thresholds,
    created_at: b.created_at,
    updated_at: b.updated_at,
    period_start: win.start,
    period_end: win.end,
    period_key: win.key,
    spent: round4(spent),
    remaining: round4(limit - spent),
    pct: Math.round(pct * 100) / 100,
    status,
    fired_thresholds: firedThresholds(db, b.id, win.key),
  };
}

/**
 * Evaluate every budget (enabled or not), oldest first.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {Date} now
 * @returns {object[]}
 */
function evaluateAll(db, now) {
  return db
    .prepare("SELECT * FROM budgets ORDER BY created_at ASC, id ASC")
    .all()
    .map((b) => evaluateBudget(db, b, now));
}

/**
 * Build the user-facing title/body for a fired alert.
 *
 * @param {object} ev   Evaluated budget.
 * @param {number} peak Highest crossed threshold.
 */
function alertMessage(ev, peak) {
  const noun = periodNoun(ev.period);
  const name = ev.label ? `${ev.label} (${ev.period})` : `${ev.period} budget`;
  const title = peak >= 100 ? `Budget exceeded — ${name}` : `Budget at ${peak}% — ${name}`;
  const body = `$${ev.spent.toFixed(2)} of $${ev.limit_usd.toFixed(2)} spent this ${noun} (${Math.round(
    ev.pct
  )}%).`;
  return { title, body };
}

/**
 * Evaluate enabled budgets and fire alerts for newly-crossed thresholds.
 * A single notification is emitted per budget per check (for the highest
 * crossed threshold), but every newly-crossed threshold is recorded so it
 * won't fire again this period.
 *
 * @param {import("better-sqlite3").Database} db
 * @param {Date} now
 * @param {{ broadcast?: Function, notify?: Function }} [hooks]
 * @returns {Array<{budget_id:number, period:string, period_key:string, threshold:number, spent:number, limit_usd:number, pct:number, status:string, title:string, body:string}>}
 */
function checkAndAlert(db, now, hooks = {}) {
  const { broadcast, notify } = hooks;
  const rows = db.prepare("SELECT * FROM budgets WHERE enabled = 1").all();
  const fired = [];

  const insertState = db.prepare(
    "INSERT OR IGNORE INTO budget_alert_state (budget_id, period_key, threshold) VALUES (?, ?, ?)"
  );

  for (const b of rows) {
    const ev = evaluateBudget(db, b, now);
    const crossed = ev.alert_thresholds.filter((t) => ev.pct >= t);
    if (crossed.length === 0) continue;

    const already = new Set(ev.fired_thresholds);
    const newly = crossed.filter((t) => !already.has(t));
    if (newly.length === 0) continue;

    const record = db.transaction(() => {
      for (const t of newly) insertState.run(b.id, ev.period_key, t);
    });
    record();

    const peak = Math.max(...crossed);
    const { title, body } = alertMessage(ev, peak);
    const alert = {
      budget_id: b.id,
      period: ev.period,
      period_key: ev.period_key,
      threshold: peak,
      spent: ev.spent,
      limit_usd: ev.limit_usd,
      pct: ev.pct,
      status: ev.status,
      title,
      body,
    };
    fired.push(alert);

    if (typeof notify === "function") {
      try {
        notify(title, body, alert);
      } catch {
        // Notification transport failures must never break the check loop.
      }
    }
    if (typeof broadcast === "function") {
      try {
        broadcast("budget_alert", alert);
      } catch {
        // Ignore broadcast failures.
      }
    }
  }

  if (fired.length > 0 && typeof broadcast === "function") {
    try {
      broadcast("budgets_updated", { budgets: evaluateAll(db, now) });
    } catch {
      // Ignore broadcast failures.
    }
  }

  return fired;
}

module.exports = {
  VALID_PERIODS,
  DEFAULT_THRESHOLDS,
  parseThresholds,
  periodNoun,
  periodWindow,
  isoWeekParts,
  spendInWindow,
  evaluateBudget,
  evaluateAll,
  checkAndAlert,
};
