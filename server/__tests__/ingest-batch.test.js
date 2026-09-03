/**
 * @file Tests for POST /api/hooks/ingest-batch — bulk ingestion for a future
 * remote/household forwarder that has been collecting hook-derived facts
 * (whole-file token totals, tool events, turn durations, subagent
 * completions) about a session whose JSONL transcript lives on another
 * machine's disk. Mirrors the setup/request-helper pattern in
 * remote-subagent-synth.test.js: in-process server, temp CLAUDE_HOME/DATA_DIR,
 * sessions seeded via the real SessionStart hook path (so the route is
 * exercised the way a real forwarder would hit it — session already known,
 * transcript unreadable on this host).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { SCHEMA_VERSION } = require("../lib/transcript-line-classifier");

const STAMP = `ingest-batch-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;

let server;
let BASE;

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(b || "{}");
          } catch {
            parsed = b;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// A path guaranteed not to exist on this host — stands in for a remote
// machine's transcript that this monitor cannot read.
const UNREADABLE = "C:\\Users\\matsp\\.claude\\projects\\enc\\does-not-exist.jsonl";
const WIN_CWD = "C:\\Users\\matsp\\chats\\ingest-batch-session";

let seq = 0;
function sid() {
  seq++;
  return `30000000-0000-0000-0000-${String(seq).padStart(12, "0")}`;
}

/** Create a session (+ main agent) via the real SessionStart hook path, transcript unreadable here. */
async function seedSession(sessionId, transcriptPath = UNREADABLE) {
  await req("POST", "/api/hooks/event", {
    hook_type: "SessionStart",
    data: { session_id: sessionId, cwd: WIN_CWD, transcript_path: transcriptPath },
  });
}

function tokenRow(sessionId, model) {
  return db
    .prepare(
      "SELECT * FROM token_usage WHERE session_id = ? AND model = ? AND speed = 'standard' AND inference_geo = 'global' AND service_tier = 'standard'"
    )
    .get(sessionId, model);
}

function effectiveInput(row) {
  return (row?.input_tokens || 0) + (row?.baseline_input || 0);
}

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("POST /api/hooks/ingest-batch", () => {
  it("404s when the session is unknown (never calls ensureSession itself)", async () => {
    const id = sid();
    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tokens: [],
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "UNKNOWN_SESSION");
  });

  it("409s on a schema_version mismatch", async () => {
    const id = sid();
    await seedSession(id);
    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: "999",
      tokens: [],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "SCHEMA_VERSION_MISMATCH");
  });

  it("409s (skips) when the transcript IS readable on this host — local pipeline owns it", async () => {
    const id = sid();
    await seedSession(id);
    const localPath = path.join(TMP, `${id}.jsonl`);
    fs.writeFileSync(localPath, "{}\n");
    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: localPath,
      schema_version: SCHEMA_VERSION,
      tokens: [{ model: "claude-x", input: 100 }],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "LOCAL_TRANSCRIPT_OWNS_SESSION");
    assert.equal(tokenRow(id, "claude-x"), undefined, "no token row should have been written");
  });

  it("404s UNKNOWN_MAIN_AGENT when the session exists but has no main agent row (POST /api/sessions path), and does not partially write the batch", async () => {
    const id = sid();
    // Bypass SessionStart entirely — this is the pre-existing route that
    // creates a session row without ever inserting the `${id}-main` agent
    // row (server/routes/sessions.js POST / calls insertSession only).
    const created = await req("POST", "/api/sessions", { id, cwd: WIN_CWD });
    assert.equal(created.status, 201);
    assert.equal(stmts.getAgent.get(`${id}-main`), undefined, "test setup: no main agent expected");

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tokens: [{ model: "claude-orphan-session", input: 10 }],
      tool_events: [{ uuid: "orphan-evt-1", tool_name: "Read" }],
    });

    // Contract: a structured JSON error, never Express' default HTML 500 —
    // and specifically not a 500 at all, since this is now caught before
    // the transaction runs.
    assert.equal(res.status, 404);
    assert.equal(typeof res.body, "object", "response must be parsed JSON, not raw HTML");
    assert.equal(res.body.error.code, "UNKNOWN_MAIN_AGENT");

    // Nothing from the batch should have landed — not even the valid token
    // row that preceded the (formerly) transaction-killing tool_event.
    assert.equal(tokenRow(id, "claude-orphan-session"), undefined);
    const toolCount = db
      .prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'ToolEvent'")
      .get(id).c;
    assert.equal(toolCount, 0);
  });

  it("maps an unexpected DB-constraint failure inside the transaction (e.g. a bogus tool_event.agent_id) to a structured 500, not HTML — session DOES have a main agent here", async () => {
    const id = sid();
    await seedSession(id); // main agent exists — the UNKNOWN_MAIN_AGENT gate does not fire

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tool_events: [{ uuid: "bad-agent-evt", agent_id: "no-such-agent-row", tool_name: "Bash" }],
    });

    assert.equal(res.status, 500);
    assert.equal(typeof res.body, "object", "response must be parsed JSON, not raw HTML");
    assert.equal(res.body.error.code, "INGEST_BATCH_FAILED");

    const toolCount = db
      .prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'ToolEvent'")
      .get(id).c;
    assert.equal(toolCount, 0, "the failed transaction must not have partially written");
  });

  it("400s when transcript_path is missing", async () => {
    const id = sid();
    await seedSession(id);
    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      schema_version: SCHEMA_VERSION,
      tokens: [],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("token replace is idempotent (high-water mark): same totals twice → unchanged; larger totals → updated", async () => {
    const id = sid();
    await seedSession(id);
    const model = "claude-ingest-test";

    const batch1 = {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tokens: [{ model, input: 1000, output: 200, cacheRead: 50 }],
    };
    let res = await req("POST", "/api/hooks/ingest-batch", batch1);
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(effectiveInput(tokenRow(id, model)), 1000);

    // Re-post the exact same totals — high-water-mark replace means the
    // effective value must not grow (would double-count a whole-file total).
    res = await req("POST", "/api/hooks/ingest-batch", batch1);
    assert.equal(res.status, 200);
    assert.equal(effectiveInput(tokenRow(id, model)), 1000);

    // Larger totals (transcript grew) → the row updates to the new total.
    const batch2 = {
      ...batch1,
      tokens: [{ model, input: 2500, output: 400, cacheRead: 50 }],
    };
    res = await req("POST", "/api/hooks/ingest-batch", batch2);
    assert.equal(res.status, 200);
    assert.equal(effectiveInput(tokenRow(id, model)), 2500);
  });

  it("dedupes tool_events by uuid — a redelivered item is a no-op", async () => {
    const id = sid();
    await seedSession(id);
    const item = {
      uuid: "tool-evt-1",
      tool_name: "Bash",
      status: "completed",
      timestamp: new Date().toISOString(),
    };

    let res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tool_events: [item],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tool_events: [item],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0, "redelivered tool_event should not be re-inserted");

    const count = db
      .prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'ToolEvent'")
      .get(id).c;
    assert.equal(count, 1);
  });

  it("dedupes turns by uuid — a redelivered item is a no-op", async () => {
    const id = sid();
    await seedSession(id);
    const item = { uuid: "turn-1", duration_ms: 4200, timestamp: new Date().toISOString() };

    let res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      turns: [item],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      turns: [item],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0);

    const count = db
      .prepare(
        "SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'TurnDuration'"
      )
      .get(id).c;
    assert.equal(count, 1);
  });

  it("subagent idempotency — same agent_id twice creates exactly one row, type='subagent' satisfies the CHECK constraint", async () => {
    const id = sid();
    await seedSession(id);
    const sub = {
      agent_id: "sub-batch-1",
      agent_type: "code-reviewer",
      last_assistant_message: "Reviewed the diff.",
      prompt: "Review this diff",
    };

    let res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      subagents: [sub],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      subagents: [sub],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 0, "redelivered subagent should not count as written");

    const rows = db
      .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'subagent'")
      .all(id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, `${id}-sub-sub-batch-1`);
    assert.equal(rows[0].type, "subagent");
    assert.equal(rows[0].status, "completed");
    assert.equal(rows[0].name, "code-reviewer");
    assert.equal(rows[0].subagent_type, "code-reviewer");
    assert.ok(rows[0].ended_at);
  });

  it("per-item soft-fail: invalid items are reported and skipped, valid items in the same batch still land", async () => {
    const id = sid();
    await seedSession(id);

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tokens: [{ model: "claude-soft-fail-ok", input: 10 }, { input: 10 /* missing model */ }],
      tool_events: [
        { uuid: "soft-ok-1", tool_name: "Read" },
        { tool_name: "NoUuid" /* missing uuid */ },
      ],
      turns: [{ uuid: "soft-ok-turn", duration_ms: 100 }, { duration_ms: 100 /* missing uuid */ }],
      subagents: [
        { agent_id: "soft-ok-sub" },
        { last_assistant_message: "no agent_id" /* missing agent_id */ },
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.failed, 4);
    assert.equal(res.body.errors.length, 4);
    assert.equal(res.body.written, 4);

    assert.ok(tokenRow(id, "claude-soft-fail-ok"));
    const toolCount = db
      .prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'ToolEvent'")
      .get(id).c;
    assert.equal(toolCount, 1);
    const turnCount = db
      .prepare(
        "SELECT COUNT(*) AS c FROM events WHERE session_id = ? AND event_type = 'TurnDuration'"
      )
      .get(id).c;
    assert.equal(turnCount, 1);
    assert.ok(stmts.getAgent.get(`${id}-sub-soft-ok-sub`));
  });

  it("sets session.model via the same last-write-wins mechanism as the local pipeline", async () => {
    const id = sid();
    await seedSession(id);
    assert.equal(stmts.getSession.get(id).model, null);

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      model: "claude-opus-4-6",
    });
    assert.equal(res.status, 200);
    assert.equal(stmts.getSession.get(id).model, "claude-opus-4-6");
  });

  it("merges usage_extras/thinking_blocks into sessions.metadata in the exact local-pipeline shape", async () => {
    const id = sid();
    await seedSession(id);

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      usage_extras: {
        service_tiers: ["standard"],
        speeds: ["standard"],
        inference_geos: [],
        thinking_blocks: 4,
      },
    });
    assert.equal(res.status, 200);

    const meta = JSON.parse(stmts.getSession.get(id).metadata);
    assert.deepEqual(meta, {
      usage_extras: { service_tiers: ["standard"], speeds: ["standard"], inference_geos: [] },
      thinking_blocks: 4,
    });
  });

  it("usage_extras merge does not clobber other metadata keys", async () => {
    const id = sid();
    await seedSession(id);

    // Seed an unrelated metadata key the way the local pipeline would
    // (e.g. turn_count from the transcript-driven path).
    const existing = { turn_count: 7, total_turn_duration_ms: 12345 };
    stmts.updateSession.run(null, null, null, JSON.stringify(existing), id);

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      usage_extras: { service_tiers: ["batch"], speeds: [], inference_geos: ["us"] },
    });
    assert.equal(res.status, 200);

    const meta = JSON.parse(stmts.getSession.get(id).metadata);
    assert.equal(meta.turn_count, 7);
    assert.equal(meta.total_turn_duration_ms, 12345);
    assert.deepEqual(meta.usage_extras, {
      service_tiers: ["batch"],
      speeds: [],
      inference_geos: ["us"],
    });
  });

  it("model + usage_extras are idempotent — reposting the same values twice yields the same state", async () => {
    const id = sid();
    await seedSession(id);
    const payload = {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      model: "claude-sonnet-5",
      usage_extras: {
        service_tiers: ["standard"],
        speeds: ["fast"],
        inference_geos: ["us"],
        thinking_blocks: 2,
      },
    };

    await req("POST", "/api/hooks/ingest-batch", payload);
    const after1 = stmts.getSession.get(id);
    await req("POST", "/api/hooks/ingest-batch", payload);
    const after2 = stmts.getSession.get(id);

    assert.equal(after1.model, "claude-sonnet-5");
    assert.equal(after2.model, "claude-sonnet-5");
    assert.deepEqual(JSON.parse(after1.metadata), JSON.parse(after2.metadata));
    assert.equal(JSON.parse(after2.metadata).thinking_blocks, 2);
  });

  it("omitting model/usage_extras leaves session.model and metadata unchanged", async () => {
    const id = sid();
    await seedSession(id);
    stmts.updateSessionModel.run("pre-existing-model", id, "pre-existing-model");
    stmts.updateSession.run(null, null, null, JSON.stringify({ turn_count: 3 }), id);

    const res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      tokens: [{ model: "claude-x", input: 5 }],
    });
    assert.equal(res.status, 200);

    const session = stmts.getSession.get(id);
    assert.equal(session.model, "pre-existing-model");
    assert.deepEqual(JSON.parse(session.metadata), { turn_count: 3 });
  });

  it("400s on invalid model/usage_extras types", async () => {
    const id = sid();
    await seedSession(id);

    let res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      model: 42,
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      usage_extras: "not-an-object",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      usage_extras: { service_tiers: "standard" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");

    res = await req("POST", "/api/hooks/ingest-batch", {
      session_id: id,
      transcript_path: UNREADABLE,
      schema_version: SCHEMA_VERSION,
      usage_extras: { thinking_blocks: -1 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });
});
