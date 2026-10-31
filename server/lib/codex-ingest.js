/**
 * @file Incrementally ingests Codex rollout JSONL transcripts into dashboard
 * sessions, events, response-item tool calls, costs, native `/rename` titles,
 * latest human-prompt card context, startup placeholders from hooks or Codex's
 * live-thread state, resume-picker reactivation, and dashboard card lifecycle.
 * Independent byte cursors make watcher/hook notifications idempotent and
 * real-time safe.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { isLocalHistoryOwner } = require("./session-origin");
const fs = require("fs");
const path = require("path");
const { constants: bufferConstants } = require("buffer");
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
const CARD_CONTEXT_VERSION = 1;
// Tags every event reconstructed from a lifecycle hook rather than read from a
// rollout. A rollout that appears later is authoritative, so these rows are
// removed the moment one is linked to the session (see `dropHookOnlyHistory`).
const HOOK_EVENT_SOURCE = "hook";
// How long a rollout-less Codex session that has ALREADY reported a finished
// turn may stay silent before the synchronizer concludes its SessionEnd hook
// was lost. Hooks are fire-and-forget, so a dashboard that was down at exit
// never hears the terminal one, and such a session has neither a transcript
// mtime nor an open rollout for the liveness probes (both unavailable on
// Windows regardless).
//
// This gate is deliberately NOT a "how long can a run be quiet" timer — see
// `reconcileCodexSessionLiveness` for why silence alone proves nothing. It only
// bounds the wait for a SessionEnd that measurement shows arrives within a few
// hundred milliseconds of Stop (82 ms / 70 ms / 265 ms across captured
// codex-cli 0.147.0 runs). The 60 s default matches the existing
// DASHBOARD_LIVENESS_IDLE_SECONDS gate rather than inventing a second scale.
const DEFAULT_HOOK_ONLY_IDLE_MS = (() => {
  const seconds = Number.parseFloat(process.env.DASHBOARD_CODEX_HOOK_IDLE_SECONDS || "");
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : 60_000;
})();

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
 * Default bytes decoded per read. Long Codex sessions write rollouts larger
 * than V8's maximum string length (~512 MiB), and decoding such a file in one
 * `toString` throws ERR_STRING_TOO_LONG on every attempt, so the rollout could
 * never be ingested. Reading in bounded windows also caps peak memory for
 * ordinary large rollouts.
 */
const DEFAULT_READ_WINDOW_BYTES = 64 * 1024 * 1024;

/**
 * Hard ceiling for one window. A single JSONL record longer than the default
 * window grows the window up to this size; UTF-8 never decodes to more
 * characters than bytes, so staying at or under the string limit in bytes
 * guarantees the decode succeeds.
 */
const MAX_READ_WINDOW_BYTES = bufferConstants.MAX_STRING_LENGTH;

let readWindowBytes = DEFAULT_READ_WINDOW_BYTES;

/**
 * Test hook: shrink the read window so chunk boundaries can be exercised with
 * small fixtures. Returns the previous value. Not for production use.
 */
function setReadWindowBytesForTests(bytes) {
  const previous = readWindowBytes;
  readWindowBytes = Number.isInteger(bytes) && bytes > 0 ? bytes : DEFAULT_READ_WINDOW_BYTES;
  return previous;
}

/**
 * Read `[offset, offset + length)` from a file as raw bytes, closing the
 * descriptor on EVERY exit path.
 *
 * `Buffer.alloc` and `fs.readSync` can both throw after the open, and callers
 * retry a failed rollout on every subsequent sweep — so an fd leaked here does
 * not leak once, it leaks once per sweep and will eventually exhaust the
 * process descriptor limit on a file with a persistent read error.
 */
function readRangeBuffer(filePath, offset, length) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const read = fs.readSync(fd, buffer, 0, length, offset);
    return read < length ? buffer.subarray(0, read) : buffer;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed or otherwise invalid — there is nothing left to release.
    }
  }
}

/**
 * Read the complete JSONL lines that start at `offset`, stopping at `end` or
 * after one bounded window, whichever comes first.
 *
 * The cut is made on the raw bytes at the last newline, never inside a
 * record: 0x0A cannot occur inside a multi-byte UTF-8 sequence, so every
 * returned line decodes intact and `bytes` is an exact cursor advance. If a
 * window holds no newline but the range continues, the window grows (one
 * oversized record) up to the string limit; a record beyond even that throws,
 * which callers already report as a retryable failure.
 *
 * @returns {{ text: string, bytes: number, capped: boolean, tail: string }}
 *   `text` is whole lines (ending in "\n"); `bytes` is its byte length;
 *   `capped` is true when unread bytes remain before `end`; `tail` is the
 *   unterminated end of the range, only when the range was read to `end`.
 */
function readCompleteLines(filePath, offset, end) {
  let window = Math.min(readWindowBytes, MAX_READ_WINDOW_BYTES);
  for (;;) {
    const length = Math.max(0, Math.min(end - offset, window));
    const buffer = length > 0 ? readRangeBuffer(filePath, offset, length) : Buffer.alloc(0);
    const capped = offset + buffer.length < end;
    const lastNewline = buffer.lastIndexOf(0x0a);
    if (lastNewline >= 0) {
      return {
        text: buffer.toString("utf8", 0, lastNewline + 1),
        bytes: lastNewline + 1,
        capped,
        tail: capped ? "" : buffer.toString("utf8", lastNewline + 1),
      };
    }
    if (!capped) return { text: "", bytes: 0, capped: false, tail: buffer.toString("utf8") };
    if (window >= MAX_READ_WINDOW_BYTES) {
      throw new Error(
        `Codex rollout record at byte ${offset} exceeds ${MAX_READ_WINDOW_BYTES} bytes`
      );
    }
    window = Math.min(window * 2, MAX_READ_WINDOW_BYTES);
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

/**
 * Codex 0.153+ writes human prompts as response-item messages instead of the
 * older event_msg/user_message pair. The content-kind marker is essential:
 * Codex also serializes AGENTS.md and environment context with role=user, but
 * those records are injected instructions rather than dashboard turns.
 */
function responseItemUserMessage(record) {
  const item = record?.type === "response_item" ? record.payload : null;
  if (item?.type !== "message" || item.role !== "user") return null;
  const metadata = item.internal_chat_message_metadata_passthrough;
  if (
    !Array.isArray(metadata?.content_item_kinds) ||
    !metadata.content_item_kinds.includes("user.text")
  ) {
    return null;
  }
  const prompt = truncate(extractText(item.content));
  if (!prompt) return null;
  return {
    prompt,
    turnId: typeof metadata.turn_id === "string" ? metadata.turn_id : null,
  };
}

function codexUserMessage(record) {
  if (record?.type === "event_msg" && record.payload?.type === "user_message") {
    const prompt = userMessagePreview(record.payload);
    return prompt
      ? {
          prompt,
          turnId: typeof record.payload.turn_id === "string" ? record.payload.turn_id : null,
        }
      : null;
  }
  return responseItemUserMessage(record);
}

function codexUserMessageKey(record, userMessage) {
  if (!userMessage?.prompt || !Date.parse(record?.timestamp || "")) return null;
  return `${new Date(record.timestamp).toISOString()}\u0000${userMessage.prompt}`;
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
  const userMessage = codexUserMessage(record);
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
  } else if (userMessage) {
    eventType = "codex_user_message";
    tool = null;
    summary = userMessage.prompt;
    data = {
      provider: "codex",
      event: "user_message",
      turn_id: userMessage.turnId,
      timestamp: record.timestamp,
    };
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

/** Keep the Codex main card's prompt preview and turn total durable. */
function syncCodexCardContext(sessionId, agentId) {
  const prompts = db
    .prepare(
      `SELECT summary
       FROM events
       WHERE session_id = ? AND event_type = 'codex_user_message'
         AND summary IS NOT NULL AND trim(summary) != ''
       ORDER BY created_at DESC, id DESC
       LIMIT 2`
    )
    .all(sessionId);
  let changed = false;
  if (prompts.length) {
    const latestPrompt = prompts[0].summary;
    const preview = prompts
      .map((row) => row.summary)
      .reverse()
      .join("\n");
    changed = stmts.updateSessionCardPromptPreview.run(preview, sessionId, preview).changes > 0;
    const agent = stmts.getAgent.get(agentId);
    if (agent && agent.task !== latestPrompt) {
      stmts.updateAgent.run(null, null, latestPrompt, agent.current_tool, null, null, agentId);
      changed = true;
    }
  }

  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'codex_task_started' THEN 1 ELSE 0 END) AS started,
         COUNT(DISTINCT CASE WHEN event_type = 'codex_user_message'
           THEN COALESCE(json_extract(data, '$.turn_id'), 'event:' || id) END) AS prompts
       FROM events WHERE session_id = ?`
    )
    .get(sessionId);
  const turnCount = Math.max(asNumber(totals?.started), asNumber(totals?.prompts));
  if (turnCount > 0)
    changed = setSessionMetadataFlag(sessionId, "turn_count", turnCount) || changed;
  return changed;
}

/**
 * One-time repair for rollouts whose old byte cursor already passed modern
 * response-item prompts before this dashboard version learned their shape.
 */
function backfillCodexCardContext(transcriptPath, session, consumedBytes) {
  if (!session || consumedBytes <= 0) return false;
  let metadata = {};
  try {
    metadata = JSON.parse(session.metadata || "{}") || {};
  } catch {
    /* malformed metadata is repaired by setSessionMetadataFlag below */
  }
  if (metadata.card_context_version === CARD_CONTEXT_VERSION) return false;

  const agentId = `codex:${session.id}`;
  const existing = new Set(
    db
      .prepare(
        `SELECT created_at, summary FROM events
         WHERE session_id = ? AND event_type = 'codex_user_message'`
      )
      .all(session.id)
      .map((row) => `${row.created_at}\u0000${row.summary}`)
  );
  let changed = false;
  db.transaction(() => {
    // Walk the consumed range in bounded windows; the cursor always sits on a
    // line boundary, so every record here is complete.
    let position = 0;
    while (position < consumedBytes) {
      const { text, bytes, capped } = readCompleteLines(transcriptPath, position, consumedBytes);
      if (bytes === 0) break;
      position += bytes;
      for (const line of text.split("\n")) {
        if (!line) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        const message = responseItemUserMessage(record);
        if (!message) continue;
        const timestamp = Date.parse(record.timestamp || "")
          ? new Date(record.timestamp).toISOString()
          : "";
        const key = `${timestamp}\u0000${message.prompt}`;
        if (existing.has(key)) continue;
        const event = persistEvent(session.id, agentId, record);
        if (event) {
          existing.add(`${event.created_at}\u0000${event.summary}`);
          changed = true;
        }
      }
      if (!capped) break;
    }
  })();
  changed = syncCodexCardContext(session.id, agentId) || changed;
  changed =
    setSessionMetadataFlag(session.id, "card_context_version", CARD_CONTEXT_VERSION) || changed;
  return changed;
}

/** Keep dashboard cards aligned with the title chosen in Codex's `/rename` UI. */
function syncCodexSessionTitle(session) {
  if (!session?.id) return { changed: false, session };
  if (!isLocalHistoryOwner(stmts.getSession.get(session.id), "codex"))
    return { changed: false, session };
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
  const originSource = options.originSource || null;
  const metadata = JSON.stringify({
    provider: "codex",
    ...(originSource ? { origin_host: originSource.key } : {}),
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
    originSource ? originSource.id : "local",
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
 * The one place that knows every spelling Codex has used for the thread id in a
 * lifecycle hook payload. Every hook carries this id even when it carries no
 * rollout path, so it — not the transcript — is what identifies a session.
 */
function codexHookSessionId(data) {
  if (!data || typeof data !== "object") return null;
  return (
    [
      data.session_id,
      data.sessionId,
      data.thread_id,
      data.threadId,
      data.session?.id,
      data.thread?.id,
      data.context?.session_id,
      data.context?.thread_id,
    ].find((candidate) => typeof candidate === "string" && candidate.trim()) || null
  );
}

/**
 * Normalize the stable identity Codex supplies to lifecycle hooks. A rollout
 * is sometimes created or flushed after SessionStart — and with
 * `codex exec --ephemeral` never appears at all — so this lets the hook create
 * and maintain a session card without depending on a readable transcript.
 */
function codexHookMeta(data) {
  const id = codexHookSessionId(data);
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

/**
 * A live process holding a thread's rollout or writer lock proves the thread is
 * OPEN, never that it is idle. Only a thread the durable record already shows
 * as finished may be adopted back as Waiting; anything the rollout is still
 * driving owns its own lifecycle.
 */
function isFinishedCodexSession(session, agent) {
  if (session.status !== "active" || session.ended_at) return true;
  if (!agent) return true;
  return agent.status === "completed" || agent.status === "error" || Boolean(agent.ended_at);
}

function resumeCodexSessionAtPrompt(sessionId) {
  const session = stmts.getSession.get(sessionId);
  if (!session || !isLocalHistoryOwner(session, "codex")) {
    return null;
  }
  const agentId = `codex:${sessionId}`;
  const agent = stmts.getAgent.get(agentId);
  // Without this guard the probe demoted every working Codex turn to Waiting
  // and reset `awaiting_input_since` on each tick, so a busy session rendered
  // as idle and an already-waiting one lost the real reason it is waiting
  // ("stop" / "interrupted" overwritten by "session_start").
  if (!isFinishedCodexSession(session, agent)) {
    return { changed: false, session, agent: agent || null };
  }
  const changed = setCodexWaiting(sessionId, "session_start");
  return {
    changed,
    session: stmts.getSession.get(sessionId),
    agent: stmts.getAgent.get(agentId),
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

/** Guard remote-import identity before either cursor can write session data. */
function assertCodexImportIdentity(id, options) {
  if (!id) return;
  if (!options.originSource && !isLocalHistoryOwner(stmts.getSession.get(id), "codex")) {
    throw new Error("Codex import session belongs to another source or provider");
  }
  if (options.expectedSessionId && id !== options.expectedSessionId) {
    throw new Error("Codex import session identity mismatch");
  }
  if (options.isExcludedSession?.(id)) {
    throw new Error("Codex import session belongs to another source or provider");
  }
}

/**
 * Incrementally persist response-item tools through their independent cursor,
 * without replaying the primary token counters or lifecycle state.
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
  assertCodexImportIdentity(sessionId, options);
  const session = sessionId && stmts.getSession.get(sessionId);
  if (!session) return { changed: false, events: [] };
  const length = stat.size - offset;
  if (length <= 0) return { changed: false, events: [] };

  const agentId = `codex:${session.id}`;
  const events = [];
  let cursor = offset;
  let failed = false;
  // Bounded windows (see readCompleteLines): a rollout past the string limit
  // must still index. Each window's events AND its cursor advance commit in one
  // transaction, so a crash can never advance the cursor past uncommitted
  // analytics or replay committed ones, and cold backfill still pays one
  // SQLite transaction per window rather than per call.
  for (;;) {
    let window;
    try {
      window = readCompleteLines(transcriptPath, cursor, stat.size);
    } catch {
      // Same as the stat failure above — a read error must stay retryable.
      // Windows already committed keep their progress.
      failed = true;
      break;
    }
    if (window.bytes === 0) break;
    const records = [];
    for (const line of window.text.split("\n")) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.type === "response_item" && responseToolDetails(record)) records.push(record);
    }
    const nextOffset = cursor + window.bytes;
    events.push(
      ...db.transaction((responseItems) => {
        const persisted = responseItems
          .map((record) => persistEvent(session.id, agentId, record))
          .filter(Boolean);
        stmts.upsertCodexToolIngestState.run(transcriptPath, session.id, nextOffset);
        return persisted;
      })(records)
    );
    cursor = nextOffset;
    if (!window.capped) break;
  }
  if (failed && events.length === 0) return { changed: false, events: [], failed: true };
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
    ...(failed ? { failed: true } : {}),
  };
}

/**
 * Ingest one append-only rollout file. Apart from the versioned card-context
 * repair, calling it repeatedly without appended bytes produces no writes or
 * broadcasts, even when hooks and fs.watch report the same change.
 *
 * The file is consumed in bounded windows (see readCompleteLines) until its
 * last complete line, so every caller still gets the whole unread range in
 * one call — including rollouts too large to decode as a single string.
 */
function ingestCodexTranscript(transcriptPath, options = {}) {
  // The secondary tool cursor must be checked before primary ingestion can
  // change tokens, and when tool ingestion is called directly.
  assertCodexImportIdentity(stmts.getCodexToolIngestState.get(transcriptPath)?.session_id, options);
  const result = ingestCodexTranscriptWindow(transcriptPath, options, null);
  let window = result;
  while (window.more && !window.failed) {
    window = ingestCodexTranscriptWindow(transcriptPath, options, window.carry);
    mergeIngestWindow(result, window);
  }
  if (!result.failed && !result.skipped)
    mergeIngestWindow(result, ingestCodexToolEvents(transcriptPath, options));
  delete result.more;
  delete result.carry;
  return result;
}

/** Fold one later window's outcome into the accumulated result, in place. */
function mergeIngestWindow(result, window) {
  result.changed = Boolean(result.changed || window.changed);
  if (window.created) result.created = true;
  if (window.session) result.session = window.session;
  if (window.agent) result.agent = window.agent;
  if (window.events?.length) {
    result.events = result.events || [];
    for (const event of window.events) result.events.push(event);
  }
  if (window.failed) result.failed = true;
  result.more = window.more;
  result.carry = window.carry || result.carry;
}

/**
 * Ingest at most one bounded window of a rollout, starting at its cursor.
 * `carry` hands the previous window's running state forward: token snapshots
 * are priced by the latest turn context's `model`/`speed`, which may sit in an
 * earlier window (restarting at "standard" would misprice them), and naming
 * must behave as it would over the whole range.
 */
function ingestCodexTranscriptWindow(transcriptPath, options, carry) {
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
  // Guard cursor-owned rows before card repair or any cursor update too.
  assertCodexImportIdentity(state?.session_id, options);
  const storedOffset = !state || stat.size < state.byte_offset ? 0 : state.byte_offset;
  const offset = Number.isInteger(carry?.readOffset) ? carry.readOffset : storedOffset;
  const repairSession = state?.session_id ? stmts.getSession.get(state.session_id) : null;
  let repairedCardContext = false;
  try {
    repairedCardContext =
      repairSession?.status === "active"
        ? backfillCodexCardContext(transcriptPath, repairSession, Math.min(offset, stat.size))
        : false;
  } catch {
    return { changed: false, events: [], failed: true };
  }
  const cardRepairResult = () =>
    repairedCardContext
      ? {
          changed: true,
          created: false,
          session: stmts.getSession.get(repairSession.id),
          agent: stmts.getAgent.get(`codex:${repairSession.id}`),
          events: [],
        }
      : { changed: false, events: [] };
  let window;
  try {
    if (stat.size - offset <= 0) return cardRepairResult();
    window = readCompleteLines(transcriptPath, offset, stat.size);
  } catch {
    // An I/O failure is NOT a completed no-op. The sweep records this file's
    // size+mtime fingerprint after any non-throwing return, so reporting a read
    // error as an ordinary no-op would make the next sweep skip the transcript
    // entirely — leaving its lifecycle and token events unprocessed until some
    // later write happens to move the fingerprint.
    return { changed: false, events: [], failed: true };
  }

  if (window.bytes === 0) return cardRepairResult();
  const complete = window.text;
  // Only a window that reached end-of-file has a real unterminated tail; a
  // capped window stops at a line boundary, so its remainder is empty.
  const remainder = window.tail;
  const nextOffset = offset + window.bytes;
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
  if (!records.length) {
    if (state?.session_id) {
      stmts.upsertCodexIngestState.run(
        transcriptPath,
        state.session_id,
        nextOffset,
        remainder,
        asNumber(state.input_tokens),
        asNumber(state.cached_input_tokens),
        asNumber(state.cache_write_input_tokens),
        asNumber(state.output_tokens),
        asNumber(state.reasoning_output_tokens)
      );
    }
    return {
      ...cardRepairResult(),
      more: window.capped,
      carry: state?.session_id ? carry : { ...carry, readOffset: nextOffset },
    };
  }

  let meta = records.find((record) => record.type === "session_meta")?.payload;
  const resolvedSessionId = state?.session_id || meta?.id || sessionIdFromPath(transcriptPath);
  assertCodexImportIdentity(meta?.id, options);
  assertCodexImportIdentity(resolvedSessionId, options);
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
    // A shorter copy cannot inherit the snapshot cursor: replaying it would lower
    // cumulative baselines and charge already-imported usage again.
    if (previousState && stat.size < previousState.byte_offset)
      return { changed: false, events: [], skipped: true };
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
    originSource: options.originSource,
  };
  let session = knownSession || createCodexSession(meta, transcriptPath, createOptions);
  if (!session && meta?.id) session = createCodexSession(meta, transcriptPath, createOptions);
  if (!session) return { changed: false, events: [] };
  // Backfill sessions created by an older dashboard build that stored the path
  // only in metadata. The prepared statement is intentionally one-shot.
  const linkedTranscript = stmts.setSessionTranscriptPath.run(transcriptPath, session.id);
  // The rollout is authoritative the moment it exists. Anything hooks had to
  // reconstruct while it was missing is about to be replayed from byte 0 below,
  // so withdraw the reconstruction rather than double every turn.
  if (linkedTranscript.changes > 0) {
    dropHookOnlyHistory(session.id);
    session = stmts.getSession.get(session.id);
  }

  const agentId = `codex:${session.id}`;
  if (confirmedLive === false && session.status === "active") {
    const endedAt = new Date(stat.mtimeMs).toISOString();
    stmts.clearSessionAwaitingInput.run(session.id);
    stmts.clearAgentAwaitingInput.run(agentId);
    stmts.updateSession.run(null, "completed", endedAt, null, session.id);
    stmts.updateAgent.run(null, "completed", null, null, endedAt, null, agentId);
    session = stmts.getSession.get(session.id);
  }
  let model = carry?.model || session.model || "unknown";
  let speed = carry?.speed || "standard";
  let counters = {
    input_tokens: asNumber(state?.input_tokens),
    cached_input_tokens: asNumber(state?.cached_input_tokens),
    cache_write_input_tokens: asNumber(state?.cache_write_input_tokens),
    output_tokens: asNumber(state?.output_tokens),
    reasoning_output_tokens: asNumber(state?.reasoning_output_tokens),
  };
  const events = [];
  let latestLifecycleRecord = null;
  const seenPromptKeys = new Set(
    db
      .prepare(
        `SELECT created_at, summary FROM events
         WHERE session_id = ? AND event_type = 'codex_user_message'`
      )
      .all(session.id)
      .map((row) => `${row.created_at}\u0000${row.summary}`)
  );

  // Whether prompts may still set the session name. Evaluated once per call
  // against the session as loaded (the loop never refreshes it), and carried
  // across windows so a windowed read names the session exactly as a single
  // pass would.
  const nameOpen = carry?.nameOpen ?? (!session.name || session.name === "Codex session");
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
    const userMessage = codexUserMessage(record);
    const promptKey = codexUserMessageKey(record, userMessage);
    if (userMessage) {
      const prompt = userMessage.prompt;
      if (prompt) {
        if (nameOpen) {
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
    // Tool invocations are owned by `ingestCodexToolEvents`. The primary
    // cursor records lifecycle, message, and token events only, which keeps a
    // watcher/hook append from creating a duplicate tool row.
    const duplicatePrompt = promptKey && seenPromptKeys.has(promptKey);
    const event =
      (record.type === "event_msg" && !(userMessage && duplicatePrompt)) ||
      (userMessage && !duplicatePrompt)
        ? persistEvent(session.id, agentId, record)
        : null;
    if (event) {
      events.push(event);
      if (promptKey) seenPromptKeys.add(promptKey);
    }
  }

  syncCodexCardContext(session.id, agentId);
  setSessionMetadataFlag(session.id, "card_context_version", CARD_CONTEXT_VERSION);

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
    more: window.capped,
    carry: { model, speed, nameOpen },
  };
}

/**
 * Merge one flag into a session's opaque metadata JSON. Reads/writes go through
 * the whole document so a key written by another build is never dropped, and an
 * unchanged value performs no write (the card broadcast path stays quiet).
 */
function setSessionMetadataFlag(sessionId, key, value) {
  const session = stmts.getSession.get(sessionId);
  if (!session) return false;
  let metadata = {};
  try {
    const parsed = JSON.parse(session.metadata || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;
  } catch {
    // Unparseable metadata is replaced rather than propagated — the flag below
    // is the only consumer-visible key this function is responsible for.
  }
  const current = metadata[key];
  if (value === undefined || value === null) {
    if (!(key in metadata)) return false;
    delete metadata[key];
  } else {
    if (current === value) return false;
    metadata[key] = value;
  }
  return stmts.updateSession.run(null, null, null, JSON.stringify(metadata), sessionId).changes > 0;
}

/**
 * Reconstruct the events a rollout would have contained, from the lifecycle
 * hook payload itself. Codex sends the prompt, the tool call and its response,
 * and the final assistant message to hooks, so a session that never persists a
 * rollout can still show a real Conversation/Timeline instead of an empty one.
 *
 * Every row is tagged `data.source = "hook"` so {@link dropHookOnlyHistory} can
 * withdraw the whole reconstruction if the authoritative rollout shows up.
 */
function persistCodexHookEvents(sessionId, hookType, data) {
  const agentId = `codex:${sessionId}`;
  // events.agent_id is a FOREIGN KEY. Attributing a row to a main agent that is
  // missing (a partially deleted session, a row from an older build) would throw
  // inside the fail-safe hook path and silently drop the notification — the very
  // failure this whole path exists to remove. The column is nullable, so fall
  // back to an unattributed event rather than losing the turn.
  const attributedAgentId = stmts.getAgent.get(agentId) ? agentId : null;
  const turnId = typeof data?.turn_id === "string" ? data.turn_id : null;
  const insert = (eventType, tool, summary, extra) => {
    const info = stmts.insertEvent.run(
      sessionId,
      attributedAgentId,
      eventType,
      tool,
      summary,
      JSON.stringify({
        provider: "codex",
        source: HOOK_EVENT_SOURCE,
        turn_id: turnId,
        ...extra,
      })
    );
    return db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid);
  };

  if (hookType === "userpromptsubmit") {
    const prompt = truncate(extractText(data?.prompt));
    if (!prompt) return [];
    // Same card bookkeeping the rollout's `user_message` record performs, so a
    // hook-only session is titled and described like any other Codex session.
    const name = stmts.getSession.get(sessionId)?.name;
    if (!name || !name.trim() || name === "Codex session") {
      stmts.updateSessionName.run(prompt, sessionId, prompt);
    }
    stmts.updateAgent.run(null, null, prompt, null, null, null, agentId);
    return [insert("codex_user_message", null, prompt, { event: "user_message" })];
  }

  if (hookType === "pretooluse") {
    const rawName = String(data?.tool_name || "").trim();
    if (!rawName) return [];
    return [
      insert("codex_tool_call", codexToolCategory(rawName), truncate(`Called ${rawName}`), {
        event: "tool_call",
        raw_tool_name: rawName,
        call_id: data?.tool_use_id || null,
      }),
    ];
  }

  if (hookType === "posttooluse") {
    const rawName = String(data?.tool_name || "").trim();
    if (!rawName) return [];
    // Only the three categories Codex itself reports a terminal record for get
    // a completion event; anything else is already fully described by the
    // `codex_tool_call` above, exactly as in a rollout.
    const category = codexToolCategory(rawName);
    const endTypes = {
      Bash: "codex_exec_command_end",
      MCP: "codex_mcp_tool_call_end",
      WebSearch: "codex_web_search_end",
    };
    const eventType = endTypes[category];
    if (!eventType) return [];
    const summary = truncate(
      data?.tool_input?.command ||
        data?.tool_input?.query ||
        extractText(data?.tool_response) ||
        `${rawName} completed`
    );
    return [
      insert(eventType, null, summary, {
        event: eventType.replace(/^codex_/, ""),
        raw_tool_name: rawName,
        call_id: data?.tool_use_id || null,
      }),
    ];
  }

  if (hookType === "stop") {
    const message = truncate(extractText(data?.last_assistant_message));
    return [
      insert("codex_task_complete", null, message || "Task complete", { event: "task_complete" }),
    ];
  }

  if (hookType === "sessionend") {
    const session = stmts.getSession.get(sessionId);
    const label = session?.name || `Session ${String(sessionId).slice(0, 8)}`;
    return [
      insert("SessionEnd", null, `Session closed: ${label}`, {
        event: "session_end",
        session_id: sessionId,
        reason: data?.reason || null,
      }),
    ];
  }

  return [];
}

/**
 * Withdraw a hook-built reconstruction once the real rollout is linked. The
 * transcript cursor starts at byte 0 and replays the same turns, so leaving the
 * synthesized rows in place would double every prompt and tool call.
 */
function dropHookOnlyHistory(sessionId) {
  const removed = db
    .prepare(
      `DELETE FROM events
       WHERE session_id = ? AND json_extract(data, '$.source') = ?`
    )
    .run(sessionId, HOOK_EVENT_SOURCE);
  const cleared = setSessionMetadataFlag(sessionId, "hook_only", null);
  return removed.changes > 0 || cleared;
}

/**
 * Retire a Codex session: drop any waiting overlay and mark both the session
 * and its main agent completed. Shared by the SessionEnd hook and the
 * synchronizer's fallback for a SessionEnd that never arrived.
 */
function completeCodexSession(sessionId) {
  const agentId = `codex:${sessionId}`;
  const endedAt = new Date().toISOString();
  let changed = stmts.clearSessionAwaitingInput.run(sessionId).changes > 0;
  changed = stmts.clearAgentAwaitingInput.run(agentId).changes > 0 || changed;
  changed =
    stmts.updateSession.run(null, "completed", endedAt, null, sessionId).changes > 0 || changed;
  changed =
    stmts.updateAgent.run(null, "completed", null, null, endedAt, null, agentId).changes > 0 ||
    changed;
  return changed;
}

function applyCodexHookLifecycle(result, hookType, hookData = null) {
  if (!result?.session || !hookType) return result;
  const normalized = String(hookType)
    .replace(/[_\s-]/g, "")
    .toLowerCase();
  const sessionId = result.session.id;
  const agentId = `codex:${sessionId}`;
  let changed = false;
  if (normalized === "sessionend") {
    changed = completeCodexSession(sessionId) || changed;
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

  // No rollout to read from — `codex exec --ephemeral` never writes one, and an
  // interactive session has not always flushed one yet. Rebuild this turn's
  // history from the hook payload so the session is more than a status, and
  // mark it so the UI can explain the missing transcript honestly. SessionStart
  // is excluded: on its own it is indistinguishable from an interactive session
  // whose rollout simply has not appeared yet.
  const events = [...(result.events || [])];
  if (!result.session.transcript_path && normalized !== "sessionstart") {
    const synthesized = persistCodexHookEvents(sessionId, normalized, hookData);
    if (synthesized.length) {
      events.push(...synthesized);
      changed = true;
      changed = syncCodexCardContext(sessionId, agentId) || changed;
    }
    changed = setSessionMetadataFlag(sessionId, "hook_only", true) || changed;
    // The reconciler measures a hook-only session's idle window from
    // `updated_at`, so that column has to mean "when did a hook last arrive".
    // Every write above is conditional — a repeated Stop changes no state and a
    // settled flag writes nothing — which would otherwise freeze the clock at
    // the first hook of its kind and retire a session that is still reporting.
    stmts.touchSession.run(sessionId);
  }

  return {
    ...result,
    changed: Boolean(result.changed || changed),
    session: stmts.getSession.get(sessionId),
    agent: stmts.getAgent.get(agentId),
    events,
  };
}

/**
 * Self-heal active Codex cards after a dashboard restart or an interrupted
 * write. Normal task completion is immediate above; this only covers a batch
 * that was already cursor-consumed and a working turn that went silent before
 * Codex could write its terminal record.
 */
function reconcileCodexSessionLiveness({
  workingIdleMs = DEFAULT_WORKING_IDLE_MS,
  hookOnlyIdleMs = DEFAULT_HOOK_ONLY_IDLE_MS,
} = {}) {
  const activeSessions = db
    .prepare(
      `SELECT id, transcript_path, updated_at, awaiting_input_since, awaiting_reason,
              json_extract(metadata, '$.hook_only') AS hook_only
       FROM sessions WHERE provider = 'codex' AND status = 'active'`
    )
    .all();
  const changed = [];
  for (const session of activeSessions) {
    const agent = stmts.getAgent.get(`codex:${session.id}`);
    if (!agent) continue;
    const latest = stmts.getLatestCodexLifecycleEvent.get(session.id);
    let didChange = false;
    // Retire a hook-only session ONLY on Codex's own evidence that its turn
    // finished: `awaiting_reason = 'stop'` means a real Stop hook arrived, and
    // SessionEnd follows Stop within a few hundred ms, so a Stop still
    // unanswered after the idle window means that SessionEnd was lost.
    //
    // Silence is deliberately NOT sufficient. A rollout-less run emits no hooks
    // at all for the entire duration of a tool call — a captured 12 s sleep
    // produced a 12,119 ms PreToolUse→PostToolUse gap, and a CI build or test
    // suite is unbounded — so reaping a quiet session would complete a live run
    // mid-build. Nor is `interrupted` accepted: that reason is the 90 s
    // idle-working heuristic's own guess, not something Codex reported, and
    // promoting a guess to a terminal state is how a long tool call would die.
    // Those sessions stay put until a real hook resolves them.
    if (session.hook_only && !session.transcript_path && session.awaiting_reason === "stop") {
      const idleSince = Date.parse(session.updated_at) || 0;
      if (Date.now() - idleSince >= hookOnlyIdleMs) {
        didChange = completeCodexSession(session.id);
        if (didChange) {
          changed.push({
            changed: true,
            created: false,
            session: stmts.getSession.get(session.id),
            agent: stmts.getAgent.get(`codex:${session.id}`),
            events: [],
          });
        }
        continue;
      }
    }
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
  if (result.session) return applyCodexHookLifecycle(result, hookType, hookData);
  const normalized = String(hookType || "")
    .replace(/[_\s-]/g, "")
    .toLowerCase();

  // The hook's own thread id is the fallback identity for EVERY notification,
  // not just SessionStart. `codex exec --ephemeral` runs entirely without a
  // rollout, so requiring one here discarded its whole lifecycle — including
  // the terminal SessionEnd — and left the card stuck at Waiting forever.
  const meta = codexHookMeta(hookData);
  if (meta) {
    // The id comes from the hook payload, so confirm it names a session this
    // module actually owns. Without that, a colliding or forged id could drive
    // Codex lifecycle transitions — including completion — against a Claude or
    // remote-mirrored session, and attribute events to a `codex:<id>` agent
    // that was never created. Mirrors the guard in resumeCodexSessionAtPrompt.
    const candidate = stmts.getSession.get(meta.id);
    const existing = candidate && isLocalHistoryOwner(candidate, "codex") ? candidate : null;
    if (candidate && !existing) return result;
    // Only SessionStart may CREATE a session; a later notification for an
    // unknown id would otherwise resurrect a session the user already deleted.
    const session =
      existing || (normalized === "sessionstart" ? createCodexSession(meta, transcriptPath) : null);
    if (session) {
      return applyCodexHookLifecycle(
        {
          changed: false,
          created: !existing,
          session,
          agent: stmts.getAgent.get(`codex:${session.id}`),
          events: [],
        },
        hookType,
        hookData
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
    hookType,
    hookData
  );
}

module.exports = {
  CONTEXT_SHORT_LIMIT,
  findCodexTranscripts,
  findCodexTranscriptForSession,
  ingestCodexToolEvents,
  ingestCodexTranscript,
  ingestCodexHook,
  codexHookSessionId,
  applyCodexHookLifecycle,
  applyCodexTranscriptLifecycle,
  reconcileCodexSessionLiveness,
  resumeCodexSessionAtPrompt,
  refreshCodexSessionTitles,
  syncCodexStateSessions,
  isCodexTranscript,
  setReadWindowBytesForTests,
};
