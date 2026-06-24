/**
 * @file Express router for read-only shareable session snapshots. A snapshot is
 * an IMMUTABLE copy of a session's current {session, agents, events, workflows}
 * payload, captured the moment it's created and stored as JSON. Redactions are
 * applied at capture time so the persisted blob is already clean — a later
 * re-read can never leak data the creator chose to hide. Public reads are
 * served by token (an unguessable 48-hex string), gated by server-side expiry
 * and revoke, and every create/access/revoke/denied attempt is audited.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { db, stmts } = require("../db");
const {
  REDACTION_OPTIONS,
  REDACTION_KEYS,
  applyRedactions,
  computeStatus,
  newToken,
  serializeSnapshot,
} = require("../lib/snapshots");

const router = Router();

// Bound a single captured snapshot so one huge session can't produce a
// multi-megabyte blob that is re-parsed on every public read.
const MAX_SNAPSHOT_EVENTS = 5000;
// 100 years in hours — an upper bound on expires_in_hours that still keeps the
// resulting Date well within range (a larger value overflows toISOString()).
const MAX_EXPIRES_HOURS = 24 * 365 * 100;
// Cap the management list so it can't return an unbounded result set.
const MAX_LIST = 500;

// Inline prepared statements for snapshot/audit CRUD (events.js convention).
const insertSnapshot = db.prepare(
  `INSERT INTO snapshots (token, session_id, title, payload, redactions, expires_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const getSnapshot = db.prepare("SELECT * FROM snapshots WHERE token = ?");
const listSnapshots = db.prepare(
  "SELECT * FROM snapshots ORDER BY created_at DESC, token DESC LIMIT ?"
);
// Fetch one more than the cap so we can flag truncation without a COUNT.
const captureEventsStmt = db.prepare(
  "SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC, id ASC LIMIT ?"
);
const incrementView = db.prepare(
  "UPDATE snapshots SET view_count = view_count + 1 WHERE token = ?"
);
const revokeSnapshot = db.prepare(
  "UPDATE snapshots SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token = ? AND revoked_at IS NULL"
);
const deleteSnapshot = db.prepare("DELETE FROM snapshots WHERE token = ?");

const insertAudit = db.prepare(
  "INSERT INTO snapshot_audit (snapshot_token, action, detail) VALUES (?, ?, ?)"
);
const listAudit = db.prepare(
  `SELECT id, action, detail, created_at FROM snapshot_audit
   WHERE snapshot_token = ? ORDER BY created_at DESC, id DESC`
);
const deleteAudit = db.prepare("DELETE FROM snapshot_audit WHERE snapshot_token = ?");

/**
 * Record one audit entry for a snapshot. Best-effort by design: an audit write
 * must never break the request it describes, so failures are swallowed.
 */
function audit(token, action, detail = null) {
  try {
    insertAudit.run(token, action, detail);
  } catch (err) {
    console.warn("[SNAPSHOTS] audit write failed:", err?.message || err);
  }
}

/**
 * Wrap a route handler so any thrown error becomes a structured 500 instead of
 * an unhandled rejection / default HTML error page.
 */
function safe(handler) {
  return (req, res) => {
    try {
      return handler(req, res);
    } catch (err) {
      console.error("[SNAPSHOTS] handler error:", err?.message || err);
      return res
        .status(500)
        .json({ error: { code: "INTERNAL", message: "Internal server error" } });
    }
  };
}

/**
 * Capture a session's current {session, agents, events, workflows} payload —
 * mirrors the GET /api/sessions/:id handler exactly so a snapshot reproduces
 * what the session detail page shows. Returns null if the session is unknown.
 */
function captureSessionPayload(sessionId) {
  const session = stmts.getSession.get(sessionId);
  if (!session) return null;
  // Internal metadata blobs (hook enrichment + arbitrary user-set values) can
  // carry secrets/paths and are not meaningful in a read-only shared view, so
  // they are NEVER captured — independent of the redaction choices.
  session.metadata = null;
  const agents = stmts.listAgentsBySession.all(sessionId).map((a) => ({ ...a, metadata: null }));
  // Bound the captured events; flag truncation so the viewer can say so.
  const rawEvents = captureEventsStmt.all(sessionId, MAX_SNAPSHOT_EVENTS + 1);
  const eventsTruncated = rawEvents.length > MAX_SNAPSHOT_EVENTS;
  const events = eventsTruncated ? rawEvents.slice(0, MAX_SNAPSHOT_EVENTS) : rawEvents;
  const workflows = stmts.listWorkflowsBySession.all(sessionId).map((w) => {
    let phases = [];
    let progress = [];
    try {
      phases = w.phases ? JSON.parse(w.phases) : [];
    } catch {
      phases = [];
    }
    try {
      progress = w.progress ? JSON.parse(w.progress) : [];
    } catch {
      progress = [];
    }
    return { ...w, phases, progress };
  });
  return { session, agents, events, workflows, events_truncated: eventsTruncated };
}

// GET /api/snapshots/options — the redaction allowlist for the create UI.
// Registered BEFORE /:token so "options" is never mistaken for a token.
router.get(
  "/options",
  safe((_req, res) => {
    res.json({ redactions: REDACTION_OPTIONS });
  })
);

// GET /api/snapshots — management list, newest first.
router.get(
  "/",
  safe((_req, res) => {
    res.json({ snapshots: listSnapshots.all(MAX_LIST).map(serializeSnapshot) });
  })
);

// POST /api/snapshots — capture an immutable, optionally-redacted snapshot.
router.post(
  "/",
  safe((req, res) => {
    const { session_id, title, redactions, expires_in_hours } = req.body || {};

    if (!session_id || typeof session_id !== "string") {
      return res
        .status(400)
        .json({ error: { code: "INVALID_INPUT", message: "session_id is required" } });
    }

    // Validate redactions against the allowlist — reject unknown keys.
    let redactionKeys = [];
    if (redactions != null) {
      if (!Array.isArray(redactions)) {
        return res
          .status(400)
          .json({ error: { code: "INVALID_INPUT", message: "redactions must be an array" } });
      }
      for (const key of redactions) {
        if (!REDACTION_KEYS.has(key)) {
          return res
            .status(400)
            .json({ error: { code: "INVALID_INPUT", message: `unknown redaction key: ${key}` } });
        }
      }
      // De-dupe while preserving the allowlist order for a stable stored value.
      const requested = new Set(redactions);
      redactionKeys = REDACTION_OPTIONS.map((o) => o.key).filter((k) => requested.has(k));
    }

    // Validate expiry — a positive, finite number of hours if given.
    let expiresAt = null;
    if (expires_in_hours != null) {
      if (
        typeof expires_in_hours !== "number" ||
        !Number.isFinite(expires_in_hours) ||
        expires_in_hours <= 0
      ) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "expires_in_hours must be a positive number" },
        });
      }
      if (expires_in_hours > MAX_EXPIRES_HOURS) {
        return res.status(400).json({
          error: {
            code: "INVALID_INPUT",
            message: `expires_in_hours must be at most ${MAX_EXPIRES_HOURS}`,
          },
        });
      }
      expiresAt = new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString();
    }

    if (title != null && typeof title !== "string") {
      return res
        .status(400)
        .json({ error: { code: "INVALID_INPUT", message: "title must be a string" } });
    }

    const captured = captureSessionPayload(session_id);
    if (!captured) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
    }

    // Redact at CAPTURE time so the persisted blob is already clean. captured_at
    // stamps when this immutable view was taken.
    const redactedPayload = applyRedactions(captured, redactionKeys);
    redactedPayload.captured_at = new Date().toISOString();

    const token = newToken();
    insertSnapshot.run(
      token,
      session_id,
      title != null ? title : null,
      JSON.stringify(redactedPayload),
      JSON.stringify(redactionKeys),
      expiresAt
    );
    audit(token, "create", redactionKeys.length ? `redacted: ${redactionKeys.join(", ")}` : null);

    res.status(201).json({ snapshot: serializeSnapshot(getSnapshot.get(token)) });
  })
);

// GET /api/snapshots/:token — public, read-only view. Enforces revoke + expiry
// server-side and audits every access (and every denied attempt).
router.get(
  "/:token",
  safe((req, res) => {
    const row = getSnapshot.get(req.params.token);
    // Unknown token: 404 with NO audit — there's no snapshot to attribute it to.
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found" } });
    }

    // Enforce revoke + expiry server-side via the shared status helper (which
    // fails closed on a corrupt expires_at). The payload is never read below
    // unless the snapshot is active.
    const status = computeStatus(row);
    if (status === "revoked") {
      audit(row.token, "access_denied", "revoked");
      return res
        .status(410)
        .json({ error: { code: "GONE", message: "This snapshot has been revoked" } });
    }
    if (status === "expired") {
      audit(row.token, "access_denied", "expired");
      return res
        .status(410)
        .json({ error: { code: "GONE", message: "This snapshot has expired" } });
    }

    let payload;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      // A corrupt stored blob is unrecoverable for the viewer.
      return res
        .status(500)
        .json({ error: { code: "INTERNAL", message: "Snapshot payload is corrupt" } });
    }

    incrementView.run(row.token);
    audit(row.token, "access", null);

    const capturedAt = payload.captured_at || row.created_at;
    let redactions = [];
    try {
      redactions = JSON.parse(row.redactions || "[]");
    } catch {
      redactions = [];
    }

    const publicSnapshot = {
      token: row.token,
      title: row.title ?? null,
      captured_at: capturedAt,
      age_seconds: Math.max(0, Math.round((Date.now() - Date.parse(capturedAt)) / 1000)),
      redactions: Array.isArray(redactions) ? redactions : [],
      read_only: true,
    };

    res.json({ snapshot: publicSnapshot, payload });
  })
);

// POST /api/snapshots/:token/revoke — idempotent revoke; always audits.
router.post(
  "/:token/revoke",
  safe((req, res) => {
    const row = getSnapshot.get(req.params.token);
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found" } });
    }
    // Only stamp revoked_at the first time (the UPDATE's NULL guard makes this a
    // no-op on an already-revoked row), but audit every revoke call.
    revokeSnapshot.run(row.token);
    audit(row.token, "revoke", null);
    res.json({ snapshot: serializeSnapshot(getSnapshot.get(row.token)) });
  })
);

// DELETE /api/snapshots/:token — drop the snapshot and its audit trail.
router.delete(
  "/:token",
  safe((req, res) => {
    const row = getSnapshot.get(req.params.token);
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found" } });
    }
    deleteSnapshot.run(row.token);
    deleteAudit.run(row.token);
    res.json({ ok: true });
  })
);

// GET /api/snapshots/:token/audit — the audit trail, newest first.
router.get(
  "/:token/audit",
  safe((req, res) => {
    const row = getSnapshot.get(req.params.token);
    if (!row) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found" } });
    }
    res.json({ audit: listAudit.all(row.token) });
  })
);

module.exports = router;
