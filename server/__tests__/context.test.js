/**
 * @file Tests for the read-only context-management routes. Covers the
 * disabled-by-default gate, empty-data behaviour, the PreCompact/PostCompact
 * pairing logic, and basic input validation on the per-session endpoints.
 *
 * Uses a tmp SQLite file so the test does not collide with a developer's
 * dashboard.db. Runs the gating tests in a separate isolated child fixture so
 * we can re-require the route module with ORCHESTRATOR_ENABLED unset without
 * disturbing the main "enabled" suite.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const express = require("express");

// Set up a fresh test database BEFORE requiring db / routes.
const TEST_DB = path.join(os.tmpdir(), `context-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

// Helper to launch a transient HTTP server with a fresh router instance under
// a controllable env. Returns the base URL and a cleanup function.
async function withApp(envOverrides, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Reload route module so it observes the new env (the ENABLED flag is
  // captured at require-time).
  delete require.cache[require.resolve("../routes/context")];
  const router = require("../routes/context");
  const app = express();
  app.use("/api/context", router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("context routes — gating", () => {
  it("returns 404 for every endpoint when ORCHESTRATOR_ENABLED is unset", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: undefined }, async (base) => {
      for (const p of [
        "/api/context/compactions",
        "/api/context/compactions/some-session",
        "/api/context/sessions/some-session/budget",
      ]) {
        const res = await fetch(base + p);
        assert.strictEqual(res.status, 404, `expected 404 for ${p}`);
        const body = await res.json();
        assert.strictEqual(body.error, "context routes disabled");
      }
    });
  });
});

describe("context routes — enabled", () => {
  // Lazily require db here so DASHBOARD_DB_PATH (set above) is honoured.
  const { db, stmts } = require("../db");

  const SESSION_A = `ctx-test-a-${Date.now()}`;
  const SESSION_B = `ctx-test-b-${Date.now()}`;
  const SESSION_EMPTY = `ctx-test-empty-${Date.now()}`;

  before(() => {
    // Seed sessions so the JOIN in /compactions hydrates name fields.
    stmts.insertSession.run(SESSION_A, "Session A", "active", "/repo/a", "claude-opus", null);
    stmts.insertSession.run(SESSION_B, "Session B", "active", "/repo/b", "claude-opus", null);
    stmts.insertSession.run(SESSION_EMPTY, "Empty", "active", "/repo/e", "claude-opus", null);

    // Seed events. We control created_at by writing rows then back-stamping
    // them so the pairing logic has deterministic time ordering.
    function seedEvent(session, type, summary, data, createdAt) {
      stmts.insertEvent.run(
        session,
        null,
        type,
        null,
        summary,
        data ? JSON.stringify(data) : null
      );
      // Back-stamp the most recent row for this session/type.
      db.prepare(
        `UPDATE events SET created_at = ?
         WHERE id = (SELECT MAX(id) FROM events WHERE session_id = ? AND event_type = ?)`
      ).run(createdAt, session, type);
    }

    const t0 = Date.parse("2026-04-01T10:00:00.000Z");
    // Session A: a paired Pre/Post (10s apart) and one standalone Compaction.
    seedEvent(SESSION_A, "PreCompact", "pre #1", { trigger: "auto" }, new Date(t0).toISOString());
    seedEvent(
      SESSION_A,
      "PostCompact",
      "post #1",
      { ratio: 0.4 },
      new Date(t0 + 10_000).toISOString()
    );
    seedEvent(
      SESSION_A,
      "Compaction",
      "auto compaction detected",
      { compaction_number: 1, total_compactions: 1 },
      new Date(t0 + 60 * 60_000).toISOString()
    );

    // Session B: a Pre with no matching Post (out-of-window), and another
    // Pre/Post pair within window — exercises pendingByPost reset behaviour.
    seedEvent(SESSION_B, "PreCompact", "pre orphan", null, new Date(t0).toISOString());
    seedEvent(
      SESSION_B,
      "PostCompact",
      "post orphan",
      null,
      new Date(t0 + 5 * 60_000).toISOString() // 5min — out of window
    );
    seedEvent(
      SESSION_B,
      "PreCompact",
      "pre paired",
      null,
      new Date(t0 + 10 * 60_000).toISOString()
    );
    seedEvent(
      SESSION_B,
      "PostCompact",
      "post paired",
      null,
      new Date(t0 + 10 * 60_000 + 15_000).toISOString()
    );

    // Some non-compaction noise — must not appear in /compactions.
    seedEvent(
      SESSION_A,
      "PreToolUse",
      "Using tool: Read",
      null,
      new Date(t0 + 1_000).toISOString()
    );
    seedEvent(
      SESSION_A,
      "PostToolUse",
      "Tool completed: Read",
      null,
      new Date(t0 + 2_000).toISOString()
    );
  });

  after(() => {
    try {
      db.prepare("DELETE FROM events WHERE session_id IN (?, ?, ?)").run(
        SESSION_A,
        SESSION_B,
        SESSION_EMPTY
      );
      db.prepare("DELETE FROM sessions WHERE id IN (?, ?, ?)").run(
        SESSION_A,
        SESSION_B,
        SESSION_EMPTY
      );
    } catch {
      // best effort
    }
  });

  it("/compactions returns only compaction event types", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/compactions`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.events));
      // No PreToolUse/PostToolUse should leak through.
      for (const e of body.events) {
        assert.ok(
          ["PreCompact", "PostCompact", "Compaction"].includes(e.eventType),
          `unexpected event type ${e.eventType}`
        );
      }
      // Summary should reflect what we seeded for these two sessions.
      assert.ok(body.summary.total >= 7);
      assert.ok(body.summary.uniqueSessions >= 2);
      assert.ok(body.summary.preCompactCount >= 3);
      assert.ok(body.summary.postCompactCount >= 3);
      assert.ok(body.summary.compactionCount >= 1);
    });
  });

  it("/compactions hydrates session metadata via join", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/compactions?limit=500`);
      const body = await res.json();
      const aEvent = body.events.find((e) => e.sessionId === SESSION_A);
      assert.ok(aEvent, "expected session A to appear");
      assert.strictEqual(aEvent.sessionName, "Session A");
      assert.strictEqual(aEvent.sessionStatus, "active");
    });
  });

  it("/compactions caps limit at 500 and rejects bogus values gracefully", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const r1 = await fetch(`${base}/api/context/compactions?limit=99999`);
      const b1 = await r1.json();
      assert.strictEqual(b1.limit, 500);

      const r2 = await fetch(`${base}/api/context/compactions?limit=junk`);
      const b2 = await r2.json();
      assert.strictEqual(b2.limit, 100); // default
    });
  });

  it("/compactions/:sessionId pairs Pre/Post within 60s", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/compactions/${SESSION_A}`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.sessionId, SESSION_A);
      // 1 PreCompact + 1 PostCompact + 1 Compaction = 3 events
      assert.strictEqual(body.events.length, 3);
      const pre = body.events.find((e) => e.eventType === "PreCompact");
      const post = body.events.find((e) => e.eventType === "PostCompact");
      assert.ok(pre.pairId, "PreCompact should be paired");
      assert.strictEqual(pre.pairId, post.pairId, "Pre/Post must share a pairId");
    });
  });

  it("/compactions/:sessionId leaves out-of-window Pre orphaned", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/compactions/${SESSION_B}`);
      const body = await res.json();
      // Two Pre + two Post = 4 events. Pre #1 + Post #1 are 5 minutes apart
      // (out of window) so neither gets a pairId. Pre #2 + Post #2 are 15s
      // apart so they share one.
      const orphanPre = body.events.find(
        (e) => e.eventType === "PreCompact" && e.summary === "pre orphan"
      );
      const pairedPre = body.events.find(
        (e) => e.eventType === "PreCompact" && e.summary === "pre paired"
      );
      const pairedPost = body.events.find(
        (e) => e.eventType === "PostCompact" && e.summary === "post paired"
      );
      assert.strictEqual(orphanPre.pairId, null);
      assert.ok(pairedPre.pairId);
      assert.strictEqual(pairedPre.pairId, pairedPost.pairId);
    });
  });

  it("/compactions/:sessionId returns empty list for unknown session", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/compactions/${SESSION_EMPTY}`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body.events, []);
      assert.strictEqual(body.count, 0);
    });
  });

  it("/compactions/:sessionId rejects invalid session IDs", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(
        `${base}/api/context/compactions/${encodeURIComponent("foo$bar")}`
      );
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "invalid sessionId");
    });
  });

  it("/sessions/:sessionId/budget returns event counts grouped by type", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/sessions/${SESSION_A}/budget`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.sessionId, SESSION_A);
      assert.ok(body.eventCounts.PreCompact >= 1);
      assert.ok(body.eventCounts.PostCompact >= 1);
      assert.ok(body.eventCounts.Compaction >= 1);
      assert.ok(body.eventCounts.PreToolUse >= 1);
      assert.strictEqual(body.compactionEvents, 3);
      assert.ok(body.totalEvents >= 5);
      assert.ok(typeof body.note === "string");
    });
  });

  it("/sessions/:sessionId/budget handles a session with no events", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(`${base}/api/context/sessions/${SESSION_EMPTY}/budget`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body.eventCounts, {});
      assert.strictEqual(body.totalEvents, 0);
      assert.strictEqual(body.compactionEvents, 0);
    });
  });

  it("/sessions/:sessionId/budget rejects invalid session IDs", async () => {
    await withApp({ ORCHESTRATOR_ENABLED: "1" }, async (base) => {
      const res = await fetch(
        `${base}/api/context/sessions/${encodeURIComponent("foo$bar")}/budget`
      );
      assert.strictEqual(res.status, 400);
    });
  });
});

// Cleanup tmp DB at the end of the test process.
process.on("exit", () => {
  try {
    fs.rmSync(TEST_DB, { force: true });
    fs.rmSync(TEST_DB + "-wal", { force: true });
    fs.rmSync(TEST_DB + "-shm", { force: true });
  } catch {
    // best effort
  }
});
