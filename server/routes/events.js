/**
 * @file Express router for event endpoints. Supports listing events with
 * multi-dimensional filtering (event type, tool name, agent, session, text
 * search, date range) plus pagination. Also exposes a `/facets` endpoint that
 * returns the distinct event_type and tool_name values currently in the DB,
 * so the UI can populate filter dropdowns without hardcoding them. Page reads
 * select ordered IDs before fetching payloads; page and count share one snapshot
 * in the bounded read-only worker.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db, readEventPageQuery } = require("../db");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");
const { parseProviders, providerColumnClause } = require("../lib/provider-filter");

const router = Router();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

function parseCsv(value) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function parseDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Builds the WHERE clause + param array for a given filter set. Used by both
// the list and count queries so they stay in sync.
function buildWhere(filters) {
  const clauses = [];
  const params = [];

  const inClause = (field, values) => {
    clauses.push(`${field} IN (${values.map(() => "?").join(",")})`);
    params.push(...values);
  };

  if (filters.event_type) inClause("event_type", filters.event_type);
  if (filters.tool_name) inClause("tool_name", filters.tool_name);
  if (filters.agent_id) inClause("agent_id", filters.agent_id);
  if (filters.session_id) inClause("session_id", filters.session_id);

  if (filters.q) {
    clauses.push("(summary LIKE ? OR tool_name LIKE ? OR data LIKE ?)");
    const pattern = `%${filters.q}%`;
    params.push(pattern, pattern, pattern);
  }

  if (filters.from) {
    clauses.push("created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("created_at <= ?");
    params.push(filters.to);
  }

  // Resolve the intersection once at session granularity, rather than checking
  // independent source/provider memberships for every historical event.
  const scope = sourceColumnClause(filters.sources, "source");
  const providerScope = providerColumnClause(filters.providers, "provider");
  const sessionClauses = [scope.clause, providerScope.clause].filter(Boolean);
  if (sessionClauses.length > 0) {
    clauses.push(`session_id IN (SELECT id FROM sessions WHERE ${sessionClauses.join(" AND ")})`);
    params.push(...scope.params, ...providerScope.params);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

// GET /api/events?event_type=a,b&tool_name=Bash&q=curl&from=...&to=...&limit=50&offset=0
router.get("/", async (req, res, next) => {
  try {
    const limit = clampInt(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    const filters = {
      event_type: parseCsv(req.query.event_type),
      tool_name: parseCsv(req.query.tool_name),
      agent_id: parseCsv(req.query.agent_id),
      session_id: parseCsv(req.query.session_id),
      q: typeof req.query.q === "string" && req.query.q.trim() !== "" ? req.query.q.trim() : null,
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
      sources: parseSources(req),
      providers: parseProviders(req),
    };

    const { sql: whereSql, params: whereParams } = buildWhere(filters);

    // Keep full payloads out of the scope-filtered sort. The inner LIMIT also
    // prevents flattening, so only the requested page is fetched by primary key.
    const listSql = `SELECT e.* FROM events e
      JOIN (SELECT id FROM events ${whereSql}
            ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?) page ON page.id = e.id
      ORDER BY e.created_at DESC, e.id DESC`;
    const countSql = `SELECT COUNT(*) as count FROM events ${whereSql}`;

    // Scope-first plans can sort millions of matching historical IDs to serve
    // the first page. Try a bounded newest global prefix first. LIMIT prevents
    // flattening: predicates examine only these candidates by primary key.
    // A full result proves the page complete; otherwise the reader falls back
    // to listSql on the same snapshot, preserving sparse/old scope semantics.
    const probe =
      whereSql && limit + offset <= 500
        ? {
            sql: `SELECT e.* FROM events e JOIN (
              SELECT candidate.id FROM (
                SELECT id FROM events ORDER BY created_at DESC, id DESC LIMIT ?
              ) recent CROSS JOIN events candidate ON candidate.id = recent.id
              ${whereSql}
              ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT ? OFFSET ?
            ) page ON page.id = e.id ORDER BY e.created_at DESC, e.id DESC`,
            params: [Math.max(128, 4 * (limit + offset)), ...whereParams, limit, offset],
            limit,
          }
        : null;
    const { events, total } = await readEventPageQuery(
      { sql: listSql, params: [...whereParams, limit, offset], ...(probe ? { probe } : {}) },
      { sql: countSql, params: whereParams }
    );

    res.json({ events, limit, offset, total });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/facets — distinct event_type / tool_name values in the DB.
router.get("/facets", (req, res) => {
  const { sql: whereSql, params } = buildWhere({
    sources: parseSources(req),
    providers: parseProviders(req),
  });
  const eventTypeWhere = whereSql
    ? `${whereSql} AND event_type IS NOT NULL`
    : "WHERE event_type IS NOT NULL";
  const toolNameWhere = whereSql
    ? `${whereSql} AND tool_name IS NOT NULL`
    : "WHERE tool_name IS NOT NULL";
  const eventTypes = db
    .prepare(`SELECT DISTINCT event_type FROM events ${eventTypeWhere} ORDER BY event_type`)
    .all(...params)
    .map((r) => r.event_type);

  const toolNames = db
    .prepare(`SELECT DISTINCT tool_name FROM events ${toolNameWhere} ORDER BY tool_name`)
    .all(...params)
    .map((r) => r.tool_name);

  res.json({ event_types: eventTypes, tool_names: toolNames });
});

module.exports = router;
