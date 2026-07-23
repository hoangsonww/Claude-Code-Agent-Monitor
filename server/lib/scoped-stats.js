/**
 * @file scoped-stats.js
 * @description Source-scoped variants of the dashboard's aggregate queries
 * (stats + analytics). When the user restricts the "data scope" to a subset of
 * machines (see server/lib/source-filter.js), the routes call these instead of
 * the cached prepared statements in db.js so EVERY headline number — session /
 * agent / event counts, token totals, cost, daily charts, tool + type
 * distributions — reflects only the chosen sources.
 *
 * These build SQL dynamically (per request) and are used ONLY on the filtered
 * path; the unfiltered default keeps using db.js's prepared statements, so the
 * common zero-config case pays nothing for this feature.
 *
 * Every function takes a non-empty `sources` string array. The predicate is
 * either `source IN (...)` (queries over `sessions`) or a `session_id IN
 * (SELECT id FROM sessions WHERE source IN (...))` subquery (queries over
 * events / agents / token_usage), always via bound parameters.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** `?,?,…` for N sources. */
function ph(sources) {
  return sources.map(() => "?").join(",");
}

/** Subquery restricting a `session_id` column to the chosen sources. */
function sessionSubquery(sources) {
  return `SELECT id FROM sessions WHERE source IN (${ph(sources)})`;
}

function statsOverview(db, sources) {
  const sq = sessionSubquery(sources);
  const p = ph(sources);
  const row = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sessions WHERE source IN (${p})) as total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE status = 'active' AND source IN (${p})) as active_sessions,
        (SELECT COUNT(*) FROM agents WHERE status IN ('working','waiting') AND session_id IN (${sq})) as active_agents,
        (SELECT COUNT(*) FROM agents WHERE session_id IN (${sq})) as total_agents,
        (SELECT COUNT(*) FROM events WHERE session_id IN (${sq})) as total_events`
    )
    .get(...sources, ...sources, ...sources, ...sources, ...sources);
  return row;
}

function agentStatusCounts(db, sources) {
  return db
    .prepare(
      `SELECT status, COUNT(*) as count FROM agents WHERE session_id IN (${sessionSubquery(
        sources
      )}) GROUP BY status`
    )
    .all(...sources);
}

function sessionStatusCounts(db, sources) {
  return db
    .prepare(
      `SELECT status, COUNT(*) as count FROM sessions WHERE source IN (${ph(sources)}) GROUP BY status`
    )
    .all(...sources);
}

function countEventsToday(db, sources, toLocal, toUTC) {
  return db
    .prepare(
      `SELECT COUNT(*) as count FROM events
       WHERE created_at >= datetime('now', ?, 'start of day', ?)
         AND session_id IN (${sessionSubquery(sources)})`
    )
    .get(toLocal, toUTC, ...sources);
}

function tokenTotals(db, sources) {
  return db
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens + baseline_input), 0) as total_input,
        COALESCE(SUM(output_tokens + baseline_output), 0) as total_output,
        COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) as total_cache_read,
        COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) as total_cache_write,
        COALESCE(SUM(cache_write_1h_tokens + baseline_cache_write_1h), 0) as total_cache_write_1h,
        COALESCE(SUM(web_search_requests + baseline_web_search), 0) as total_web_search,
        COALESCE(SUM(web_fetch_requests + baseline_web_fetch), 0) as total_web_fetch,
        COALESCE(SUM(code_execution_requests + baseline_code_execution), 0) as total_code_execution
       FROM token_usage WHERE session_id IN (${sessionSubquery(sources)})`
    )
    .get(...sources);
}

function toolUsageCounts(db, sources) {
  return db
    .prepare(
      `SELECT tool_name, COUNT(*) as count FROM events
       WHERE tool_name IS NOT NULL AND session_id IN (${sessionSubquery(sources)})
       GROUP BY tool_name ORDER BY count DESC LIMIT 20`
    )
    .all(...sources);
}

function dailyEventCounts(db, sources, tzModifier) {
  return db
    .prepare(
      `SELECT DATE(created_at, ?) as date, COUNT(*) as count FROM events
       WHERE created_at >= DATE('now', '-365 days') AND session_id IN (${sessionSubquery(sources)})
       GROUP BY 1 ORDER BY date ASC`
    )
    .all(tzModifier, ...sources);
}

function dailySessionCounts(db, sources, tzModifier) {
  return db
    .prepare(
      `SELECT DATE(started_at, ?) as date, COUNT(*) as count FROM sessions
       WHERE started_at >= DATE('now', '-365 days') AND source IN (${ph(sources)})
       GROUP BY 1 ORDER BY date ASC`
    )
    .all(tzModifier, ...sources);
}

function agentTypeDistribution(db, sources) {
  return db
    .prepare(
      `SELECT subagent_type, COUNT(*) as count FROM agents
       WHERE type = 'subagent' AND subagent_type IS NOT NULL AND session_id IN (${sessionSubquery(
         sources
       )})
       GROUP BY subagent_type ORDER BY count DESC`
    )
    .all(...sources);
}

function totalSubagentCount(db, sources) {
  return db
    .prepare(
      `SELECT COUNT(*) as count FROM agents WHERE type = 'subagent' AND session_id IN (${sessionSubquery(
        sources
      )})`
    )
    .get(...sources);
}

function eventTypeCounts(db, sources) {
  return db
    .prepare(
      `SELECT event_type, COUNT(*) as count FROM events
       WHERE session_id IN (${sessionSubquery(sources)})
       GROUP BY event_type ORDER BY count DESC`
    )
    .all(...sources);
}

function avgEventsPerSession(db, sources) {
  const sq = sessionSubquery(sources);
  return db
    .prepare(
      `SELECT ROUND(CAST(COUNT(*) AS REAL) /
         MAX(1, (SELECT COUNT(*) FROM sessions WHERE source IN (${ph(sources)}))), 1) as avg
       FROM events WHERE session_id IN (${sq})`
    )
    .get(...sources, ...sources);
}

/** token_usage rows joined to their session start date, scoped to sources. */
function scopedTokenUsageWithDate(db, sources) {
  return db
    .prepare(
      `SELECT tu.*, DATE(s.started_at) as date
       FROM token_usage tu JOIN sessions s ON s.id = tu.session_id
       WHERE s.source IN (${ph(sources)})`
    )
    .all(...sources);
}

module.exports = {
  statsOverview,
  agentStatusCounts,
  sessionStatusCounts,
  countEventsToday,
  tokenTotals,
  toolUsageCounts,
  dailyEventCounts,
  dailySessionCounts,
  agentTypeDistribution,
  totalSubagentCount,
  eventTypeCounts,
  avgEventsPerSession,
  scopedTokenUsageWithDate,
};
