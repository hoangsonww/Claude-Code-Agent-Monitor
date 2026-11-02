/**
 * @file cursor-turn-usage.js
 * @description Turns a Cursor `stop` payload into one priced token bucket.
 * Cursor's agent transcript is `{role, message:{content}}` and never carries
 * `usage`. The stop hook reports the turn's cumulative counts once per
 * `generation_id` (and repeats them on retries). `input_tokens` includes cache
 * read and write, so those are subtracted before the Cursor rate card runs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const UNGROUPED_GENERATION = "__latest__";

function finiteCount(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function paramValue(data, id) {
  if (!Array.isArray(data.model_params)) return undefined;
  const found = data.model_params.find((entry) => entry && entry.id === id);
  return found ? found.value : undefined;
}

function isFast(data, model) {
  const fast = paramValue(data, "fast");
  if (fast === true || fast === "true") return true;
  if (typeof data.speed === "string" && data.speed.toLowerCase() === "fast") return true;
  return /(?:^|-)fast(?:-|$)/i.test(model);
}

/** Rate-card model id. Prefer `model_id`; otherwise drop a `cursor-` prefix. */
function cursorModelId(data) {
  if (typeof data.model_id === "string" && data.model_id.trim()) return data.model_id.trim();
  if (typeof data.model === "string" && data.model.trim()) {
    return data.model.trim().replace(/^cursor-/, "");
  }
  return "";
}

/**
 * Normalize one Cursor stop / afterAgentResponse payload.
 * Returns null when the payload has no token counts.
 * @param {Record<string, unknown>} data
 */
function normalizeCursorTurnUsage(data) {
  if (!data || typeof data !== "object") return null;
  const hasInput = data.input_tokens != null && data.input_tokens !== "";
  const hasOutput = data.output_tokens != null && data.output_tokens !== "";
  if (!hasInput && !hasOutput) return null;

  const cacheRead = finiteCount(data.cache_read_tokens) ?? 0;
  const cacheWrite = finiteCount(data.cache_write_tokens) ?? 0;
  const reportedInput = finiteCount(data.input_tokens) ?? 0;
  const output = finiteCount(data.output_tokens) ?? 0;
  // Only the Cursor stop shape includes cache fields inside input_tokens.
  const cacheKeysPresent = data.cache_read_tokens != null || data.cache_write_tokens != null;
  const input = cacheKeysPresent
    ? Math.max(0, reportedInput - cacheRead - cacheWrite)
    : reportedInput;
  if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) return null;

  let model = cursorModelId(data);
  const speed = isFast(data, model) ? "fast" : "standard";
  if (speed === "fast") model = model.replace(/-fast$/i, "");
  if (!model) model = "unknown";

  const generationId =
    typeof data.generation_id === "string" && data.generation_id.trim()
      ? data.generation_id.trim()
      : UNGROUPED_GENERATION;

  return { generationId, model, speed, input, output, cacheRead, cacheWrite };
}

/**
 * Accept Cursor's `conversation_id` as the dashboard session id, and map
 * `status: "error"` onto the Claude Stop field the session state machine reads.
 * @param {string} hookType
 * @param {Record<string, unknown>} data
 */
function normalizeCursorHook(hookType, data) {
  let type = hookType === "stop" ? "Stop" : hookType;
  if (!data || typeof data !== "object") return { hookType: type, data };
  const next = { ...data };
  if (!next.session_id && typeof next.conversation_id === "string" && next.conversation_id) {
    next.session_id = next.conversation_id;
  }
  if (type === "Stop" && !next.stop_reason && next.status === "error") {
    next.stop_reason = "error";
  }
  return { hookType: type, data: next };
}

/**
 * Replace this turn's snapshot and rewrite the session's Cursor token buckets
 * as the sum of every stored turn. Repeated stop hooks for one generation
 * do not add usage twice.
 * @returns {boolean} Whether a snapshot was stored.
 */
function applyCursorTurnUsage(stmts, sessionId, data) {
  const snap = normalizeCursorTurnUsage(data);
  if (!snap || !sessionId) return false;
  stmts.upsertCursorTurnUsage.run(
    sessionId,
    snap.generationId,
    snap.model,
    snap.speed,
    snap.input,
    snap.output,
    snap.cacheRead,
    snap.cacheWrite
  );
  const buckets = stmts.sumCursorTurnUsage.all(sessionId);
  for (const bucket of buckets) {
    stmts.replaceTokenUsage.run(
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
  return true;
}

module.exports = {
  normalizeCursorTurnUsage,
  normalizeCursorHook,
  applyCursorTurnUsage,
};
