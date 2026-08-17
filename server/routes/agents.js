/**
 * @file Express router for managing agents, providing endpoints to list, retrieve, create, and update agents. It interacts with the database using prepared statements and broadcasts changes to connected WebSocket clients for real-time updates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts, db } = require("../db");
const { broadcast } = require("../websocket");
const { attachAgentCosts } = require("./pricing");
const { parseSources, sessionIdInSourcesClause } = require("../lib/source-filter");
const { parseProviders, sessionIdInProvidersClause } = require("../lib/provider-filter");
const { getCodexProcessAgents } = require("../lib/codex-process-overlay");

const router = Router();

// The mutable `agents.updated_at` includes status and metadata bookkeeping.
// Agent cards must show the latest durable provider event so a maintenance
// sweep never makes an idle/error agent appear freshly active.
const AGENT_LAST_ACTIVITY_SQL = `COALESCE(
  (SELECT MAX(e.created_at) FROM events e WHERE e.agent_id = a.id),
  a.ended_at,
  a.started_at
)`;

router.get("/", (req, res) => {
  const rawLimit = parseInt(req.query.limit);
  const limit = rawLimit > 0 ? rawLimit : 10000;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const session_id = req.query.session_id;
  const includeTransient =
    req.query.include_transient === "1" || req.query.include_transient === "true";
  const sources = parseSources(req);
  const providers = parseProviders(req);

  let rows;
  if (session_id || sources || providers) {
    // Agents carry only session_id, so source/provider scope composes via the
    // owning session. This also prevents direct session_id requests bypassing
    // a selected provider.
    const clauses = [];
    const params = [];
    if (session_id) {
      clauses.push("a.session_id = ?");
      params.push(session_id);
    }
    const sourceScope = sessionIdInSourcesClause(sources, "session_id");
    if (sourceScope.clause) {
      clauses.push(sourceScope.clause);
      params.push(...sourceScope.params);
    }
    const providerScope = sessionIdInProvidersClause(providers, "session_id");
    if (providerScope.clause) {
      clauses.push(providerScope.clause);
      params.push(...providerScope.params);
    }
    if (status) {
      clauses.push("a.status = ?");
      params.push(status);
    }
    rows = db
      .prepare(
        `SELECT a.*, ${AGENT_LAST_ACTIVITY_SQL} AS last_activity
         FROM agents a WHERE ${clauses.join(" AND ")}
         ORDER BY last_activity DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
  } else if (status) {
    rows = stmts.listAgentsByStatus.all(status, limit, offset);
  } else {
    rows = stmts.listAgents.all(limit, offset);
  }

  const includesLocal = !sources || sources.includes("local");
  const includesCodex = !providers || providers.includes("codex");
  const transient =
    includeTransient &&
    status === "waiting" &&
    !session_id &&
    includesLocal &&
    includesCodex &&
    offset === 0
      ? getCodexProcessAgents(
          db
            .prepare(
              `SELECT id, cwd FROM sessions
               WHERE provider = 'codex' AND status = 'active'
                 AND (source = 'local' OR source IS NULL)`
            )
            .all()
        )
      : [];

  // Attach each persisted agent's OWN cost (from its metadata token buckets)
  // and prepend the in-memory, pre-identity Codex cards without persisting or
  // pricing them.
  res.json({ agents: [...transient, ...attachAgentCosts(rows)], limit, offset });
});

router.get("/:id", (req, res) => {
  const agent = stmts.getAgent.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  }
  res.json({ agent });
});

router.post("/", (req, res) => {
  const { id, session_id, name, type, subagent_type, status, task, parent_agent_id, metadata } =
    req.body;
  if (!id || !session_id || !name) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "id, session_id, and name are required" },
    });
  }

  const existing = stmts.getAgent.get(id);
  if (existing) {
    return res.json({ agent: existing, created: false });
  }

  stmts.insertAgent.run(
    id,
    session_id,
    name,
    type || "main",
    subagent_type || null,
    status || "waiting",
    task || null,
    parent_agent_id || null,
    metadata ? JSON.stringify(metadata) : null
  );

  const agent = stmts.getAgent.get(id);
  broadcast("agent_created", agent);
  res.status(201).json({ agent, created: true });
});

router.patch("/:id", (req, res) => {
  const { name, status, task, current_tool, ended_at, metadata } = req.body;
  const existing = stmts.getAgent.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  }

  stmts.updateAgent.run(
    name || null,
    status || null,
    task || null,
    current_tool !== undefined ? current_tool : existing.current_tool,
    ended_at || null,
    metadata ? JSON.stringify(metadata) : null,
    req.params.id
  );

  const agent = stmts.getAgent.get(req.params.id);
  broadcast("agent_updated", agent);
  res.json({ agent });
});

module.exports = router;
