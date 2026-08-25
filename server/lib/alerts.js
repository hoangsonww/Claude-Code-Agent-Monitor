/**
 * @file Rules-based alerting engine. Evaluates user-defined alert rules against
 * live activity: event-driven rules (event_pattern, token_threshold) run on
 * every hook ingest, time-based rules (inactivity, status_duration) run on a
 * periodic sweep. Fired alerts are persisted to alert_events with per-scope
 * cooldown dedup and broadcast to clients as `alert_triggered`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { db, stmts } = require("../db");
const { broadcast } = require("../websocket");

const RULE_TYPES = ["event_pattern", "inactivity", "status_duration", "token_threshold"];
const AGENT_STATUSES = ["working", "waiting"];

// Enabled-rules cache. Hook ingest is hot — re-querying alert_rules on every
// event would be wasted work since rules only change through the CRUD routes,
// which call invalidateRuleCache().
let rulesCache = null;

function invalidateRuleCache() {
  rulesCache = null;
}

function loadEnabledRules() {
  if (rulesCache) return rulesCache;
  rulesCache = stmts.listEnabledAlertRules.all().map((row) => {
    let config = {};
    try {
      config = JSON.parse(row.config || "{}");
    } catch {
      /* tolerate hand-edited bad JSON — rule simply never matches */
    }
    return { ...row, config };
  });
  return rulesCache;
}

/**
 * Validate and normalize a rule config for its type. Returns
 * `{ ok: true, config }` with defaults applied, or `{ ok: false, error }`.
 */
function validateRuleConfig(ruleType, config) {
  if (!RULE_TYPES.includes(ruleType)) {
    return { ok: false, error: `rule_type must be one of: ${RULE_TYPES.join(", ")}` };
  }
  const cfg = config && typeof config === "object" && !Array.isArray(config) ? config : null;
  if (!cfg) return { ok: false, error: "config must be an object" };

  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

  switch (ruleType) {
    case "event_pattern": {
      const out = {};
      for (const key of ["event_type", "tool_name", "summary_contains"]) {
        if (cfg[key] != null) {
          if (typeof cfg[key] !== "string" || !cfg[key].trim()) {
            return { ok: false, error: `${key} must be a non-empty string` };
          }
          out[key] = cfg[key].trim();
        }
      }
      if (!out.event_type && !out.tool_name && !out.summary_contains) {
        return {
          ok: false,
          error: "event_pattern needs at least one of event_type, tool_name, summary_contains",
        };
      }
      const count = cfg.count == null ? 1 : num(cfg.count);
      if (!count || !Number.isInteger(count)) {
        return { ok: false, error: "count must be a positive integer" };
      }
      out.count = count;
      if (count > 1) {
        const window = cfg.window_minutes == null ? 5 : num(cfg.window_minutes);
        if (!window) return { ok: false, error: "window_minutes must be a positive number" };
        out.window_minutes = window;
      }
      return { ok: true, config: out };
    }
    case "inactivity": {
      const minutes = num(cfg.minutes);
      if (!minutes) return { ok: false, error: "minutes must be a positive number" };
      return { ok: true, config: { minutes } };
    }
    case "status_duration": {
      if (!AGENT_STATUSES.includes(cfg.status)) {
        return { ok: false, error: `status must be one of: ${AGENT_STATUSES.join(", ")}` };
      }
      const minutes = num(cfg.minutes);
      if (!minutes) return { ok: false, error: "minutes must be a positive number" };
      return { ok: true, config: { status: cfg.status, minutes } };
    }
    case "token_threshold": {
      const total = num(cfg.total_tokens);
      if (!total || !Number.isInteger(total)) {
        return { ok: false, error: "total_tokens must be a positive integer" };
      }
      return { ok: true, config: { total_tokens: total } };
    }
    default:
      return { ok: false, error: "unsupported rule_type" };
  }
}

/**
 * Alert message builders. Both the live evaluators and the read-only rule
 * preview render their text through these, so a preview shows the exact
 * sentence the rule would produce when it really fires — no second copy of
 * the wording to drift out of sync.
 */
const messages = {
  patternMatch: (ruleName, event) =>
    `${ruleName}: event matched (${event.event_type}${event.tool_name ? ` · ${event.tool_name}` : ""})`,
  patternCount: (ruleName, seen, cfg) =>
    `${ruleName}: ${seen} matching events in ${cfg.window_minutes} min (threshold ${cfg.count})`,
  tokenThreshold: (ruleName, total, threshold) =>
    `${ruleName}: session used ${total.toLocaleString()} tokens (threshold ${threshold.toLocaleString()})`,
  inactivity: (ruleName, session, minutes) =>
    `${ruleName}: no activity on "${session.name || session.id}" for ${minutes} min`,
  statusDuration: (ruleName, agent, cfg) =>
    `${ruleName}: agent "${agent.name}" stuck in ${cfg.status} for ${cfg.minutes} min`,
};

/**
 * Fire an alert unless the same rule already fired for the same scope inside
 * its cooldown window. Persists the alert row and broadcasts it. Returns the
 * inserted row, or null when suppressed by cooldown.
 */
function fireAlert(rule, { sessionId = null, agentId = null, message, details = null }) {
  const last = stmts.lastAlertFor.get(rule.id, sessionId, agentId);
  if (last) {
    const elapsedMs = Date.now() - new Date(last.triggered_at).getTime();
    if (elapsedMs < rule.cooldown_seconds * 1000) return null;
  }

  const info = stmts.insertAlertEvent.run(
    rule.id,
    rule.name,
    rule.rule_type,
    sessionId,
    agentId,
    message,
    details ? JSON.stringify(details) : null
  );
  const alert = stmts.getAlertEvent.get(info.lastInsertRowid);
  broadcast("alert_triggered", alert);

  // Fan out to configured webhook targets. Detached and fail-safe — webhook
  // delivery must never slow or break alert firing. Lazy-required to keep the
  // module graph acyclic and tolerate any load-order edge case.
  try {
    const { dispatchAlert } = require("./webhooks");
    Promise.resolve(dispatchAlert(alert)).catch(() => {});
  } catch (err) {
    console.warn("[ALERTS] webhook dispatch failed:", err?.message || err);
  }

  return alert;
}

// `summary_contains` is a literal substring in the rule's contract — matchesPattern
// implements it with String#includes. SQL LIKE, however, treats `%` and `_` as
// wildcards, so an unescaped pattern silently widens the match: `summary_contains:
// "%"` would hit every non-null summary, and `a_b` would also match `axb`. Escaping
// the metacharacters (and the escape character itself) keeps every SQL path
// agreeing with matchesPattern.
const LIKE_ESCAPE_CHAR = "\\";
const LIKE_ESCAPE_CLAUSE = `ESCAPE '${LIKE_ESCAPE_CHAR}'`;

function likeContains(value) {
  const escaped = value.toLowerCase().replace(/[\\%_]/g, (ch) => `${LIKE_ESCAPE_CHAR}${ch}`);
  return `%${escaped}%`;
}

// Dynamic count-in-window queries vary by which pattern fields a rule sets;
// cache prepared statements by their SQL so hot rules don't re-prepare.
const countStmtCache = new Map();

function countMatchingEvents(sessionId, cfg) {
  const where = ["session_id = ?", "created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)"];
  const params = [sessionId, `-${cfg.window_minutes * 60} seconds`];
  if (cfg.event_type) {
    where.push("event_type = ?");
    params.push(cfg.event_type);
  }
  if (cfg.tool_name) {
    where.push("tool_name = ?");
    params.push(cfg.tool_name);
  }
  if (cfg.summary_contains) {
    where.push(`LOWER(COALESCE(summary, '')) LIKE ? ${LIKE_ESCAPE_CLAUSE}`);
    params.push(likeContains(cfg.summary_contains));
  }
  const sql = `SELECT COUNT(*) as count FROM events WHERE ${where.join(" AND ")}`;
  let stmt = countStmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    countStmtCache.set(sql, stmt);
  }
  return stmt.get(...params).count;
}

function matchesPattern(event, cfg) {
  if (cfg.event_type && event.event_type !== cfg.event_type) return false;
  if (cfg.tool_name && event.tool_name !== cfg.tool_name) return false;
  if (
    cfg.summary_contains &&
    !(event.summary || "").toLowerCase().includes(cfg.summary_contains.toLowerCase())
  ) {
    return false;
  }
  return true;
}

// Token totals only move on hooks that read the transcript — skip the SUM
// query for the rest of the event stream.
const TOKEN_BEARING_EVENTS = new Set(["PostToolUse", "Stop", "SubagentStop", "SessionEnd"]);

// Sweep queries are static — prepare once at module load instead of on every
// 60s tick. The time window arrives as a strftime modifier parameter.
const staleSessionsStmt = db.prepare(
  `SELECT id, name FROM sessions
   WHERE status = 'active'
     AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`
);
const stuckAgentsStmt = db.prepare(
  `SELECT a.id, a.session_id, a.name FROM agents a
   JOIN sessions s ON s.id = a.session_id
   WHERE s.status = 'active' AND a.status = ?
     AND a.updated_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`
);

/**
 * Evaluate event-driven rules against one freshly ingested event. Must never
 * throw — hook ingestion stays fail-safe regardless of rule misconfiguration.
 */
function evaluateEvent(event) {
  if (!event || !event.session_id) return;
  let rules;
  try {
    rules = loadEnabledRules();
  } catch (err) {
    console.warn("[ALERTS] rule load failed:", err?.message || err);
    return;
  }

  for (const rule of rules) {
    try {
      if (rule.rule_type === "event_pattern") {
        const cfg = rule.config;
        if (!matchesPattern(event, cfg)) continue;
        if (cfg.count > 1) {
          const seen = countMatchingEvents(event.session_id, cfg);
          if (seen < cfg.count) continue;
          fireAlert(rule, {
            sessionId: event.session_id,
            agentId: event.agent_id || null,
            message: messages.patternCount(rule.name, seen, cfg),
            details: { matched: cfg, observed_count: seen, last_event_type: event.event_type },
          });
        } else {
          fireAlert(rule, {
            sessionId: event.session_id,
            agentId: event.agent_id || null,
            message: messages.patternMatch(rule.name, event),
            details: { matched: cfg, summary: event.summary || null },
          });
        }
      } else if (rule.rule_type === "token_threshold") {
        if (!TOKEN_BEARING_EVENTS.has(event.event_type)) continue;
        const totals = stmts.sessionTokenTotals.get(event.session_id);
        const total =
          totals.input_tokens +
          totals.output_tokens +
          totals.cache_read_tokens +
          totals.cache_write_tokens;
        if (total < rule.config.total_tokens) continue;
        fireAlert(rule, {
          sessionId: event.session_id,
          message: messages.tokenThreshold(rule.name, total, rule.config.total_tokens),
          details: { total_tokens: total, threshold: rule.config.total_tokens },
        });
      }
    } catch (err) {
      console.warn(`[ALERTS] rule "${rule.name}" evaluation failed:`, err?.message || err);
    }
  }
}

/**
 * Evaluate time-based rules (inactivity, status_duration). Called by the
 * periodic sweep; exported so tests can invoke it deterministically.
 */
function sweepTimeRules() {
  let rules;
  try {
    rules = loadEnabledRules();
  } catch (err) {
    console.warn("[ALERTS] rule load failed:", err?.message || err);
    return;
  }

  for (const rule of rules) {
    try {
      if (rule.rule_type === "inactivity") {
        // sessions.updated_at is bumped on every ingested event (touchSession),
        // so "stale updated_at on an active session" ≡ "no events for N min".
        const stale = staleSessionsStmt.all(`-${rule.config.minutes * 60} seconds`);
        for (const session of stale) {
          fireAlert(rule, {
            sessionId: session.id,
            message: messages.inactivity(rule.name, session, rule.config.minutes),
            details: { minutes: rule.config.minutes },
          });
        }
      } else if (rule.rule_type === "status_duration") {
        // agents.updated_at moves on any agent update (status flips, tool
        // changes), so this detects agents *stuck* in a status with no
        // activity — the hung-agent case the rule exists for.
        const stuck = stuckAgentsStmt.all(
          rule.config.status,
          `-${rule.config.minutes * 60} seconds`
        );
        for (const agent of stuck) {
          fireAlert(rule, {
            sessionId: agent.session_id,
            agentId: agent.id,
            message: messages.statusDuration(rule.name, agent, rule.config),
            details: { status: rule.config.status, minutes: rule.config.minutes },
          });
        }
      }
    } catch (err) {
      console.warn(`[ALERTS] rule "${rule.name}" sweep failed:`, err?.message || err);
    }
  }
}

// Periodic sweep for the time-based rules. unref'd so it never keeps the
// process (or the test runner) alive — same pattern as the hooks watchdog.
const SWEEP_INTERVAL_MS = 60_000;
const sweepTimer = setInterval(sweepTimeRules, SWEEP_INTERVAL_MS);
if (sweepTimer.unref) sweepTimer.unref();

// ── Rule preview (backtest) ──────────────────────────────────────────────────
//
// A rule is cheap to write and expensive to get wrong: too loose and it pages
// you every minute, too tight and it never fires at all. Both failure modes are
// only discoverable by waiting. `previewRule` answers "what would this rule have
// done?" against data already on disk, before the rule is ever saved.
//
// It is strictly read-only: no alert_events rows, no broadcast, no webhook
// dispatch. It reuses the live matching predicates and message builders above so
// the preview cannot drift from what the engine actually does.

const PREVIEW_DEFAULT_LOOKBACK_HOURS = 24;
const PREVIEW_MAX_LOOKBACK_HOURS = 24 * 30;
const PREVIEW_DEFAULT_SAMPLE_LIMIT = 20;
const PREVIEW_MAX_SAMPLE_LIMIT = 200;
// Hard ceiling on rows pulled into memory for the event_pattern backtest. A
// broad pattern over a long lookback can match hundreds of thousands of rows;
// scanning the oldest slice and reporting `truncated` beats blocking the event
// loop on an unbounded read.
const PREVIEW_SCAN_LIMIT = 20000;

const previewStmtCache = new Map();

function preparedCached(sql) {
  let stmt = previewStmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    previewStmtCache.set(sql, stmt);
  }
  return stmt;
}

/** Rule name used for preview message rendering when none is supplied yet. */
const PREVIEW_RULE_NAME = "Preview";

function isoSince(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

/**
 * Replay `event_pattern` against historical events. Mirrors evaluateEvent:
 * events are walked oldest-first and, for count > 1 rules, each event is tested
 * against a per-session sliding window of the same width the live counter uses.
 */
function previewEventPattern(cfg, { since, ruleName, cooldownSeconds, sampleLimit }) {
  const where = ["e.created_at >= ?"];
  const params = [since];
  if (cfg.event_type) {
    where.push("e.event_type = ?");
    params.push(cfg.event_type);
  }
  if (cfg.tool_name) {
    where.push("e.tool_name = ?");
    params.push(cfg.tool_name);
  }
  if (cfg.summary_contains) {
    where.push(`LOWER(COALESCE(e.summary, '')) LIKE ? ${LIKE_ESCAPE_CLAUSE}`);
    params.push(likeContains(cfg.summary_contains));
  }

  const rows = preparedCached(
    `SELECT e.id, e.session_id, e.agent_id, e.event_type, e.tool_name, e.summary, e.created_at,
            s.name AS session_name
     FROM events e
     LEFT JOIN sessions s ON s.id = e.session_id
     WHERE ${where.join(" AND ")}
     ORDER BY e.created_at ASC, e.id ASC
     LIMIT ?`
  ).all(...params, PREVIEW_SCAN_LIMIT);

  const windowMs = (cfg.window_minutes || 0) * 60 * 1000;
  const sessionWindows = new Map(); // session_id -> ascending match timestamps
  const lastFireAt = new Map(); // cooldown scope key -> ms
  const samples = [];
  let wouldFire = 0;
  let suppressed = 0;

  for (const row of rows) {
    const at = Date.parse(row.created_at);
    let seen = 1;

    if (cfg.count > 1) {
      // The live counter asks SQLite for "matching events in this session over
      // the last window_minutes", which at fire time includes the event that
      // triggered the check. The sliding window reproduces that exactly.
      let times = sessionWindows.get(row.session_id);
      if (!times) {
        times = [];
        sessionWindows.set(row.session_id, times);
      }
      times.push(at);
      while (times.length && times[0] < at - windowMs) times.shift();
      seen = times.length;
      if (seen < cfg.count) continue;
    }

    // Cooldown dedup is scoped per (session, agent) exactly as lastAlertFor is.
    const scopeKey = `${row.session_id || ""}|${row.agent_id || ""}`;
    const last = lastFireAt.get(scopeKey);
    if (last != null && at - last < cooldownSeconds * 1000) {
      suppressed++;
      continue;
    }
    lastFireAt.set(scopeKey, at);
    wouldFire++;

    if (samples.length < sampleLimit) {
      samples.push({
        triggered_at: row.created_at,
        session_id: row.session_id,
        session_name: row.session_name || null,
        agent_id: row.agent_id || null,
        message:
          cfg.count > 1
            ? messages.patternCount(ruleName, seen, cfg)
            : messages.patternMatch(ruleName, row),
        details:
          cfg.count > 1
            ? { matched: cfg, observed_count: seen, last_event_type: row.event_type }
            : { matched: cfg, summary: row.summary || null },
      });
    }
  }

  return {
    evaluated: "history",
    matched_count: rows.length,
    would_fire_count: wouldFire,
    suppressed_by_cooldown: suppressed,
    scanned_events: rows.length,
    truncated: rows.length >= PREVIEW_SCAN_LIMIT,
    samples,
  };
}

/**
 * `token_threshold` is evaluated against *current* session totals, not replayed.
 * token_usage stores running totals rather than a per-instant history, so the
 * moment a session first crossed the threshold is not recoverable — reporting
 * which sessions sit above it today is the honest answer, and callers get
 * `evaluated: "current_state"` so the UI can say so.
 *
 * The lookback still applies, but as a *candidate filter* rather than a replay
 * window: evaluateEvent only tests this rule when a token-bearing event arrives,
 * and sessions.updated_at is bumped on every ingested event, so a session with
 * no activity inside the window can no longer fire the rule no matter how large
 * its stored total is. Listing those would report matches that provably cannot
 * happen. Callers are told which sessions were considered via
 * `candidate_window_hours` on the result.
 */
function previewTokenThreshold(cfg, { since, ruleName, sampleLimit, lookbackHours }) {
  const rows = preparedCached(
    `SELECT s.id AS session_id, s.name AS session_name,
            COALESCE(SUM(t.input_tokens), 0) + COALESCE(SUM(t.output_tokens), 0)
              + COALESCE(SUM(t.cache_read_tokens), 0) + COALESCE(SUM(t.cache_write_tokens), 0)
              AS total_tokens
     FROM sessions s
     LEFT JOIN token_usage t ON t.session_id = s.id
     WHERE COALESCE(s.updated_at, s.started_at) >= ?
     GROUP BY s.id
     HAVING total_tokens >= ?
     ORDER BY total_tokens DESC`
  ).all(since, cfg.total_tokens);

  return {
    evaluated: "current_state",
    // Surfaced so a client never has to infer why the lookback control changes
    // this rule type's results even though the totals themselves are current.
    candidate_window_hours: lookbackHours,
    matched_count: rows.length,
    would_fire_count: rows.length,
    suppressed_by_cooldown: 0,
    truncated: false,
    samples: rows.slice(0, sampleLimit).map((row) => ({
      triggered_at: null,
      session_id: row.session_id,
      session_name: row.session_name || null,
      agent_id: null,
      message: messages.tokenThreshold(ruleName, row.total_tokens, cfg.total_tokens),
      details: { total_tokens: row.total_tokens, threshold: cfg.total_tokens },
    })),
  };
}

/**
 * Time-based rules describe a condition that holds *right now* — an active
 * session with no recent events, or an agent parked in a status. Both are read
 * off live state with the same statements the sweep uses.
 */
function previewTimeRule(ruleType, cfg, { ruleName, sampleLimit }) {
  const modifier = `-${cfg.minutes * 60} seconds`;
  const rows =
    ruleType === "inactivity"
      ? staleSessionsStmt.all(modifier).map((session) => ({
          session_id: session.id,
          session_name: session.name || null,
          agent_id: null,
          message: messages.inactivity(ruleName, session, cfg.minutes),
          details: { minutes: cfg.minutes },
        }))
      : stuckAgentsStmt.all(cfg.status, modifier).map((agent) => ({
          session_id: agent.session_id,
          session_name: null,
          agent_id: agent.id,
          message: messages.statusDuration(ruleName, agent, cfg),
          details: { status: cfg.status, minutes: cfg.minutes },
        }));

  return {
    evaluated: "current_state",
    matched_count: rows.length,
    would_fire_count: rows.length,
    suppressed_by_cooldown: 0,
    truncated: false,
    samples: rows.slice(0, sampleLimit).map((row) => ({ triggered_at: null, ...row })),
  };
}

/**
 * Dry-run a candidate rule. `config` is validated with the same
 * validateRuleConfig the CRUD routes use, so a preview of an invalid rule fails
 * the same way saving it would.
 *
 * @param {string} ruleType One of RULE_TYPES.
 * @param {object} config Raw (unvalidated) rule config.
 * @param {object} [opts]
 * @param {string} [opts.name] Rule name, used to render sample messages.
 * @param {number} [opts.lookbackHours] History window for replayed rule types.
 * @param {number} [opts.cooldownSeconds] Cooldown to simulate (default 300).
 * @param {number} [opts.limit] Max sample rows to return.
 * @returns {{ok: true, preview: object}|{ok: false, error: string}}
 */
function previewRule(ruleType, config, opts = {}) {
  const validated = validateRuleConfig(ruleType, config);
  if (!validated.ok) return validated;
  const cfg = validated.config;

  const rawLookback = opts.lookbackHours;
  if (rawLookback != null && (!Number.isFinite(rawLookback) || rawLookback <= 0)) {
    return { ok: false, error: "lookback_hours must be a positive number" };
  }
  const lookbackHours = Math.min(
    rawLookback || PREVIEW_DEFAULT_LOOKBACK_HOURS,
    PREVIEW_MAX_LOOKBACK_HOURS
  );

  const rawCooldown = opts.cooldownSeconds;
  if (rawCooldown != null && (!Number.isInteger(rawCooldown) || rawCooldown < 0)) {
    return { ok: false, error: "cooldown_seconds must be a non-negative integer" };
  }
  const cooldownSeconds = rawCooldown == null ? 300 : rawCooldown;

  const rawLimit = opts.limit;
  if (rawLimit != null && (!Number.isInteger(rawLimit) || rawLimit <= 0)) {
    return { ok: false, error: "limit must be a positive integer" };
  }
  const sampleLimit = Math.min(rawLimit || PREVIEW_DEFAULT_SAMPLE_LIMIT, PREVIEW_MAX_SAMPLE_LIMIT);

  const ruleName =
    typeof opts.name === "string" && opts.name.trim() ? opts.name.trim() : PREVIEW_RULE_NAME;
  const since = isoSince(lookbackHours);
  const ctx = { since, ruleName, cooldownSeconds, sampleLimit, lookbackHours };

  let result;
  if (ruleType === "event_pattern") result = previewEventPattern(cfg, ctx);
  else if (ruleType === "token_threshold") result = previewTokenThreshold(cfg, ctx);
  else result = previewTimeRule(ruleType, cfg, ctx);

  return {
    ok: true,
    preview: {
      rule_type: ruleType,
      config: cfg,
      lookback_hours: lookbackHours,
      cooldown_seconds: cooldownSeconds,
      since,
      until: new Date().toISOString(),
      sample_limit: sampleLimit,
      ...result,
    },
  };
}

module.exports = {
  RULE_TYPES,
  validateRuleConfig,
  previewRule,
  evaluateEvent,
  sweepTimeRules,
  fireAlert,
  invalidateRuleCache,
};
