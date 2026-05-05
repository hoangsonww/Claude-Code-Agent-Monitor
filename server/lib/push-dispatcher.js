/**
 * @file push-dispatcher.js
 * @description Centralised entry point for fan-out web-push delivery triggered
 * from server-side events (notably the hook ingester). Wraps `server/lib/push.js`
 * so callers don't have to know about VAPID setup, payload shape, or the
 * SQLite subscriptions table. Behaviour intentionally:
 *   - Idempotent: safe to call repeatedly with the same payload; we never
 *     mutate caller state.
 *   - Failure-tolerant: a single bad subscription (network error, expired
 *     endpoint, malformed key) cannot kill the rest of the batch — the
 *     underlying `sendPushToAll` uses Promise.allSettled and prunes 410s.
 *   - Filtered: only events in PUSH_EVENT_FILTER produce notifications. Anything
 *     else short-circuits with `{ sent: 0, skipped: true }`.
 *
 * Used by `server/routes/hooks.js` (fire-and-forget after DB writes) and
 * `server/routes/push.js` (manual /send endpoint).
 */

const webpush = require("web-push");
const { db } = require("../db");
const { sendPushToAll } = require("./push");

// Hook event types worth waking the user for. Stop = Claude finished and is
// waiting; Notification = permission/input prompt; SubagentStop = a background
// subagent reported done. PreToolUse / PostToolUse / SessionStart fire far too
// often to be useful as push.
const PUSH_EVENT_FILTER = new Set(["Stop", "Notification", "SubagentStop"]);

function isFilterableEvent(event) {
  return PUSH_EVENT_FILTER.has(event);
}

/**
 * Send a notification payload to every stored push subscription.
 *
 * @param {Object} args
 * @param {string} args.event - Hook event type (e.g. "Stop", "Notification").
 *                              Used as a coarse filter; out-of-filter events
 *                              skip without touching the network.
 * @param {Object} args.payload - Notification body. `{ title, body, ts? }` at
 *                                minimum; arbitrary extra fields pass through
 *                                to the service worker `push` listener.
 * @returns {Promise<{sent: number, skipped?: boolean}>}
 */
async function dispatchPush({ event, payload } = {}) {
  if (!event || !isFilterableEvent(event)) {
    return { sent: 0, skipped: true };
  }
  if (!payload || typeof payload !== "object") {
    return { sent: 0, skipped: true };
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "Agent Monitor";
  const body =
    typeof payload.body === "string" && payload.body ? payload.body : `Event: ${event}`;

  // Snapshot the subscriptions before sending so we can return an accurate
  // `sent` count even though `sendPushToAll` doesn't return one. The pruning
  // of 410-Gone subscriptions still happens inside sendPushToAll.
  let subscriptionCount = 0;
  try {
    const row = db.prepare("SELECT COUNT(*) AS c FROM push_subscriptions").get();
    subscriptionCount = row?.c ?? 0;
  } catch {
    // DB not ready / table missing — treat as zero subscribers.
    return { sent: 0, skipped: true };
  }
  if (subscriptionCount === 0) {
    return { sent: 0, skipped: true };
  }

  try {
    await sendPushToAll(db, title, body);
    return { sent: subscriptionCount };
  } catch (err) {
    // sendPushToAll uses Promise.allSettled internally so this branch is
    // unusual — but we still treat it as best-effort and log to stderr.
    // eslint-disable-next-line no-console
    console.error("[push-dispatcher] sendPushToAll threw:", err && err.message);
    return { sent: 0, error: err && err.message };
  }
}

module.exports = {
  dispatchPush,
  PUSH_EVENT_FILTER,
  isFilterableEvent,
  // exposed for tests so they can verify VAPID lookup without spinning the
  // whole web-push pipeline
  _webpush: webpush,
};
