/**
 * @file Correlates Cursor hook session shells with their canonical resumed
 * conversation by generation_id. It merges provisional rows transactionally,
 * preserves events/agents/usage, and keeps durable aliases for old URLs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");
const { isCursorTranscriptPath } = require("./cursor-home");

function resolveCursorSessionId(db, sessionId) {
  if (!sessionId) return sessionId;
  let current = sessionId;
  const visited = new Set();
  while (!visited.has(current)) {
    visited.add(current);
    const row = db
      .prepare("SELECT canonical_session_id FROM cursor_session_aliases WHERE alias_session_id = ?")
      .get(current);
    if (!row?.canonical_session_id) break;
    current = row.canonical_session_id;
  }
  return current;
}

function mainAgent(db, sessionId) {
  return db
    .prepare(
      "SELECT id FROM agents WHERE session_id = ? AND type = 'main' ORDER BY started_at LIMIT 1"
    )
    .get(sessionId);
}

function mergeLegacyTokenUsage(db, aliasId, canonicalId) {
  db.prepare(
    `INSERT INTO token_usage (
       session_id, model, speed, inference_geo, service_tier, context_size,
       input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
       cache_write_1h_tokens, web_search_requests, web_fetch_requests,
       code_execution_requests, baseline_input, baseline_output,
       baseline_cache_read, baseline_cache_write, baseline_cache_write_1h,
       baseline_web_search, baseline_web_fetch, baseline_code_execution
     )
     SELECT ?, model, speed, inference_geo, service_tier, context_size,
       input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
       cache_write_1h_tokens, web_search_requests, web_fetch_requests,
       code_execution_requests, baseline_input, baseline_output,
       baseline_cache_read, baseline_cache_write, baseline_cache_write_1h,
       baseline_web_search, baseline_web_fetch, baseline_code_execution
     FROM token_usage WHERE session_id = ?
     ON CONFLICT(session_id, model, speed, inference_geo, service_tier, context_size)
     DO UPDATE SET
       input_tokens = MAX(input_tokens, excluded.input_tokens),
       output_tokens = MAX(output_tokens, excluded.output_tokens),
       cache_read_tokens = MAX(cache_read_tokens, excluded.cache_read_tokens),
       cache_write_tokens = MAX(cache_write_tokens, excluded.cache_write_tokens),
       cache_write_1h_tokens = MAX(cache_write_1h_tokens, excluded.cache_write_1h_tokens),
       web_search_requests = MAX(web_search_requests, excluded.web_search_requests),
       web_fetch_requests = MAX(web_fetch_requests, excluded.web_fetch_requests),
       code_execution_requests = MAX(code_execution_requests, excluded.code_execution_requests),
       baseline_input = MAX(baseline_input, excluded.baseline_input),
       baseline_output = MAX(baseline_output, excluded.baseline_output),
       baseline_cache_read = MAX(baseline_cache_read, excluded.baseline_cache_read),
       baseline_cache_write = MAX(baseline_cache_write, excluded.baseline_cache_write),
       baseline_cache_write_1h = MAX(baseline_cache_write_1h, excluded.baseline_cache_write_1h),
       baseline_web_search = MAX(baseline_web_search, excluded.baseline_web_search),
       baseline_web_fetch = MAX(baseline_web_fetch, excluded.baseline_web_fetch),
       baseline_code_execution = MAX(baseline_code_execution, excluded.baseline_code_execution)`
  ).run(canonicalId, aliasId);
}

function mergeCursorSessionsNow(db, aliasSessionId, canonicalSessionId, generationId = null) {
  const aliasId = db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(aliasSessionId)
    ? aliasSessionId
    : resolveCursorSessionId(db, aliasSessionId);
  const canonicalId = resolveCursorSessionId(db, canonicalSessionId);
  if (!aliasId || !canonicalId || aliasId === canonicalId) return canonicalId;
  const alias = db.prepare("SELECT * FROM sessions WHERE id = ?").get(aliasId);
  const canonical = db.prepare("SELECT * FROM sessions WHERE id = ?").get(canonicalId);
  if (!alias || !canonical) return canonicalId;

  const aliasMain = mainAgent(db, aliasId);
  const canonicalMain = mainAgent(db, canonicalId);
  if (aliasMain && canonicalMain) {
    db.prepare("UPDATE events SET agent_id = ? WHERE session_id = ? AND agent_id = ?").run(
      canonicalMain.id,
      aliasId,
      aliasMain.id
    );
    db.prepare(
      "UPDATE agents SET parent_agent_id = ? WHERE session_id = ? AND parent_agent_id = ?"
    ).run(canonicalMain.id, aliasId, aliasMain.id);
    db.prepare("DELETE FROM agents WHERE id = ?").run(aliasMain.id);
  }
  db.prepare(
    `UPDATE events
     SET data = json_set(data, '$.cursor_source_session_id', ?)
     WHERE session_id = ? AND event_type = 'cursor_user_message' AND json_valid(data) = 1
       AND json_extract(data, '$.cursor_source_session_id') IS NULL`
  ).run(aliasId, aliasId);
  db.prepare("UPDATE agents SET session_id = ? WHERE session_id = ?").run(canonicalId, aliasId);
  db.prepare("UPDATE events SET session_id = ? WHERE session_id = ?").run(canonicalId, aliasId);
  mergeLegacyTokenUsage(db, aliasId, canonicalId);
  db.prepare("DELETE FROM token_usage WHERE session_id = ?").run(aliasId);
  db.prepare("UPDATE cursor_turn_usage SET session_id = ? WHERE session_id = ?").run(
    canonicalId,
    aliasId
  );
  db.prepare("UPDATE cursor_hook_receipts SET session_id = ? WHERE session_id = ?").run(
    canonicalId,
    aliasId
  );
  db.prepare("UPDATE cursor_generations SET session_id = ? WHERE session_id = ?").run(
    canonicalId,
    aliasId
  );
  db.prepare("UPDATE workflows SET session_id = ? WHERE session_id = ?").run(canonicalId, aliasId);
  db.prepare("UPDATE dashboard_runs SET session_id = ? WHERE session_id = ?").run(
    canonicalId,
    aliasId
  );
  db.prepare("UPDATE alert_events SET session_id = ? WHERE session_id = ?").run(
    canonicalId,
    aliasId
  );

  db.prepare(
    `UPDATE sessions SET
       started_at = MIN(started_at, ?),
       updated_at = MAX(updated_at, ?),
       card_prompt_preview = COALESCE(NULLIF(card_prompt_preview, ''), ?),
       metadata = COALESCE(metadata, ?)
     WHERE id = ?`
  ).run(alias.started_at, alias.updated_at, alias.card_prompt_preview, alias.metadata, canonicalId);
  db.prepare(
    `UPDATE cursor_session_aliases SET canonical_session_id = ?
     WHERE canonical_session_id = ?`
  ).run(canonicalId, aliasId);
  db.prepare(
    `INSERT INTO cursor_session_aliases
       (alias_session_id, canonical_session_id, generation_id)
     VALUES (?, ?, ?)
     ON CONFLICT(alias_session_id) DO UPDATE SET
       canonical_session_id = excluded.canonical_session_id,
       generation_id = COALESCE(excluded.generation_id, generation_id)`
  ).run(aliasId, canonicalId, generationId);
  db.prepare("DELETE FROM sessions WHERE id = ?").run(aliasId);
  return canonicalId;
}

/** Merge a provisional Cursor session into the canonical conversation row atomically. */
function mergeCursorSessions(db, aliasSessionId, canonicalSessionId, generationId = null) {
  const merge = () => mergeCursorSessionsNow(db, aliasSessionId, canonicalSessionId, generationId);
  return db.inTransaction ? merge() : db.transaction(merge)();
}

function sessionHasTranscript(db, sessionId, data) {
  if (isCursorTranscriptPath(data?.transcript_path)) return true;
  const row = db.prepare("SELECT transcript_path FROM sessions WHERE id = ?").get(sessionId);
  return isCursorTranscriptPath(row?.transcript_path);
}

/** Register a generation and return the canonical session id for this hook. */
function registerCursorGeneration(db, sessionId, data) {
  const generationId =
    typeof data?.generation_id === "string" && data.generation_id.trim()
      ? data.generation_id.trim()
      : null;
  let incomingId = resolveCursorSessionId(db, sessionId);
  if (!generationId) return incomingId;
  const hasTranscript = sessionHasTranscript(db, incomingId, data) ? 1 : 0;
  const existing = db
    .prepare("SELECT session_id, has_transcript FROM cursor_generations WHERE generation_id = ?")
    .get(generationId);
  if (!existing) {
    db.prepare(
      `INSERT INTO cursor_generations (generation_id, session_id, has_transcript)
       VALUES (?, ?, ?)`
    ).run(generationId, incomingId, hasTranscript);
    return incomingId;
  }
  const previousId = resolveCursorSessionId(db, existing.session_id);
  if (previousId === incomingId) {
    db.prepare(
      `UPDATE cursor_generations SET has_transcript = MAX(has_transcript, ?),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE generation_id = ?`
    ).run(hasTranscript, generationId);
    return incomingId;
  }

  const incomingWins = hasTranscript > Number(existing.has_transcript || 0);
  const canonicalId = incomingWins ? incomingId : previousId;
  const aliasId = incomingWins ? previousId : incomingId;
  incomingId = mergeCursorSessions(db, aliasId, canonicalId, generationId);
  db.prepare(
    `UPDATE cursor_generations SET session_id = ?, has_transcript = MAX(has_transcript, ?),
     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE generation_id = ?`
  ).run(incomingId, hasTranscript, generationId);
  return incomingId;
}

function cursorHookReceiptKey(hookType, data) {
  if (!data?.generation_id || !["Stop", "afterAgentResponse"].includes(hookType)) return null;
  const identity = {
    type: hookType,
    generation: data.generation_id,
    status: data.status || data.stop_reason || "",
    input: data.input_tokens ?? null,
    output: data.output_tokens ?? null,
    cacheRead: data.cache_read_tokens ?? null,
    cacheWrite: data.cache_write_tokens ?? null,
    text: hookType === "afterAgentResponse" ? data.text || "" : "",
  };
  return crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

function claimCursorHookReceipt(db, hookType, data, sessionId) {
  const key = cursorHookReceiptKey(hookType, data);
  if (!key) return true;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO cursor_hook_receipts (receipt_key, session_id, hook_type, generation_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(key, sessionId, hookType, data.generation_id);
  return result.changes > 0;
}

function candidateCanonicalSession(db, sessionIds) {
  const rows = sessionIds
    .map((id) =>
      db.prepare("SELECT id, transcript_path, updated_at FROM sessions WHERE id = ?").get(id)
    )
    .filter(Boolean);
  rows.sort((left, right) => {
    const leftTranscript = isCursorTranscriptPath(left.transcript_path) ? 1 : 0;
    const rightTranscript = isCursorTranscriptPath(right.transcript_path) ? 1 : 0;
    return (
      rightTranscript - leftTranscript || String(right.updated_at).localeCompare(left.updated_at)
    );
  });
  return rows[0]?.id || null;
}

/** One-time repair for generations already split by Cursor `/resume`. */
function reconcileHistoricalCursorSessions(db) {
  let merged = 0;
  const aliases = db
    .prepare(
      `SELECT a.alias_session_id, a.canonical_session_id, a.generation_id
       FROM cursor_session_aliases a
       JOIN sessions alias ON alias.id = a.alias_session_id
       JOIN sessions canonical ON canonical.id = a.canonical_session_id`
    )
    .all();
  for (const alias of aliases) {
    mergeCursorSessions(
      db,
      alias.alias_session_id,
      alias.canonical_session_id,
      alias.generation_id
    );
    merged++;
  }
  const groups = db
    .prepare(
      `SELECT json_extract(e.data, '$.generation_id') AS generation_id,
              GROUP_CONCAT(DISTINCT e.session_id) AS session_ids
       FROM events e JOIN sessions s ON s.id = e.session_id
       WHERE s.provider = 'cursor' AND json_valid(e.data) = 1
         AND json_extract(e.data, '$.generation_id') IS NOT NULL
       GROUP BY generation_id HAVING COUNT(DISTINCT e.session_id) > 1`
    )
    .all();
  for (const group of groups) {
    const sessionIds = group.session_ids.split(",").filter(Boolean);
    const canonicalId = candidateCanonicalSession(db, sessionIds);
    if (!canonicalId) continue;
    for (const aliasId of sessionIds) {
      if (
        aliasId === canonicalId ||
        !db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(aliasId)
      ) {
        continue;
      }
      mergeCursorSessions(db, aliasId, canonicalId, group.generation_id);
      merged++;
    }
  }
  return merged;
}

module.exports = {
  claimCursorHookReceipt,
  cursorHookReceiptKey,
  mergeCursorSessions,
  reconcileHistoricalCursorSessions,
  registerCursorGeneration,
  resolveCursorSessionId,
};
