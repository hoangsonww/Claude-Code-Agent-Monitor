/**
 * @file Pure helpers for read-only shareable session snapshots. Redaction is
 * applied at CAPTURE time so the persisted blob is already clean — a later
 * re-read can never expose data the creator chose to redact. Keeps DB access
 * out of this module (callers pass rows in); only `crypto` is required, for the
 * unguessable public token.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");

// Allowlist of redaction keys. Each entry pairs the stored key with a
// human-readable label the UI shows in the "what to hide" picker. The order
// here is the order the /options endpoint returns.
const REDACTION_OPTIONS = [
  {
    key: "file_paths",
    label: "File paths (session cwd/transcript path + event-level cwd/path keys)",
  },
  { key: "event_data", label: "Event payloads (raw tool data)" },
  { key: "agent_tasks", label: "Agent task descriptions" },
  { key: "event_summaries", label: "Event summaries" },
];

// Fast membership set for validating incoming redaction keys.
const REDACTION_KEYS = new Set(REDACTION_OPTIONS.map((o) => o.key));

// Well-known path-bearing keys inside an event's raw `data` blob (the hook
// payload). `file_paths` strips these top-level keys too; full payload removal
// (nested values, secrets in tool inputs) requires the `event_data` redaction.
const EVENT_DATA_PATH_KEYS = ["cwd", "transcript_path", "file_path", "filePath"];

/**
 * Best-effort strip of well-known top-level path keys from an event's `data`
 * (a JSON string). Returns the original value unchanged when it isn't a JSON
 * object string or contains none of the keys.
 */
function scrubPathKeysFromEventData(data) {
  if (typeof data !== "string") return data;
  let obj;
  try {
    obj = JSON.parse(data);
  } catch {
    return data;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return data;
  let changed = false;
  for (const k of EVENT_DATA_PATH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      delete obj[k];
      changed = true;
    }
  }
  return changed ? JSON.stringify(obj) : data;
}

/**
 * Return a NEW, deeply-independent copy of `payload` with the requested
 * redactions applied. Never mutates the input. `keys` may be any iterable of
 * redaction keys; unknown keys are ignored here (the route validates them).
 *
 * Redactions:
 *   - file_paths      → session.cwd = null, session.transcript_path = null
 *   - event_data      → every event.data = null
 *   - agent_tasks     → every agent.task = null
 *   - event_summaries → every event.summary = null
 */
function applyRedactions(payload, keys) {
  const set = keys instanceof Set ? keys : new Set(keys || []);
  // Structured deep clone so callers can persist the result immutably without
  // sharing references back into the live capture object.
  const copy = JSON.parse(JSON.stringify(payload));

  if (set.has("file_paths")) {
    if (copy.session && typeof copy.session === "object") {
      copy.session.cwd = null;
      if ("transcript_path" in copy.session) copy.session.transcript_path = null;
    }
    // Paths also live inside event payloads (the hook stores cwd/transcript_path
    // at the top level of event.data) — scrub those too so this option honors
    // its name even when the full event_data redaction isn't selected.
    if (Array.isArray(copy.events)) {
      for (const e of copy.events) e.data = scrubPathKeysFromEventData(e.data);
    }
  }
  if (set.has("event_data") && Array.isArray(copy.events)) {
    for (const e of copy.events) e.data = null;
  }
  if (set.has("event_summaries") && Array.isArray(copy.events)) {
    for (const e of copy.events) e.summary = null;
  }
  if (set.has("agent_tasks") && Array.isArray(copy.agents)) {
    for (const a of copy.agents) a.task = null;
  }

  return copy;
}

/**
 * Derive the lifecycle status of a snapshot row. Revoked wins over expired
 * (an explicit revoke is the stronger signal); expiry is computed against the
 * current wall clock so it's enforced server-side on every read.
 */
function computeStatus(row) {
  if (row.revoked_at) return "revoked";
  if (row.expires_at) {
    const t = Date.parse(row.expires_at);
    // Fail CLOSED: an unparseable/expired timestamp is treated as expired so a
    // corrupted row can never serve its payload.
    if (Number.isNaN(t) || Date.now() > t) return "expired";
  }
  return "active";
}

/**
 * Generate an unguessable public token — 24 random bytes as 48 hex chars.
 * This is the snapshot row's primary key and the only handle a viewer needs.
 */
function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Parse a `snapshots` DB row into the SnapshotMeta shape the management UI
 * consumes. The immutable `payload` blob is intentionally NOT included here —
 * only the public read endpoint hydrates it.
 */
function serializeSnapshot(row) {
  let redactions = [];
  try {
    redactions = JSON.parse(row.redactions || "[]");
  } catch {
    /* tolerate a hand-edited bad blob — treat as no redactions */
  }
  if (!Array.isArray(redactions)) redactions = [];
  return {
    token: row.token,
    session_id: row.session_id,
    title: row.title ?? null,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    revoked_at: row.revoked_at ?? null,
    view_count: row.view_count ?? 0,
    redactions,
    status: computeStatus(row),
  };
}

module.exports = {
  REDACTION_OPTIONS,
  REDACTION_KEYS,
  applyRedactions,
  computeStatus,
  newToken,
  serializeSnapshot,
};
