/**
 * @file Express router for event endpoints. Supports listing events with
 * multi-dimensional filtering (event type, tool name, agent, session, text
 * search, date range) plus pagination. Also exposes a `/facets` endpoint that
 * returns the distinct event_type and tool_name values currently in the DB,
 * so the UI can populate filter dropdowns without hardcoding them. Also serves
 * `/stream`, a Server-Sent Events mirror of the WebSocket broadcast feed for
 * clients that cannot open a WebSocket (curl, scripts, proxied browsers).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db } = require("../db");
const { parseSources, sessionIdInSourcesClause } = require("../lib/source-filter");
const { parseProviders, sessionIdInProvidersClause } = require("../lib/provider-filter");
const { addClient } = require("../lib/sse");

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

  // Data-scope: restrict to events whose session was collected from a chosen
  // set of machines. `events` carries only session_id, so filter via subquery.
  const scope = sessionIdInSourcesClause(filters.sources, "session_id");
  if (scope.clause) {
    clauses.push(scope.clause);
    params.push(...scope.params);
  }
  const providerScope = sessionIdInProvidersClause(filters.providers, "session_id");
  if (providerScope.clause) {
    clauses.push(providerScope.clause);
    params.push(...providerScope.params);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

// GET /api/events?event_type=a,b&tool_name=Bash&q=curl&from=...&to=...&limit=50&offset=0
router.get("/", (req, res) => {
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

  const listSql = `SELECT * FROM events ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as count FROM events ${whereSql}`;

  const events = db.prepare(listSql).all(...whereParams, limit, offset);
  const { count: total } = db.prepare(countSql).get(...whereParams);

  res.json({ events, limit, offset, total });
});

// GET /api/events/facets — distinct event_type / tool_name values in the DB.
// GET /api/events/stream - Server-Sent Events mirror of the WebSocket feed.
//
// Same envelopes, same message types, no Upgrade handshake — so `curl -N`, a
// shell script, an automation runner, or a browser behind a proxy that strips
// WebSocket upgrades can all consume live activity. `?types=` narrows the feed
// server-side; `Last-Event-ID` resumes a dropped connection from the replay
// buffer (a `stream_gap` event is emitted when the gap is too large to cover).
//
// Declared before the `/` list handler purely for readability — Express matches
// on the exact path either way.
router.get("/stream", (req, res) => {
  const types = parseCsv(req.query.types);
  if (!addClient(req, res, { types })) {
    return res.status(503).json({
      error: {
        code: "STREAM_LIMIT",
        message:
          "Too many concurrent event streams. Close an existing stream or raise DASHBOARD_SSE_MAX_CLIENTS.",
      },
    });
  }
  // No response is sent here: addClient() has taken ownership of `res` and holds
  // it open until the client disconnects or the server shuts down.
});

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
