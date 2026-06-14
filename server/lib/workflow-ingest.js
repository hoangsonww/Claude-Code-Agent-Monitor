/**
 * Workflow-tool run ingestion.
 *
 * The Claude Code "Workflow" tool (and self-paced /loop) spawn fleets of inner
 * sub-agents that emit NO hooks — so hook-based ingestion can never see them.
 * Everything lives on disk under the launching session's transcript folder:
 *
 *   <projects>/<enc-cwd>/<sessionId>/
 *     workflows/
 *       scripts/<name>-wf_<runId>.js   ← written at LAUNCH
 *       wf_<runId>.json                ← run journal, written at COMPLETION
 *     subagents/
 *       agent-<agentId>.jsonl          ← one transcript per inner agent
 *
 * The run journal is the source of truth for a completed run: identity,
 * lifecycle, aggregates, phases[], and workflowProgress[] (one entry per inner
 * agent, keyed by the EXACT agent-<agentId>.jsonl basename). Because the
 * journal is terminal-only, a running workflow is detected from its launch
 * script plus live subagents/ activity, and replaced by the journal record on
 * completion (idempotent upsert by run_id).
 *
 * Inner agents are linked into the existing agents table via the same
 * `${sessionId}-jsonl-<agentId>` id scheme that importSubagentFromJsonl uses,
 * so ingestion CONVERGES with any prior subagent import (no duplicate rows).
 * Per-agent token/tool/duration metrics come from the journal's progress[]
 * JSON — this module never writes token_usage, so it cannot double-count.
 *
 * All functions are fail-safe: a malformed/partial journal throws only locally
 * and is skipped; ingestion never blocks or breaks hook handling.
 */

const fs = require("fs");
const path = require("path");

// Lazy-required to avoid a require cycle (import-history → db → … ) and to keep
// startup cheap; mirrors how server/index.js lazy-requires import helpers.
function importHistory() {
  return require("../../scripts/import-history");
}

let claudeHome = null;
function getClaudeHomeLib() {
  if (!claudeHome) claudeHome = require("./claude-home");
  return claudeHome;
}

/**
 * Canonical run id derived from a journal/script filename. Both
 * `wf_<runId>.json` and `<name>-wf_<runId>.js` reduce to the same `wf_<runId>`
 * token so a launch-detected "running" row and its later journal reconcile on
 * the same key.
 */
function extractRunId(filename) {
  const base = path.basename(filename).replace(/\.(json|js)$/i, "");
  const m = base.match(/wf_[A-Za-z0-9_-]+$/);
  return m ? m[0] : base;
}

/** Workflow name from a launch-script basename: strip the `-wf_<runId>` tail. */
function nameFromScript(filename) {
  const base = path.basename(filename).replace(/\.js$/i, "");
  return base.replace(/-?wf_[A-Za-z0-9_-]+$/, "") || base;
}

function toIso(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    try {
      return new Date(value).toISOString();
    } catch {
      return null;
    }
  }
  return String(value);
}

/** Map a journal progress `state` to an agents.status value. */
function mapState(state) {
  switch (String(state || "").toLowerCase()) {
    case "error":
    case "failed":
      return "error";
    case "running":
    case "working":
    case "active":
    case "in_progress":
    case "queued":
      return "working";
    case "done":
    case "completed":
    case "success":
      return "completed";
    default:
      return "completed";
  }
}

/**
 * Resolve a session's transcript JSONL path from a session-like row. Prefers an
 * explicit transcript_path; otherwise derives it from (id, cwd) via claude-home.
 */
function resolveTranscriptPath(session) {
  if (session && session.transcript_path) return session.transcript_path;
  if (session && session.id && session.cwd) {
    try {
      return getClaudeHomeLib().getTranscriptPath(session.id, session.cwd);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Locate a session's workflow artifacts from its transcript JSONL path.
 * Mirrors findSessionSubagents: workflows live at
 * `<dir>/<sessionId>/workflows/` next to `<dir>/<sessionId>.jsonl`.
 *
 * @returns {{ workflowsDir: string|null, subagentsDir: string|null,
 *             journals: string[], scripts: string[] }}
 */
function findSessionWorkflows(transcriptPath) {
  const empty = { sessionDir: null, workflowsDir: null, journals: [], scripts: [] };
  if (!transcriptPath) return empty;
  const dir = path.dirname(transcriptPath);
  const sessionId = path.basename(transcriptPath, ".jsonl");
  const sessionDir = path.join(dir, sessionId);
  const workflowsDir = path.join(sessionDir, "workflows");

  const journals = [];
  const scripts = [];
  try {
    if (fs.existsSync(workflowsDir)) {
      for (const f of fs.readdirSync(workflowsDir)) {
        if (f.startsWith("wf_") && f.endsWith(".json")) journals.push(path.join(workflowsDir, f));
      }
      const scriptsDir = path.join(workflowsDir, "scripts");
      if (fs.existsSync(scriptsDir)) {
        for (const f of fs.readdirSync(scriptsDir)) {
          if (f.endsWith(".js")) scripts.push(path.join(scriptsDir, f));
        }
      }
    }
  } catch {
    /* non-fatal — partial dir during a live run */
  }
  return { sessionDir, workflowsDir, journals, scripts };
}

/**
 * Per-run inner-agent transcript directory. The Workflow tool writes each
 * fleet's agents under `<sessionId>/subagents/workflows/<runId>/agent-*.jsonl`
 * (NOT the session's top-level subagents/ dir).
 */
function agentsDirForRun(sessionDir, runId) {
  return path.join(sessionDir, "subagents", "workflows", runId);
}

/** Read + normalize a run journal file. Returns null on any parse failure. */
function parseWorkflowJournal(journalPath) {
  let raw;
  try {
    raw = fs.readFileSync(journalPath, "utf8");
  } catch {
    return null;
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  const runId = extractRunId(journalPath) || j.runId || null;
  if (!runId) return null;

  const startedAt = toIso(j.startTime != null ? j.startTime : j.startedAt);
  const durationMs = Number.isFinite(j.durationMs) ? j.durationMs : null;
  let endedAt = toIso(j.endTime != null ? j.endTime : j.endedAt);
  if (!endedAt && startedAt && durationMs != null) {
    const t = Date.parse(startedAt);
    if (!Number.isNaN(t)) endedAt = new Date(t + durationMs).toISOString();
  }
  const progress = Array.isArray(j.workflowProgress)
    ? j.workflowProgress
    : Array.isArray(j.progress)
      ? j.progress
      : [];

  return {
    runId,
    taskId: j.taskId || null,
    name: j.workflowName || j.name || nameFromScript(journalPath),
    status: String(j.status || "completed"),
    defaultModel: j.defaultModel || null,
    startedAt,
    endedAt,
    durationMs,
    agentCount: Number.isFinite(j.agentCount) ? j.agentCount : progress.length,
    totalTokens: Number.isFinite(j.totalTokens) ? j.totalTokens : 0,
    totalToolCalls: Number.isFinite(j.totalToolCalls) ? j.totalToolCalls : 0,
    phases: Array.isArray(j.phases) ? j.phases : [],
    progress,
    journalPath,
  };
}

/**
 * Ingest one parsed journal: upsert the workflow row, then link/create each
 * inner agent. Returns the upserted workflow row, or null on failure.
 */
async function ingestWorkflowJournal(dbModule, sessionId, journal, opts = {}) {
  const { stmts } = dbModule;
  const mainAgentId = `${sessionId}-main`;
  const ih = importHistory();
  // Inner-agent transcripts live in a per-run nested dir, not the session's
  // top-level subagents/. opts.sessionDir is the session transcript folder.
  const agentDir = opts.sessionDir ? agentsDirForRun(opts.sessionDir, journal.runId) : null;

  stmts.upsertWorkflow.run(
    journal.runId,
    sessionId,
    journal.taskId,
    journal.name,
    journal.status,
    journal.defaultModel,
    journal.startedAt,
    journal.endedAt,
    journal.durationMs,
    journal.agentCount,
    journal.totalTokens,
    journal.totalToolCalls,
    JSON.stringify(journal.phases),
    JSON.stringify(journal.progress),
    opts.scriptPath || null,
    journal.journalPath || null,
    "journal"
  );

  // Only `workflow_agent` entries are real agents; `workflow_phase` entries are
  // phase markers (kept in progress[] for the phase chips, skipped here).
  const agentEntries = journal.progress.filter(
    (e) => e && e.type === "workflow_agent" && e.agentId
  );
  for (const entry of agentEntries) {
    const agentId = entry.agentId;
    const jsonlId = `${sessionId}-jsonl-${agentId}`;
    const status = mapState(entry.state);
    const phase = entry.phaseTitle || null;
    // subagent_type: prefer the label's prefix (e.g. "scout:starship" → "scout")
    // for nicer grouping; otherwise the generic workflow-subagent type.
    const subType =
      (entry.label && entry.label.includes(":") ? entry.label.split(":")[0] : null) ||
      entry.agentType ||
      "workflow-subagent";

    // Prefer parsing the real transcript so tool events + metadata land via the
    // shared importer (idempotent, dedups by tool_use_id). Fall back to a
    // minimal row built from the journal entry if the file is gone.
    let parsed = null;
    if (agentDir) {
      const subPath = path.join(agentDir, `agent-${agentId}.jsonl`);
      if (fs.existsSync(subPath)) {
        try {
          parsed = await ih.parseSubagentFile(subPath);
        } catch {
          parsed = null;
        }
      }
    }
    try {
      if (parsed) {
        ih.importSubagentFromJsonl(dbModule, sessionId, mainAgentId, parsed);
      } else if (!stmts.getAgent.get(jsonlId)) {
        stmts.insertAgent.run(
          jsonlId,
          sessionId,
          entry.label || `Subagent ${String(agentId).slice(0, 8)}`,
          "subagent",
          subType,
          status,
          entry.label || entry.promptPreview || null,
          mainAgentId,
          JSON.stringify({
            imported: true,
            source: "workflow",
            workflow_run_id: journal.runId,
            model: entry.model || null,
            tokens: entry.tokens || 0,
            tool_calls: entry.toolCalls || 0,
          })
        );
      }
      // Stamp the workflow linkage + journal-authoritative status/phase.
      stmts.setAgentWorkflow.run(journal.runId, phase, status, jsonlId);
    } catch {
      /* one bad agent must not abort the whole run ingest */
    }
  }

  return stmts.getWorkflow.get(journal.runId);
}

/**
 * Detect running workflows: a launch script whose journal hasn't landed yet.
 * Upsert a minimal `running` row so the UI shows it before completion. Skips
 * runs that already have a completed/error row (the journal won.) Returns the
 * upserted rows.
 */
function detectRunningWorkflows(dbModule, sessionId, paths, journalRunIds) {
  const { stmts } = dbModule;
  const changed = [];
  for (const scriptPath of paths.scripts) {
    const runId = extractRunId(scriptPath);
    if (!runId || journalRunIds.has(runId)) continue;
    const existing = stmts.getWorkflow.get(runId);
    if (existing && existing.status !== "running") continue; // journal already won

    let startedAt = null;
    let agentCount = 0;
    try {
      const st = fs.statSync(scriptPath);
      startedAt = new Date(st.mtimeMs).toISOString();
    } catch {
      /* ignore */
    }
    // Best-effort fleet size: inner-agent transcripts in this run's nested dir.
    try {
      const agentDir = paths.sessionDir ? agentsDirForRun(paths.sessionDir, runId) : null;
      if (agentDir && fs.existsSync(agentDir)) {
        agentCount = fs
          .readdirSync(agentDir)
          .filter((f) => f.startsWith("agent-") && f.endsWith(".jsonl")).length;
      }
    } catch {
      /* ignore */
    }

    stmts.upsertWorkflow.run(
      runId,
      sessionId,
      null,
      nameFromScript(scriptPath),
      "running",
      null,
      startedAt,
      null,
      null,
      agentCount,
      0,
      0,
      null,
      null,
      scriptPath,
      null,
      "live"
    );
    changed.push(stmts.getWorkflow.get(runId));
  }
  return changed;
}

/**
 * Ingest every workflow artifact for one session: completed journals first,
 * then running detection for journal-less launch scripts.
 *
 * @param {object} dbModule - { db, stmts }
 * @param {{id: string, transcript_path?: string, cwd?: string}} session
 * @returns {Promise<object[]>} the workflow rows that were inserted/updated
 */
async function ingestWorkflowsForSession(dbModule, session) {
  const sessionId = session && session.id;
  if (!sessionId) return [];
  const transcriptPath = resolveTranscriptPath(session);
  if (!transcriptPath) return [];

  const paths = findSessionWorkflows(transcriptPath);
  if (paths.journals.length === 0 && paths.scripts.length === 0) return [];

  const changed = [];
  const journalRunIds = new Set();
  // Map runId → its launch script (so a journal row records script_path too).
  const scriptByRun = new Map();
  for (const s of paths.scripts) scriptByRun.set(extractRunId(s), s);

  for (const journalPath of paths.journals) {
    try {
      const journal = parseWorkflowJournal(journalPath);
      if (!journal) continue;
      journalRunIds.add(journal.runId);
      const row = await ingestWorkflowJournal(dbModule, sessionId, journal, {
        sessionDir: paths.sessionDir,
        scriptPath: scriptByRun.get(journal.runId) || null,
      });
      if (row) changed.push(row);
    } catch {
      /* skip malformed journal */
    }
  }

  try {
    changed.push(...detectRunningWorkflows(dbModule, sessionId, paths, journalRunIds));
  } catch {
    /* non-fatal */
  }

  return changed;
}

/**
 * One-time backfill: ingest workflow artifacts for every recorded session.
 * Used by the legacy auto-import on first boot so historical completed
 * workflows surface. Idempotent and fail-safe per session.
 *
 * @returns {Promise<{sessions: number, workflows: number}>}
 */
async function ingestAllWorkflows(dbModule) {
  const { db } = dbModule;
  let rows = [];
  try {
    rows = db.prepare("SELECT id, cwd, transcript_path FROM sessions").all();
  } catch {
    return { sessions: 0, workflows: 0 };
  }
  let sessions = 0;
  let workflows = 0;
  for (const row of rows) {
    try {
      const changed = await ingestWorkflowsForSession(dbModule, {
        id: row.id,
        cwd: row.cwd,
        transcript_path: row.transcript_path,
      });
      if (changed.length > 0) {
        sessions++;
        workflows += changed.length;
      }
    } catch {
      /* non-fatal — skip this session */
    }
  }
  return { sessions, workflows };
}

module.exports = {
  ingestWorkflowsForSession,
  ingestAllWorkflows,
  findSessionWorkflows,
  parseWorkflowJournal,
  ingestWorkflowJournal,
  detectRunningWorkflows,
  extractRunId,
  nameFromScript,
  mapState,
};
