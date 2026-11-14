/**
 * @file Incremental builder for the Tool Risk Audit index. Walks the events
 * table forward by primary key in bounded id windows, classifies tool-call
 * events with server/lib/tool-risk.js, and stores only the flagged ones in
 * tool_risk_events / tool_risk_signals. Work is time-boxed per call because the
 * SQLite driver is synchronous; a background pump finishes large backfills
 * without stalling requests. The index is wiped and rebuilt when the ruleset
 * version changes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { classifyToolEvent, maxSeverity, RULESET_VERSION, SEVERITY_RANK } = require("./tool-risk");

/**
 * Event types that represent one tool *invocation* (never its result, so a
 * call is not counted twice): Claude Code's PreToolUse hook and Codex's
 * rollout/hook tool-call record.
 */
const TOOL_CALL_EVENT_TYPES = Object.freeze(["PreToolUse", "codex_tool_call"]);

/** Ids scanned per batch; bounds the cost of one synchronous step. */
const ID_WINDOW = 5000;
const DEFAULT_BUDGET_MS = 200;
const MAX_TARGET_CHARS = 1000;

function createToolRiskIndex(db) {
  const getState = db.prepare("SELECT value FROM tool_risk_state WHERE key = ?");
  const setState = db.prepare(
    "INSERT INTO tool_risk_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const maxEventId = db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM events");
  const placeholders = TOOL_CALL_EVENT_TYPES.map(() => "?").join(",");
  const selectWindow = db.prepare(
    `SELECT e.id, e.session_id, e.agent_id, e.tool_name, e.summary, e.data, e.created_at,
            s.cwd AS session_cwd
     FROM events e LEFT JOIN sessions s ON s.id = e.session_id
     WHERE e.id > ? AND e.id <= ? AND e.event_type IN (${placeholders})
     ORDER BY e.id`
  );
  const insertEvent = db.prepare(
    `INSERT OR REPLACE INTO tool_risk_events
       (event_id, session_id, agent_id, tool_name, created_at, max_severity, severity_rank, target, degraded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const deleteSignals = db.prepare("DELETE FROM tool_risk_signals WHERE event_id = ?");
  const insertSignal = db.prepare(
    "INSERT INTO tool_risk_signals (event_id, signal, severity, rule, match, host) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const bumpCounter = (key, by) => {
    if (!by) return;
    const current = Number(getState.get(key)?.value || 0);
    setState.run(key, String(current + by));
  };

  const ensureVersion = () => {
    const version = Number(getState.get("ruleset_version")?.value || 0);
    if (version === RULESET_VERSION) return;
    db.transaction(() => {
      db.prepare("DELETE FROM tool_risk_signals").run();
      db.prepare("DELETE FROM tool_risk_events").run();
      db.prepare("DELETE FROM tool_risk_state").run();
      setState.run("ruleset_version", String(RULESET_VERSION));
      setState.run("last_event_id", "0");
    })();
  };

  /** Classify one id window and advance the watermark atomically. */
  const processWindow = db.transaction((from, to) => {
    const rows = selectWindow.all(from, to, ...TOOL_CALL_EVENT_TYPES);
    let degraded = 0;
    for (const row of rows) {
      const result = classifyToolEvent({
        tool_name: row.tool_name,
        summary: row.summary,
        data: row.data,
        cwd: row.session_cwd || "",
      });
      if (result.degraded) degraded++;
      if (result.signals.length === 0) continue;
      const severity = maxSeverity(result.signals);
      insertEvent.run(
        row.id,
        row.session_id,
        row.agent_id,
        row.tool_name,
        row.created_at,
        severity,
        SEVERITY_RANK[severity],
        String(result.target || "").slice(0, MAX_TARGET_CHARS),
        result.degraded ? 1 : 0
      );
      deleteSignals.run(row.id);
      for (const s of result.signals) {
        insertSignal.run(row.id, s.signal, s.severity, s.rule, s.match, s.host || null);
      }
    }
    bumpCounter("scanned", rows.length);
    bumpCounter("degraded", degraded);
    setState.run("last_event_id", String(to));
  });

  /**
   * Index pending events until caught up or the time budget runs out.
   * @returns {{complete: boolean, last_event_id: number, max_event_id: number}}
   */
  function refresh({ budgetMs = DEFAULT_BUDGET_MS } = {}) {
    ensureVersion();
    const deadline = Date.now() + budgetMs;
    const max = maxEventId.get().id;
    let last = Number(getState.get("last_event_id")?.value || 0);
    // Ids are AUTOINCREMENT, so they never move backwards; a smaller max only
    // happens after a full wipe, which also clears this state.
    if (last > max) last = max;
    while (last < max) {
      const to = Math.min(last + ID_WINDOW, max);
      processWindow(last, to);
      last = to;
      if (Date.now() >= deadline) break;
    }
    return { complete: last >= max, last_event_id: last, max_event_id: max };
  }

  /** Counters for the UI's coverage note. */
  function stats() {
    const read = (key) => Number(getState.get(key)?.value || 0);
    return { scanned: read("scanned"), degraded: read("degraded") };
  }

  let pumpTimer = null;
  /** Finish a large backfill in the background, one budgeted slice per tick. */
  function startBackgroundPump({ intervalMs = 50, budgetMs = 100 } = {}) {
    if (pumpTimer) return;
    const tick = () => {
      pumpTimer = null;
      let state;
      try {
        state = refresh({ budgetMs });
      } catch {
        return; // Best-effort: the next audit request retries.
      }
      if (!state.complete) {
        pumpTimer = setTimeout(tick, intervalMs);
        pumpTimer.unref?.();
      }
    };
    pumpTimer = setTimeout(tick, intervalMs);
    pumpTimer.unref?.();
  }

  function stopBackgroundPump() {
    if (pumpTimer) clearTimeout(pumpTimer);
    pumpTimer = null;
  }

  return { refresh, stats, startBackgroundPump, stopBackgroundPump };
}

let shared = null;
/** Process-wide index bound to the dashboard database. */
function getToolRiskIndex() {
  if (!shared) shared = createToolRiskIndex(require("../db").db);
  return shared;
}

module.exports = { createToolRiskIndex, getToolRiskIndex, TOOL_CALL_EVENT_TYPES };
