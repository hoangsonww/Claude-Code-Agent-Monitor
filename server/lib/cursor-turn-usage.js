/**
 * @file Normalizes Cursor hooks and persists one token snapshot per generation.
 * Cursor reports cache tokens inside input_tokens and may expose the selected
 * model only in its native chat store, so both are corrected before pricing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { resolveCursorStoreModel } = require("./cursor-store-transcript");
const {
  claimCursorHookReceipt,
  cursorHookReceiptKey,
  reconcileHistoricalCursorSessionsBatched,
} = require("./cursor-session-identity");

const UNGROUPED_GENERATION = "__latest__";

function finiteCount(value) {
  if (value == null || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function hasCount(data, field) {
  return data?.[field] != null && data[field] !== "";
}

function paramValue(data, id) {
  if (!Array.isArray(data?.model_params)) return undefined;
  return data.model_params.find((entry) => entry?.id === id)?.value;
}

function isFast(data, model) {
  const fast = paramValue(data, "fast");
  return (
    fast === true ||
    fast === "true" ||
    String(data?.speed || "").toLowerCase() === "fast" ||
    /(?:^|-)fast(?:-|$)/i.test(model)
  );
}

function cursorModelId(data) {
  const candidate = data?.model_id || data?.model;
  return typeof candidate === "string" ? candidate.trim().replace(/^cursor-/, "") : "";
}

function isModelAlias(model) {
  return !model || ["default", "auto", "unknown"].includes(model.toLowerCase());
}

/** Normalize one Cursor stop/afterAgentResponse token envelope. */
function normalizeCursorTurnUsage(data, modelOverride = null) {
  if (!data || typeof data !== "object") return null;
  const hasInput = hasCount(data, "input_tokens");
  const hasOutput = hasCount(data, "output_tokens");
  if (!hasInput && !hasOutput) return null;

  const countFields = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"];
  if (countFields.some((field) => hasCount(data, field) && finiteCount(data[field]) === null)) {
    return null;
  }

  const cacheRead = finiteCount(data.cache_read_tokens) ?? 0;
  const cacheWrite = finiteCount(data.cache_write_tokens) ?? 0;
  const reportedInput = finiteCount(data.input_tokens) ?? 0;
  const output = finiteCount(data.output_tokens) ?? 0;
  const cacheIncluded = data.cache_read_tokens != null || data.cache_write_tokens != null;
  const input = cacheIncluded ? Math.max(0, reportedInput - cacheRead - cacheWrite) : reportedInput;
  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return null;

  let model = cursorModelId(data);
  if (isModelAlias(model) && modelOverride) model = String(modelOverride).replace(/^cursor-/, "");
  const speed = isFast(data, model) ? "fast" : "standard";
  if (speed === "fast") model = model.replace(/-fast$/i, "");
  const generationId =
    typeof data.generation_id === "string" && data.generation_id.trim()
      ? data.generation_id.trim()
      : UNGROUPED_GENERATION;
  return {
    generationId,
    model: model || "unknown",
    speed,
    input,
    output,
    cacheRead,
    cacheWrite,
  };
}

function isCursorHook(hookType, data) {
  if (!data || typeof data !== "object") return false;
  return Boolean(
    hookType === "afterAgentResponse" ||
    data.conversation_id ||
    data.cursor_version ||
    (data.generation_id && !data.hook_event_name)
  );
}

function isCursorTurnPayload(hookType, data) {
  if (!isCursorHook(hookType, data)) return false;
  return ["afterAgentResponse", "Stop", "stop"].includes(hookType);
}

/** Map Cursor's compatible hook envelope onto the dashboard's hook contract. */
function normalizeCursorHook(hookType, data) {
  const type = hookType === "stop" ? "Stop" : hookType;
  if (!data || typeof data !== "object") return { hookType: type, data };
  const next = { ...data };
  if (!next.session_id && typeof next.conversation_id === "string") {
    next.session_id = next.conversation_id;
  }
  if (type === "Stop" && !next.stop_reason && next.status === "error") {
    next.stop_reason = "error";
  }
  if (isCursorHook(type, next)) {
    delete next.user_email;
    if (!next.provider) next.provider = "cursor";
  }
  return { hookType: type, data: next };
}

function rewriteCursorTokenBuckets(stmts, sessionId, previousBucket = null) {
  const buckets = stmts.sumCursorTurnUsage.all(sessionId);
  const live = new Set(buckets.map((bucket) => `${bucket.model}\0${bucket.speed}`));
  if (previousBucket && !live.has(`${previousBucket.model}\0${previousBucket.speed}`)) {
    stmts.deleteTokenUsageBucket.run(sessionId, previousBucket.model, previousBucket.speed);
  }
  for (const bucket of buckets) {
    stmts.resetTokenUsage.run(
      sessionId,
      bucket.model,
      bucket.speed,
      "global",
      "standard",
      bucket.input_tokens,
      bucket.output_tokens,
      bucket.cache_read_tokens,
      bucket.cache_write_tokens,
      0,
      0,
      0,
      0
    );
  }
  return buckets;
}

/** Persist and re-sum one Cursor generation; repeated hooks replace one row. */
function applyCursorTurnUsage(stmts, sessionId, data) {
  if (!sessionId) return null;
  const reportedGenerationId =
    typeof data?.generation_id === "string" && data.generation_id.trim()
      ? data.generation_id.trim()
      : UNGROUPED_GENERATION;
  const generationId =
    reportedGenerationId === UNGROUPED_GENERATION
      ? `${sessionId}\0${UNGROUPED_GENERATION}`
      : reportedGenerationId;
  const previous = stmts.getCursorTurn.get(generationId);
  const mergedData = { ...data };
  if (previous) {
    if (!hasCount(data, "input_tokens")) {
      mergedData.input_tokens =
        previous.input_tokens + previous.cache_read_tokens + previous.cache_write_tokens;
    }
    if (!hasCount(data, "output_tokens")) mergedData.output_tokens = previous.output_tokens;
    if (!hasCount(data, "cache_read_tokens")) {
      mergedData.cache_read_tokens = previous.cache_read_tokens;
    }
    if (!hasCount(data, "cache_write_tokens")) {
      mergedData.cache_write_tokens = previous.cache_write_tokens;
    }
  }
  let resolvedModel = null;
  if (isModelAlias(cursorModelId(data))) {
    const eventModel = stmts.getCursorEventModel.get(sessionId, reportedGenerationId)?.model;
    const sourceSessionId = data?.cursor_alias_session_id || data?.conversation_id;
    resolvedModel = previous && !isModelAlias(previous.model) ? previous.model : eventModel;
    if (isModelAlias(resolvedModel) && sourceSessionId && sourceSessionId !== sessionId) {
      resolvedModel = resolveCursorStoreModel(sourceSessionId, data?.text);
    }
    if (isModelAlias(resolvedModel)) {
      resolvedModel = resolveCursorStoreModel(sessionId, data?.text);
    }
    if (isModelAlias(resolvedModel)) {
      resolvedModel = stmts.getLatestCursorSessionModel.get(sessionId)?.model;
    }
  }
  const snapshot = normalizeCursorTurnUsage(mergedData, resolvedModel);
  if (!snapshot) return null;
  snapshot.generationId = generationId;
  stmts.upsertCursorTurnUsage.run(
    snapshot.generationId,
    sessionId,
    snapshot.model,
    snapshot.speed,
    snapshot.input,
    snapshot.output,
    snapshot.cacheRead,
    snapshot.cacheWrite
  );
  const buckets = rewriteCursorTokenBuckets(stmts, sessionId, previous);
  if (previous?.session_id && previous.session_id !== sessionId) {
    rewriteCursorTokenBuckets(stmts, previous.session_id, previous);
  }
  return { snapshot, buckets };
}

/** Repair existing Cursor usage, split resumes, and duplicate completion rows once. */
async function repairHistoricalCursorData(dbModule) {
  const { db, stmts } = dbModule;
  const repairKey = "resume-usage-v2";
  if (db.prepare("SELECT 1 FROM cursor_repair_state WHERE repair_key = ?").get(repairKey)) {
    db.prepare("DELETE FROM cursor_repair_progress WHERE repair_key = ?").run(repairKey);
    return { repaired: false, merged: 0, removed: 0, usage: 0 };
  }
  db.prepare(
    `INSERT OR IGNORE INTO cursor_repair_progress (repair_key, phase)
     VALUES (?, 'merge')`
  ).run(repairKey);
  const getProgress = () =>
    db.prepare("SELECT * FROM cursor_repair_progress WHERE repair_key = ?").get(repairKey);
  const setProgress = (phase, lastEventId, merged, removed, usage) =>
    db
      .prepare(
        `UPDATE cursor_repair_progress SET phase = ?, last_event_id = ?,
         merged_count = ?, removed_count = ?, usage_count = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE repair_key = ?`
      )
      .run(phase, lastEventId, merged, removed, usage, repairKey);
  const yieldToHooks = () => new Promise((resolve) => setImmediate(resolve));
  let progress = getProgress();
  let merged = Number(progress.merged_count) || 0;
  let removed = Number(progress.removed_count) || 0;
  let usage = Number(progress.usage_count) || 0;

  if (progress.phase === "merge") {
    merged += await reconcileHistoricalCursorSessionsBatched(db);
    setProgress("usage", 0, merged, removed, usage);
    progress = getProgress();
  }

  if (progress.phase === "usage") {
    let lastEventId = Number(progress.last_event_id) || 0;
    while (true) {
      const rows = db
        .prepare(
          `SELECT e.id, e.data, e.session_id
           FROM events e JOIN sessions s ON s.id = e.session_id
           WHERE e.id > ? AND s.provider = 'cursor'
             AND e.event_type IN ('afterAgentResponse', 'Stop')
             AND json_valid(e.data) = 1
             AND (json_extract(e.data, '$.input_tokens') IS NOT NULL
               OR json_extract(e.data, '$.output_tokens') IS NOT NULL)
           ORDER BY e.id LIMIT 100`
        )
        .all(lastEventId);
      if (!rows.length) break;
      db.transaction(() => {
        for (const row of rows) {
          lastEventId = row.id;
          try {
            if (applyCursorTurnUsage(stmts, row.session_id, JSON.parse(row.data))) usage++;
          } catch {
            // One malformed legacy row must not block the remaining repair.
          }
        }
        setProgress("usage", lastEventId, merged, removed, usage);
      })();
      await yieldToHooks();
    }
    setProgress("delete_responses", 0, merged, removed, usage);
    progress = getProgress();
  }

  if (progress.phase === "delete_responses") {
    while (true) {
      const result = db
        .prepare(
          `DELETE FROM events WHERE id IN (
             SELECT e.id FROM events e JOIN sessions s ON s.id = e.session_id
             WHERE s.provider = 'cursor' AND e.event_type = 'afterAgentResponse'
             ORDER BY e.id LIMIT 100
           )`
        )
        .run();
      removed += result.changes;
      setProgress("delete_responses", 0, merged, removed, usage);
      if (result.changes === 0) break;
      await yieldToHooks();
    }
    setProgress("dedupe_stops", 0, merged, removed, usage);
    progress = getProgress();
  }

  if (progress.phase === "dedupe_stops") {
    while (true) {
      const duplicates = db
        .prepare(
          `SELECT id FROM (
             SELECT e.id,
               ROW_NUMBER() OVER (
                 PARTITION BY json_extract(e.data, '$.generation_id'),
                   COALESCE(NULLIF(json_extract(e.data, '$.status'), ''),
                     json_extract(e.data, '$.stop_reason'), ''),
                   json_extract(e.data, '$.input_tokens'),
                   json_extract(e.data, '$.output_tokens'),
                   json_extract(e.data, '$.cache_read_tokens'),
                   json_extract(e.data, '$.cache_write_tokens')
                 ORDER BY e.id
               ) AS duplicate_rank
             FROM events e JOIN sessions s ON s.id = e.session_id
             WHERE s.provider = 'cursor' AND e.event_type = 'Stop'
               AND json_valid(e.data) = 1
               AND json_extract(e.data, '$.generation_id') IS NOT NULL
           ) ranked WHERE duplicate_rank > 1 LIMIT 100`
        )
        .all();
      if (!duplicates.length) break;
      db.transaction(() => {
        const remove = db.prepare("DELETE FROM events WHERE id = ?");
        for (const row of duplicates) removed += remove.run(row.id).changes;
        setProgress("dedupe_stops", 0, merged, removed, usage);
      })();
      await yieldToHooks();
    }
    setProgress("claim_stops", 0, merged, removed, usage);
    progress = getProgress();
  }

  if (progress.phase === "claim_stops") {
    let lastEventId = Number(progress.last_event_id) || 0;
    while (true) {
      const rows = db
        .prepare(
          `SELECT e.id, e.session_id, e.data
           FROM events e JOIN sessions s ON s.id = e.session_id
           WHERE e.id > ? AND s.provider = 'cursor' AND e.event_type = 'Stop'
             AND json_valid(e.data) = 1
             AND json_extract(e.data, '$.generation_id') IS NOT NULL
           ORDER BY e.id LIMIT 100`
        )
        .all(lastEventId);
      if (!rows.length) break;
      db.transaction(() => {
        for (const row of rows) {
          lastEventId = row.id;
          const data = JSON.parse(row.data);
          if (cursorHookReceiptKey("Stop", data)) {
            claimCursorHookReceipt(db, "Stop", data, row.session_id);
          }
        }
        setProgress("claim_stops", lastEventId, merged, removed, usage);
      })();
      await yieldToHooks();
    }
  }

  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO cursor_repair_state (repair_key) VALUES (?)").run(repairKey);
    db.prepare("DELETE FROM cursor_repair_progress WHERE repair_key = ?").run(repairKey);
  })();
  return { repaired: true, merged, removed, usage };
}

module.exports = {
  applyCursorTurnUsage,
  isCursorHook,
  isCursorTurnPayload,
  normalizeCursorHook,
  normalizeCursorTurnUsage,
  repairHistoricalCursorData,
  rewriteCursorTokenBuckets,
};
