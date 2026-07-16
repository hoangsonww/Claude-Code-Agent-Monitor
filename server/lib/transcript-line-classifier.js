/**
 * @file Pure, line-level classification predicates extracted from
 * TranscriptCache._consumeLine (server/lib/transcript-cache.js) so the same
 * JSONL-entry classification logic (compaction, interrupt markers, API
 * errors, turn duration, turn activity) can be reused outside the streaming
 * parser — starting with POST /api/hooks/ingest-batch's schema-version
 * assertion (server/routes/hooks.js). Behavior-preserving extraction: each
 * function here reproduces exactly what _consumeLine tested/computed inline
 * before this refactor, and the existing transcript-cache test suite is the
 * proof (unchanged pass/fail after the switch-over).
 *
 * NOT moved: TranscriptCache._streamRange (the chunked file reader). It's a
 * plausible sharing candidate for a future remote-transcript forwarder too,
 * but pulling it out is out of scope here — flagged for whoever builds that
 * forwarder next.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Schema version for the POST /api/hooks/ingest-batch payload contract
// (server/routes/hooks.js). Bumping this is a breaking change for forwarders.
const SCHEMA_VERSION = "1";

// Marker text Claude Code writes into the transcript when a turn is cancelled
// by the user (Esc). The synthetic entry is `type:"user"` and also carries an
// `interruptedMessageId` field; callers accept either signal so detection
// survives minor format drift.
const INTERRUPT_RE = /\[Request interrupted by user/i;

/** True when a transcript entry's message contains the interrupt marker text. */
function hasInterruptText(message) {
  if (!message || typeof message !== "object") return false;
  const c = message.content;
  if (typeof c === "string") return INTERRUPT_RE.test(c);
  if (Array.isArray(c)) {
    for (const block of c) {
      if (block && typeof block.text === "string" && INTERRUPT_RE.test(block.text)) return true;
    }
  }
  return false;
}

/** True when `entry` is a compaction summary line (isCompactSummary). */
function isCompactionEntry(entry) {
  return !!(entry && entry.isCompactSummary);
}

/**
 * True when `entry` is real turn activity — assistant output or a genuine
 * (non-interrupt) user prompt carrying a timestamp. Distinguishes "the
 * transcript actually progressed" from interrupt markers, which carry no
 * turn-activity signal of their own.
 */
function isTurnActivityEntry(entry) {
  return !!(entry && (entry.type === "assistant" || entry.type === "user") && entry.timestamp);
}

/**
 * Extract a {durationMs, timestamp} record from a `system`/`turn_duration`
 * entry, or null when `entry` isn't one. `timestamp` is normalized to an ISO
 * string (Claude Code emits it as either an epoch number or an ISO string).
 */
function extractTurnDuration(entry) {
  if (!entry || entry.type !== "system" || entry.subtype !== "turn_duration" || !entry.durationMs) {
    return null;
  }
  const timestamp = entry.timestamp
    ? typeof entry.timestamp === "number"
      ? new Date(entry.timestamp).toISOString()
      : entry.timestamp
    : null;
  return { durationMs: entry.durationMs, timestamp };
}

/**
 * Extract a {type, message, timestamp} API-error record from `entry`, or
 * null when it isn't one. Two on-disk shapes carry API errors: a nested
 * `message.error` (or a bare `entry.error` when `entry` itself is the
 * message), and the `isApiErrorMessage` flag Claude Code stamps on some
 * error entries.
 */
function extractApiError(entry) {
  if (!entry) return null;
  const msg = entry.message || entry;
  if (msg.type === "error" && msg.error) {
    return {
      type: msg.error.type || "unknown_error",
      message: msg.error.message || "Unknown API error",
      timestamp: entry.timestamp || null,
    };
  }
  if (entry.isApiErrorMessage) {
    const errContent = Array.isArray(entry.message?.content) ? entry.message.content : [];
    const errText = errContent[0]?.text ? errContent[0].text.slice(0, 500) : "Unknown error";
    return {
      type: entry.error || "unknown_error",
      message: errText,
      timestamp: entry.timestamp || null,
    };
  }
  return null;
}

module.exports = {
  SCHEMA_VERSION,
  INTERRUPT_RE,
  hasInterruptText,
  isCompactionEntry,
  isTurnActivityEntry,
  extractTurnDuration,
  extractApiError,
};
