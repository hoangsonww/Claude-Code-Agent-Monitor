/**
 * @file agy-ingest.js
 * @description Imports Google Antigravity CLI (agy) conversations as dashboard
 * sessions with provider "antigravity". Reads agy's conversation index
 * (conversation_summaries.db: title, workspace, status, last activity) and each
 * conversation's transcript JSONL (USER_INPUT / PLANNER_RESPONSE / GENERIC steps
 * with tool_calls and per-step input/output/cache-read tokens). Ingestion is
 * idempotent and incremental: a size+mtime fingerprint skips unchanged
 * transcripts, and only prompts/tool calls past the last imported counts become
 * new events. Token totals are written as one usage bucket per session.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");
const {
  getAgyHome,
  getAgySummariesDb,
  getAgyBrainDir,
  getAgyTranscriptPath,
} = require("./agy-home");
const { cleanAgyUserText } = require("./agy-transcript");

const PROVIDER = "antigravity";
const RECENT_SESSION_MS = 10 * 60 * 1000;
const PROMPT_LABEL_MAX = 80;
const MODEL_FALLBACK = "gemini";

/** agy writes "2026-11-12 08:42:23.33269" (UTC, no zone) or ISO strings. */
function agyTimeToIso(value) {
  if (value === null || value === undefined || value === "") return null;
  let text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d/.test(text)) text = text.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(text)) text += "Z";
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** First file:// URI of agy's JSON array of workspace URIs → local path. */
function workspaceToCwd(uris) {
  if (!uris) return null;
  let list = uris;
  if (typeof uris === "string") {
    try {
      list = JSON.parse(uris);
    } catch {
      list = [uris];
    }
  }
  if (!Array.isArray(list)) return null;
  for (const uri of list) {
    if (typeof uri !== "string" || !uri.startsWith("file:")) continue;
    try {
      return fileURLToPath(uri);
    } catch {
      continue;
    }
  }
  return null;
}

function promptLabel(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > PROMPT_LABEL_MAX ? `${clean.slice(0, PROMPT_LABEL_MAX - 1)}…` : clean;
}

/** Conversation index rows keyed by id. Missing/locked DB → empty map (fail-safe). */
function readAgySummaries(home = getAgyHome()) {
  const file = getAgySummariesDb(home);
  const rows = new Map();
  if (!fs.existsSync(file)) return rows;
  let db = null;
  try {
    const Database = require("../compat-sqlite");
    db = new Database(file, { readonly: true });
    for (const row of db
      .prepare(
        "SELECT conversation_id, title, workspace_uris, status, last_modified_time, agent_name FROM conversation_summaries"
      )
      .all()) {
      if (row && row.conversation_id) rows.set(String(row.conversation_id), row);
    }
  } catch {
    // agy may hold a write lock or change its schema; the transcript alone
    // is still enough to build the session.
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
  return rows;
}

/**
 * Parse one transcript into prompts, tool calls and token totals. A read
 * failure throws so the caller does not record a fingerprint for data it never
 * saw — the next poll retries the file.
 */
function readAgyTranscript(file) {
  const out = {
    prompts: [],
    tools: [],
    input: 0,
    output: 0,
    cacheRead: 0,
    steps: 0,
    firstAt: null,
    lastAt: null,
  };
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // agy can be mid-write on the last line
    }
    out.steps++;
    const at = agyTimeToIso(row.created_at);
    if (at) {
      if (!out.firstAt || at < out.firstAt) out.firstAt = at;
      if (!out.lastAt || at > out.lastAt) out.lastAt = at;
    }
    if (row.type === "USER_INPUT") {
      const text = cleanAgyUserText(row.content);
      if (text) out.prompts.push({ text, at });
    }
    if (row.type === "PLANNER_RESPONSE") {
      out.input += Number(row.input_tokens) || 0;
      out.output += Number(row.output_tokens) || 0;
      out.cacheRead += Number(row.cache_read_tokens) || 0;
    }
    if (Array.isArray(row.tool_calls)) {
      for (const call of row.tool_calls) {
        const name = call && typeof call.name === "string" ? call.name : null;
        if (name) out.tools.push({ name, at });
      }
    }
  }
  return out;
}

function fingerprint(file) {
  try {
    const st = fs.statSync(file);
    return {
      key: `${st.size}:${Math.round(st.mtimeMs)}`,
      mtimeMs: st.mtimeMs,
      birth: st.birthtime,
    };
  } catch {
    return null;
  }
}

function parseMetadata(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

/** Every conversation id that has a transcript on disk. */
function discoverAgyConversations(home = getAgyHome()) {
  const brain = getAgyBrainDir(home);
  let entries = [];
  try {
    entries = fs.readdirSync(brain, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && fs.existsSync(getAgyTranscriptPath(e.name, home)))
    .map((e) => e.name);
}

/**
 * Create or refresh one agy conversation as a dashboard session.
 * @returns {{changed: boolean, created: boolean, session: object|null, events: object[]}}
 */
function ingestAgyConversation(dbModule, conversationId, summary = null, options = {}) {
  const { db, stmts } = dbModule;
  const home = options.home || getAgyHome();
  const transcriptPath = getAgyTranscriptPath(conversationId, home);
  const fp = fingerprint(transcriptPath);
  if (!fp)
    return {
      changed: false,
      created: false,
      session: stmts.getSession.get(conversationId) || null,
      events: [],
    };

  const existing = stmts.getSession.get(conversationId);
  const meta = existing ? parseMetadata(existing.metadata) : {};
  if (existing && existing.provider !== PROVIDER) {
    // Never take over a session id owned by another provider.
    return { changed: false, created: false, session: existing, events: [] };
  }
  const title = typeof summary?.title === "string" ? summary.title.trim() : "";
  if (existing && meta.agy_fingerprint === fp.key) {
    // The transcript is unchanged, but the session can still need a refresh:
    // an active conversation that went quiet must age out to completed, and
    // the index (title) may have changed or become readable since last poll.
    const lastActivityMs = Date.parse(existing.updated_at) || fp.mtimeMs;
    const aged = existing.status === "active" && Date.now() - lastActivityMs >= RECENT_SESSION_MS;
    const ownedName = meta.agy_ingested_name && existing.name === meta.agy_ingested_name;
    const retitled = Boolean(ownedName && title && title !== existing.name);
    const gainedCwd = !existing.cwd && Boolean(workspaceToCwd(summary?.workspace_uris));
    if (!aged && !retitled && !gainedCwd) {
      return { changed: false, created: false, session: existing, events: [] };
    }
  }

  const t = readAgyTranscript(transcriptPath);
  // Activity comes from agy's own clocks (last transcript step, index last
  // modified); file mtime is only a fallback because copies/backups touch it.
  const summaryAt = agyTimeToIso(summary?.last_modified_time);
  const agyActivityMs = Math.max(
    summaryAt ? Date.parse(summaryAt) : 0,
    t.lastAt ? Date.parse(t.lastAt) : 0
  );
  const activityMs = agyActivityMs || fp.mtimeMs;
  const recent = Date.now() - activityMs < RECENT_SESSION_MS;
  const startedAt =
    t.firstAt || (fp.birth ? fp.birth.toISOString() : new Date(activityMs).toISOString());
  const updatedAt = new Date(activityMs).toISOString();
  const name =
    title || promptLabel(t.prompts[0]?.text) || `Antigravity session ${conversationId.slice(0, 8)}`;
  const cwd = workspaceToCwd(summary?.workspace_uris);
  const model = typeof options.model === "string" && options.model ? options.model : MODEL_FALLBACK;
  const mainId = `${conversationId}-main`;
  const events = [];
  const pushEvent = (info, eventType, toolName, summaryText, createdAt) =>
    events.push({
      id: Number(info.lastInsertRowid),
      session_id: conversationId,
      agent_id: mainId,
      event_type: eventType,
      tool_name: toolName,
      summary: summaryText,
      created_at: createdAt,
    });
  let ownedName = true;

  const run = db.transaction(() => {
    if (!existing) {
      stmts.insertSession.run(
        conversationId,
        name,
        recent ? "active" : "completed",
        cwd,
        model,
        JSON.stringify({ imported: true, antigravity: true, agy_ingested_name: name })
      );
      db.prepare(
        `UPDATE sessions
         SET provider = ?, transcript_path = ?, started_at = ?, updated_at = ?, ended_at = ?
         WHERE id = ?`
      ).run(
        PROVIDER,
        transcriptPath,
        startedAt,
        updatedAt,
        recent ? null : updatedAt,
        conversationId
      );
      stmts.insertAgent.run(
        mainId,
        conversationId,
        `Antigravity · ${name}`,
        "main",
        null,
        recent ? "working" : "completed",
        promptLabel(t.prompts[0]?.text) || null,
        null,
        null
      );
    } else {
      ownedName = Boolean(meta.agy_ingested_name && existing.name === meta.agy_ingested_name);
      db.prepare(
        `UPDATE sessions
         SET name = ?, status = ?, updated_at = ?, ended_at = ?, cwd = COALESCE(cwd, ?)
         WHERE id = ?`
      ).run(
        ownedName ? name : existing.name,
        recent ? "active" : "completed",
        updatedAt,
        recent ? null : updatedAt,
        cwd,
        conversationId
      );
      stmts.updateAgent.run(
        ownedName ? `Antigravity · ${name}` : null,
        recent ? "working" : "completed",
        null,
        null,
        recent ? null : updatedAt,
        null,
        mainId
      );
    }

    const fromPrompt = Number(meta.agy_prompts) || 0;
    for (const p of t.prompts.slice(fromPrompt)) {
      const label = promptLabel(p.text);
      const at = p.at || updatedAt;
      const info = stmts.insertEventAt.run(
        conversationId,
        mainId,
        "UserPromptSubmit",
        null,
        label,
        JSON.stringify({ prompt: p.text, source: PROVIDER }),
        at
      );
      pushEvent(info, "UserPromptSubmit", null, label, at);
    }
    const fromTool = Number(meta.agy_tools) || 0;
    for (const call of t.tools.slice(fromTool)) {
      const at = call.at || updatedAt;
      const info = stmts.insertEventAt.run(
        conversationId,
        mainId,
        "PostToolUse",
        call.name,
        call.name,
        JSON.stringify({ tool_name: call.name, source: PROVIDER }),
        at
      );
      pushEvent(info, "PostToolUse", call.name, call.name, at);
    }

    if (t.input || t.output || t.cacheRead) {
      stmts.resetTokenUsage.run(
        conversationId,
        model,
        "standard",
        "global",
        "standard",
        t.input,
        t.output,
        t.cacheRead,
        0,
        0,
        0,
        0,
        0
      );
    }

    const nextMeta = {
      ...parseMetadata(stmts.getSession.get(conversationId)?.metadata),
      agy_fingerprint: fp.key,
      // Advance the importer-owned name marker only when the importer set the
      // name; a manual rename stays unowned and is never overwritten.
      ...(ownedName ? { agy_ingested_name: name } : {}),
      agy_prompts: t.prompts.length,
      agy_tools: t.tools.length,
      agy_steps: t.steps,
      turn_count: t.prompts.length,
      user_messages: t.prompts.length,
    };
    db.prepare("UPDATE sessions SET metadata = ? WHERE id = ?").run(
      JSON.stringify(nextMeta),
      conversationId
    );
  });
  run();

  return {
    changed: true,
    created: !existing,
    session: stmts.getSession.get(conversationId),
    events,
  };
}

/** Sync every agy conversation found on disk. Fail-safe per conversation. */
async function syncAgySessions(dbModule, options = {}) {
  const home = options.home || getAgyHome();
  const summaries = readAgySummaries(home);
  const results = [];
  for (const id of discoverAgyConversations(home)) {
    try {
      const result = ingestAgyConversation(dbModule, id, summaries.get(id) || null, {
        ...options,
        home,
      });
      if (result.changed) {
        results.push(result);
        if (typeof options.onSession === "function") options.onSession(result);
      }
    } catch (err) {
      if (options.onError) options.onError(id, err);
    }
  }
  return results;
}

module.exports = {
  PROVIDER,
  agyTimeToIso,
  workspaceToCwd,
  readAgySummaries,
  readAgyTranscript,
  discoverAgyConversations,
  ingestAgyConversation,
  syncAgySessions,
};
