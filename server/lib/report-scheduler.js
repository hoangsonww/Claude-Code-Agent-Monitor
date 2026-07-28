/**
 * @file Periodic scheduler for Scheduled Analytics Reports. On a 60s unref'd
 * tick it materializes a run for every enabled definition whose next_run_at has
 * come due, advancing the schedule as it goes. Reuses the exact generate-and-
 * persist path from routes/reports.js (runReportForDefinition) so on-demand and
 * scheduled runs are byte-for-byte identical. Env-gated by
 * DASHBOARD_REPORTS_DISABLED; the timer is unref'd so it never keeps the
 * process (or the test runner) alive — same pattern as the alerts sweep and the
 * update scheduler.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const dbModule = require("../db");
const { runReportForDefinition, serializeRun } = require("../routes/reports");

const SCHEDULER_INTERVAL_MS = 60_000;

function isDisabled() {
  const v = (process.env.DASHBOARD_REPORTS_DISABLED || "").toLowerCase();
  return v === "1" || v === "true" || v === "off";
}

// Static — prepared once. Selects enabled definitions that are due to run.
const dueDefsStmt = dbModule.db.prepare(
  "SELECT * FROM report_definitions WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC"
);

/**
 * Run every enabled definition whose next_run_at <= now. Generates + persists a
 * run for each (a thrown generation error is captured as an `error`-status run
 * inside runReportForDefinition — it never crashes the tick), advances the
 * schedule, and broadcasts run metadata. Returns the list of run rows produced.
 * Exported so tests can invoke it deterministically with a pinned `nowMs`.
 */
function runDueReports(nowMs = Date.now(), broadcast = null) {
  const nowIso = new Date(nowMs).toISOString();
  let due;
  try {
    due = dueDefsStmt.all(nowIso);
  } catch (err) {
    console.warn("[REPORTS] due-definition load failed:", err?.message || err);
    return [];
  }

  const produced = [];
  for (const def of due) {
    try {
      const run = runReportForDefinition(def, nowMs);
      produced.push(run);
      if (typeof broadcast === "function") {
        broadcast("report_run", serializeRun(run));
      }
    } catch (err) {
      // runReportForDefinition is itself fail-safe, but guard the loop so one
      // bad definition can never abort the rest of the tick.
      console.warn(`[REPORTS] definition "${def.name}" run failed:`, err?.message || err);
    }
  }
  return produced;
}

/**
 * Start the report scheduler. Returns `{ stop }`. No-op (still returns a valid
 * handle) when disabled via env.
 */
function startReportScheduler({ broadcast } = {}) {
  if (isDisabled()) return { stop: () => {} };

  const timer = setInterval(() => {
    try {
      runDueReports(Date.now(), broadcast);
    } catch (err) {
      // Defensive — the tick must never throw out and kill the interval.
      console.warn("[REPORTS] scheduler tick failed:", err?.message || err);
    }
  }, SCHEDULER_INTERVAL_MS);
  if (timer.unref) timer.unref();

  return {
    stop: () => clearInterval(timer),
  };
}

module.exports = { startReportScheduler, runDueReports, SCHEDULER_INTERVAL_MS };
