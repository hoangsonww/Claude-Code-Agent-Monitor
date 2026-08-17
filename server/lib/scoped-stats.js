/**
 * @file scoped-stats.js
 * @description Provider- and source-scoped variants of the dashboard aggregate
 * queries. They keep all statistics aligned with the global data selectors
 * without changing the fast prepared-statement path when no scope is active.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

function placeholders(values) {
  return values.map(() => "?").join(",");
}

function sessionScope(sources, providers, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const clauses = [];
  const params = [];
  if (sources?.length) {
    clauses.push(`${prefix}source IN (${placeholders(sources)})`);
    params.push(...sources);
  }
  if (providers?.length) {
    clauses.push(`${prefix}provider IN (${placeholders(providers)})`);
    params.push(...providers);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function sessionSubquery(sources, providers) {
  const scope = sessionScope(sources, providers);
  return { sql: `SELECT id FROM sessions ${scope.where}`, params: scope.params };
}

function statsOverview(db, sources, providers) {
  const scope = sessionScope(sources, providers);
  const sessions = `SELECT id FROM sessions ${scope.where}`;
  const active = sessionScope(sources, providers);
  const activeWhere = active.where
    ? `${active.where} AND status = 'active'`
    : "WHERE status = 'active'";
  return db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM sessions ${scope.where}) as total_sessions,
        (SELECT COUNT(*) FROM sessions ${activeWhere}) as active_sessions,
        (SELECT COUNT(*) FROM agents WHERE status IN ('working','waiting') AND session_id IN (${sessions})) as active_agents,
        (SELECT COUNT(*) FROM agents WHERE session_id IN (${sessions})) as total_agents,
        (SELECT COUNT(*) FROM events WHERE session_id IN (${sessions})) as total_events`
    )
    .get(...scope.params, ...active.params, ...scope.params, ...scope.params, ...scope.params);
}

function agentStatusCounts(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT status, COUNT(*) as count FROM agents WHERE session_id IN (${scope.sql}) GROUP BY status`
    )
    .all(...scope.params);
}

function sessionStatusCounts(db, sources, providers) {
  const scope = sessionScope(sources, providers);
  return db
    .prepare(`SELECT status, COUNT(*) as count FROM sessions ${scope.where} GROUP BY status`)
    .all(...scope.params);
}

function countEventsToday(db, sources, providers, toLocal, toUTC) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT COUNT(*) as count FROM events
       WHERE created_at >= datetime('now', ?, 'start of day', ?)
         AND session_id IN (${scope.sql})`
    )
    .get(toLocal, toUTC, ...scope.params);
}

function tokenTotals(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
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
       FROM token_usage WHERE session_id IN (${scope.sql})`
    )
    .get(...scope.params);
}

function toolUsageCounts(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT tool_name, COUNT(*) as count FROM events
       WHERE tool_name IS NOT NULL AND session_id IN (${scope.sql})
       GROUP BY tool_name ORDER BY count DESC LIMIT 20`
    )
    .all(...scope.params);
}

function dailyEventCounts(db, sources, providers, tzModifier) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT DATE(created_at, ?) as date, COUNT(*) as count FROM events
       WHERE created_at >= DATE('now', '-365 days') AND session_id IN (${scope.sql})
       GROUP BY 1 ORDER BY date ASC`
    )
    .all(tzModifier, ...scope.params);
}

function dailySessionCounts(db, sources, providers, tzModifier) {
  const scope = sessionScope(sources, providers);
  const where = scope.where
    ? `${scope.where} AND started_at >= DATE('now', '-365 days')`
    : "WHERE started_at >= DATE('now', '-365 days')";
  return db
    .prepare(
      `SELECT DATE(started_at, ?) as date, COUNT(*) as count FROM sessions
       ${where} GROUP BY 1 ORDER BY date ASC`
    )
    .all(tzModifier, ...scope.params);
}

function agentTypeDistribution(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT subagent_type, COUNT(*) as count FROM agents
       WHERE type = 'subagent' AND subagent_type IS NOT NULL AND session_id IN (${scope.sql})
       GROUP BY subagent_type ORDER BY count DESC`
    )
    .all(...scope.params);
}

function totalSubagentCount(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT COUNT(*) as count FROM agents WHERE type = 'subagent' AND session_id IN (${scope.sql})`
    )
    .get(...scope.params);
}

function eventTypeCounts(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  return db
    .prepare(
      `SELECT event_type, COUNT(*) as count FROM events
       WHERE session_id IN (${scope.sql}) GROUP BY event_type ORDER BY count DESC`
    )
    .all(...scope.params);
}

function avgEventsPerSession(db, sources, providers) {
  const scope = sessionSubquery(sources, providers);
  const sessions = sessionScope(sources, providers);
  return db
    .prepare(
      `SELECT ROUND(CAST(COUNT(*) AS REAL) /
         MAX(1, (SELECT COUNT(*) FROM sessions ${sessions.where})), 1) as avg
       FROM events WHERE session_id IN (${scope.sql})`
    )
    .get(...sessions.params, ...scope.params);
}

function scopedTokenUsageWithDate(db, sources, providers) {
  const scope = sessionScope(sources, providers, "s");
  return db
    .prepare(
      `SELECT tu.*, s.provider, DATE(s.started_at) as date
       FROM token_usage tu JOIN sessions s ON s.id = tu.session_id ${scope.where}`
    )
    .all(...scope.params);
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
