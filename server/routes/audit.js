/**
 * @file Express router for the Tool Risk Audit (#301). Read-only views over the
 * derived tool_risk_* index: `GET /tools` lists flagged tool calls with their
 * signals (same filter and pagination shape as /api/events, plus signal and
 * severity), `GET /summary` returns counts per signal, severity, project and
 * egress host for the header tiles, `GET /export` streams the filtered rows as
 * CSV or JSON, and `GET /rules` describes the built-in ruleset. Each request
 * first advances the incremental index within a small time budget.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db } = require("../db");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");
const { parseProviders, providerColumnClause } = require("../lib/provider-filter");
const {
  SIGNALS,
  SEVERITIES,
  SEVERITY_RANK,
  COMMAND_RULES,
  CREDENTIAL_RULES,
  RULESET_VERSION,
} = require("../lib/tool-risk");
const { getToolRiskIndex } = require("../lib/tool-risk-index");

const router = Router();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;
const MAX_EXPORT_ROWS = 10000;

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
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function badRequest(res, message) {
  return res.status(400).json({ error: { code: "INVALID_FILTER", message } });
}

/** Parse and validate the shared filter set. Returns {filters} or {error}. */
function parseFilters(req) {
  const signal = parseCsv(req.query.signal);
  if (signal && signal.some((s) => !SIGNALS.includes(s))) {
    return { error: `signal must be one of: ${SIGNALS.join(", ")}` };
  }
  const severity = parseCsv(req.query.severity);
  if (severity && severity.some((s) => !SEVERITIES.includes(s))) {
    return { error: `severity must be one of: ${SEVERITIES.join(", ")}` };
  }
  const minSeverity = typeof req.query.min_severity === "string" ? req.query.min_severity : null;
  if (minSeverity && !SEVERITIES.includes(minSeverity)) {
    return { error: `min_severity must be one of: ${SEVERITIES.join(", ")}` };
  }
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
  return {
    filters: {
      signal,
      severity,
      minRank: minSeverity ? SEVERITY_RANK[minSeverity] : null,
      session_id: parseCsv(req.query.session_id),
      tool_name: parseCsv(req.query.tool_name),
      project: parseCsv(req.query.project),
      host: parseCsv(req.query.host),
      q,
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
      sources: parseSources(req),
      providers: parseProviders(req),
    },
  };
}

/** WHERE clause over `tool_risk_events r` (joined to sessions `s`). */
function buildWhere(f) {
  const clauses = [];
  const params = [];
  const inClause = (field, values) => {
    clauses.push(`${field} IN (${values.map(() => "?").join(",")})`);
    params.push(...values);
  };
  if (f.session_id) inClause("r.session_id", f.session_id);
  if (f.tool_name) inClause("r.tool_name", f.tool_name);
  if (f.project) inClause("s.cwd", f.project);
  if (f.minRank) {
    clauses.push("r.severity_rank >= ?");
    params.push(f.minRank);
  }
  if (f.from) {
    clauses.push("r.created_at >= ?");
    params.push(f.from);
  }
  if (f.to) {
    clauses.push("r.created_at <= ?");
    params.push(f.to);
  }
  // Signal / severity / host / text filters match on any of the event's signals.
  const sig = [];
  const sigParams = [];
  if (f.signal) {
    sig.push(`x.signal IN (${f.signal.map(() => "?").join(",")})`);
    sigParams.push(...f.signal);
  }
  if (f.severity) {
    sig.push(`x.severity IN (${f.severity.map(() => "?").join(",")})`);
    sigParams.push(...f.severity);
  }
  if (f.host) {
    sig.push(`x.host IN (${f.host.map(() => "?").join(",")})`);
    sigParams.push(...f.host);
  }
  if (sig.length > 0) {
    clauses.push(
      `EXISTS (SELECT 1 FROM tool_risk_signals x WHERE x.event_id = r.event_id AND ${sig.join(" AND ")})`
    );
    params.push(...sigParams);
  }
  if (f.q) {
    const pattern = `%${f.q}%`;
    clauses.push(
      "(r.target LIKE ? OR EXISTS (SELECT 1 FROM tool_risk_signals y WHERE y.event_id = r.event_id AND y.match LIKE ?))"
    );
    params.push(pattern, pattern);
  }
  const scope = sourceColumnClause(f.sources, "s.source");
  const providerScope = providerColumnClause(f.providers, "s.provider");
  for (const c of [scope, providerScope]) {
    if (c.clause) {
      clauses.push(c.clause);
      params.push(...c.params);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const FROM_SQL = "FROM tool_risk_events r LEFT JOIN sessions s ON s.id = r.session_id";

function attachSignals(rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.event_id);
  const signals = db
    .prepare(
      `SELECT event_id, signal, severity, rule, match, host FROM tool_risk_signals
       WHERE event_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid`
    )
    .all(...ids);
  const byEvent = new Map(ids.map((id) => [id, []]));
  for (const s of signals) {
    const { event_id, ...rest } = s;
    if (!rest.host) delete rest.host;
    byEvent.get(event_id).push(rest);
  }
  return rows.map((r) => ({ ...r, degraded: r.degraded === 1, signals: byEvent.get(r.event_id) }));
}

function listRows(where, limit, offset) {
  const rows = db
    .prepare(
      `SELECT r.event_id, r.session_id, s.name AS session_name, s.cwd AS project, s.provider,
              r.agent_id, r.tool_name, r.created_at, r.max_severity, r.target, r.degraded
       ${FROM_SQL} ${where.sql}
       ORDER BY r.created_at DESC, r.event_id DESC LIMIT ? OFFSET ?`
    )
    .all(...where.params, limit, offset);
  return attachSignals(rows);
}

function indexStatus() {
  const index = getToolRiskIndex();
  const state = index.refresh();
  if (!state.complete) index.startBackgroundPump();
  return { indexing: state, coverage: index.stats() };
}

// GET /api/audit/tools?signal=destructive&min_severity=high&from=...&limit=50&offset=0
router.get("/tools", (req, res, next) => {
  try {
    const parsed = parseFilters(req);
    if (parsed.error) return badRequest(res, parsed.error);
    const status = indexStatus();
    const limit = clampInt(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const where = buildWhere(parsed.filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS c ${FROM_SQL} ${where.sql}`)
      .get(...where.params).c;
    res.json({ events: listRows(where, limit, offset), limit, offset, total, ...status });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/summary — counts for the header tiles, same filters as /tools.
router.get("/summary", (req, res, next) => {
  try {
    const parsed = parseFilters(req);
    if (parsed.error) return badRequest(res, parsed.error);
    const status = indexStatus();
    const where = buildWhere(parsed.filters);
    const flagged = `SELECT r.event_id ${FROM_SQL} ${where.sql}`;

    const total = db
      .prepare(`SELECT COUNT(*) AS c ${FROM_SQL} ${where.sql}`)
      .get(...where.params).c;
    const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
    for (const row of db
      .prepare(
        `SELECT r.max_severity AS sev, COUNT(*) AS c ${FROM_SQL} ${where.sql} GROUP BY r.max_severity`
      )
      .all(...where.params)) {
      bySeverity[row.sev] = row.c;
    }
    const bySignal = SIGNALS.map((signal) => ({
      signal,
      events: 0,
      ...Object.fromEntries(SEVERITIES.map((s) => [s, 0])),
    }));
    for (const row of db
      .prepare(
        `SELECT signal, severity, COUNT(DISTINCT event_id) AS c FROM tool_risk_signals
         WHERE event_id IN (${flagged}) GROUP BY signal, severity`
      )
      .all(...where.params)) {
      const entry = bySignal.find((b) => b.signal === row.signal);
      if (entry) entry[row.severity] += row.c;
    }
    for (const row of db
      .prepare(
        `SELECT signal, COUNT(DISTINCT event_id) AS c FROM tool_risk_signals
         WHERE event_id IN (${flagged}) GROUP BY signal`
      )
      .all(...where.params)) {
      const entry = bySignal.find((b) => b.signal === row.signal);
      if (entry) entry.events = row.c;
    }
    const byProject = db
      .prepare(
        `SELECT s.cwd AS project, COUNT(*) AS events, MAX(r.severity_rank) AS rank
         ${FROM_SQL} ${where.sql} GROUP BY s.cwd ORDER BY events DESC LIMIT 20`
      )
      .all(...where.params)
      .map(({ rank, ...row }) => ({ ...row, max_severity: SEVERITIES[rank - 1] || null }));
    const topHosts = db
      .prepare(
        `SELECT host, COUNT(DISTINCT event_id) AS events FROM tool_risk_signals
         WHERE host IS NOT NULL AND event_id IN (${flagged})
         GROUP BY host ORDER BY events DESC, host LIMIT 20`
      )
      .all(...where.params);

    res.json({
      total,
      by_severity: bySeverity,
      by_signal: bySignal,
      by_project: byProject,
      top_hosts: topHosts,
      ...status,
    });
  } catch (error) {
    next(error);
  }
});

function csvCell(value) {
  const text = value == null ? "" : String(value);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// GET /api/audit/export?format=csv|json — the filtered rows for an offline review.
router.get("/export", (req, res, next) => {
  try {
    const parsed = parseFilters(req);
    if (parsed.error) return badRequest(res, parsed.error);
    const format = req.query.format === "json" ? "json" : "csv";
    indexStatus();
    const limit = clampInt(req.query.limit, MAX_EXPORT_ROWS, 1, MAX_EXPORT_ROWS);
    const rows = listRows(buildWhere(parsed.filters), limit, 0);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tool-risk-audit-${stamp}.${format}"`
    );
    if (format === "json") {
      return res.json({
        generated_at: new Date().toISOString(),
        ruleset_version: RULESET_VERSION,
        events: rows,
      });
    }
    const header = [
      "created_at",
      "severity",
      "signals",
      "matches",
      "tool",
      "target",
      "session_id",
      "session_name",
      "project",
      "agent_id",
      "event_id",
      "payload_missing",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.created_at,
          r.max_severity,
          [...new Set(r.signals.map((s) => s.signal))].join(" "),
          r.signals.map((s) => s.match).join(" | "),
          r.tool_name,
          r.target,
          r.session_id,
          r.session_name,
          r.project,
          r.agent_id,
          r.event_id,
          r.degraded ? "yes" : "no",
        ]
          .map(csvCell)
          .join(",")
      );
    }
    res.type("text/csv").send(`${lines.join("\n")}\n`);
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/rules — the built-in ruleset, so the UI can explain every flag.
router.get("/rules", (_req, res) => {
  const describe = (pattern) => pattern.source;
  res.json({
    ruleset_version: RULESET_VERSION,
    signals: SIGNALS,
    severities: SEVERITIES,
    rules: [
      ...COMMAND_RULES.map((r) => ({
        id: r.id,
        signal: r.signal,
        severity: r.severity,
        pattern: describe(r.pattern),
      })),
      {
        id: "npx-unpinned",
        signal: "remote-exec",
        severity: "medium",
        pattern: "npx/dlx without an exact version",
      },
      ...CREDENTIAL_RULES.map((r) => ({
        id: r.id,
        signal: "credential-access",
        severity: r.severity,
        pattern: describe(r.pattern),
      })),
      {
        id: "network-command",
        signal: "egress",
        severity: "low",
        pattern: "network command with a remote host",
      },
      { id: "web-fetch", signal: "egress", severity: "low", pattern: "WebFetch target host" },
      { id: "web-search", signal: "egress", severity: "low", pattern: "WebSearch query" },
      {
        id: "write-outside-cwd",
        signal: "outside-cwd",
        severity: "medium",
        pattern: "write resolves outside the session cwd",
      },
      {
        id: "sensitive-path-write",
        signal: "outside-cwd",
        severity: "high",
        pattern: "write to a system path or Claude settings",
      },
    ],
  });
});

module.exports = router;
