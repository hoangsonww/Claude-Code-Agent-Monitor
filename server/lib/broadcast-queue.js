/**
 * @file Deferred broadcast queue that decouples WebSocket notifications from SQLite transactions. Enqueue type+ref pairs inside a transaction, then flush after commit — reducing lock hold time and deduplicating redundant broadcasts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { stmts } = require("../db");
const { broadcast } = require("../websocket");

/**
 * Pending broadcast items. Each item is { type, ref } where ref contains
 * just enough info to load the full payload on flush (sessionId / agentId / inline data).
 */
let pending = [];

/**
 * Enqueue a broadcast to be sent later (outside the current transaction).
 * Call this inside `db.transaction()` instead of `broadcast()` directly.
 *
 * @param {string} type  - WebSocket message type ("session_updated", "agent_updated", etc.)
 * @param {object} ref   - Reference to locate the data on flush.
 *   For session/agent types: { sessionId } or { agentId }
 *   For inline data (e.g. "new_event"): { data } — the full payload, no DB read needed
 */
function enqueue(type, ref) {
  pending.push({ type, ref });
}

/**
 * Flush all pending broadcasts: deduplicate, load data from DB,
 * and call the real `broadcast()`. Should be called outside any transaction
 * (typically via `setImmediate` after `processEvent` returns).
 */
function flush() {
  if (pending.length === 0) return;

  const items = pending;
  pending = [];

  // Deduplicate: for DB-backed types, keep only the last entry per (type, id).
  // Inline-data types ("new_event") are never deduped.
  const seen = new Map();
  const deduped = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = dedupeKey(item);
    if (key) {
      seen.set(key, i);
    } else {
      // Inline data — always keep
      deduped.push(item);
    }
  }

  // Append the last occurrence of each dedup-able key
  for (const idx of seen.values()) {
    deduped.push(items[idx]);
  }

  // Send broadcasts (DB reads happen here, outside the transaction)
  for (const item of deduped) {
    const data = loadData(item);
    if (data !== undefined && data !== null) {
      broadcast(item.type, data);
    }
  }
}

/**
 * Clear all pending items without sending. Useful for error recovery.
 */
function clear() {
  pending = [];
}

/**
 * Number of pending items (for diagnostics / testing).
 */
function size() {
  return pending.length;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a dedup key for DB-backed types. Returns null for inline-data types.
 */
function dedupeKey(item) {
  const { type, ref } = item;
  if (ref.data !== undefined) return null; // inline payload, don't dedup
  if (ref.sessionId) return `${type}:session:${ref.sessionId}`;
  if (ref.agentId) return `${type}:agent:${ref.agentId}`;
  return null;
}

/**
 * Load the full payload for a queued broadcast item.
 * DB-backed types fetch fresh data; inline types return ref.data directly.
 */
function loadData(item) {
  const { type, ref } = item;

  // Inline payload — no DB read needed
  if (ref.data !== undefined) return ref.data;

  // Session types
  if (ref.sessionId) {
    return stmts.getSession.get(ref.sessionId) || null;
  }

  // Agent types
  if (ref.agentId) {
    return stmts.getAgent.get(ref.agentId) || null;
  }

  return null;
}

module.exports = { enqueue, flush, clear, size };
