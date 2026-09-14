/**
 * @file Tests for POST /api/hooks/ingest-batch — the third session-data
 * ingestion path (alongside the local hook and the SSH-pull remote-sync
 * path): a roaming/NAT'd machine the dashboard can never reach pushes a
 * batch of its own session data to us over HTTPS instead.
 *
 * Covers, per the route's spec: the extra "token must be configured" gate on
 * top of hookGuard (503 vs hookGuard's own 401), the remote-push `source`
 * sentinel + provider validation, the ownership hijack guard (a pushed
 * session_id must never be able to write into a locally-owned session), uuid
 * dedup (both across requests and within a single batch), per-item soft-fail
 * validation (numeric fields, cacheWrite1h <= cacheWrite, agent_id must
 * belong to the target session), explicit-timestamp persistence, and
 * schema_version mismatch as a whole-request 409.
 *
 * All requests go through the real HTTP route (createApp()/startServer()),
 * not internal function calls — a direct function-call test would pass even
 * if the Express-level auth/routing wiring were broken.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const STAMP = `ingest-batch-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
// Keep the watchdog's real liveness probe inert for the duration of this
// suite (mirrors server/__tests__/session-liveness.test.js).
process.env.DASHBOARD_LIVENESS_PROBE = "0";
fs.mkdirSync(TMP, { recursive: true });

const { createApp, startServer } = require("../index");
const { closeWebSocket } = require("../websocket");
const { db, stmts } = require("../db");
const { normalizeSpeed, normalizeGeo, normalizeTier } = require("../lib/token-usage");
const WebSocket = require("ws");

const TOKEN = "test-ingest-batch-token-xyz";

let server;
let BASE;
let WS_BASE;

before(async () => {
  const app = createApp();
  // startServer() already wires up the WebSocket server internally
  // (initWebSocket(server)) — calling it again ourselves double-registers the
  // 'upgrade' handler and throws inside `ws`.
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
  WS_BASE = `ws://127.0.0.1:${server.address().port}/ws`;
});

after(() => {
  closeWebSocket();
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

beforeEach(() => {
  process.env.REMOTE_PUSH_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.REMOTE_PUSH_TOKEN;
  delete process.env.REMOTE_PUSH_TOKEN_FILE;
});

async function post(body, { token = TOKEN } = {}) {
  const headers = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}/api/hooks/ingest-batch`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    /* no body */
  }
  return { status: response.status, body: json };
}

function newSessionId(label) {
  return `ingest-${label}-${crypto.randomUUID()}`;
}

function toolEventPayload(overrides = {}) {
  return { uuid: crypto.randomUUID(), tool_name: "Bash", status: "success", ...overrides };
}

function turnPayload(overrides = {}) {
  return { uuid: crypto.randomUUID(), duration_ms: 1500, ...overrides };
}

function rawEventsFor(sessionId) {
  return db.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY id").all(sessionId);
}

function rawTokenRows(sessionId) {
  return db.prepare("SELECT * FROM token_usage WHERE session_id = ?").all(sessionId);
}

describe("POST /api/hooks/ingest-batch", () => {
  it("responds 503 when REMOTE_PUSH_TOKEN is not configured at all", async () => {
    delete process.env.REMOTE_PUSH_TOKEN;
    delete process.env.REMOTE_PUSH_TOKEN_FILE;
    const sessionId = newSessionId("no-token");
    const res = await post({ session_id: sessionId, provider: "claude" }, { token: undefined });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, "REMOTE_PUSH_NOT_CONFIGURED");
    assert.equal(stmts.getSession.get(sessionId), undefined, "no session was created");
  });

  it("setting DASHBOARD_HOOK_TOKEN alone (hardening the local hook) does NOT enable this route", async () => {
    // The exact scenario the maintainer flagged on PR #329: an operator who
    // sets DASHBOARD_HOOK_TOKEN to protect the loopback local hook must not
    // thereby also open this internet-reachable route as a side effect.
    delete process.env.REMOTE_PUSH_TOKEN;
    delete process.env.REMOTE_PUSH_TOKEN_FILE;
    process.env.DASHBOARD_HOOK_TOKEN = "some-other-token-for-the-local-hook";
    try {
      const sessionId = newSessionId("hook-token-only");
      const res = await post(
        { session_id: sessionId, provider: "claude" },
        { token: "some-other-token-for-the-local-hook" }
      );
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, "REMOTE_PUSH_NOT_CONFIGURED");
    } finally {
      delete process.env.DASHBOARD_HOOK_TOKEN;
    }
  });

  it("responds 401 for a wrong token when a token IS configured", async () => {
    const sessionId = newSessionId("wrong-token");
    const res = await post(
      { session_id: sessionId, provider: "claude" },
      { token: "definitely-not-the-token" }
    );
    assert.equal(res.status, 401);
    assert.equal(stmts.getSession.get(sessionId), undefined, "no session was created");
  });

  it("rejects a correct token sent only as ?token= -- a public-internet route must not accept a query-string credential", async () => {
    // Deliberately not using the post() helper (which always sends
    // Authorization) -- this needs to send NO Authorization header at all.
    const sessionId = newSessionId("query-token");
    const response = await fetch(
      `${BASE}/api/hooks/ingest-batch?token=${encodeURIComponent(TOKEN)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, provider: "claude" }),
      }
    );
    assert.equal(response.status, 401);
    assert.equal(stmts.getSession.get(sessionId), undefined, "no session was created");
  });

  it("rejects a malformed uuid on tool_events/turns instead of persisting it", async () => {
    const sessionId = newSessionId("bad-uuid");
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [toolEventPayload({ uuid: "not-a-uuid" })],
      turns: [turnPayload({ uuid: "also-not-a-uuid" })],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0);
    assert.deepEqual(
      res.body.errors.map((e) => e.code),
      ["INVALID_UUID", "INVALID_UUID"]
    );
    assert.equal(rawEventsFor(sessionId).length, 0, "malformed-uuid items must not be persisted");
  });

  it("creates a new session with the remote-push source sentinel + validated provider", async () => {
    const sessionId = newSessionId("create");
    const res = await post({
      session_id: sessionId,
      provider: "codex",
      session_name: "My roaming laptop session",
      cwd: "/home/bap/work",
      model: "gpt-5.6",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const session = stmts.getSession.get(sessionId);
    assert.ok(session, "session row was created");
    assert.equal(session.source, "remote_push");
    assert.equal(session.provider, "codex");
    assert.equal(session.name, "My roaming laptop session");
    assert.equal(session.cwd, "/home/bap/work");
    assert.equal(session.model, "gpt-5.6");
    assert.equal(session.status, "active");

    const mainAgent = stmts.getAgent.get(`${sessionId}-main`);
    assert.ok(mainAgent, "main agent was created alongside the session");
    assert.equal(mainAgent.session_id, sessionId);
  });

  it("rejects an oversized batch with 413, before creating a session or doing any DB work", async () => {
    const sessionId = newSessionId("too-large");
    const tooMany = Array.from({ length: 1001 }, () => toolEventPayload());
    const res = await post({ session_id: sessionId, provider: "claude", tool_events: tooMany });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "BATCH_TOO_LARGE");
    assert.equal(stmts.getSession.get(sessionId), undefined, "no session was created");
    assert.equal(rawEventsFor(sessionId).length, 0);
  });

  it("accepts a batch exactly at the item limit", async () => {
    const sessionId = newSessionId("at-limit");
    const exactly1000 = Array.from({ length: 1000 }, () => toolEventPayload());
    const res = await post({ session_id: sessionId, provider: "claude", tool_events: exactly1000 });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1000);
  });

  it("rejects an invalid provider with 400 and creates nothing", async () => {
    const sessionId = newSessionId("bad-provider");
    const res = await post({ session_id: sessionId, provider: "gemini" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_PROVIDER");
    assert.equal(stmts.getSession.get(sessionId), undefined);
  });

  it("SCHEMA_VERSION_MISMATCH is a whole-request 409, before any other processing", async () => {
    const sessionId = newSessionId("schema-mismatch");
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      schema_version: 999,
      tokens: [{ model: "claude-opus-5", input: 10 }],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "SCHEMA_VERSION_MISMATCH");
    assert.equal(stmts.getSession.get(sessionId), undefined, "nothing was written");
  });

  it("never lets a pushed session_id hijack a locally-owned session", async () => {
    // Seed a session directly with source='local', simulating a session this
    // dashboard's own local hook is actively managing (the exact scenario
    // that sank PR #321).
    const sessionId = newSessionId("hijack");
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sessions (id, name, status, cwd, model, provider, source, started_at, updated_at)
       VALUES (?, 'Locally owned session', 'active', '/local/cwd', 'claude-opus-5', 'claude', 'local', ?, ?)`
    ).run(sessionId, now, now);
    db.prepare(
      `INSERT INTO agents (id, session_id, name, type, status, started_at, updated_at)
       VALUES (?, ?, 'Main Agent', 'main', 'working', ?, ?)`
    ).run(`${sessionId}-main`, sessionId, now, now);

    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tokens: [{ model: "claude-opus-5", input: 999, output: 999 }],
      tool_events: [toolEventPayload()],
      turns: [turnPayload()],
    });

    assert.equal(res.status, 200, "a hijack attempt is a soft-fail, not a hard error");
    assert.equal(res.body.written, 0);
    assert.equal(res.body.errors.length, 3, "one error per item across all three arrays");
    for (const err of res.body.errors) {
      assert.equal(err.code, "SESSION_LOCALLY_OWNED");
    }

    // Verify against actual DB state, not just the response.
    const session = stmts.getSession.get(sessionId);
    assert.equal(session.source, "local", "ownership column untouched");
    assert.equal(session.name, "Locally owned session", "metadata untouched");
    assert.equal(session.model, "claude-opus-5", "metadata untouched");
    assert.equal(rawEventsFor(sessionId).length, 0, "no events were written");
    assert.equal(rawTokenRows(sessionId).length, 0, "no token_usage rows were written");
  });

  it("dedups by uuid across two separate requests (idempotent resend)", async () => {
    const sessionId = newSessionId("dedup-cross-request");
    const ev = toolEventPayload();
    const tn = turnPayload();

    const first = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [ev],
      turns: [tn],
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.written, 2);
    assert.equal(first.body.skipped, 0);

    // Re-send the exact same batch.
    const second = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [ev],
      turns: [tn],
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.written, 0, "nothing new was written on the resend");
    assert.equal(second.body.skipped, 2);

    const rows = rawEventsFor(sessionId);
    const toolRows = rows.filter((r) => r.event_type === "RemoteToolEvent");
    const turnRows = rows.filter((r) => r.event_type === "RemoteTurn");
    assert.equal(toolRows.length, 1, "no duplicate tool_event row");
    assert.equal(turnRows.length, 1, "no duplicate turn row");
  });

  it("dedups by uuid WITHIN a single batch (same uuid sent twice in one request)", async () => {
    const sessionId = newSessionId("dedup-in-batch");
    const ev = toolEventPayload();

    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [ev, { ...ev }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(res.body.skipped, 1);
    assert.equal(
      rawEventsFor(sessionId).filter((r) => r.event_type === "RemoteToolEvent").length,
      1
    );
  });

  it("rejects a foreign-session agent_id per-item without rolling back other valid items", async () => {
    const sessionA = newSessionId("owner-a");
    const sessionB = newSessionId("owner-b");
    await post({ session_id: sessionA, provider: "claude" });
    await post({ session_id: sessionB, provider: "claude" });

    const validEvent = toolEventPayload();
    const foreignAgentEvent = toolEventPayload({ agent_id: `${sessionB}-main` });

    const res = await post({
      session_id: sessionA,
      provider: "claude",
      tool_events: [validEvent, foreignAgentEvent],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1, "the valid item was written despite the invalid one");
    assert.equal(res.body.errors.length, 1);
    assert.equal(res.body.errors[0].item, "tool_events[1]");
    assert.equal(res.body.errors[0].code, "UNKNOWN_AGENT");

    const rows = rawEventsFor(sessionA).filter((r) => r.event_type === "RemoteToolEvent");
    assert.equal(rows.length, 1);
    assert.equal(JSON.parse(rows[0].data).uuid, validEvent.uuid);
  });

  it("rejects negative/fractional token counters per-item, valid items in the same batch still written", async () => {
    const sessionId = newSessionId("bad-numeric");
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tokens: [
        { model: "claude-opus-5", input: -5, output: 10 },
        { model: "claude-opus-5", input: 3.5, output: 10 },
        { model: "claude-sonnet-5", input: 100, output: 50 },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(res.body.errors.length, 2);
    assert.equal(res.body.errors[0].item, "tokens[0]");
    assert.equal(res.body.errors[0].code, "INVALID_NUMERIC");
    assert.equal(res.body.errors[1].item, "tokens[1]");
    assert.equal(res.body.errors[1].code, "INVALID_NUMERIC");

    const rows = rawTokenRows(sessionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].model, "claude-sonnet-5");
    assert.equal(rows[0].input_tokens, 100);
  });

  it("rejects unsafe-integer token/duration values per-item (Number.isInteger alone would pass these)", async () => {
    const sessionId = newSessionId("unsafe-integer");
    const unsafe = Number.MAX_SAFE_INTEGER + 2; // still Number.isInteger(unsafe) === true
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tokens: [{ model: "claude-opus-5", input: unsafe, output: 10 }],
      turns: [turnPayload({ duration_ms: unsafe })],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0);
    assert.equal(res.body.errors.length, 2);
    assert.equal(res.body.errors[0].item, "tokens[0]");
    assert.equal(res.body.errors[0].code, "INVALID_NUMERIC");
    assert.equal(res.body.errors[1].item, "turns[0]");
    assert.equal(res.body.errors[1].code, "INVALID_NUMERIC");
    assert.equal(rawTokenRows(sessionId).length, 0);
  });

  it("rejects cacheWrite1h > cacheWrite", async () => {
    const sessionId = newSessionId("cache-1h-overflow");
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tokens: [{ model: "claude-opus-5", cacheWrite: 100, cacheWrite1h: 150 }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0);
    assert.equal(res.body.errors.length, 1);
    assert.equal(res.body.errors[0].code, "CACHE_WRITE_1H_EXCEEDS_TOTAL");
    assert.equal(rawTokenRows(sessionId).length, 0);
  });

  it("persists an explicit tool_event timestamp into created_at exactly (not server 'now')", async () => {
    const sessionId = newSessionId("timestamp");
    const explicitTs = "2020-01-01T00:00:00.000Z"; // already ms-precision ISO
    const ev = toolEventPayload({ timestamp: explicitTs });

    const res = await post({ session_id: sessionId, provider: "claude", tool_events: [ev] });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    const rows = rawEventsFor(sessionId).filter((r) => r.event_type === "RemoteToolEvent");
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].created_at,
      explicitTs,
      "stored created_at must equal the supplied timestamp, not ingestion wall-clock time"
    );
  });

  it("broadcasts the SAME created_at it persisted (no live-client vs REST divergence)", async () => {
    // The exact regression PR #321 was flagged for: the old code broadcast the
    // remote timestamp but always persisted server "now". Connect a real WS
    // client and assert the frame's created_at against the persisted row.
    const ws = new WebSocket(WS_BASE);
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });

    const frames = [];
    ws.on("message", (raw) => {
      try {
        frames.push(JSON.parse(raw.toString()));
      } catch {
        /* ignore */
      }
    });

    const sessionId = newSessionId("ws-parity");
    const explicitTs = "2021-06-15T08:30:00.000Z";
    const ev = toolEventPayload({ timestamp: explicitTs });

    const res = await post({ session_id: sessionId, provider: "claude", tool_events: [ev] });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    // Give the WS frame a moment to arrive (same-process broadcast is
    // synchronous server-side, but delivery to this client is a real socket
    // round-trip).
    await new Promise((resolve) => setTimeout(resolve, 200));
    ws.close();

    const frame = frames.find(
      (f) => f.type === "new_event" && f.data && f.data.session_id === sessionId
    );
    assert.ok(frame, "a new_event frame for this session was broadcast");
    assert.equal(frame.data.event_type, "RemoteToolEvent");

    const stored = rawEventsFor(sessionId).find((r) => r.event_type === "RemoteToolEvent");
    assert.ok(stored, "the row was actually persisted");
    assert.equal(
      frame.data.created_at,
      stored.created_at,
      "the broadcast created_at must match the persisted row exactly"
    );
    assert.equal(frame.data.created_at, explicitTs, "and both must match the supplied timestamp");
  });

  it("rejects a malformed timestamp per-item (missing timestamp is fine, invalid one is not)", async () => {
    const sessionId = newSessionId("bad-timestamp");
    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [
        toolEventPayload({ timestamp: "not-a-real-date" }),
        toolEventPayload(), // no timestamp — falls back to server "now", must succeed
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(res.body.errors.length, 1);
    assert.equal(res.body.errors[0].item, "tool_events[0]");
    assert.equal(res.body.errors[0].code, "INVALID_TIMESTAMP");
  });

  it("writes a token bucket matching local-hook parity: context_size='short' + normalized speed/geo/tier", async () => {
    const sessionId = newSessionId("token-parity");
    const rawEntry = {
      model: "claude-opus-5",
      speed: "fast",
      inference_geo: "us",
      service_tier: "batch",
      input: 1000,
      output: 200,
      cacheRead: 50,
      cacheWrite: 30,
      cacheWrite1h: 10,
      webSearch: 2,
      webFetch: 1,
      codeExec: 0,
    };
    const res = await post({ session_id: sessionId, provider: "claude", tokens: [rawEntry] });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    const rows = rawTokenRows(sessionId);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(
      row.context_size,
      "short",
      "must match the hardcoded literal in replaceTokenUsage"
    );
    assert.equal(row.speed, normalizeSpeed({ speed: rawEntry.speed }));
    assert.equal(row.inference_geo, normalizeGeo({ inference_geo: rawEntry.inference_geo }));
    assert.equal(row.service_tier, normalizeTier({ service_tier: rawEntry.service_tier }));
    assert.equal(row.input_tokens, 1000);
    assert.equal(row.output_tokens, 200);
    assert.equal(row.cache_read_tokens, 50);
    assert.equal(row.cache_write_tokens, 30);
    assert.equal(row.cache_write_1h_tokens, 10);
    assert.equal(row.web_search_requests, 2);
    assert.equal(row.web_fetch_requests, 1);
    assert.equal(row.code_execution_requests, 0);
  });

  it("a follow-up batch for the same remote-push session proceeds normally (not treated as a hijack)", async () => {
    const sessionId = newSessionId("followup");
    const first = await post({
      session_id: sessionId,
      provider: "claude",
      tokens: [{ model: "claude-opus-5", input: 10 }],
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.written, 1);

    const second = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [toolEventPayload()],
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.written, 1);
    assert.equal(second.body.errors.length, 0);
    assert.equal(stmts.getSession.get(sessionId).source, "remote_push");
  });

  it("still records events when the target session's main agent row was lost (no FK-abort of the batch)", async () => {
    const sessionId = newSessionId("orphan-main-agent");
    const created = await post({ session_id: sessionId, provider: "claude" });
    assert.equal(created.status, 200);

    db.prepare("DELETE FROM agents WHERE id = ?").run(`${sessionId}-main`);
    assert.equal(stmts.getAgent.get(`${sessionId}-main`), undefined);

    const res = await post({
      session_id: sessionId,
      provider: "claude",
      tool_events: [toolEventPayload()],
      turns: [turnPayload()],
    });
    assert.equal(res.status, 200);
    assert.equal(
      res.body.written,
      2,
      "both items were written, not rolled back by a missing-agent FK error"
    );
    assert.equal(res.body.errors.length, 0);
    assert.ok(stmts.getAgent.get(`${sessionId}-main`), "the main agent row was recreated");
  });
});
