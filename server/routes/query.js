/**
 * @file Express router for the Advanced Query Explorer. Provides a unified
 * safe-query interface over sessions, agents, and events with multi-dimensional
 * filtering, pagination, sorting, and CSV/JSON export. All SQL is parameterised
 * via an explicit allowlist; no raw user-supplied SQL is ever executed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db } = require("../db");
const { parseSources, sessionIdInSourcesClause } = require("../lib/source-filter");
const { parseProviders, sessionIdInProvidersClause } = require("../lib/provider-filter");

const router = Router();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;
const EXPORT_LIMIT = 5000;

// Allowed sort columns per entity — protects against SQL injection via ORDER BY.
const ALLOWED_SORT = {
  sessions: new Set(["started_at", "ended_at", "updated_at", "status", "id"]),
  agents:   new Set(["started_at", "ended_at", "updated_at", "status", "id"]),
  events:   new Set(["created_at", "event_type", "tool_name", "id"]),
};

function parseCsv(value) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function parseDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function safeSortCol(entity, col, fallback) {
  const allowed = ALLOWED_SORT[entity];
  if (!allowed) return fallback;
  return allowed.has(col) ? col : fallback;
}

// ---------------------------------------------------------------------------
// Sessions query
// ---------------------------------------------------------------------------
function querySessions(filters, limit, offset) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push(`s.status IN (${filters.status.map(() => "?").join(",")})`);
    params.push(...filters.status);
  }
  if (filters.q) {
    clauses.push("(s.id LIKE ? OR s.name LIKE ? OR s.cwd LIKE ?)");
    const p = `%${filters.q}%`;
    params.push(p, p, p);
  }
  if (filters.from) { clauses.push("s.started_at >= ?"); params.push(filters.from); }
  if (filters.to)   { clauses.push("s.started_at <= ?"); params.push(filters.to); }

  const sourceScope = sessionIdInSourcesClause(filters.sources, "id");
  if (sourceScope.clause) { clauses.push(sourceScope.clause); params.push(...sourceScope.params); }
  const providerScope = sessionIdInProvidersClause(filters.providers, "id");
  if (providerScope.clause) { clauses.push(providerScope.clause); params.push(...providerScope.params); }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sortCol = safeSortCol("sessions", filters.sort_by, "started_at");
  const sortDir = filters.sort_dir === "asc" ? "ASC" : "DESC";

  const rows = db.prepare(
    `SELECT s.id, s.name, s.status, s.model, s.cwd, s.started_at, s.ended_at,
            (SELECT COUNT(*) FROM agents a WHERE a.session_id = s.id) AS agent_count,
            (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id) AS event_count
     FROM sessions s ${where} ORDER BY s.${sortCol} ${sortDir} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  const { count: total } = db.prepare(`SELECT COUNT(*) AS count FROM sessions s ${where}`).get(...params);
  return { rows, total, columns: ["id", "name", "status", "model", "cwd", "started_at", "ended_at", "agent_count", "event_count"] };
}

// ---------------------------------------------------------------------------
// Agents query
// ---------------------------------------------------------------------------
function queryAgents(filters, limit, offset) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push(`a.status IN (${filters.status.map(() => "?").join(",")})`);
    params.push(...filters.status);
  }
  if (filters.q) {
    clauses.push("(a.id LIKE ? OR a.session_id LIKE ?)");
    const p = `%${filters.q}%`;
    params.push(p, p);
  }
  if (filters.from) { clauses.push("a.started_at >= ?"); params.push(filters.from); }
  if (filters.to)   { clauses.push("a.started_at <= ?"); params.push(filters.to); }

  const sourceScope = sessionIdInSourcesClause(filters.sources, "session_id");
  if (sourceScope.clause) { clauses.push(sourceScope.clause); params.push(...sourceScope.params); }
  const providerScope = sessionIdInProvidersClause(filters.providers, "session_id");
  if (providerScope.clause) { clauses.push(providerScope.clause); params.push(...providerScope.params); }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sortCol = safeSortCol("agents", filters.sort_by, "started_at");
  const sortDir = filters.sort_dir === "asc" ? "ASC" : "DESC";

  const rows = db.prepare(
    `SELECT a.id, a.session_id, a.status, a.type, a.started_at, a.ended_at,
            (SELECT COUNT(*) FROM events e WHERE e.agent_id = a.id) AS event_count
     FROM agents a ${where} ORDER BY a.${sortCol} ${sortDir} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  const { count: total } = db.prepare(`SELECT COUNT(*) AS count FROM agents a ${where}`).get(...params);
  return { rows, total, columns: ["id", "session_id", "status", "type", "started_at", "ended_at", "event_count"] };
}

// ---------------------------------------------------------------------------
// Events query
// ---------------------------------------------------------------------------
function queryEvents(filters, limit, offset) {
  const clauses = [];
  const params = [];

  if (filters.event_type) {
    clauses.push(`event_type IN (${filters.event_type.map(() => "?").join(",")})`);
    params.push(...filters.event_type);
  }
  if (filters.tool_name) {
    clauses.push(`tool_name IN (${filters.tool_name.map(() => "?").join(",")})`);
    params.push(...filters.tool_name);
  }
  if (filters.q) {
    clauses.push("(summary LIKE ? OR tool_name LIKE ?)");
    const p = `%${filters.q}%`;
    params.push(p, p);
  }
  if (filters.from) { clauses.push("created_at >= ?"); params.push(filters.from); }
  if (filters.to)   { clauses.push("created_at <= ?"); params.push(filters.to); }

  const sourceScope = sessionIdInSourcesClause(filters.sources, "session_id");
  if (sourceScope.clause) { clauses.push(sourceScope.clause); params.push(...sourceScope.params); }
  const providerScope = sessionIdInProvidersClause(filters.providers, "session_id");
  if (providerScope.clause) { clauses.push(providerScope.clause); params.push(...providerScope.params); }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sortCol = safeSortCol("events", filters.sort_by, "created_at");
  const sortDir = filters.sort_dir === "asc" ? "ASC" : "DESC";

  const rows = db.prepare(
    `SELECT id, session_id, agent_id, event_type, tool_name, summary, created_at
     FROM events ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  const { count: total } = db.prepare(`SELECT COUNT(*) AS count FROM events ${where}`).get(...params);
  return { rows, total, columns: ["id", "session_id", "agent_id", "event_type", "tool_name", "summary", "created_at"] };
}

// ---------------------------------------------------------------------------
// Shared filter parser
// ---------------------------------------------------------------------------
function parseFilters(req) {
  return {
    status:     parseCsv(req.query.status),
    event_type: parseCsv(req.query.event_type),
    tool_name:  parseCsv(req.query.tool_name),
    q: typeof req.query.q === "string" && req.query.q.trim() !== "" ? req.query.q.trim() : null,
    from:       parseDate(req.query.from),
    to:         parseDate(req.query.to),
    sort_by:    typeof req.query.sort_by === "string" ? req.query.sort_by : null,
    sort_dir:   req.query.sort_dir === "asc" ? "asc" : "desc",
    sources:    parseSources(req),
    providers:  parseProviders(req),
  };
}

// ---------------------------------------------------------------------------
// GET /api/query?entity=sessions|agents|events&...filters&limit&offset
// ---------------------------------------------------------------------------
router.get("/", (req, res) => {
  const entity = ["sessions", "agents", "events"].includes(req.query.entity)
    ? req.query.entity
    : "events";
  const limit  = clampInt(req.query.limit,  DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const filters = parseFilters(req);

  let result;
  if (entity === "sessions") result = querySessions(filters, limit, offset);
  else if (entity === "agents") result = queryAgents(filters, limit, offset);
  else result = queryEvents(filters, limit, offset);

  res.json({ entity, ...result, limit, offset });
});

// ---------------------------------------------------------------------------
// GET /api/query/facets?entity=sessions|agents|events — distinct filter values
// ---------------------------------------------------------------------------
router.get("/facets", (req, res) => {
  const entity = ["sessions", "agents", "events"].includes(req.query.entity)
    ? req.query.entity
    : "events";
  const filters = parseFilters(req);

  const facets = {};
  if (entity === "sessions" || entity === "agents") {
    const table = entity === "sessions" ? "sessions" : "agents";
    const clauses = [];
    const params = [];
    const sourceScope = sessionIdInSourcesClause(filters.sources, "id");
    if (sourceScope.clause) { clauses.push(sourceScope.clause); params.push(...sourceScope.params); }
    const providerScope = sessionIdInProvidersClause(filters.providers, "id");
    if (providerScope.clause) { clauses.push(providerScope.clause); params.push(...providerScope.params); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    facets.statuses = db.prepare(`SELECT DISTINCT status FROM ${table} ${where} WHERE status IS NOT NULL ORDER BY status`).all(...params).map((r) => r.status);
  }
  if (entity === "events") {
    const clauses = [];
    const params = [];
    const sourceScope = sessionIdInSourcesClause(filters.sources, "session_id");
    if (sourceScope.clause) { clauses.push(sourceScope.clause); params.push(...sourceScope.params); }
    const providerScope = sessionIdInProvidersClause(filters.providers, "session_id");
    if (providerScope.clause) { clauses.push(providerScope.clause); params.push(...providerScope.params); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    facets.event_types = db.prepare(`SELECT DISTINCT event_type FROM events ${where} WHERE event_type IS NOT NULL ORDER BY event_type`).all(...params).map((r) => r.event_type);
    facets.tool_names  = db.prepare(`SELECT DISTINCT tool_name  FROM events ${where} WHERE tool_name  IS NOT NULL ORDER BY tool_name`).all(...params).map((r) => r.tool_name);
  }
  res.json({ entity, ...facets });
});

// ---------------------------------------------------------------------------
// GET /api/query/export?entity=...&format=csv|json&...filters — download
// ---------------------------------------------------------------------------
router.get("/export", (req, res) => {
  const entity = ["sessions", "agents", "events"].includes(req.query.entity)
    ? req.query.entity
    : "events";
  const format  = req.query.format === "json" ? "json" : "csv";
  const filters = parseFilters(req);

  let result;
  if (entity === "sessions") result = querySessions(filters, EXPORT_LIMIT, 0);
  else if (entity === "agents") result = queryAgents(filters, EXPORT_LIMIT, 0);
  else result = queryEvents(filters, EXPORT_LIMIT, 0);

  const filename = `ccam-${entity}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
    res.setHeader("Content-Type", "application/json");
    const truncated = result.total > EXPORT_LIMIT;
    return res.json({
      entity,
      total: result.total,
      rows: result.rows,
      truncated,
      message: truncated ? `Export limited to ${EXPORT_LIMIT} rows; ${result.total} total rows match.` : undefined,
    });
  }

  // CSV
  const { columns, rows } = result;
  const escape = (v) => {
    if (v == null) return "";
    let s = String(v);
    // Neutralize spreadsheet formula prefixes (=, +, -, @, tab, CR), even
    // after leading whitespace, before quoting.
    if (/^[\s=+\-@]/.test(s)) {
      s = "'" + s;
    }
    return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const truncated = result.total > EXPORT_LIMIT;
  const lines = [
    ...(truncated ? [`# WARNING: Export limited to ${EXPORT_LIMIT} rows; ${result.total} total rows match.`] : []),
    columns.join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
  ];
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.setHeader("Content-Type", "text/csv");
  res.send(lines.join("\r\n"));
});

module.exports = router;
