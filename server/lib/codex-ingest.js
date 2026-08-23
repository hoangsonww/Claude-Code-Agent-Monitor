/**
 * @file Incrementally ingests Codex rollout JSONL transcripts into dashboard
 * sessions, events, response-item tool calls, costs, native `/rename` titles,
 * latest human-prompt card context, startup placeholders from hooks or Codex's
 * live-thread state, resume-picker reactivation, and dashboard card lifecycle.
 * Independent byte cursors make watcher/hook notifications idempotent and
 * real-time safe.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { db, stmts } = require("../db");
const {
  getCodexSessionsDir,
  getCodexStateDbPath,
  getCodexSessionTitle,
  getCodexSessionTitles,
} = require("./codex-home");
const { getDataDir } = require("./claude-home");
const { updatePlanArgumentIndexes } = require("./codex-plan-call");

const MAX_EVENT_SUMMARY = 500;
const CONTEXT_SHORT_LIMIT = 272000;
const EVENT_TYPES = new Set([
  "user_message",
  "task_started",
  "task_complete",
  "exec_command_end",
  "mcp_tool_call_end",
  "web_search_end",
  "turn_aborted",
  "context_compacted",
  "error",
]);
const LIFECYCLE_EVENT_TYPES = new Set([
  "user_message",
  "task_started",
  "task_complete",
  "turn_aborted",
]);
const DEFAULT_WORKING_IDLE_MS = 90_000;
const LIVE_THREAD_MAX_AGE_MS = 15 * 60 * 1_000;

// Hooks generally identify a Codex thread but do not consistently include its
// rollout path. Keep this small, disposable index so a hook can ingest the
// right file immediately instead of waiting for the polling safety net.
const transcriptPathBySessionId = new Map();

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function sessionIdFromPath(transcriptPath) {
  const match = path.basename(transcriptPath).match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i);
  return match ? match[1] : null;
}

function rememberTranscriptPath(transcriptPath) {
  const sessionId = sessionIdFromPath(transcriptPath);
  if (sessionId) transcriptPathBySessionId.set(sessionId, transcriptPath);
  return sessionId;
}

/**
 * Read `[offset, offset + length)` from a file as UTF-8, closing the descriptor
 * on EVERY exit path.
 *
 * `Buffer.alloc` and `fs.readSync` can both throw after the open, and callers
 * retry a failed rollout on every subsequent sweep — so an fd leaked here does
 * not leak once, it leaks once per sweep and will eventually exhaust the
 * process descriptor limit on a file with a persistent read error.
 */
function readRangeUtf8(filePath, offset, length) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, offset);
    return buffer.toString("utf8");
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed or otherwise invalid — there is nothing left to release.
    }
  }
}

function isCodexTranscript(transcriptPath, options = {}) {
  if (typeof transcriptPath !== "string" || !transcriptPath.endsWith(".jsonl")) return false;
  const root = path.resolve(options.root || getCodexSessionsDir());
  const candidate = path.resolve(transcriptPath);
  return candidate.startsWith(`${root}${path.sep}`);
}

function findCodexTranscripts(root = getCodexSessionsDir(), options = {}) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (
        entry.isFile() &&
        entry.name.endsWith(".jsonl") &&
        (entry.name.startsWith("rollout-") || options.includeAllJsonl)
      ) {
        rememberTranscriptPath(fullPath);
        // Stat once here rather than inside the sort comparator below — with
        // thousands of historical rollouts a comparator statSync turns one
        // discovery pass into O(n log n) stat syscalls (measured 25k+ per
        // sweep on a 4k-file corpus).
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(fullPath).mtimeMs;
        } catch {
          /* sort unstattable files last */
        }
        files.push({ path: fullPath, mtimeMs });
      }
    }
  }
  // New/active rollouts must win over a large historical backlog. The syncer
  // yields between files, but this ordering ensures a just-created session is
  // visible on the first cooperative slice rather than after every old file.
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).map((file) => file.path);
}

/**
 * Resolve a hook's session/thread id to its rollout file. A cache hit is O(1);
 * a cache miss safely falls back to the same recursive discovery used by the
 * background synchronizer so fresh sessions arrive in real time too.
 */
function findCodexTranscriptForSession(sessionId, root = getCodexSessionsDir()) {
  if (typeof sessionId !== "string" || !sessionId) return null;
  const cached = transcriptPathBySessionId.get(sessionId);
  if (cached && isCodexTranscript(cached) && fs.existsSync(cached)) return cached;
  for (const transcriptPath of findCodexTranscripts(root)) {
    if (sessionIdFromPath(transcriptPath) === sessionId) return transcriptPath;
  }
  return null;
}

function extractText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function truncate(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > MAX_EVENT_SUMMARY ? `${text.slice(0, MAX_EVENT_SUMMARY - 1)}…` : text;
}

/**
 * A Codex user-message event is the provider's closest equivalent to Claude's
 * main-agent task. Keep the exact human-authored text (within the same safe
 * preview limit used by the activity feed) so cards can explain what a renamed
 * Codex session is actually working on without inventing an AI-generated title.
 */
function userMessagePreview(payload) {
  return truncate(extractText(payload?.message));
}

function eventDetails(record) {
  const payload = record.payload || {};
  switch (payload.type) {
    case "user_message":
      return { summary: userMessagePreview(payload), tool: null };
    case "exec_command_end":
      return {
        summary: truncate(payload.command || payload.output || "Command completed"),
        tool: "Bash",
      };
    case "mcp_tool_call_end":
      return { summary: truncate(payload.name || "MCP tool completed"), tool: "MCP" };
    case "web_search_end":
      return { summary: truncate(payload.query || "Web search completed"), tool: "WebSearch" };
    default:
      return { summary: truncate(payload.message || payload.type || "Codex event"), tool: null };
  }
}

/**
 * Normalize Codex's multiple tool surfaces to the dashboard's concise, visual
 * vocabulary. The raw tool name remains in the event payload, while analytics
 * can group equivalent shell/edit/search actions without mistaking an output
 * record for a second invocation.
 */
function codexToolCategory(name) {
  const raw = String(name || "").trim();
  const normalized = raw.toLowerCase();
  if (/^(exec_command|shell_command|shell|bash|write_stdin|exec)$/.test(normalized)) {
    return "Bash";
  }
  if (normalized === "apply_patch" || normalized === "edit") return "Edit";
  if (/^(read|cat|read_file)$/.test(normalized)) return "Read";
  if (/(^|_)(grep|rg|search)(_|$)/.test(normalized)) return "Grep";
  if (/(^|_)(glob|find)(_|$)/.test(normalized)) return "Glob";
  if (normalized === "web_search" || normalized === "web_search_call") return "WebSearch";
  if (normalized === "tool_search" || normalized === "tool_search_call") return "ToolSearch";
  if (/(^|_)(spawn_agent|create_agent|delegate)(_|$)/.test(normalized)) return "Agent";
  if (normalized.startsWith("mcp__")) return "MCP";
  if (normalized === "wait") return "Wait";
  return raw || "Other";
}

function isWrappedUpdatePlan(item) {
  return (
    item?.type === "custom_tool_call" &&
    item.name === "exec" &&
    updatePlanArgumentIndexes(item.input).length > 0
  );
}

function responseToolDetails(record) {
  const item = record.payload || {};
  if (
    item.type !== "function_call" &&
    item.type !== "custom_tool_call" &&
    item.type !== "web_search_call" &&
    item.type !== "tool_search_call"
  ) {
    return null;
  }
  const rawName =
    item.name ||
    (item.type === "web_search_call"
      ? "web_search"
      : item.type === "tool_search_call"
        ? "tool_search"
        : null);
  if (!rawName) return null;
  const displayName = isWrappedUpdatePlan(item) ? "update_plan" : String(rawName);
  return {
    rawName: String(rawName),
    tool: codexToolCategory(displayName),
    summary: truncate(`Called ${displayName}`),
    callId: item.call_id || null,
    itemType: item.type,
  };
}

function eventSpeed(record) {
  const tier =
    record?.payload?.service_tier ||
    record?.payload?.serviceTier ||
    record?.payload?.thread_settings?.service_tier ||
    record?.payload?.thread_settings?.serviceTier;
  return tier === "fast" || tier === "priority" ? "fast" : "standard";
}

function persistEvent(sessionId, agentId, record) {
  let eventType;
  let tool;
  let summary;
  let data;
  if (record.type === "event_msg" && EVENT_TYPES.has(record.payload?.type)) {
    ({ summary, tool } = eventDetails(record));
    eventType = `codex_${record.payload.type}`;
    // The matching response_item is the actual invocation and owns the tool
    // analytics row. Terminal notifications still belong in the event feed,
    // but counting them as tools would double every command/MCP/search call.
    if (["exec_command_end", "mcp_tool_call_end", "web_search_end"].includes(record.payload.type)) {
      tool = null;
    }
    data = { provider: "codex", event: record.payload.type, timestamp: record.timestamp };
  } else {
    const details = responseToolDetails(record);
    if (!details) return null;
    eventType = "codex_tool_call";
    tool = details.tool;
    summary = details.summary;
    data = {
      provider: "codex",
      event: "tool_call",
      item_type: details.itemType,
      call_id: details.callId,
      raw_tool_name: details.rawName,
      timestamp: record.timestamp,
    };
  }
  const timestamp = Date.parse(record.timestamp || "")
    ? new Date(record.timestamp).toISOString()
    : new Date().toISOString();
  const info = stmts.insertEventAt.run(
    sessionId,
    agentId,
    eventType,
    tool,
    summary,
    JSON.stringify(data),
    timestamp
  );
  return db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid);
}

/** Keep dashboard cards aligned with the title chosen in Codex's `/rename` UI. */
function syncCodexSessionTitle(session) {
  if (!session?.id) return { changed: false, session };
  const title = getCodexSessionTitle(session.id);
  if (!title || title === session.name) return { changed: false, session };
  const changed = stmts.updateSessionName.run(title, session.id, title).changes > 0;
  return { changed, session: changed ? stmts.getSession.get(session.id) : session };
}

/**
 * Sync title-only Codex changes which do not append to a rollout transcript.
 * `/rename` is written to `session_index.jsonl`, so this runs independently of
 * the incremental transcript byte cursor.
 */
function refreshCodexSessionTitles() {
  const titles = getCodexSessionTitles();
  if (!titles.size) return [];
  const sessions = db.prepare("SELECT * FROM sessions WHERE provider = 'codex'").all();
  const changed = [];
  for (const session of sessions) {
    if (!titles.has(session.id)) continue;
    const synced = syncCodexSessionTitle(session);
    if (synced.changed) {
      changed.push({
        changed: true,
        created: false,
        session: synced.session,
        agent: stmts.getAgent.get(`codex:${session.id}`),
        events: [],
      });
    }
  }
  return changed;
}

function createCodexSession(meta, transcriptPath, options = {}) {
  const sessionId = meta?.id || sessionIdFromPath(transcriptPath);
  if (!sessionId) return null;
  let session = stmts.getSession.get(sessionId);
  if (session) return session;

  const startedAt = meta?.timestamp || new Date().toISOString();
  const cwd = meta?.cwd || null;
  const metadata = JSON.stringify({
    provider: "codex",
    transcript_path: transcriptPath,
    cli_version: meta?.cli_version || null,
    model_provider: meta?.model_provider || "openai",
    git: meta?.git || null,
  });
  const confirmedHistorical = options.confirmedLive === false;
  stmts.insertCodexSession.run(
    sessionId,
    getCodexSessionTitle(sessionId) || "Codex session",
    confirmedHistorical ? "completed" : "active",
    cwd,
    meta?.model || meta?.model_name || "unknown",
    "local",
    startedAt,
    startedAt,
    metadata
  );
  // Keep the canonical transcript pointer on the session row too. The session
  // detail/transcript APIs, retention tools, and live-status checks all read
  // this column rather than provider-specific metadata.
  if (typeof transcriptPath === "string" && transcriptPath) {
    stmts.setSessionTranscriptPath.run(transcriptPath, sessionId);
  }
  const agentId = `codex:${sessionId}`;
  stmts.insertAgent.run(
    agentId,
    sessionId,
    "Codex",
    "main",
    null,
    confirmedHistorical ? "completed" : "working",
    null,
    null,
    metadata
  );
  if (confirmedHistorical) {
    const endedAt = options.endedAt || startedAt;
    db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(endedAt, sessionId);
    db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(endedAt, agentId);
  }
  session = stmts.getSession.get(sessionId);
  return session;
}

/**
 * Read Codex's native live-thread index as a hook-independent startup signal.
 * A CLI can defer a newly configured hook for trust review, while its local
 * state row is written at launch and already contains the stable session ID.
 * Only very recent rows become placeholders; older sessions remain owned by
 * normal rollout discovery, avoiding an unexpected history import at startup.
 */
function syncCodexStateSessions(options = {}) {
  const maxAgeMs = options.maxAgeMs ?? LIVE_THREAD_MAX_AGE_MS;
  const statePath = getCodexStateDbPath();
  if (!statePath || !fs.existsSync(statePath)) return [];

  let stateDb;
  try {
    const Database = require("better-sqlite3");
    stateDb = new Database(statePath, { readonly: true, fileMustExist: true });
    const threads = stateDb
      .prepare(
        `SELECT id, rollout_path, created_at, cwd, model, model_provider, cli_version
         FROM threads
         WHERE archived = 0
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all();
    const now = Date.now();
    const changed = [];
    for (const thread of threads) {
      const createdAtMs = Number(thread.created_at) * 1_000;
      if (!thread.id || !Number.isFinite(createdAtMs) || now - createdAtMs > maxAgeMs) continue;
      if (stmts.getSession.get(thread.id)) continue;

      const transcriptPath =
        typeof thread.rollout_path === "string" && fs.existsSync(thread.rollout_path)
          ? thread.rollout_path
          : null;
      const session = createCodexSession(
        {
          id: thread.id,
          timestamp: new Date(createdAtMs).toISOString(),
          cwd: thread.cwd,
          model: thread.model,
          model_provider: thread.model_provider,
          cli_version: thread.cli_version,
        },
        transcriptPath
      );
      if (!session) continue;
      setCodexWaiting(thread.id, "session_start");
      changed.push({
        changed: true,
        created: true,
        session: stmts.getSession.get(thread.id),
        agent: stmts.getAgent.get(`codex:${thread.id}`),
        events: [],
      });
    }
    return changed;
  } catch {
    // The native state format is optional and evolves with Codex. Rollout
    // ingestion remains authoritative when this read is unavailable.
    return [];
  } finally {
    try {
      stateDb?.close();
    } catch {
      // Read-only diagnostic access must never affect dashboard startup.
    }
  }
}

/**
 * Normalize the stable identity Codex supplies to lifecycle hooks. A rollout
 * is sometimes created or flushed after SessionStart, so this lets the hook
 * create the same initial, prompt-waiting card that Claude's SessionStart
 * creates without depending on a readable transcript yet.
 */
function codexHookMeta(data) {
  if (!data || typeof data !== "object") return null;
  const id = [
    data.session_id,
    data.sessionId,
    data.thread_id,
    data.threadId,
    data.session?.id,
    data.thread?.id,
    data.context?.session_id,
    data.context?.thread_id,
  ].find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!id) return null;
  return {
    id,
    timestamp: data.timestamp || data.started_at || data.startedAt,
    cwd: data.cwd || data.session?.cwd || data.context?.cwd,
    model: data.model || data.model_name || data.session?.model || data.context?.model,
    cli_version: data.cli_version || data.cliVersion,
    model_provider: data.model_provider || data.modelProvider,
    git: data.git,
  };
}

/**
 * Codex writes its lifecycle directly into append-only rollout records. Keep
 * the same invariant the Claude Stop hook owns: a completed turn is still an
 * active session, but its cards are Waiting until the next human prompt.
 */
function setCodexWorking(sessionId) {
  const agentId = `codex:${sessionId}`;
  let changed = false;
  const session = stmts.getSession.get(sessionId);
  if (!session) return false;
  if (session.status !== "active" || session.ended_at) {
    changed = stmts.reactivateSession.run(sessionId).changes > 0 || changed;
  }
  if (session.awaiting_input_since) {
    changed = stmts.clearSessionAwaitingInput.run(sessionId).changes > 0 || changed;
  }
  const agent = stmts.getAgent.get(agentId);
  // A new rollout turn is authoritative evidence that a session previously
  // completed by a lost/mis-timed hook was resumed. Match Claude's existing
  // self-heal behavior and restore the main agent to working.
  if (agent && agent.status !== "working") {
    changed = stmts.reactivateAgent.run(agentId).changes > 0 || changed;
  }
  if (agent?.awaiting_input_since) {
    changed = stmts.clearAgentAwaitingInput.run(agentId).changes > 0 || changed;
  }
  return changed;
}

function setCodexWaiting(sessionId, reason = "stop") {
  const agentId = `codex:${sessionId}`;
  let changed = false;
  const session = stmts.getSession.get(sessionId);
  if (!session) return false;
  if (session.status !== "active" || session.ended_at) {
    changed = stmts.reactivateSession.run(sessionId).changes > 0 || changed;
  }
  const now = new Date().toISOString();
  if (!session.awaiting_input_since || session.awaiting_reason !== reason) {
    changed = stmts.setSessionAwaitingInput.run(now, reason, sessionId).changes > 0 || changed;
  }
  const agent = stmts.getAgent.get(agentId);
  if (agent && (agent.status === "completed" || agent.status === "error")) {
    changed = stmts.reactivateAgent.run(agentId).changes > 0 || changed;
  }
  if (agent && agent.status !== "waiting") {
    changed =
      stmts.updateAgent.run(null, "waiting", null, null, null, null, agentId).changes > 0 ||
      changed;
  }
  if (agent && (!agent.awaiting_input_since || agent.awaiting_reason !== reason)) {
    changed = stmts.setAgentAwaitingInput.run(now, reason, agentId).changes > 0 || changed;
  }
  return changed;
}

function resumeCodexSessionAtPrompt(sessionId) {
  const session = stmts.getSession.get(sessionId);
  if (
    !session ||
    session.provider !== "codex" ||
    (session.source !== null && session.source !== "local")
  ) {
    return null;
  }
  const changed = setCodexWaiting(sessionId, "session_start");
  return {
    changed,
    session: stmts.getSession.get(sessionId),
    agent: stmts.getAgent.get(`codex:${sessionId}`),
  };
}

function applyCodexTranscriptLifecycle(sessionId, record) {
  const type = record?.type === "event_msg" ? record.payload?.type : null;
  if (!LIFECYCLE_EVENT_TYPES.has(type)) return false;
  if (type === "task_complete") return setCodexWaiting(sessionId, "stop");
  if (type === "turn_aborted") return setCodexWaiting(sessionId, "interrupted");
  return setCodexWorking(sessionId);
}

function applyTokenSnapshot(sessionId, model, speed, tokenInfo, previous) {
  const total = tokenInfo.total_token_usage;
  if (!total) return previous;
  const current = {
    input_tokens: asNumber(total.input_tokens),
    cached_input_tokens: asNumber(total.cached_input_tokens),
    cache_write_input_tokens: asNumber(total.cache_write_input_tokens),
    output_tokens: asNumber(total.output_tokens),
    reasoning_output_tokens: asNumber(total.reasoning_output_tokens),
  };
  const fields = Object.keys(current);
  const hasRegression = fields.some((field) => current[field] < asNumber(previous[field]));
  const delta = Object.fromEntries(
    fields.map((field) => [
      field,
      hasRegression ? 0 : Math.max(0, current[field] - asNumber(previous[field])),
    ])
  );
  const output = delta.output_tokens + delta.reasoning_output_tokens;
  const freshInput = Math.max(
    0,
    delta.input_tokens - delta.cached_input_tokens - delta.cache_write_input_tokens
  );
  if (freshInput || delta.cached_input_tokens || delta.cache_write_input_tokens || output) {
    const contextSize = delta.input_tokens > CONTEXT_SHORT_LIMIT ? "long" : "short";
    stmts.upsertCodexTokenDelta.run(
      sessionId,
      model || "unknown",
      speed,
      contextSize,
      freshInput,
      output,
      delta.cached_input_tokens,
      delta.cache_write_input_tokens
    );
  }
  return current;
}

/**
 * Incrementally persist Codex `response_item` tool invocations. These records
 * are richer than the low-volume terminal `event_msg` notifications and power
 * the Workflows tool-flow view. Their own cursor lets existing histories be
 * backfilled once without replaying token counters or lifecycle state.
 */
function ingestCodexToolEvents(transcriptPath, options = {}) {
  if (!isCodexTranscript(transcriptPath, options)) return { changed: false, events: [] };
  rememberTranscriptPath(transcriptPath);
  let stat;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    // An I/O failure is NOT a completed no-op: the caller's retry bookkeeping
    // has to keep this file queued, otherwise a transient error leaves its
    // response-item tool calls unindexed until the file happens to grow.
    return { changed: false, events: [], failed: true };
  }
  const state = stmts.getCodexToolIngestState.get(transcriptPath);
  const offset = !state || stat.size < state.byte_offset ? 0 : state.byte_offset;
  const sessionId = state?.session_id || sessionIdFromPath(transcriptPath);
  const session = sessionId && stmts.getSession.get(sessionId);
  if (!session) return { changed: false, events: [] };
  const length = stat.size - offset;
  if (length <= 0) return { changed: false, events: [] };

  let body;
  try {
    body = readRangeUtf8(transcriptPath, offset, length);
  } catch {
    // Same as the stat failure above — a read error must stay retryable.
    return { changed: false, events: [], failed: true };
  }
  const lastNewline = body.lastIndexOf("\n");
  if (lastNewline < 0) return { changed: false, events: [] };
  const complete = body.slice(0, lastNewline + 1);
  const nextOffset = offset + Buffer.byteLength(complete);
  const records = [];
  for (const line of complete.split("\n")) {
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type === "response_item") records.push(record);
  }
  const agentId = `codex:${session.id}`;
  // A historical rollout can contain thousands of calls. Commit the whole
  // file atomically so a crash never advances the cursor past only part of its
  // analytics, and so cold backfill does not pay one SQLite transaction per
  // call.
  const events = db.transaction((responseItems) =>
    responseItems.map((record) => persistEvent(session.id, agentId, record)).filter(Boolean)
  )(records);
  stmts.upsertCodexToolIngestState.run(transcriptPath, session.id, nextOffset);
  // Do not touch `sessions.updated_at` for a historical analytics backfill:
  // that timestamp drives card freshness and must remain the session's actual
  // activity time. A live append reaches the main ingest path too, which
  // touches the session after this tool cursor finishes.
  return {
    changed: events.length > 0,
    created: false,
    session: events.length > 0 ? stmts.getSession.get(session.id) : session,
    agent: events.length > 0 ? stmts.getAgent.get(agentId) : null,
    events,
  };
}

/**
 * Ingest one append-only rollout file. Calling it repeatedly without appended
 * bytes produces no writes and no broadcasts, even when hooks and fs.watch
 * report the same change.
 */
function ingestCodexTranscript(transcriptPath, options = {}) {
  if (!isCodexTranscript(transcriptPath, options)) return { changed: false, events: [] };
  rememberTranscriptPath(transcriptPath);
  let stat;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    // Same reasoning as the read failure below — keep it retryable.
    return { changed: false, events: [], failed: true };
  }
  const state = stmts.getCodexIngestState.get(transcriptPath);
  const offset = !state || stat.size < state.byte_offset ? 0 : state.byte_offset;
  let body;
  try {
    const length = stat.size - offset;
    if (length <= 0) return { changed: false, events: [] };
    body = readRangeUtf8(transcriptPath, offset, length);
  } catch {
    // An I/O failure is NOT a completed no-op. The sweep records this file's
    // size+mtime fingerprint after any non-throwing return, so reporting a read
    // error as an ordinary no-op would make the next sweep skip the transcript
    // entirely — leaving its lifecycle and token events unprocessed until some
    // later write happens to move the fingerprint.
    return { changed: false, events: [], failed: true };
  }

  const lastNewline = body.lastIndexOf("\n");
  if (lastNewline < 0) return { changed: false, events: [] };
  const complete = body.slice(0, lastNewline + 1);
  const remainder = body.slice(lastNewline + 1);
  const nextOffset = offset + Buffer.byteLength(complete);
  const records = complete
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  if (!records.length) return { changed: false, events: [] };

  let meta = records.find((record) => record.type === "session_meta")?.payload;
  const resolvedSessionId = state?.session_id || meta?.id || sessionIdFromPath(transcriptPath);
  const knownSession = resolvedSessionId ? stmts.getSession.get(resolvedSessionId) : null;
  // Imported rollouts live in a dashboard-owned snapshot so uploads remain
  // readable after their temporary extraction directory is removed. When the
  // same session later appears under the active CODEX_HOME, carry its byte
  // cursors forward before switching to that live file. Re-reading the whole
  // rollout with a fresh cursor would otherwise add every token delta twice.
  if (
    knownSession?.provider === "codex" &&
    knownSession.transcript_path &&
    path.resolve(knownSession.transcript_path) !== path.resolve(transcriptPath) &&
    path
      .resolve(knownSession.transcript_path)
      .startsWith(`${path.resolve(getDataDir(), "codex-transcripts")}${path.sep}`) &&
    path.resolve(transcriptPath).startsWith(`${path.resolve(getCodexSessionsDir())}${path.sep}`) &&
    !stmts.getCodexIngestState.get(transcriptPath)
  ) {
    const previousState = stmts.getCodexIngestState.get(knownSession.transcript_path);
    const previousToolState = stmts.getCodexToolIngestState.get(knownSession.transcript_path);
    if (previousState) {
      stmts.upsertCodexIngestState.run(
        transcriptPath,
        knownSession.id,
        previousState.byte_offset,
        previousState.remainder,
        previousState.input_tokens,
        previousState.cached_input_tokens,
        previousState.cache_write_input_tokens,
        previousState.output_tokens,
        previousState.reasoning_output_tokens
      );
    }
    if (previousToolState) {
      stmts.upsertCodexToolIngestState.run(
        transcriptPath,
        knownSession.id,
        previousToolState.byte_offset
      );
    }
    stmts.replaceSessionTranscriptPath.run(transcriptPath, knownSession.id);
    return ingestCodexTranscript(transcriptPath, options);
  }
  const liveTranscripts = options.liveTranscripts instanceof Set ? options.liveTranscripts : null;
  const confirmedLive = liveTranscripts ? liveTranscripts.has(path.resolve(transcriptPath)) : null;
  const created = !knownSession;
  const createOptions = {
    confirmedLive,
    endedAt: new Date(stat.mtimeMs).toISOString(),
  };
  let session = knownSession || createCodexSession(meta, transcriptPath, createOptions);
  if (!session && meta?.id) session = createCodexSession(meta, transcriptPath, createOptions);
  if (!session) return { changed: false, events: [] };
  // Backfill sessions created by an older dashboard build that stored the path
  // only in metadata. The prepared statement is intentionally one-shot.
  stmts.setSessionTranscriptPath.run(transcriptPath, session.id);

  const agentId = `codex:${session.id}`;
  if (confirmedLive === false && session.status === "active") {
    const endedAt = new Date(stat.mtimeMs).toISOString();
    stmts.clearSessionAwaitingInput.run(session.id);
    stmts.clearAgentAwaitingInput.run(agentId);
    stmts.updateSession.run(null, "completed", endedAt, null, session.id);
    stmts.updateAgent.run(null, "completed", null, null, endedAt, null, agentId);
    session = stmts.getSession.get(session.id);
  }
  let model = session.model || "unknown";
  let speed = "standard";
  let counters = {
    input_tokens: asNumber(state?.input_tokens),
    cached_input_tokens: asNumber(state?.cached_input_tokens),
    cache_write_input_tokens: asNumber(state?.cache_write_input_tokens),
    output_tokens: asNumber(state?.output_tokens),
    reasoning_output_tokens: asNumber(state?.reasoning_output_tokens),
  };
  const events = [];
  let latestLifecycleRecord = null;

  for (const record of records) {
    if (record.type === "session_meta") {
      meta = record.payload;
      continue;
    }
    if (record.type === "turn_context") {
      model = record.payload?.model || model;
      speed = eventSpeed(record);
      if (model && model !== session.model) stmts.updateSessionModel.run(model, session.id, model);
      continue;
    }
    if (record.type === "event_msg" && record.payload?.type === "thread_settings_applied") {
      model = record.payload?.thread_settings?.model || model;
      speed = eventSpeed(record);
      if (model && model !== session.model) stmts.updateSessionModel.run(model, session.id, model);
      continue;
    }
    if (record.type === "event_msg" && record.payload?.type === "token_count") {
      counters = applyTokenSnapshot(session.id, model, speed, record.payload.info || {}, counters);
    }
    if (record.type === "event_msg" && record.payload?.type === "user_message") {
      const prompt = userMessagePreview(record.payload);
      if (prompt) {
        if (!session.name || session.name === "Codex session") {
          stmts.updateSessionName.run(prompt, session.id, prompt);
        }
        // Claude main agents already receive their task through hooks. Codex
        // rollouts expose the same information as user_message records, so
        // promote the newest real prompt into the shared card field. This is
        // deliberately independent of the native /rename title: a concise
        // user title stays in the heading while the latest request explains
        // the current work below it.
        stmts.updateAgent.run(null, null, prompt, null, null, null, agentId);
      }
    }
    if (record.type === "event_msg" && LIFECYCLE_EVENT_TYPES.has(record.payload?.type)) {
      latestLifecycleRecord = record;
    }
    // Tool invocations are owned by `ingestCodexToolEvents` below. The primary
    // cursor records lifecycle, message, and token events only, which keeps a
    // watcher/hook append from creating a duplicate tool row.
    const event = record.type === "event_msg" ? persistEvent(session.id, agentId, record) : null;
    if (event) events.push(event);
  }

  stmts.upsertCodexIngestState.run(
    transcriptPath,
    session.id,
    nextOffset,
    remainder,
    counters.input_tokens,
    counters.cached_input_tokens,
    counters.cache_write_input_tokens,
    counters.output_tokens,
    counters.reasoning_output_tokens
  );
  // Process only the final lifecycle record in this byte batch. A cold import
  // can contain hundreds of historic turns; replaying every intermediate
  // Working/Waiting mutation is wasteful and can briefly broadcast stale state.
  // Exact process identity wins over a historical rollout's final lifecycle
  // marker. Replaying an old task_started record must never reactivate and
  // broadcast a dead session merely because it shares a cwd with a live one.
  if (confirmedLive !== false) applyCodexTranscriptLifecycle(session.id, latestLifecycleRecord);
  // Tool invocations are stored through an independent cursor so initial
  // rollout imports and all subsequent real-time appends preserve their exact
  // order without double-counting lifecycle/token records.
  const toolResult = ingestCodexToolEvents(transcriptPath, options);
  events.push(...(toolResult.events || []));
  stmts.touchSession.run(session.id);
  // A native `/rename` lives outside the rollout, so it wins over the first
  // user prompt even when both files changed around the same time.
  session = syncCodexSessionTitle(stmts.getSession.get(session.id)).session;
  return {
    changed: true,
    created,
    session,
    agent: stmts.getAgent.get(agentId),
    events,
  };
}

function applyCodexHookLifecycle(result, hookType) {
  if (!result?.session || !hookType) return result;
  const normalized = String(hookType)
    .replace(/[_\s-]/g, "")
    .toLowerCase();
  const sessionId = result.session.id;
  const agentId = `codex:${sessionId}`;
  let changed = false;
  if (normalized === "sessionend") {
    changed = stmts.clearSessionAwaitingInput.run(sessionId).changes > 0 || changed;
    changed = stmts.clearAgentAwaitingInput.run(agentId).changes > 0 || changed;
    const endedAt = new Date().toISOString();
    changed = stmts.updateSession.run(null, "completed", endedAt, null, sessionId).changes > 0;
    changed =
      stmts.updateAgent.run(null, "completed", null, null, endedAt, null, agentId).changes > 0 ||
      changed;
  } else if (normalized === "sessionstart") {
    // A Codex SessionStart/Stop hook is emitted at an interactive prompt, not
    // a process exit. Match Claude's SessionStart/Stop semantics: retain the
    // active session while surfacing it as Waiting for another user turn.
    changed = setCodexWaiting(sessionId, "session_start");
  } else if (normalized === "stop") {
    changed = setCodexWaiting(sessionId, "stop");
  } else if (["userpromptsubmit", "pretooluse", "posttooluse"].includes(normalized)) {
    changed = setCodexWorking(sessionId);
  }
  return {
    ...result,
    changed: Boolean(result.changed || changed),
    session: stmts.getSession.get(sessionId),
    agent: stmts.getAgent.get(agentId),
  };
}

/**
 * Self-heal active Codex cards after a dashboard restart or an interrupted
 * write. Normal task completion is immediate above; this only covers a batch
 * that was already cursor-consumed and a working turn that went silent before
 * Codex could write its terminal record.
 */
function reconcileCodexSessionLiveness({ workingIdleMs = DEFAULT_WORKING_IDLE_MS } = {}) {
  const activeSessions = db
    .prepare(
      `SELECT id, transcript_path, updated_at, awaiting_input_since
       FROM sessions WHERE provider = 'codex' AND status = 'active'`
    )
    .all();
  const changed = [];
  for (const session of activeSessions) {
    const agent = stmts.getAgent.get(`codex:${session.id}`);
    if (!agent) continue;
    const latest = stmts.getLatestCodexLifecycleEvent.get(session.id);
    let didChange = false;
    if (latest?.event_type === "codex_task_complete") {
      didChange = setCodexWaiting(session.id, "stop");
    } else if (latest?.event_type === "codex_turn_aborted") {
      didChange = setCodexWaiting(session.id, "interrupted");
    } else if (!session.awaiting_input_since && agent.status === "working") {
      let lastActivityMs = Date.parse(session.updated_at) || 0;
      if (session.transcript_path) {
        try {
          lastActivityMs = Math.max(lastActivityMs, fs.statSync(session.transcript_path).mtimeMs);
        } catch {
          // The session remains eligible through its persisted timestamp.
        }
      }
      if (Date.now() - lastActivityMs >= workingIdleMs) {
        didChange = setCodexWaiting(session.id, "interrupted");
      }
    }
    if (didChange) {
      changed.push({
        changed: true,
        created: false,
        session: stmts.getSession.get(session.id),
        agent: stmts.getAgent.get(`codex:${session.id}`),
        events: [],
      });
    }
  }
  return changed;
}

/**
 * Apply a lifecycle notification even when the rollout did not gain a complete
 * JSONL line yet. This matters most for SessionEnd: a hook can arrive before
 * Codex flushes its final event, but the dashboard should still stop showing a
 * stale active session immediately.
 */
function ingestCodexHook(transcriptPath, hookType, hookData) {
  const result = transcriptPath
    ? ingestCodexTranscript(transcriptPath)
    : { changed: false, events: [] };
  if (result.session) return applyCodexHookLifecycle(result, hookType);
  const normalized = String(hookType || "")
    .replace(/[_\s-]/g, "")
    .toLowerCase();
  if (normalized === "sessionstart") {
    const meta = codexHookMeta(hookData);
    const existing = meta && stmts.getSession.get(meta.id);
    const session = meta && (existing || createCodexSession(meta, transcriptPath));
    if (session) {
      return applyCodexHookLifecycle(
        {
          changed: false,
          created: !existing,
          session,
          agent: stmts.getAgent.get(`codex:${session.id}`),
          events: [],
        },
        hookType
      );
    }
  }
  if (!isCodexTranscript(transcriptPath)) return result;
  const state = stmts.getCodexIngestState.get(transcriptPath);
  const sessionId = state?.session_id || sessionIdFromPath(transcriptPath);
  const session = sessionId && stmts.getSession.get(sessionId);
  if (!session) return result;
  return applyCodexHookLifecycle(
    { ...result, session, agent: stmts.getAgent.get(`codex:${session.id}`) },
    hookType
  );
}

module.exports = {
  CONTEXT_SHORT_LIMIT,
  findCodexTranscripts,
  findCodexTranscriptForSession,
  ingestCodexToolEvents,
  ingestCodexTranscript,
  ingestCodexHook,
  applyCodexHookLifecycle,
  applyCodexTranscriptLifecycle,
  reconcileCodexSessionLiveness,
  resumeCodexSessionAtPrompt,
  refreshCodexSessionTitles,
  syncCodexStateSessions,
  isCodexTranscript,
};
