/**
 * @file source-filter.js
 * @description Shared helper for the "data scope" feature: restricting a query
 * to sessions collected from a chosen set of machines (see server/db.js
 * `sessions.source` and server/lib/remote-sync.js).
 *
 * The client passes `?sources=local,src_abc,...` on any data endpoint. Absent or
 * empty means "all sources" (no filter) so every existing caller and the
 * zero-config default are unaffected. This module turns that query param into a
 * SQL fragment that is safe to append to any WHERE clause — either directly on
 * `sessions.source`, or, for tables that only carry a `session_id`, as a
 * subquery so complex aggregate SQL (stats, analytics) needs only one extra AND.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Parse the `sources` query param into a de-duplicated list, or null for
 * "all sources" (no filtering).
 * @param {import("express").Request} req
 * @returns {string[]|null}
 */
function parseSources(req) {
  const raw = req.query ? req.query.sources : undefined;
  if (typeof raw !== "string") return null;
  const list = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
  return list.length > 0 ? list : null;
}

/**
 * Filter directly on a `source` column (used when `sessions` is in the query).
 * @param {string[]|null} sources result of parseSources
 * @param {string} [col] the qualified source column (default "s.source")
 * @returns {{clause:string, params:string[]}} `clause` is "" when no filter
 */
function sourceColumnClause(sources, col = "s.source") {
  if (!sources || sources.length === 0) return { clause: "", params: [] };
  const placeholders = sources.map(() => "?").join(",");
  return { clause: `${col} IN (${placeholders})`, params: sources };
}

/**
 * Filter by session origin when only a `session_id` column is available, via a
 * subquery against `sessions`. Lets stats/analytics/events/agents scope by
 * source with a single extra AND and no FROM/GROUP BY changes.
 * @param {string[]|null} sources result of parseSources
 * @param {string} sessionIdCol the qualified session-id column (e.g. "e.session_id")
 * @returns {{clause:string, params:string[]}} `clause` is "" when no filter
 */
function sessionIdInSourcesClause(sources, sessionIdCol) {
  if (!sources || sources.length === 0) return { clause: "", params: [] };
  const placeholders = sources.map(() => "?").join(",");
  return {
    clause: `${sessionIdCol} IN (SELECT id FROM sessions WHERE source IN (${placeholders}))`,
    params: sources,
  };
}

module.exports = { parseSources, sourceColumnClause, sessionIdInSourcesClause };
