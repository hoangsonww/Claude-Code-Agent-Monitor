/**
 * @file Express router for session endpoints, allowing creation, retrieval, and
 * updating of sessions with pagination plus status, search, and multi-directory
 * filtering. It computes costs, derives optional owner-aware task progress,
 * adds card-ready prompt context, safely exposes transcript images, and
 * broadcasts live changes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { stmts, db } = require("../db");
const { broadcast } = require("../websocket");
const { calculateProviderCost, attachAgentCosts } = require("./pricing");
const { parseSources, sourceColumnClause } = require("../lib/source-filter");
const { parseProviders, providerColumnClause } = require("../lib/provider-filter");
const { getCodexProcessSessions } = require("../lib/codex-process-overlay");
const { extractSessionTaskProgress } = require("../lib/task-progress");
const {
  getClaudeHome,
  getProjectsDir,
  getTranscriptPath,
  getSubagentTranscriptPath,
  getSnapshotTranscriptPath,
  getSnapshotSubagentTranscriptPath,
  findTranscriptPath,
  findSubagentTranscriptPath,
} = require("../lib/claude-home");

const router = Router();
const MAX_TASK_PROGRESS_ROWS = 100;

// A session's mutable `updated_at` also changes for metadata repair, title
// discovery, and other bookkeeping. The UI's "Last active" label must instead
// reflect the latest durable CLI event, with lifecycle timestamps only as a
// fallback for historical/eventless rows.
const SESSION_LAST_ACTIVITY_SQL = `COALESCE(
  (SELECT MAX(e.created_at) FROM events e WHERE e.session_id = s.id),
  s.ended_at,
  s.started_at
)`;

// Compact cards need enough context to distinguish a meaningful task from a
// renamed session title. Both providers preserve their newest two distinct
// human turns as a tiny newline-separated summary. Claude derives it from its
// local JSONL scanner; Codex has equivalent append-only lifecycle events.
// Historical rows still fall back to a main-agent task.
const SESSION_PROMPT_PREVIEW_SQL = `COALESCE(
  NULLIF(s.card_prompt_preview, ''),
  CASE WHEN s.provider = 'codex' THEN (
    SELECT group_concat(prompt, char(10))
    FROM (
      SELECT prompt
      FROM (
        SELECT e.summary AS prompt, e.created_at, e.id
        FROM events e
        WHERE e.session_id = s.id
          AND e.event_type = 'codex_user_message'
          AND e.summary IS NOT NULL
          AND trim(e.summary) != ''
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 2
      ) latest_prompts
      ORDER BY created_at ASC, id ASC
    ) ordered_prompts
  ) END,
  NULLIF((
    SELECT a.task
    FROM agents a
    WHERE a.session_id = s.id
      AND a.type = 'main'
      AND a.task IS NOT NULL
      AND trim(a.task) != ''
    ORDER BY a.updated_at DESC
    LIMIT 1
  ), ''),
  (
    SELECT e.summary
    FROM events e
    WHERE e.session_id = s.id
      AND e.event_type = 'codex_user_message'
      AND e.summary IS NOT NULL
      AND trim(e.summary) != ''
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
  )
)`;

function sessionIsInScope(session, req) {
  const sources = parseSources(req);
  const providers = parseProviders(req);
  return (
    (!sources || sources.includes(session.source || "local")) &&
    (!providers || providers.includes(session.provider || "claude"))
  );
}

function taskEventsForSession(sessionId) {
  return stmts.listTaskEventsBySession.all(sessionId);
}

function taskProgressForSession(session, agents, events) {
  const mainTranscriptPath =
    session.transcript_path && fs.existsSync(session.transcript_path)
      ? session.transcript_path
      : resolveSessionTranscriptPath(session, session.id, null, null);
  return extractSessionTaskProgress({
    session,
    agents,
    events,
    mainTranscriptPath,
  });
}

function attachTaskSummaries(sessions) {
  for (const [index, session] of sessions.entries()) {
    if (index >= MAX_TASK_PROGRESS_ROWS) continue;
    if (
      session.metadata &&
      (() => {
        try {
          return JSON.parse(session.metadata)?.transient_process === true;
        } catch {
          return false;
        }
      })()
    ) {
      session.todo_summary = null;
      continue;
    }
    const agents = stmts.listAgentsBySession.all(session.id);
    const events = taskEventsForSession(session.id);
    session.todo_summary = taskProgressForSession(session, agents, events).summary;
  }
  return sessions;
}

// JSONL entry types the transcript reader turns into renderable messages.
// `user`/`assistant` are the conversation. `custom-title` is the metadata line
// written by /rename, `claude -n`, and the picker's Ctrl+R — surfaced as an
// inline rename marker so a rename is visible even when there is no command
// line (e.g. `claude -n` at startup). `system` carries local slash-command I/O
// in newer Claude Code builds — `system`/`local_command` lines hold the TUI
// markup (`<command-name>`, `<local-command-stdout>`, …) in a top-level
// `content` string, so /color, /rename, /clear, and custom commands render as
// command pills + their captured output; every other `system` subtype
// (turn_duration, stop_hook_summary, away_summary, …) is dropped as noise.
// (ai-title is intentionally excluded: it repeats on nearly every turn and
// would flood the stream; it drives the session NAME instead, not the chat.)
// `attachment` is included ONLY for its `queued_command` subtype: a message the
// human typed mid-turn (while Claude was still working) is written to the JSONL
// as `queue-operation` bookkeeping lines plus a `queued_command` attachment at
// the point the model actually saw it — there is NO `type:"user"` line for it,
// so without this the Conversation tab silently drops mid-turn messages. Every
// other attachment subtype (task_reminder, hook_success, skill_listing, …) is
// harness noise and stays hidden.
const TRANSCRIPT_RENDER_TYPES = new Set([
  "user",
  "assistant",
  "custom-title",
  "system",
  "attachment",
]);

/**
 * Classify the TRUE sender of a transcript entry. A JSONL `type:"user"` line is
 * not always the human: it also carries tool results, harness-injected
 * task-notifications, /loop re-injections (`isMeta`), and — in a subagent
 * transcript — the task prompt handed down by the orchestrator. Attributing all
 * of those to "User" is wrong; the UI styles each sender distinctly.
 *
 * Returns: "user" | "assistant" | "orchestrator" | "system" | "tool".
 *   user         — a real message typed by the human
 *   assistant    — the agent's own turn
 *   orchestrator — a subagent's task, assigned by its parent/main agent
 *   system       — harness/tooling injection (task-notification, /loop meta, …)
 *   tool         — a tool_result echoed back on a `user` line
 */
function classifyTranscriptSender(entry, isSubagentFile) {
  if (entry.type === "assistant") return "assistant";
  // `system`/local_command lines are surfaced as the human's slash-command I/O.
  if (entry.type !== "user") return "user";

  const content = entry.message ? entry.message.content : undefined;
  const onlyToolResults =
    Array.isArray(content) &&
    content.length > 0 &&
    content.every((b) => b && b.type === "tool_result");
  if (entry.toolUseResult !== undefined || onlyToolResults) return "tool";

  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? (content.find((b) => b && b.type === "text") || {}).text || ""
        : "";
  const lead = text.replace(/^\s+/, "");

  // Harness injections that masquerade as a user line.
  if (entry.isMeta === true) return "system";
  if (lead.startsWith("<task-notification>") || lead.startsWith("<task-notification ")) {
    return "system";
  }
  // Background-task event banner ("[SYSTEM NOTIFICATION - NOT USER INPUT] …")
  // that newer harness builds prefix ahead of the <task-notification> payload.
  if (lead.startsWith("[SYSTEM NOTIFICATION")) return "system";

  // In a subagent transcript, a user line with no human prompt provenance is the
  // task injected by the Task/Agent tool. A real human message to the subagent
  // (rare, but allowed) carries promptSource/origin and stays "user".
  if (isSubagentFile && entry.promptSource === undefined && entry.origin === undefined) {
    return "orchestrator";
  }

  return "user";
}

/**
 * Read only the first non-empty line from a JSONL file using streaming.
 * Avoids loading the entire file into memory.
 */
async function readFirstLine(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    rl.close();
    rl.removeAllListeners();
    return line;
  }
  return null;
}

router.get("/", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 10000);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const includeTransient =
    req.query.include_transient === "1" || req.query.include_transient === "true";
  const includeTaskProgress =
    req.query.include_task_progress === "1" || req.query.include_task_progress === "true";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const cwds = Array.isArray(req.query.cwd)
    ? req.query.cwd.filter((cwd) => typeof cwd === "string" && cwd)
    : typeof req.query.cwd === "string" && req.query.cwd
      ? [req.query.cwd]
      : [];
  const sortBy = req.query.sort_by || "time"; // "time", "duration", "price"
  const sortDesc = req.query.sort_desc !== "false";
  const sources = parseSources(req);
  const providers = parseProviders(req);

  let where = [];
  let params = [];

  if (q) {
    const like = `%${q}%`;
    where.push("(s.id LIKE ? OR s.name LIKE ? OR s.cwd LIKE ?)");
    params.push(like, like, like);
  }
  if (status) {
    where.push("s.status = ?");
    params.push(status);
  }
  if (cwds.length > 0) {
    where.push(`s.cwd IN (${cwds.map(() => "?").join(",")})`);
    params.push(...cwds);
  }
  // Data-scope filter: restrict to sessions collected from a chosen set of
  // machines (local + any configured remote sources). Absent = all sources.
  const sourceFilter = sourceColumnClause(sources);
  if (sourceFilter.clause) {
    where.push(sourceFilter.clause);
    params.push(...sourceFilter.params);
  }
  const providerFilter = providerColumnClause(providers);
  if (providerFilter.clause) {
    where.push(providerFilter.clause);
    params.push(...providerFilter.params);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM sessions s ${whereSql}`).get(...params).c;

  let rows = [];

  if (sortBy === "price") {
    const allRows = db
      .prepare(
        `SELECT s.*, COUNT(a.id) as agent_count, ${SESSION_LAST_ACTIVITY_SQL} as last_activity,
                ${SESSION_PROMPT_PREVIEW_SQL} AS prompt_preview
         FROM sessions s LEFT JOIN agents a ON a.session_id = s.id
         ${whereSql}
         GROUP BY s.id`
      )
      .all(...params);

    if (allRows.length > 0) {
      const rules = stmts.listPricing.all();
      const gptRules = stmts.listGptPricing.all();

      for (let i = 0; i < allRows.length; i += 900) {
        const chunk = allRows.slice(i, i + 900);
        const ids = chunk.map((r) => r.id);
        const placeholders = ids.map(() => "?").join(",");
        const chunkTokens = db
          .prepare(
            `SELECT session_id, model, speed, inference_geo, service_tier, context_size,
              input_tokens + baseline_input as input_tokens,
              output_tokens + baseline_output as output_tokens,
              cache_read_tokens + baseline_cache_read as cache_read_tokens,
              cache_write_tokens + baseline_cache_write as cache_write_tokens,
              cache_write_1h_tokens + baseline_cache_write_1h as cache_write_1h_tokens,
              web_search_requests + baseline_web_search as web_search_requests,
              web_fetch_requests + baseline_web_fetch as web_fetch_requests,
              code_execution_requests + baseline_code_execution as code_execution_requests
            FROM token_usage WHERE session_id IN (${placeholders})`
          )
          .all(...ids);

        const providerBySession = new Map(chunk.map((session) => [session.id, session.provider]));
        const tokensBySession = {};
        for (const t of chunkTokens) {
          if (!tokensBySession[t.session_id]) tokensBySession[t.session_id] = [];
          tokensBySession[t.session_id].push({
            ...t,
            provider: providerBySession.get(t.session_id) || "claude",
          });
        }

        for (const row of chunk) {
          const sessionTokens = tokensBySession[row.id];
          row.cost = sessionTokens
            ? calculateProviderCost(sessionTokens, rules, gptRules, row.started_at).total_cost
            : 0;
        }
      }

      allRows.sort((a, b) => {
        return sortDesc ? b.cost - a.cost : a.cost - b.cost;
      });
      rows = allRows.slice(offset, offset + limit);
    }
  } else {
    let orderSql = "last_activity DESC";
    if (sortBy === "time") {
      orderSql = `last_activity ${sortDesc ? "DESC" : "ASC"}`;
    } else if (sortBy === "duration") {
      orderSql = `(julianday(COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))) - julianday(s.started_at)) ${sortDesc ? "DESC" : "ASC"}`;
    }

    rows = db
      .prepare(
        `SELECT s.*, COUNT(a.id) as agent_count, ${SESSION_LAST_ACTIVITY_SQL} as last_activity,
                ${SESSION_PROMPT_PREVIEW_SQL} AS prompt_preview
         FROM sessions s LEFT JOIN agents a ON a.session_id = s.id
         ${whereSql}
         GROUP BY s.id ORDER BY ${orderSql} LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const allTokens = db
        .prepare(
          `SELECT session_id, model, speed, inference_geo, service_tier, context_size,
            input_tokens + baseline_input as input_tokens,
            output_tokens + baseline_output as output_tokens,
            cache_read_tokens + baseline_cache_read as cache_read_tokens,
            cache_write_tokens + baseline_cache_write as cache_write_tokens,
            cache_write_1h_tokens + baseline_cache_write_1h as cache_write_1h_tokens,
            web_search_requests + baseline_web_search as web_search_requests,
            web_fetch_requests + baseline_web_fetch as web_fetch_requests,
            code_execution_requests + baseline_code_execution as code_execution_requests
          FROM token_usage WHERE session_id IN (${placeholders})`
        )
        .all(...ids);

      const rules = stmts.listPricing.all();
      const gptRules = stmts.listGptPricing.all();
      const providerBySession = new Map(rows.map((session) => [session.id, session.provider]));
      const tokensBySession = {};
      for (const t of allTokens) {
        if (!tokensBySession[t.session_id]) tokensBySession[t.session_id] = [];
        tokensBySession[t.session_id].push({
          ...t,
          provider: providerBySession.get(t.session_id) || "claude",
        });
      }

      for (const row of rows) {
        const sessionTokens = tokensBySession[row.id];
        row.cost = sessionTokens
          ? calculateProviderCost(sessionTokens, rules, gptRules, row.started_at).total_cost
          : 0;
      }
    }
  }

  const includesLocal = !sources || sources.includes("local");
  const includesCodex = !providers || providers.includes("codex");
  const normalizedQuery = q.toLowerCase();
  const transient =
    includeTransient &&
    (!status || status === "active") &&
    includesLocal &&
    includesCodex &&
    offset === 0
      ? getCodexProcessSessions(
          db
            .prepare(
              `SELECT id, cwd FROM sessions
               WHERE provider = 'codex' AND status = 'active'
                 AND (source = 'local' OR source IS NULL)`
            )
            .all()
        )
          .filter(
            (session) =>
              !normalizedQuery ||
              [session.id, session.name, session.cwd].some((value) =>
                value?.toLowerCase().includes(normalizedQuery)
              )
          )
          .filter((session) => cwds.length === 0 || cwds.includes(session.cwd))
      : [];
  if (transient.length > 0) {
    rows = [...transient, ...rows];
  }

  if (includeTaskProgress) attachTaskSummaries(rows);
  res.json({ sessions: rows, limit, offset, total });
});

router.get("/facets", (req, res) => {
  const sourceFilter = sourceColumnClause(parseSources(req), "s.source");
  const providerFilter = providerColumnClause(parseProviders(req), "s.provider");
  const clauses = [
    "s.cwd IS NOT NULL",
    "s.cwd != ''",
    sourceFilter.clause,
    providerFilter.clause,
  ].filter(Boolean);
  const rows = db
    .prepare(`SELECT DISTINCT s.cwd FROM sessions s WHERE ${clauses.join(" AND ")} ORDER BY s.cwd`)
    .all(...sourceFilter.params, ...providerFilter.params);
  // Distinct origins present in the data, so the UI can offer a source facet /
  // scope selector. Always includes at least 'local' (the column default).
  const sources = stmts.distinctSessionSources.all().map((r) => r.source);
  const providers = stmts.distinctSessionProviders.all().map((r) => r.provider);
  res.json({ cwds: rows.map((r) => r.cwd), sources, providers });
});

router.get("/:id", (req, res) => {
  const session = db
    .prepare(
      `SELECT s.*, ${SESSION_PROMPT_PREVIEW_SQL} AS prompt_preview
       FROM sessions s WHERE s.id = ?`
    )
    .get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  if (!sessionIsInScope(session, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  // Each agent's OWN cost (from its metadata token buckets) so subagent cards on
  // the session-detail tree show their real cost, not the session total.
  const agents = attachAgentCosts(stmts.listAgentsBySession.all(req.params.id));
  const events = stmts.listEventsBySession.all(req.params.id);
  session.todo_snapshot = taskProgressForSession(session, agents, events).snapshot;
  // Workflow-tool runs launched within this session (issue #167). Parse the
  // JSON-blob columns so the client gets arrays, not strings.
  const workflows = stmts.listWorkflowsBySession.all(req.params.id).map((w) => {
    let phases = [];
    let progress = [];
    try {
      phases = w.phases ? JSON.parse(w.phases) : [];
    } catch {
      phases = [];
    }
    try {
      progress = w.progress ? JSON.parse(w.progress) : [];
    } catch {
      progress = [];
    }
    return { ...w, phases, progress };
  });
  res.json({ session, agents, events, workflows });
});

/**
 * GET /:id/stats — Aggregated counts for the SessionOverview panel.
 *
 * Returns at-a-glance metrics used by the Agents tab on the Session detail page.
 * All aggregation runs in SQL so we don't ship 14k+ event rows to the client.
 */
router.get("/:id/stats", (req, res) => {
  const sessionId = req.params.id;
  const session = stmts.getSession.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  if (!sessionIsInScope(session, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  const totalEvents = stmts.sessionEventCount.get(sessionId)?.count ?? 0;
  const eventsByType = stmts.sessionEventTypeCounts.all(sessionId);
  const tools = stmts.sessionToolUsageCounts.all(sessionId);
  const errors = stmts.sessionErrorCount.get(sessionId)?.count ?? 0;
  const timeRange = stmts.sessionEventTimeRange.get(sessionId) || {};
  const subagentTypes = stmts.sessionAgentTypeCounts.all(sessionId);
  const agentStatusRows = stmts.sessionAgentStatusCounts.all(sessionId);
  const tokens = stmts.sessionTokenTotals.get(sessionId) || {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };

  // Aggregate agent counts by category
  const agentCounts = {
    total: 0,
    main: 0,
    subagent: 0,
    compaction: 0,
    by_status: {},
  };
  for (const row of agentStatusRows) {
    agentCounts.total += row.count;
    agentCounts.by_status[row.status] = row.count;
  }
  // Compactions: count agents whose subagent_type === 'compaction'
  const compactionRow = subagentTypes.find((r) => r.subagent_type === "compaction");
  agentCounts.compaction = compactionRow?.count ?? 0;
  // Main vs sub: count by type in SQL (avoids loading all agents)
  const typeCounts = db
    .prepare(`SELECT type, COUNT(*) as count FROM agents WHERE session_id = ? GROUP BY type`)
    .all(sessionId);
  for (const row of typeCounts) {
    if (row.type === "main") agentCounts.main = row.count;
    else if (row.type === "subagent") agentCounts.subagent = row.count;
  }

  res.json({
    session_id: sessionId,
    total_events: totalEvents,
    events_by_type: eventsByType,
    tools_used: tools,
    error_count: errors,
    first_event_at: timeRange.first_at ?? null,
    last_event_at: timeRange.last_at ?? null,
    agents: agentCounts,
    subagent_types: subagentTypes.filter((r) => r.subagent_type !== "compaction"),
    tokens,
  });
});

router.post("/", (req, res) => {
  const { id, name, cwd, model, metadata } = req.body;
  if (!id) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "id is required" } });
  }

  const existing = stmts.getSession.get(id);
  if (existing) {
    return res.json({ session: existing, created: false });
  }

  stmts.insertSession.run(
    id,
    name || null,
    "active",
    cwd || null,
    model || null,
    metadata ? JSON.stringify(metadata) : null
  );
  const session = stmts.getSession.get(id);
  broadcast("session_created", session);
  res.status(201).json({ session, created: true });
});

router.patch("/:id", (req, res) => {
  const { name, status, ended_at, metadata } = req.body;
  const existing = stmts.getSession.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  if (!sessionIsInScope(existing, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  stmts.updateSession.run(
    name || null,
    status || null,
    ended_at || null,
    metadata ? JSON.stringify(metadata) : null,
    req.params.id
  );

  const session = stmts.getSession.get(req.params.id);
  broadcast("session_updated", session);
  res.json({ session });
});

// GET /:id/transcripts — List available transcript files for a session (main + sub-agents)
router.get("/:id/transcripts", async (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  if (!sessionIsInScope(session, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  // Codex uses a single append-only rollout rather than Claude Code's
  // projects/<cwd>/<session>/subagents layout. Surface it through the same
  // transcript contract so the Conversation tab stays provider-agnostic.
  if (session.provider === "codex") {
    const mainAgent = stmts.listAgentsBySession
      .all(session.id)
      .find((agent) => agent.type === "main");
    return res.json({
      transcripts:
        session.transcript_path && fs.existsSync(session.transcript_path)
          ? [
              {
                id: "main",
                name: "Codex",
                type: "main",
                has_transcript: true,
                db_agent_id: mainAgent?.id || null,
              },
            ]
          : [],
    });
  }

  const result = [];

  // Query database agent list for db_agent_id association
  const dbAgents = stmts.listAgentsBySession.all(req.params.id) || [];

  // Main session transcript (live, else the durable import-time snapshot)
  const mainPath =
    getTranscriptPath(req.params.id, session.cwd) ||
    findTranscriptPath(req.params.id) ||
    getSnapshotTranscriptPath(req.params.id);
  if (mainPath && fs.existsSync(mainPath)) {
    // Main agent database ID format: <sessionId>-main
    const mainDbAgent = dbAgents.find((a) => a.type === "main");
    result.push({
      id: "main",
      name: "Main Agent",
      type: "main",
      has_transcript: true,
      db_agent_id: mainDbAgent ? mainDbAgent.id : null,
    });
  }

  // Sub-agent transcript files
  const encoded = session.cwd ? session.cwd.replace(/[^a-zA-Z0-9]/g, "-") : null;
  const subagentDirs = [];

  // Direct path
  if (encoded) {
    const directDir = path.join(getProjectsDir(), encoded, req.params.id, "subagents");
    if (fs.existsSync(directDir)) subagentDirs.push(directDir);
  }

  // Fallback: scan all project directories when direct path doesn't exist
  if (subagentDirs.length === 0) {
    const projectsDir = path.join(getClaudeHome(), "projects");
    if (fs.existsSync(projectsDir)) {
      try {
        for (const d of fs.readdirSync(projectsDir, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          const candidate = path.join(projectsDir, d.name, req.params.id, "subagents");
          if (fs.existsSync(candidate)) subagentDirs.push(candidate);
        }
      } catch {
        /* ignore */
      }
    }
  }

  for (const dir of subagentDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        // File name format: agent-<shortId>.jsonl
        const shortId = file.replace(/^agent-/, "").replace(/\.jsonl$/, "");
        // Try reading meta.json for agent type info
        let meta = null;
        const metaPath = path.join(dir, file.replace(".jsonl", ".meta.json"));
        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          } catch {
            /* ignore */
          }
        }

        const isCompact = shortId.startsWith("acompact-");
        const transcriptName = isCompact
          ? "Context Compaction"
          : meta?.description || meta?.agentType || shortId;
        const transcriptSubagentType = meta?.agentType || null;

        // Read first-line timestamp from JSONL for time-based matching
        let transcriptTimestamp = null;
        try {
          const jsonlPath = path.join(dir, file);
          const firstLine = await readFirstLine(jsonlPath);
          if (firstLine) {
            const entry = JSON.parse(firstLine);
            transcriptTimestamp = entry.timestamp || null;
          }
        } catch {
          /* ignore */
        }

        result.push({
          id: shortId,
          name: transcriptName,
          type: isCompact ? "compaction" : "subagent",
          subagent_type: transcriptSubagentType,
          has_transcript: true,
          db_agent_id: null, // matched later after all transcripts are collected
          _timestamp: transcriptTimestamp,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // Match database agents to transcripts using best-effort strategies
  // Strategy: sort both sides by time within each type, then match by index order.
  // This works because agents and transcripts are created in chronological order.

  // Step 1: Sort all non-main transcripts by timestamp
  for (const t of result) {
    if (t.type === "main") continue;
    // Store parseable timestamp for sorting
    t._sortTime = t._timestamp ? new Date(t._timestamp).getTime() : Infinity;
  }

  // Step 2: Sort DB agents by started_at within each subagent_type
  const agentsByType = {};
  for (const a of dbAgents) {
    const key = a.subagent_type || a.type;
    if (!agentsByType[key]) agentsByType[key] = [];
    agentsByType[key].push(a);
  }
  for (const key of Object.keys(agentsByType)) {
    agentsByType[key].sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));
  }

  // Step 3: Sort transcripts by type+time, then match by index within each type group
  // Group transcripts by their effective type key
  const transcriptsByType = {};
  for (const t of result) {
    if (t.type === "main") continue;
    // Compaction transcripts have subagent_type=null, use type as key
    const key = t.subagent_type || t.type;
    if (!transcriptsByType[key]) transcriptsByType[key] = [];
    transcriptsByType[key].push(t);
  }
  // Sort each group by timestamp
  for (const key of Object.keys(transcriptsByType)) {
    transcriptsByType[key].sort((a, b) => (a._sortTime || Infinity) - (b._sortTime || Infinity));
  }

  // Step 4: Match by index within each type group
  // First try db_agent_id exact match, then fall back to positional match
  for (const key of Object.keys(transcriptsByType)) {
    const tGroup = transcriptsByType[key];
    const aGroup = agentsByType[key] || [];
    const usedAgentIds = new Set();

    for (let i = 0; i < tGroup.length; i++) {
      const t = tGroup[i];

      // Try exact db_agent_id match first (for non-compact sub-agents with meta.json data)
      if (t.db_agent_id) {
        usedAgentIds.add(t.db_agent_id);
        continue;
      }

      // Positional match: i-th transcript → i-th agent in the same type group
      if (i < aGroup.length && !usedAgentIds.has(aGroup[i].id)) {
        t.db_agent_id = aGroup[i].id;
        usedAgentIds.add(aGroup[i].id);
      }
      // If no agent at this position, db_agent_id stays null — client will show "info missing"
    }
  }

  // Clean up internal fields before sending response
  for (const t of result) {
    delete t._timestamp;
    delete t._sortTime;
  }

  // Sort transcripts: main first, then by time ascending (consistent with agents list order)
  result.sort((a, b) => {
    if (a.type === "main") return -1;
    if (b.type === "main") return 1;
    const aAgent = dbAgents.find((ag) => ag.id === a.db_agent_id);
    const bAgent = dbAgents.find((ag) => ag.id === b.db_agent_id);
    const aTime = aAgent?.started_at ? new Date(aAgent.started_at).getTime() : 0;
    const bTime = bAgent?.started_at ? new Date(bAgent.started_at).getTime() : 0;
    if (aTime && bTime) return aTime - bTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  res.json({ transcripts: result });
});

// GET /:id/transcript — Read session JSONL transcript, return structured message list
// Query params:
//   agent_id: file-level short ID ("main" or "ad18a79192af10ed1", "acompact-xxx")
//   run_id: Workflow run id ("wf_...") — disambiguates a workflow inner agent's
//           nested transcript (subagents/workflows/<run_id>/agent-<agent_id>.jsonl)
//   limit: max messages to return (default 50, max 200)
//   after: JSONL line number, only return messages after this line (incremental mode)
//   before: JSONL line number, only return messages before this line (history mode)
//   offset: legacy pagination offset (compatible, mutually exclusive with after/before)
const MAX_INLINE_TRANSCRIPT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_STORED_TRANSCRIPT_IMAGE_BYTES = 10 * 1024 * 1024;
const SAFE_INLINE_IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/i;
const STORED_TRANSCRIPT_IMAGE_MIME = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

/**
 * Preserve only bounded raster image data that was already persisted inside a
 * local transcript. This deliberately rejects remote URLs and SVG so opening
 * a transcript never causes a network fetch or renders executable markup.
 */
function safeInlineTranscriptImage(value) {
  if (typeof value !== "string") return null;
  const match = value.match(SAFE_INLINE_IMAGE_DATA_URL);
  if (!match) return null;
  const base64 = match[2].replace(/\s/g, "");
  if (Buffer.byteLength(base64, "base64") > MAX_INLINE_TRANSCRIPT_IMAGE_BYTES) return null;
  const subtype = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  return `data:image/${subtype};base64,${base64}`;
}

/** Hide CLI image wrapper tags (and their local paths) from prose. */
function stripTranscriptImageMarkup(value) {
  return String(value || "")
    .replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, "")
    .replace(/<\/?image\b[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n")
    .trim();
}

/** Extract local paths from the CLI's persisted `<image … path="…">` wrappers. */
function transcriptImagePaths(value) {
  const paths = [];
  const matcher = /<image\b[^>]*\bpath=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
  for (const match of String(value || "").matchAll(matcher)) {
    const candidate = match[1] || match[2] || match[3];
    if (candidate && path.isAbsolute(candidate)) paths.push(candidate);
  }
  return paths;
}

function inlineClaudeImage(block) {
  if (block?.type !== "image") return null;
  const source = block.source || {};
  if (typeof source.data !== "string") return null;
  const mediaType = String(source.media_type || "").toLowerCase();
  return safeInlineTranscriptImage(
    source.data.startsWith("data:") ? source.data : `data:${mediaType};base64,${source.data}`
  );
}

/** Resolve only the exact transcript selected by the reader/image request. */
function resolveSessionTranscriptPath(session, sessionId, agentId, runId) {
  if (session.provider === "codex") {
    return session.transcript_path && fs.existsSync(session.transcript_path)
      ? session.transcript_path
      : null;
  }
  if (agentId && agentId !== "main") {
    return (
      getSubagentTranscriptPath(sessionId, session.cwd, agentId, runId) ||
      findSubagentTranscriptPath(sessionId, agentId, runId) ||
      getSnapshotSubagentTranscriptPath(sessionId, agentId, runId)
    );
  }
  return (
    getTranscriptPath(sessionId, session.cwd) ||
    findTranscriptPath(sessionId) ||
    getSnapshotTranscriptPath(sessionId)
  );
}

async function jsonlEntryAtLine(jsonlPath, targetLine) {
  let lineNumber = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    lineNumber++;
    if (lineNumber !== targetLine) continue;
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Convert Codex's mixed input_text/input_image array into display blocks.
 * Keeping images as their own block lets the client render the real persisted
 * attachment instead of an "[Image #]" placeholder in the user prompt.
 */
function codexMessageContent(content) {
  if (typeof content === "string") {
    const text = stripTranscriptImageMarkup(content);
    return text ? [{ type: "text", text: truncate(text, 10240) }] : [];
  }
  if (!Array.isArray(content)) return [];
  const blocks = [];
  for (const part of content) {
    if (part?.type === "input_image") {
      const src = safeInlineTranscriptImage(part.image_url);
      if (src) blocks.push({ type: "image", src, alt: "Attached image" });
      continue;
    }
    if (typeof part?.text === "string") {
      const text = stripTranscriptImageMarkup(part.text);
      if (text) blocks.push({ type: "text", text: truncate(text, 10240) });
    }
  }
  return blocks;
}

function codexContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part?.text === "string") return part.text;
      // Preserve the fact that a user shared an image without exposing a local
      // file path or a base64 payload in the dashboard transcript.
      if (part?.type === "input_image") return "[Image attached]";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function codexToolInput(input) {
  if (typeof input === "string") {
    try {
      return truncateObj(JSON.parse(input), 10240);
    } catch {
      // `exec` is a Codex custom tool call whose input is source code, not JSON.
      // Keeping it under `code` lets the client render it as readable JavaScript.
      return truncateObj({ code: input }, 10240);
    }
  }
  return truncateObj(input || {}, 10240);
}

function codexToolOutput(output) {
  if (typeof output === "string") return truncate(output, 10240);
  if (Array.isArray(output)) return truncate(codexContentText(output), 10240);
  return truncate(JSON.stringify(output || ""), 10240);
}

/** Translate Codex rollout records into the shared conversation DTO. */
function parseCodexMessage(entry, line) {
  if (entry.type === "event_msg" && entry.payload?.type === "user_message") {
    const text =
      typeof entry.payload.message === "string"
        ? stripTranscriptImageMarkup(entry.payload.message)
        : "";
    if (!text.trim()) return null;
    return {
      type: "user",
      sender: "user",
      timestamp: entry.timestamp || null,
      content: [{ type: "text", text: truncate(text, 10240) }],
      line,
      _codexUserKind: "event",
    };
  }
  if (entry.type !== "response_item") return null;
  const item = entry.payload || {};
  const timestamp = entry.timestamp || null;
  if (item.type === "message") {
    const content = codexMessageContent(item.content);
    const text = content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n");
    // Codex injects this descriptor at session start; it is not a human turn.
    if ((!text.trim() && content.length === 0) || text.trim().startsWith("<environment_context>")) {
      return null;
    }
    // `event_msg:user_message` is Codex's durable human-turn record. A matching
    // response item normally immediately precedes it, but keep response-user
    // records too: the reader dedupes adjacent twins and preserves image-only
    // or future Codex shapes that do not emit the event record.
    if (item.role !== "assistant" && item.role !== "user") return null;
    return {
      type: item.role === "assistant" ? "assistant" : "user",
      sender: item.role === "assistant" ? "assistant" : "user",
      timestamp,
      content,
      line,
      ...(item.role === "user" ? { _codexUserKind: "response" } : {}),
    };
  }
  if (item.type === "function_call" || item.type === "custom_tool_call") {
    return {
      type: "assistant",
      sender: "assistant",
      timestamp,
      content: [
        {
          type: "tool_use",
          name: item.name || "tool",
          id: item.call_id || null,
          input: codexToolInput(item.arguments ?? item.input),
        },
      ],
      line,
    };
  }
  if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
    return {
      type: "user",
      sender: "tool",
      timestamp,
      content: [
        {
          type: "tool_result",
          id: item.call_id || null,
          output: codexToolOutput(item.output),
          is_error: false,
        },
      ],
      line,
    };
  }
  return null;
}

async function readCodexTranscript(jsonlPath, { limit, afterLine, beforeLine, offset }) {
  const messages = [];
  let lineNum = 0;
  let total = 0;
  let hasMore = false;
  let previousCodexUserResponse = null;
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = parseCodexMessage(entry, lineNum);
    if (!message) continue;
    if (beforeLine !== null && lineNum >= beforeLine) break;
    const messageText = message.content
      .filter((content) => content.type === "text")
      .map((content) => content.text || "")
      .join("\n");
    // Codex writes the same human turn twice: a response_item message then an
    // immediately following event_msg:user_message. Keep exactly one while
    // retaining either form when it appears on its own at a page boundary.
    if (
      message._codexUserKind === "event" &&
      previousCodexUserResponse &&
      lineNum - previousCodexUserResponse.line <= 1 &&
      messageText === previousCodexUserResponse.text
    ) {
      // The response record was already counted and retained. Drop only its
      // immediately-following event twin so totals and cursor pages stay exact.
      previousCodexUserResponse = null;
      continue;
    }
    total++;
    // Track response-user records even before an `after` cursor. A rollout may
    // flush the response and its event twin in separate writes; carrying this
    // one-record context prevents the next incremental request from appending
    // that same human turn a second time.
    if (message._codexUserKind === "response") {
      previousCodexUserResponse = { line: lineNum, text: messageText };
    } else if (message._codexUserKind === "event") {
      previousCodexUserResponse = null;
    }
    if (afterLine !== null && lineNum <= afterLine) continue;
    if (offset > 0 && total <= offset) continue;
    messages.push(message);
    if (afterLine !== null || offset > 0) {
      if (messages.length >= limit) {
        hasMore = true;
        break;
      }
    } else if (messages.length > limit) {
      messages.shift();
      hasMore = true;
    }
  }

  const firstLine = messages[0]?.line || 0;
  const lastLine = messages[messages.length - 1]?.line || 0;
  messages.forEach((message) => {
    delete message.line;
    delete message._codexUserKind;
  });
  return { messages, total, has_more: hasMore, first_line: firstLine, last_line: lastLine };
}

router.get("/:id/transcript", async (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  if (!sessionIsInScope(session, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  const agentId = req.query.agent_id || null;
  const runId = req.query.run_id || null;
  // Subagent transcripts (anything but the main session file) need different
  // sender attribution: their first user line is the orchestrator's task.
  const isSubagentFile = !!(agentId && agentId !== "main");
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const afterLine = req.query.after ? parseInt(req.query.after) : null;
  const beforeLine = req.query.before ? parseInt(req.query.before) : null;
  const offset = parseInt(req.query.offset) || 0;

  if (session.provider === "codex") {
    const jsonlPath = resolveSessionTranscriptPath(session, req.params.id, agentId, runId);
    if (!jsonlPath) {
      return res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
    }
    try {
      return res.json(
        await readCodexTranscript(jsonlPath, { limit, afterLine, beforeLine, offset })
      );
    } catch {
      return res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
    }
  }

  // Determine the JSONL file path to read. Prefer the live file under
  // ~/.claude/projects, then fall back to the dashboard's durable snapshot —
  // the live file is gone once Claude Code prunes it under cleanupPeriodDays
  // (default 30 days), but the snapshot taken at import time survives.
  const jsonlPath = resolveSessionTranscriptPath(session, req.params.id, agentId, runId);

  if (!jsonlPath || !fs.existsSync(jsonlPath)) {
    return res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
  }

  try {
    // Stream-parse JSONL with early termination for efficiency.
    // Instead of loading all messages into memory, we use pagination-aware
    // strategies to stop reading as soon as we have enough data.
    const messages = [];
    let lineNum = 0;
    let total = 0; // total valid messages seen (exact for early-terminated streams, indicates >= actual)
    let hasMore = false;

    const rl = readline.createInterface({
      input: fs.createReadStream(jsonlPath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    // Dedupe state for synthetic rename markers: custom-title lines can repeat
    // with the same value across a transcript, so only emit when the title
    // actually changes from the last one we surfaced.
    let lastRenameTitle = null;

    function storedImageUrl(line, index) {
      const query = new URLSearchParams({ line: String(line), index: String(index) });
      if (agentId) query.set("agent_id", String(agentId));
      if (runId) query.set("run_id", String(runId));
      return `/api/sessions/${encodeURIComponent(req.params.id)}/transcript-image?${query.toString()}`;
    }

    // Helper: parse a JSONL line into a message object, or null if not a displayable message
    function parseMessage(entry, num) {
      // /rename, `claude -n`, picker Ctrl+R → custom-title metadata line. These
      // commands produce no user/assistant turn, so without this they'd be
      // invisible. Surface a compact "renamed" marker instead.
      if (entry.type === "custom-title") {
        const title = typeof entry.customTitle === "string" ? entry.customTitle.trim() : "";
        if (!title || title === lastRenameTitle) return null;
        lastRenameTitle = title;
        return {
          type: "session_event",
          event_kind: "rename",
          title,
          timestamp: entry.timestamp || null,
          content: [],
          line: num,
        };
      }

      // Local slash-command I/O. Newer Claude Code builds write the command
      // invocation and its captured output as `system`/`local_command` lines
      // with the TUI markup in a top-level `content` string (older builds used
      // `user` messages, handled below). Surface those as user-side text so the
      // client's tuiSegments parser renders the command pill + stdout/stderr
      // (e.g. /color → "/color" pill + "Session color set to: cyan"). Skip
      // every other system subtype (turn_duration, stop_hook_summary, …) and
      // empty local_command lines (e.g. /clear writes a content-less one).
      if (entry.type === "system") {
        if (entry.subtype !== "local_command") return null;
        const sysText = typeof entry.content === "string" ? entry.content : "";
        if (!sysText.trim()) return null;
        return {
          type: "user",
          sender: "user", // local slash-command I/O is the human's own action
          timestamp: entry.timestamp || null,
          content: [{ type: "text", text: truncate(sysText, 10240) }],
          line: num,
        };
      }

      // Mid-turn queued message: journaled as a `queued_command` attachment
      // (never as a `user` line). Surface it at the position the model actually
      // received it. NOT everything in the queue is the human, though — the
      // harness delivers its own injections (task-notifications from background
      // agents, "[SYSTEM NOTIFICATION …]" banners) through the same queue, and
      // those attachments carry NO `origin` field, while a genuinely typed
      // message carries `origin.kind = "human"`. So: harness-marker text or a
      // non-human origin → "system"; everything else → "user". Other attachment
      // subtypes are harness noise → dropped.
      if (entry.type === "attachment") {
        const att = entry.attachment;
        if (!att || att.type !== "queued_command") return null;
        const prompt = typeof att.prompt === "string" ? att.prompt : "";
        if (!prompt.trim()) return null;
        const lead = prompt.replace(/^\s+/, "");
        // Same harness markers classifyTranscriptSender strips off user lines.
        const isHarnessText =
          lead.startsWith("<task-notification") || lead.startsWith("[SYSTEM NOTIFICATION");
        const kind = att.origin && typeof att.origin.kind === "string" ? att.origin.kind : null;
        const isSystem = isHarnessText || (kind !== null && kind !== "human");
        return {
          type: "user",
          sender: isSystem ? "system" : "user",
          timestamp: entry.timestamp || att.timestamp || null,
          content: [{ type: "text", text: truncate(prompt, 10240) }],
          line: num,
        };
      }

      const msg = entry.type === "assistant" ? entry.message || {} : {};
      const content = [];

      if (entry.type === "user") {
        const msgContent = entry.message?.content;
        if (typeof msgContent === "string") {
          const imagePaths = transcriptImagePaths(msgContent);
          imagePaths.forEach((_, index) => {
            content.push({ type: "image", src: storedImageUrl(num, index), alt: "Attached image" });
          });
          const text = stripTranscriptImageMarkup(msgContent);
          if (text) content.push({ type: "text", text: truncate(text, 10240) });
        } else if (Array.isArray(msgContent)) {
          let storedImageIndex = 0;
          for (const block of msgContent) {
            if (block.type === "text" && block.text) {
              const imagePaths = transcriptImagePaths(block.text);
              imagePaths.forEach(() => {
                content.push({
                  type: "image",
                  src: storedImageUrl(num, storedImageIndex++),
                  alt: "Attached image",
                });
              });
              const text = stripTranscriptImageMarkup(block.text);
              if (text) content.push({ type: "text", text: truncate(text, 10240) });
            } else if (block.type === "image") {
              const src = inlineClaudeImage(block);
              if (src) content.push({ type: "image", src, alt: "Attached image" });
            } else if (block.type === "tool_result") {
              content.push({
                type: "tool_result",
                id: block.tool_use_id || null,
                output: truncate(
                  typeof block.content === "string"
                    ? block.content
                    : JSON.stringify(block.content || ""),
                  10240
                ),
                is_error: !!block.is_error,
              });
            }
          }
        } else if (msgContent === undefined || msgContent === null) {
          return null;
        }
      } else {
        const msgContent = msg.content || [];
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "text" && block.text) {
              content.push({ type: "text", text: truncate(block.text, 10240) });
            } else if (block.type === "thinking" && block.thinking) {
              content.push({ type: "thinking", text: truncate(block.thinking, 10240) });
            } else if (block.type === "tool_use") {
              content.push({
                type: "tool_use",
                name: block.name || "unknown",
                id: block.id || null,
                input: truncateObj(block.input, 10240),
              });
            }
          }
        }
      }

      if (content.length === 0) return null;

      const message = {
        type: entry.type,
        sender: classifyTranscriptSender(entry, isSubagentFile),
        timestamp: entry.timestamp
          ? typeof entry.timestamp === "number"
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp
          : null,
        content,
        line: num,
      };

      if (entry.type === "assistant") {
        if (msg.model) message.model = msg.model;
        if (msg.usage) {
          message.usage = {
            input_tokens: msg.usage.input_tokens || 0,
            output_tokens: msg.usage.output_tokens || 0,
            cache_read_input_tokens: msg.usage.cache_read_input_tokens || 0,
            cache_creation_input_tokens: msg.usage.cache_creation_input_tokens || 0,
          };
        }
      }

      return message;
    }

    if (afterLine !== null) {
      // Incremental mode: skip lines until after afterLine, collect up to limit, then stop
      let foundStart = false;
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (!TRANSCRIPT_RENDER_TYPES.has(entry.type)) continue;

        if (!foundStart) {
          if (lineNum <= afterLine) continue;
          foundStart = true;
        }

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        if (messages.length >= limit) {
          // Check if there's at least one more valid message
          hasMore = true;
          rl.close();
          rl.removeAllListeners();
          break;
        }
      }
      // If we exhausted the stream without hitting limit, hasMore stays false
    } else if (beforeLine !== null) {
      // History mode: collect messages with line < beforeLine using a sliding window.
      // hasMore here means "more *older* messages exist before what we're returning"
      // — the only way to know that is if we shifted any out of the window
      // (total > limit). Hitting the boundary tells us nothing about older history.
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (!TRANSCRIPT_RENDER_TYPES.has(entry.type)) continue;
        if (lineNum >= beforeLine) {
          // Reached the boundary — stop reading
          rl.close();
          rl.removeAllListeners();
          break;
        }

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        // Sliding window: only keep the last `limit` messages
        if (messages.length > limit) {
          messages.shift();
        }
      }
      if (total > limit) hasMore = true;
    } else if (offset > 0) {
      // Legacy offset pagination: skip `offset` valid messages, then collect `limit`
      let skipped = 0;
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (!TRANSCRIPT_RENDER_TYPES.has(entry.type)) continue;

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;

        if (skipped < offset) {
          skipped++;
          continue;
        }
        messages.push(message);
        if (messages.length >= limit) {
          hasMore = true; // assume more exist
          rl.close();
          rl.removeAllListeners();
          break;
        }
      }
    } else {
      // Default: return the latest N messages (chat-flow mode) using a sliding window
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (!TRANSCRIPT_RENDER_TYPES.has(entry.type)) continue;

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        // Sliding window: only keep the last `limit` messages in memory
        if (messages.length > limit) {
          messages.shift();
        }
      }
      // If we shifted any messages out, there are more
      hasMore = total > limit;
    }

    const lastLine = messages.length > 0 ? messages[messages.length - 1].line : 0;
    const firstLine = messages.length > 0 ? messages[0].line : 0;

    // Remove internal line field from messages
    for (const m of messages) {
      delete m.line;
    }

    res.json({
      messages,
      total,
      has_more: hasMore,
      last_line: lastLine,
      first_line: firstLine,
    });
  } catch (err) {
    res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
  }
});

// GET /:id/transcript-image — Stream one image that is explicitly referenced
// by one persisted Claude transcript line. The client receives this opaque
// same-origin URL rather than the machine's absolute screenshot path.
router.get("/:id/transcript-image", async (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session || !sessionIsInScope(session, req)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
  }
  const line = Number(req.query.line);
  const index = Number(req.query.index);
  if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(index) || index < 0) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_IMAGE", message: "Invalid image reference" } });
  }
  const agentId = req.query.agent_id || null;
  const runId = req.query.run_id || null;
  const jsonlPath = resolveSessionTranscriptPath(session, req.params.id, agentId, runId);
  if (!jsonlPath) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
  }

  try {
    const entry = await jsonlEntryAtLine(jsonlPath, line);
    if (!entry || entry.type !== "user") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
    }
    const rawContent = entry.message?.content;
    const textBlocks =
      typeof rawContent === "string"
        ? [rawContent]
        : Array.isArray(rawContent)
          ? rawContent.filter((block) => block?.type === "text").map((block) => block.text)
          : [];
    const imagePath = textBlocks.flatMap(transcriptImagePaths)[index];
    if (!imagePath) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
    }
    const realPath = fs.realpathSync(imagePath);
    const mime = STORED_TRANSCRIPT_IMAGE_MIME.get(path.extname(realPath).toLowerCase());
    const stat = fs.statSync(realPath);
    if (!mime || !stat.isFile() || stat.size > MAX_STORED_TRANSCRIPT_IMAGE_BYTES) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
    }
    res.set({
      "Cache-Control": "private, max-age=300",
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "X-Content-Type-Options": "nosniff",
    });
    const stream = fs.createReadStream(realPath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    });
    return stream.pipe(res);
  } catch {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Image not found" } });
  }
});

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "[truncated]";
}

function truncateObj(obj, maxLen) {
  if (!obj) return obj;
  const json = JSON.stringify(obj);
  if (json.length <= maxLen) return obj;
  return { _truncated: truncate(json, maxLen) };
}

module.exports = router;
// Exported for unit tests — sender attribution is correctness-critical.
module.exports.classifyTranscriptSender = classifyTranscriptSender;
module.exports.readCodexTranscript = readCodexTranscript;
