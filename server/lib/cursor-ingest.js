/**
 * @file cursor-ingest.js
 * @description Discovers, enriches, snapshots, and backfills Cursor agent
 * sessions from ~/.cursor. Chat metadata is ingested before Cursor creates a
 * transcript, so new sessions and submitted prompts reach the dashboard live;
 * later transcript data adds durable conversation and subagent detail. Titles
 * come from chat metadata, then Cursor's state.vscdb, then the first prompt.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const {
  cursorSessionIdFromPath,
  getCursorProjectsDir,
  getCursorSnapshotDir,
  isSafeCursorId,
  indexCursorChatDirs,
  readCursorChatMetadata,
} = require("./cursor-home");
const { writeSnapshot } = require("./snapshot-store");
const { getSnapshotPolicy } = require("./snapshot-retention");
const { createCursorTitleLookup } = require("./cursor-state-db");

const RECENT_SESSION_MS = 10 * 60 * 1000;
// How often the orphan-agent heal below may rescan (it always runs on the
// first sync after boot). The ingest path itself no longer creates orphans;
// this only repairs rows written by older versions or by paths outside it.
const ORPHAN_HEAL_INTERVAL_MS = 5 * 60 * 1000;
const TERMINAL_SESSION_STATUSES = new Set(["completed", "abandoned"]);
// A Cursor turn that neither advances its transcript/chat files nor receives a
// hook for this long is over (Cursor wrote its final message, or was stopped or
// killed mid-turn), so the main agent moves from "working" to "waiting". Shares
// DASHBOARD_WORKING_IDLE_SECONDS with the Claude hook watchdog's equivalent.
const WORKING_IDLE_MS = (() => {
  const raw = parseInt(process.env.DASHBOARD_WORKING_IDLE_SECONDS, 10);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : 120_000;
})();
const syncFingerprints = new Map();
let lastOrphanHealMs = 0;

function statFingerprint(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return "-";
  }
}

function cursorSessionFingerprint(transcriptPath, chatDir) {
  const parts = [transcriptPath ? statFingerprint(transcriptPath) : "no-transcript"];
  if (chatDir) {
    parts.push(statFingerprint(path.join(chatDir, "meta.json")));
    parts.push(statFingerprint(path.join(chatDir, "prompt_history.json")));
  }
  if (!transcriptPath) return parts.join("|");
  const subagentsDir = path.join(path.dirname(transcriptPath), "subagents");
  let subagents = [];
  try {
    subagents = fs
      .readdirSync(subagentsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => `${entry.name}:${statFingerprint(path.join(subagentsDir, entry.name))}`)
      .sort();
  } catch {
    // No subagents is the common case.
  }
  parts.push(...subagents);
  return parts.join("|");
}

function trimPrompt(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function promptLabel(value) {
  const text = trimPrompt(value);
  if (!text) return null;
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function promptPreview(prompts) {
  const seen = new Set();
  return prompts
    .map(trimPrompt)
    .filter((text) => {
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-2)
    .join("\n");
}

/** Persist append-only Cursor prompt history once so last-activity and Timeline stay live. */
function importCursorPromptEvents(dbModule, sessionId, prompts, createdAt, updatedAt) {
  if (prompts.length === 0) return [];
  const { db, stmts } = dbModule;
  const existingIndexes = new Set(
    db
      .prepare(
        `SELECT json_extract(data, '$.prompt_index') AS prompt_index
         FROM events
         WHERE session_id = ? AND event_type = 'cursor_user_message'`
      )
      .all(sessionId)
      .map((row) => Number(row.prompt_index))
      .filter(Number.isInteger)
  );
  const inserted = [];
  prompts.forEach((prompt, index) => {
    if (existingIndexes.has(index)) return;
    const timestamp = index === prompts.length - 1 ? updatedAt : createdAt;
    const info = stmts.insertEventAt.run(
      sessionId,
      `${sessionId}-main`,
      "cursor_user_message",
      null,
      trimPrompt(prompt),
      JSON.stringify({ provider: "cursor", event: "user_message", prompt_index: index }),
      timestamp
    );
    inserted.push(db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid));
  });
  return inserted;
}

function isoFromMs(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return new Date(n).toISOString();
  return fallback;
}

/** Return the later valid ISO timestamp, preserving the fallback on bad input. */
function latestIso(first, second) {
  const firstMs = Date.parse(first);
  const secondMs = Date.parse(second);
  if (!Number.isFinite(firstMs)) return second;
  if (!Number.isFinite(secondMs)) return first;
  return firstMs >= secondMs ? first : second;
}

/** Return the newest useful mtime across Cursor's immediately-written chat files. */
function cursorChatMtimeMs(chatDir) {
  if (!chatDir) return 0;
  return Math.max(
    ...[chatDir, path.join(chatDir, "meta.json"), path.join(chatDir, "prompt_history.json")].map(
      (candidate) => {
        try {
          return fs.statSync(candidate).mtimeMs;
        } catch {
          return 0;
        }
      }
    )
  );
}

/**
 * True when a main agent marked "working" has had no Cursor file activity and
 * no hook write for WORKING_IDLE_MS. A tool in flight or an explicit waiting
 * flag (both set by Cursor's hooks) keeps the hook-driven state authoritative.
 * The poll's skip check and enrichment pass identical inputs (file mtimes and
 * session updated_at), so they never disagree and re-enrich on every poll.
 */
function isCursorWorkingIdle(main, activityMs, sessionUpdatedAt) {
  if (!main || main.current_tool || main.awaiting_input_since) return false;
  const lastActivityMs = Math.max(Number(activityMs) || 0, Date.parse(sessionUpdatedAt) || 0);
  return lastActivityMs > 0 && Date.now() - lastActivityMs >= WORKING_IDLE_MS;
}

/**
 * Complete live-status agents left on terminal Cursor sessions. Older builds
 * could flip the main agent back to `working` when a prompt was imported for a
 * session that had already ended, and the stale sweep only examines `active`
 * sessions — so those cards showed "Working" forever. Returns healed session ids.
 */
function healCursorOrphanAgents(dbModule) {
  const { db } = dbModule;
  const select = db.prepare(
    `SELECT a.id, a.session_id, s.ended_at AS session_ended_at, s.updated_at AS session_updated_at
     FROM agents a JOIN sessions s ON s.id = a.session_id
     WHERE s.provider = 'cursor' AND s.status IN ('completed', 'abandoned')
       AND a.status NOT IN ('completed', 'error')`
  );
  // Re-check the session state observed by the SELECT: a hook or another
  // dashboard on the same database may reactivate the session in between, and
  // its now-live agent must not be completed.
  const complete = db.prepare(
    `UPDATE agents SET status = 'completed', current_tool = NULL, awaiting_input_since = NULL,
       ended_at = COALESCE(ended_at, ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND session_id = ? AND status NOT IN ('completed', 'error')
       AND EXISTS (
         SELECT 1 FROM sessions s
         WHERE s.id = agents.session_id AND s.provider = 'cursor'
           AND s.status IN ('completed', 'abandoned')
       )`
  );
  const healed = new Set();
  db.transaction(() => {
    for (const row of select.all()) {
      const endedAt = row.session_ended_at || row.session_updated_at || new Date().toISOString();
      if (complete.run(endedAt, row.id, row.session_id).changes > 0) healed.add(row.session_id);
    }
  })();
  return [...healed];
}

/** Parse stored metadata without letting an old malformed row stop discovery. */
function parseMetadata(value) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Snapshot a Cursor transcript (and its subagent transcripts) into the
 * dashboard's data dir before Cursor's own cleanup removes them. Goes through
 * the shared snapshot store: atomic, copy-on-write where supported, and it
 * never shrinks an existing snapshot — a truncated original cannot overwrite
 * the fuller copy. Returns whether anything was written.
 */
function snapshotCursorTranscript(transcriptPath, sessionId) {
  if (!transcriptPath) return false;
  const root = getCursorSnapshotDir();
  const { max_age_days: maxAgeDays } = getSnapshotPolicy();
  const write = (source, relPath) =>
    writeSnapshot({ root, sessionId, source, relPath, maxAgeDays }).written;
  let changed = write(transcriptPath, `${sessionId}.jsonl`);
  const subagentsDir = path.join(path.dirname(transcriptPath), "subagents");
  let entries = [];
  try {
    entries = fs.readdirSync(subagentsDir, { withFileTypes: true });
  } catch {
    return changed;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    changed =
      write(path.join(subagentsDir, entry.name), path.join(sessionId, "subagents", entry.name)) ||
      changed;
  }
  return changed;
}

function cursorTextBlocks(entry) {
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => trimPrompt(block.text))
    .filter(Boolean);
}

function readCursorSubagent(filePath) {
  let body;
  try {
    body = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  let firstPrompt = null;
  let toolCount = 0;
  let terminalStatus = null;
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.role === "user" && !firstPrompt) firstPrompt = cursorTextBlocks(entry)[0] || null;
    const content = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    toolCount += content.filter((block) => block?.type === "tool_use").length;
    if (entry.type === "turn_ended") {
      terminalStatus = entry.status === "error" ? "error" : "completed";
    }
  }
  return { firstPrompt, toolCount, terminalStatus };
}

function importCursorSubagents(dbModule, sessionId, transcriptPath, sessionActive) {
  if (!transcriptPath) return 0;
  const { db, stmts } = dbModule;
  const mainAgentId = `${sessionId}-main`;
  const subagentsDir = path.join(path.dirname(transcriptPath), "subagents");
  let entries = [];
  try {
    entries = fs.readdirSync(subagentsDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let changed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const cursorAgentId = path.basename(entry.name, ".jsonl");
    const agentId = `${sessionId}-cursor-${cursorAgentId}`;
    const filePath = path.join(subagentsDir, entry.name);
    const fingerprint = statFingerprint(filePath);
    const existing = stmts.getAgent.get(agentId);
    const currentMeta = parseMetadata(existing?.metadata);
    let parsed = null;
    if (!existing || currentMeta.cursor_fingerprint !== fingerprint) {
      parsed = readCursorSubagent(filePath);
    }
    const task = parsed?.firstPrompt || existing?.task || null;
    const toolCount = parsed?.toolCount ?? currentMeta.tool_count ?? 0;
    const terminalStatus = parsed?.terminalStatus ?? currentMeta.cursor_terminal_status ?? null;
    const status = terminalStatus || (sessionActive ? "working" : "completed");
    const label = promptLabel(task) || `Cursor subagent ${cursorAgentId.slice(0, 8)}`;
    const metadata = JSON.stringify({
      ...currentMeta,
      cursor_agent_id: cursorAgentId,
      cursor_fingerprint: fingerprint,
      cursor_terminal_status: terminalStatus,
      tool_count: toolCount,
    });
    const endedAt =
      status === "working" || status === "waiting"
        ? null
        : isoFromMs(
            (() => {
              try {
                return fs.statSync(filePath).mtimeMs;
              } catch {
                return Date.now();
              }
            })(),
            new Date().toISOString()
          );

    if (!existing) {
      stmts.insertAgent.run(
        agentId,
        sessionId,
        label,
        "subagent",
        "cursor",
        status,
        task,
        mainAgentId,
        metadata
      );
      if (endedAt) {
        db.prepare("UPDATE agents SET ended_at = ?, updated_at = ? WHERE id = ?").run(
          endedAt,
          endedAt,
          agentId
        );
      }
      changed++;
      continue;
    }

    const update = db
      .prepare(
        `UPDATE agents SET
           name = ?, subagent_type = 'cursor', status = ?, task = ?,
           parent_agent_id = ?, metadata = ?, ended_at = ?, updated_at = ?
         WHERE id = ? AND (
           COALESCE(name, '') != COALESCE(?, '') OR
           COALESCE(subagent_type, '') != 'cursor' OR
           status != ? OR
           COALESCE(task, '') != COALESCE(?, '') OR
           COALESCE(parent_agent_id, '') != COALESCE(?, '') OR
           COALESCE(metadata, '') != COALESCE(?, '') OR
           COALESCE(ended_at, '') != COALESCE(?, '')
         )`
      )
      .run(
        label,
        status,
        task,
        mainAgentId,
        metadata,
        endedAt,
        endedAt || existing.updated_at,
        agentId,
        label,
        status,
        task,
        mainAgentId,
        metadata,
        endedAt
      );
    changed += update.changes;
  }
  return changed;
}

function discoverCursorTranscripts(root = getCursorProjectsDir()) {
  const results = [];
  let projects = [];
  try {
    projects = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const transcriptsRoot = path.join(root, project.name, "agent-transcripts");
    let sessions = [];
    try {
      sessions = fs.readdirSync(transcriptsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (!session.isDirectory() || !isSafeCursorId(session.name)) continue;
      const transcriptPath = path.join(transcriptsRoot, session.name, `${session.name}.jsonl`);
      if (fs.existsSync(transcriptPath)) results.push(transcriptPath);
    }
  }
  return results;
}

function enrichCursorSession(dbModule, transcriptPath, options = {}) {
  const { db, stmts } = dbModule;
  const sessionId =
    options.sessionId || (transcriptPath && cursorSessionIdFromPath(transcriptPath));
  if (!sessionId) return { changed: false, created: false, session: null };

  let stat = null;
  if (transcriptPath) {
    try {
      stat = fs.statSync(transcriptPath);
    } catch {
      transcriptPath = null;
    }
  }
  const { meta, prompts } = readCursorChatMetadata(sessionId, options.chatDir);
  const chatMtimeMs = cursorChatMtimeMs(options.chatDir);
  if (!stat && !meta && prompts.length === 0) {
    return { changed: false, created: false, session: stmts.getSession.get(sessionId) || null };
  }
  const existing = stmts.getSession.get(sessionId);
  const transcriptMtimeMs = stat?.mtimeMs || 0;
  const activityMs = Math.max(Number(meta?.updatedAtMs) || 0, chatMtimeMs, transcriptMtimeMs);
  const fallbackCreatedAt = stat?.birthtime?.toISOString() || new Date(activityMs).toISOString();
  const recent = Date.now() - activityMs < RECENT_SESSION_MS;
  const createdAt = isoFromMs(meta?.createdAtMs, fallbackCreatedAt);
  const updatedAt = latestIso(
    isoFromMs(meta?.updatedAtMs, new Date(activityMs).toISOString()),
    new Date(Math.max(chatMtimeMs, transcriptMtimeMs)).toISOString()
  );
  const firstPrompt = prompts[0] || null;
  const nativeTitle =
    trimPrompt(meta?.title) ||
    (typeof options.cursorTitle === "function" ? trimPrompt(options.cursorTitle(sessionId)) : "");
  const name = nativeTitle || promptLabel(firstPrompt) || `Cursor session ${sessionId.slice(0, 8)}`;
  const cwd = typeof meta?.cwd === "string" && meta.cwd.trim() ? meta.cwd.trim() : null;
  const model = typeof options.model === "string" && options.model ? options.model : null;
  let changed = false;
  let created = false;

  if (!existing) {
    const metadata = JSON.stringify({
      imported: true,
      cursor: true,
      cursor_ingest_recent: recent,
      turn_count: prompts.length,
      user_messages: prompts.length,
      has_conversation: meta?.hasConversation === true,
    });
    stmts.insertSession.run(sessionId, name, recent ? "active" : "completed", cwd, model, metadata);
    db.prepare(
      `UPDATE sessions
       SET provider = 'cursor', transcript_path = ?, started_at = ?, updated_at = ?, ended_at = ?
       WHERE id = ?`
    ).run(transcriptPath || null, createdAt, updatedAt, recent ? null : updatedAt, sessionId);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      `Cursor · ${name}`,
      "main",
      null,
      recent
        ? prompts.length > 0 && Date.now() - activityMs < WORKING_IDLE_MS
          ? "working"
          : "waiting"
        : "completed",
      firstPrompt,
      null,
      JSON.stringify({ cursor: true })
    );
    if (!recent) {
      db.prepare("UPDATE agents SET ended_at = ?, updated_at = ? WHERE id = ?").run(
        updatedAt,
        updatedAt,
        `${sessionId}-main`
      );
    }
    created = true;
    changed = true;
  } else {
    const currentMeta = parseMetadata(existing.metadata);
    const previousPromptCount = Number(currentMeta.user_messages) || 0;
    const promptAdded = prompts.length > previousPromptCount;
    const hasNewActivity = Date.parse(updatedAt) > Date.parse(existing.updated_at || "");
    const shouldComplete = !recent && existing.status === "active";
    const shouldReactivate =
      recent &&
      (currentMeta.cursor_ingest_recent === false || hasNewActivity || promptAdded) &&
      (existing.status === "completed" || existing.status === "abandoned");
    const desiredStatus = shouldComplete
      ? "completed"
      : shouldReactivate
        ? "active"
        : existing.status;
    const desiredEndedAt = shouldComplete ? updatedAt : shouldReactivate ? null : existing.ended_at;
    const nextMeta = {
      ...currentMeta,
      cursor: true,
      cursor_ingest_recent: recent,
      turn_count: prompts.length || currentMeta.turn_count || 0,
      user_messages: prompts.length || currentMeta.user_messages || 0,
      has_conversation: meta?.hasConversation === true || currentMeta.has_conversation === true,
    };
    const placeholder =
      !existing.name ||
      existing.name === `Session ${sessionId.slice(0, 8)}` ||
      existing.name === `Cursor session ${sessionId.slice(0, 8)}`;
    const desiredName = placeholder ? name : existing.name;
    const update = db
      .prepare(
        `UPDATE sessions SET
           name = ?,
           status = ?,
           ended_at = ?,
           cwd = COALESCE(?, cwd),
           model = COALESCE(?, model),
           provider = 'cursor',
           transcript_path = COALESCE(?, transcript_path),
           metadata = ?,
           started_at = CASE WHEN started_at > ? THEN ? ELSE started_at END,
           updated_at = CASE WHEN updated_at < ? THEN ? ELSE updated_at END
         WHERE id = ? AND (
           COALESCE(name, '') != COALESCE(?, '') OR
           status != ? OR
           COALESCE(ended_at, '') != COALESCE(?, '') OR
           (? IS NOT NULL AND COALESCE(cwd, '') != ?) OR
           (? IS NOT NULL AND COALESCE(model, '') != ?) OR
           provider != 'cursor' OR
           (? IS NOT NULL AND COALESCE(transcript_path, '') != ?) OR
           COALESCE(metadata, '') != ?
         )`
      )
      .run(
        desiredName,
        desiredStatus,
        desiredEndedAt,
        cwd,
        model,
        transcriptPath,
        JSON.stringify(nextMeta),
        createdAt,
        createdAt,
        updatedAt,
        updatedAt,
        sessionId,
        desiredName,
        desiredStatus,
        desiredEndedAt,
        cwd,
        cwd,
        model,
        model,
        transcriptPath,
        transcriptPath,
        JSON.stringify(nextMeta)
      );
    changed = update.changes > 0;

    let main = stmts.getAgent.get(`${sessionId}-main`);
    if (!main) {
      stmts.insertAgent.run(
        `${sessionId}-main`,
        sessionId,
        `Cursor · ${desiredName}`,
        "main",
        null,
        recent ? "waiting" : "completed",
        firstPrompt,
        null,
        JSON.stringify({ cursor: true })
      );
      if (!recent) {
        db.prepare("UPDATE agents SET ended_at = ?, updated_at = ? WHERE id = ?").run(
          updatedAt,
          updatedAt,
          `${sessionId}-main`
        );
      }
      changed = true;
      main = stmts.getAgent.get(`${sessionId}-main`);
    } else {
      const autoMain =
        /^Main Agent(?: - Session [0-9a-f]{8})?$/i.test(main.name || "") ||
        /^Cursor · (?:Cursor session )?[0-9a-f]{8}$/i.test(main.name || "");
      const desiredMainName = autoMain ? `Cursor · ${desiredName}` : main.name;
      const desiredTask = main.task || firstPrompt;
      const currentAgentMeta = parseMetadata(main.metadata);
      const nextAgentMeta = JSON.stringify({ ...currentAgentMeta, cursor: true });
      // A prompt imported for a session that stays ended (e.g. discovered at
      // boot, long after the turn) must not revive the agent: the session row
      // is terminal and no sweep re-examines it, so "working" would stick.
      const sessionTerminal = TERMINAL_SESSION_STATUSES.has(desiredStatus);
      const workingIdle =
        !sessionTerminal &&
        (promptAdded || main.status === "working") &&
        isCursorWorkingIdle(main, Math.max(chatMtimeMs, transcriptMtimeMs), existing.updated_at);
      const desiredMainStatus =
        main.status === "error"
          ? "error"
          : shouldComplete || sessionTerminal
            ? "completed"
            : workingIdle
              ? "waiting"
              : promptAdded
                ? "working"
                : shouldReactivate
                  ? "waiting"
                  : main.status;
      const desiredMainEndedAt = shouldComplete
        ? updatedAt
        : sessionTerminal
          ? main.ended_at || desiredEndedAt || updatedAt
          : shouldReactivate
            ? null
            : main.ended_at;
      const mainUpdate = db
        .prepare(
          `UPDATE agents SET name = ?, status = ?, task = ?, metadata = ?, ended_at = ?, updated_at = ?
           WHERE id = ? AND (
             COALESCE(name, '') != COALESCE(?, '') OR
             status != ? OR
             COALESCE(task, '') != COALESCE(?, '') OR
             COALESCE(metadata, '') != COALESCE(?, '') OR
             COALESCE(ended_at, '') != COALESCE(?, '')
           )`
        )
        .run(
          desiredMainName,
          desiredMainStatus,
          desiredTask,
          nextAgentMeta,
          desiredMainEndedAt,
          updatedAt,
          main.id,
          desiredMainName,
          desiredMainStatus,
          desiredTask,
          nextAgentMeta,
          desiredMainEndedAt
        );
      changed = mainUpdate.changes > 0 || changed;
    }
  }

  const promptEvents = importCursorPromptEvents(dbModule, sessionId, prompts, createdAt, updatedAt);
  changed = promptEvents.length > 0 || changed;
  const preview = promptPreview(prompts);
  if (preview) {
    const previewUpdate = stmts.updateSessionCardPromptPreview.run(preview, sessionId, preview);
    changed = previewUpdate.changes > 0 || changed;
  }
  const refreshedSession = stmts.getSession.get(sessionId);
  const subagents = importCursorSubagents(
    dbModule,
    sessionId,
    transcriptPath,
    refreshedSession?.status === "active" && recent
  );
  changed = subagents > 0 || changed;
  snapshotCursorTranscript(transcriptPath, sessionId);

  return {
    changed,
    created,
    session: stmts.getSession.get(sessionId),
    subagents,
    events: promptEvents,
  };
}

async function syncCursorSessions(dbModule, options = {}) {
  // One read-only state.vscdb handle per pass, opened only if a title is needed.
  const titles = createCursorTitleLookup();
  try {
    return await syncCursorSessionsWithTitles(dbModule, options, titles.title);
  } finally {
    titles.close();
  }
}

async function syncCursorSessionsWithTitles(dbModule, options, cursorTitle) {
  const transcripts = discoverCursorTranscripts(options.root);
  const chatDirs = indexCursorChatDirs();
  const transcriptsBySession = new Map();
  for (const transcriptPath of transcripts) {
    const sessionId = cursorSessionIdFromPath(transcriptPath);
    if (sessionId) transcriptsBySession.set(sessionId, transcriptPath);
  }
  const sessionIds = [...new Set([...chatDirs.keys(), ...transcriptsBySession.keys()])];
  const counters = {
    filesScanned: transcripts.length,
    chatsScanned: chatDirs.size,
    imported: 0,
    backfilled: 0,
    skipped: 0,
  };
  if (Date.now() - lastOrphanHealMs >= ORPHAN_HEAL_INTERVAL_MS) {
    lastOrphanHealMs = Date.now();
    for (const sessionId of healCursorOrphanAgents(dbModule)) {
      counters.backfilled++;
      const session = dbModule.stmts.getSession.get(sessionId);
      if (session && typeof options.onSession === "function") {
        options.onSession({ changed: true, created: false, session, subagents: 0, events: [] });
      }
    }
  }
  for (let index = 0; index < sessionIds.length; index++) {
    const sessionId = sessionIds[index];
    const transcriptPath = transcriptsBySession.get(sessionId) || null;
    const chatDir = chatDirs.get(sessionId) || null;
    const fingerprint = cursorSessionFingerprint(transcriptPath, chatDir);
    const existing = dbModule.stmts.getSession.get(sessionId);
    let recencyExpired = false;
    let workingIdleExpired = false;
    if (existing?.status === "active") {
      const activityMs = Math.max(
        cursorChatMtimeMs(chatDir),
        transcriptPath ? Number(statFingerprint(transcriptPath).split(":")[1]) || 0 : 0
      );
      recencyExpired = activityMs > 0 && Date.now() - activityMs >= RECENT_SESSION_MS;
      // Unchanged files are exactly how an ended turn looks, so the idle
      // transition must re-run enrichment without a fingerprint change.
      const main = dbModule.stmts.getAgent.get(`${sessionId}-main`);
      workingIdleExpired =
        main?.status === "working" && isCursorWorkingIdle(main, activityMs, existing.updated_at);
    }
    if (
      syncFingerprints.get(sessionId) === fingerprint &&
      existing?.provider === "cursor" &&
      (!transcriptPath || existing.transcript_path === transcriptPath) &&
      !recencyExpired &&
      !workingIdleExpired
    ) {
      counters.skipped++;
      continue;
    }
    const result = enrichCursorSession(dbModule, transcriptPath, {
      sessionId,
      chatDir,
      cursorTitle,
    });
    if (result.session) {
      syncFingerprints.set(sessionId, cursorSessionFingerprint(transcriptPath, chatDir));
    }
    if (result.created) counters.imported++;
    else if (result.changed) counters.backfilled++;
    else counters.skipped++;
    if (result.changed && typeof options.onSession === "function") options.onSession(result);
    if (index > 0 && index % 25 === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  return counters;
}

module.exports = {
  discoverCursorTranscripts,
  enrichCursorSession,
  healCursorOrphanAgents,
  importCursorSubagents,
  snapshotCursorTranscript,
  syncCursorSessions,
};
