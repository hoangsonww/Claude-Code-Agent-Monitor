/**
 * @file Periodic spend-budget evaluation. On each tick it recomputes
 * current-period spend for every enabled budget and fires web-push / native /
 * websocket alerts when a configured threshold is newly crossed. Mirrors the
 * fail-safe, env-gated shape of update-scheduler.js.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { db } = require("./db");
const { checkAndAlert } = require("./lib/budgets");
const { sendPushToAll, showNativeNotificationIfElectron } = require("./lib/push");

function isDisabled() {
  const v = process.env.DASHBOARD_BUDGET_CHECK;
  return v === "0" || v === "false" || v === "off";
}

function intervalMs() {
  const n = Number.parseInt(process.env.DASHBOARD_BUDGET_CHECK_INTERVAL_MS || "", 10);
  // Floor at 15s so a misconfigured value can't hammer the DB.
  if (Number.isFinite(n) && n >= 15_000) return n;
  return 60 * 1000;
}

/**
 * Start the budget scheduler.
 *
 * @param {{ broadcast: Function }} deps
 * @returns {{ stop: () => void }}
 */
function startBudgetScheduler({ broadcast }) {
  if (isDisabled()) return { stop: () => {} };

  let stopped = false;
  let initialTimer = null;
  let intervalTimer = null;

  async function notify(title, body) {
    // Native first (covers the desktop/Electron host), then web push for
    // browser subscribers. Both are best-effort.
    showNativeNotificationIfElectron(title, body);
    try {
      await sendPushToAll(db, title, body);
    } catch {
      // Push transport errors are non-fatal.
    }
  }

  function tick() {
    if (stopped) return;
    try {
      const fired = checkAndAlert(db, new Date(), { broadcast, notify });
      if (fired.length > 0) {
        for (const a of fired) {
          console.log(
            `[budgets] alert: budget #${a.budget_id} (${a.period}) crossed ${a.threshold}% — ` +
              `$${a.spent.toFixed(2)} / $${a.limit_usd.toFixed(2)}`
          );
        }
      }
    } catch (err) {
      console.warn("[budgets] check failed:", err.message);
    }
  }

  // Small delay so startup isn't blocked by a cost computation.
  initialTimer = setTimeout(tick, 5000);
  initialTimer.unref?.();

  intervalTimer = setInterval(tick, intervalMs());
  intervalTimer.unref?.();

  return {
    stop() {
      stopped = true;
      if (initialTimer) clearTimeout(initialTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    },
  };
}

module.exports = { startBudgetScheduler };
