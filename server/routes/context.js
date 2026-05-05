/**
 * @file Read-only context-management routes. Surfaces compaction events stored
 * in the existing `events` table so the dashboard can render a timeline of
 * when sessions compacted, how often, and (eventually) drill into pre-compact
 * transcript snapshots.
 *
 * v1 is strictly read-only and pulls from existing event rows. The hook
 * ingestion path (server/routes/hooks.js) already records:
 *   - "Compaction"  — emitted when JSONL parsing detects an isCompactSummary
 *                     entry, or when a Notification message matches a compact
 *                     pattern.
 *   - "PreCompact" / "PostCompact" — reserved event types for future hook
 *                     wiring. We accept them here so this route works the
 *                     moment the upstream hook starts emitting them.
 *
 * Disabled by default — gated behind ORCHESTRATOR_ENABLED=1 (same flag as the
 * orchestrator surface) so this surface isn't exposed unless the operator opts
 * in.
 */

const express = require("express");
const { db } = require("../db");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

// Event types we treat as "compaction" surface. Includes both the legacy
// single-event "Compaction" tag and the Pre/Post variants for forward
// compatibility.
const COMPACT_EVENT_TYPES = ["Compaction", "PreCompact", "PostCompact"];

// Same gating model as the orchestrator/memory routers: 404 (not 403) hides
// the endpoint entirely when disabled so it's indistinguishable from "this
// build doesn't ship the feature".
router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "context routes disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 to enable read-only context-management routes.",
    });
  }
  next();
});

// Strict allowlist for path-bound session IDs. Mirrors the convention used by
// memory/skills routers so we can cleanly reject anything that could escape
// expected shape (slashes, "..", null bytes, etc.).
const SESSION_ID_RE = /^[A-Za-z0-9_.-]+$/;

function tryParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Pair PostCompact events with the most recent PreCompact for the same session
 * within a 60-second window. Standalone "Compaction" events (the legacy single
 * marker emitted from JSONL detection) are surfaced as their own pair-less
 * entries. Returns the input list with an extra `pairId` annotation per row.
 *
 * Inputs are expected to be ordered DESC by created_at (newest first) — the
 * way the SQL returns them. We walk newest→oldest so the "most recent
 * PreCompact" lookup is just "the next PreCompact we see for this session".
 */
function annotatePairs(rows) {
  // pendingByPost[sessionId] → { id of a PostCompact awaiting its PreCompact }
  const pendingByPost = new Map();
  let nextPairId = 1;
  const pairIds = new Map(); // event id → pairId

  for (const row of rows) {
    if (row.event_type === "PostCompact") {
      // Stash this PostCompact; the matching PreCompact will follow in the
      // DESC iteration order.
      pendingByPost.set(row.session_id, row);
    } else if (row.event_type === "PreCompact") {
      const post = pendingByPost.get(row.session_id);
      if (post) {
        const dt = Math.abs(
          new Date(post.created_at).getTime() - new Date(row.created_at).getTime()
        );
        if (dt <= 60_000) {
          const pid = nextPairId++;
          pairIds.set(post.id, pid);
          pairIds.set(row.id, pid);
        }
        pendingByPost.delete(row.session_id);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    eventType: r.event_type,
    timestamp: r.created_at,
    pairId: pairIds.get(r.id) ?? null,
    payload: tryParseJson(r.data),
    summary: r.summary || null,
  }));
}

// ── GET /api/context/compactions ────────────────────────────────────────────
//
// List recent compaction events across every session, with a session-name
// hydration for display and a small summary block.

router.get("/compactions", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

  const placeholders = COMPACT_EVENT_TYPES.map(() => "?").join(",");
  let rows;
  try {
    rows = db
      .prepare(
        `SELECT e.id, e.session_id, e.event_type, e.created_at, e.data, e.summary,
                s.name as session_name, s.cwd as session_cwd, s.status as session_status
         FROM events e
         LEFT JOIN sessions s ON s.id = e.session_id
         WHERE e.event_type IN (${placeholders})
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT ?`
      )
      .all(...COMPACT_EVENT_TYPES, limit);
  } catch (err) {
    return res.status(500).json({ error: `query failed: ${err.message}` });
  }

  const annotated = annotatePairs(rows).map((r, i) => ({
    ...r,
    sessionName: rows[i].session_name || null,
    sessionCwd: rows[i].session_cwd || null,
    sessionStatus: rows[i].session_status || null,
  }));

  const uniqueSessions = new Set(annotated.map((c) => c.sessionId));
  const counts = annotated.reduce(
    (acc, c) => {
      acc[c.eventType] = (acc[c.eventType] || 0) + 1;
      return acc;
    },
    {}
  );

  res.json({
    events: annotated,
    summary: {
      total: annotated.length,
      preCompactCount: counts.PreCompact || 0,
      postCompactCount: counts.PostCompact || 0,
      compactionCount: counts.Compaction || 0,
      uniqueSessions: uniqueSessions.size,
      pairCount: new Set(annotated.map((c) => c.pairId).filter((p) => p !== null)).size,
    },
    limit,
  });
});

// ── GET /api/context/compactions/:sessionId ────────────────────────────────
//
// Per-session compaction history (ASC: oldest first, since this is typically
// rendered as a timeline reading top-to-bottom).

router.get("/compactions/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  if (!SESSION_ID_RE.test(sessionId)) {
    return res.status(400).json({ error: "invalid sessionId" });
  }

  const placeholders = COMPACT_EVENT_TYPES.map(() => "?").join(",");
  let rows;
  try {
    rows = db
      .prepare(
        `SELECT id, session_id, event_type, created_at, data, summary
         FROM events
         WHERE session_id = ? AND event_type IN (${placeholders})
         ORDER BY created_at ASC, id ASC`
      )
      .all(sessionId, ...COMPACT_EVENT_TYPES);
  } catch (err) {
    return res.status(500).json({ error: `query failed: ${err.message}` });
  }

  // Pair walking ASC: the matching PostCompact for each PreCompact is the
  // next PostCompact we see for the same session within the window.
  let nextPairId = 1;
  const pairIds = new Map();
  const pendingPre = new Map(); // sessionId → PreCompact row
  for (const r of rows) {
    if (r.event_type === "PreCompact") {
      pendingPre.set(r.session_id, r);
    } else if (r.event_type === "PostCompact") {
      const pre = pendingPre.get(r.session_id);
      if (pre) {
        const dt = Math.abs(
          new Date(pre.created_at).getTime() - new Date(r.created_at).getTime()
        );
        if (dt <= 60_000) {
          const pid = nextPairId++;
          pairIds.set(pre.id, pid);
          pairIds.set(r.id, pid);
        }
        pendingPre.delete(r.session_id);
      }
    }
  }

  const events = rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    timestamp: r.created_at,
    pairId: pairIds.get(r.id) ?? null,
    payload: tryParseJson(r.data),
    summary: r.summary || null,
  }));

  res.json({
    sessionId,
    events,
    count: events.length,
  });
});

// ── GET /api/context/sessions/:sessionId/budget ─────────────────────────────
//
// Approximate context budget usage from event metadata. v1 returns only event
// counts grouped by type — token totals will require parsing stream-json
// usage entries which is deferred.

router.get("/sessions/:sessionId/budget", (req, res) => {
  const sessionId = req.params.sessionId;
  if (!SESSION_ID_RE.test(sessionId)) {
    return res.status(400).json({ error: "invalid sessionId" });
  }

  let rows;
  try {
    rows = db
      .prepare(
        `SELECT event_type, COUNT(*) as count
         FROM events
         WHERE session_id = ?
         GROUP BY event_type`
      )
      .all(sessionId);
  } catch (err) {
    return res.status(500).json({ error: `query failed: ${err.message}` });
  }

  const eventCounts = Object.fromEntries(rows.map((r) => [r.event_type, r.count]));
  const totalEvents = rows.reduce((acc, r) => acc + r.count, 0);
  const compactionEvents = COMPACT_EVENT_TYPES.reduce(
    (acc, t) => acc + (eventCounts[t] || 0),
    0
  );

  // Best-effort token totals — pulled from token_usage where available so the
  // UI can show a "consumed so far" hint without waiting on per-message
  // accounting work. The columns include compaction baselines so totals
  // remain accurate across compactions.
  let tokens = null;
  try {
    const t = db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens + baseline_input), 0) as input_tokens,
          COALESCE(SUM(output_tokens + baseline_output), 0) as output_tokens,
          COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) as cache_read_tokens,
          COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) as cache_write_tokens
        FROM token_usage
        WHERE session_id = ?`
      )
      .get(sessionId);
    if (t) tokens = t;
  } catch {
    // token_usage may be missing baseline columns on very old DBs; ignore.
    tokens = null;
  }

  res.json({
    sessionId,
    eventCounts,
    totalEvents,
    compactionEvents,
    tokens,
    note:
      "v1: counts only. Per-message token-budget tracking will require parsing stream-json events with usage data.",
  });
});

module.exports = router;
