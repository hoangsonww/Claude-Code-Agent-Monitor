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
  reconcileHistoricalCursorSessions,
} = require("./cursor-session-identity");

const UNGROUPED_GENERATION = "__latest__";

function finiteCount(value) {
  if (value == null || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : null;
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
  const hasInput = data.input_tokens != null && data.input_tokens !== "";
  const hasOutput = data.output_tokens != null && data.output_tokens !== "";
  if (!hasInput && !hasOutput) return null;

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
  const generationId =
    typeof data?.generation_id === "string" && data.generation_id.trim()
      ? data.generation_id.trim()
      : UNGROUPED_GENERATION;
  const previous = stmts.getCursorTurn.get(generationId);
  let resolvedModel = null;
  if (isModelAlias(cursorModelId(data))) {
    const eventModel = stmts.getCursorEventModel.get(sessionId, generationId)?.model;
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
  const snapshot = normalizeCursorTurnUsage(data, resolvedModel);
  if (!snapshot) return null;
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
function repairHistoricalCursorData(dbModule) {
  const { db, stmts } = dbModule;
  if (db.prepare("SELECT 1 FROM cursor_repair_state WHERE repair_key = ?").get("resume-usage-v2")) {
    return { repaired: false, merged: 0, removed: 0, usage: 0 };
  }
  return db.transaction(() => {
    const merged = reconcileHistoricalCursorSessions(db);
    const usageRows = db
      .prepare(
        `SELECT e.event_type, e.data, e.session_id
         FROM events e JOIN sessions s ON s.id = e.session_id
         WHERE s.provider = 'cursor' AND e.event_type IN ('afterAgentResponse', 'Stop')
           AND json_valid(e.data) = 1
           AND (json_extract(e.data, '$.input_tokens') IS NOT NULL
             OR json_extract(e.data, '$.output_tokens') IS NOT NULL)
         ORDER BY e.id`
      )
      .all();
    let usage = 0;
    for (const row of usageRows) {
      try {
        if (applyCursorTurnUsage(stmts, row.session_id, JSON.parse(row.data))) usage++;
      } catch {
        // One malformed legacy row must not block the remaining repair.
      }
    }

    let removed = db
      .prepare(
        `DELETE FROM events WHERE event_type = 'afterAgentResponse'
         AND session_id IN (SELECT id FROM sessions WHERE provider = 'cursor')`
      )
      .run().changes;
    const stops = db
      .prepare(
        `SELECT e.id, e.session_id, e.data FROM events e JOIN sessions s ON s.id = e.session_id
         WHERE s.provider = 'cursor' AND e.event_type = 'Stop' AND json_valid(e.data) = 1
           AND json_extract(e.data, '$.generation_id') IS NOT NULL ORDER BY e.id`
      )
      .all();
    const seen = new Set();
    for (const row of stops) {
      const data = JSON.parse(row.data);
      const key = cursorHookReceiptKey("Stop", data);
      if (key && seen.has(key)) {
        db.prepare("DELETE FROM events WHERE id = ?").run(row.id);
        removed++;
        continue;
      }
      if (key) seen.add(key);
      claimCursorHookReceipt(db, "Stop", data, row.session_id);
    }
    db.prepare("INSERT INTO cursor_repair_state (repair_key) VALUES (?)").run("resume-usage-v2");
    return { repaired: true, merged, removed, usage };
  })();
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
