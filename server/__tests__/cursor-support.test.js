/**
 * @file cursor-support.test.js
 * @description Verifies chat-first Cursor discovery and prompt updates, native
 * history backfill, watcher latency, durable snapshots, subagent import, and
 * conversation rendering without duplicate prompt hand-off.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { before, after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const ROOT = path.join(os.tmpdir(), `cursor-support-${Date.now()}-${process.pid}`);
const CURSOR_HOME = path.join(ROOT, ".cursor");
const DATA_DIR = path.join(ROOT, "data");
const SESSION_ID = "1bace4f0-506a-436b-badd-16209a514803";
const CHAT_ONLY_ID = "2dedf943-0b42-4aa0-92d0-dd56e28bcae5";
const WATCHED_ID = "3eedf943-0b42-4aa0-92d0-dd56e28bcae6";
const TRANSCRIPT = path.join(
  CURSOR_HOME,
  "projects",
  "Users-example-project",
  "agent-transcripts",
  SESSION_ID,
  `${SESSION_ID}.jsonl`
);
const SUBAGENT_TRANSCRIPT = path.join(path.dirname(TRANSCRIPT), "subagents", "worker-a.jsonl");

process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = DATA_DIR;
process.env.DASHBOARD_CURSOR_HOME = CURSOR_HOME;
// Keep titles hermetic: never read the developer's real Cursor state.vscdb.
process.env.DASHBOARD_CURSOR_STATE_DB = path.join(ROOT, "state.vscdb");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
process.env.DASHBOARD_CURSOR_SYNC_MS = "0";

const { createApp, startCursorSessionSync, startServer } = require("../index");
const { db, stmts } = require("../db");
const { healCursorOrphanAgents, syncCursorSessions } = require("../lib/cursor-ingest");

let server;
let base;

function jsonl(rows) {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, base);
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on("error", reject);
  });
}

async function waitUntil(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for Cursor filesystem sync");
}

before(async () => {
  fs.mkdirSync(path.dirname(TRANSCRIPT), { recursive: true });
  fs.writeFileSync(
    TRANSCRIPT,
    jsonl([
      {
        role: "user",
        message: {
          content: [
            {
              type: "text",
              text: "<timestamp>Friday, Sep 18, 2026, 9:02 PM (UTC-7)</timestamp>\n<user_query>Build the API</user_query>",
            },
          ],
        },
      },
      {
        role: "assistant",
        message: {
          content: [
            { type: "text", text: "I’ll inspect the project." },
            { type: "tool_use", id: "tool-1", name: "Read", input: { path: "README.md" } },
          ],
        },
      },
      { type: "turn_ended", status: "completed" },
    ])
  );
  fs.mkdirSync(path.dirname(SUBAGENT_TRANSCRIPT), { recursive: true });
  fs.writeFileSync(
    SUBAGENT_TRANSCRIPT,
    jsonl([
      { role: "user", message: { content: [{ type: "text", text: "Inspect routes" }] } },
      { role: "assistant", message: { content: [{ type: "text", text: "Done" }] } },
    ])
  );
  const chatDir = path.join(CURSOR_HOME, "chats", "workspace-a", SESSION_ID);
  fs.mkdirSync(chatDir, { recursive: true });
  fs.writeFileSync(
    path.join(chatDir, "meta.json"),
    JSON.stringify({
      createdAtMs: Date.parse("2026-09-19T04:02:00.000Z"),
      updatedAtMs: Date.parse("2026-09-19T04:20:00.000Z"),
      hasConversation: true,
      title: "Ship the backend",
      cwd: "/Users/example/project",
    })
  );
  fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify(["Build the API"]));

  const app = createApp();
  server = await startServer(app, 0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("Cursor local history", () => {
  it("backfills provider metadata, card context, subagents, and snapshots", async () => {
    // Reproduce a pre-v2.2.2 row created by Cursor's Claude-compatible hook:
    // the event existed, but CCAM had classified it as Claude and had only the
    // generic session/agent labels shown in the reported screenshot.
    stmts.insertSession.run(
      SESSION_ID,
      `Session ${SESSION_ID.slice(0, 8)}`,
      "active",
      null,
      "Grok 4.6",
      null
    );
    stmts.insertAgent.run(
      `${SESSION_ID}-main`,
      SESSION_ID,
      `Main Agent - Session ${SESSION_ID.slice(0, 8)}`,
      "main",
      null,
      "working",
      null,
      null,
      null
    );

    const result = await syncCursorSessions(require("../db"));
    assert.equal(result.filesScanned, 1);
    assert.equal(result.backfilled, 1);
    const session = stmts.getSession.get(SESSION_ID);
    assert.equal(session.provider, "cursor");
    assert.equal(session.name, "Ship the backend");
    assert.equal(session.cwd, "/Users/example/project");
    assert.equal(session.card_prompt_preview, "Build the API");
    assert.equal(JSON.parse(session.metadata).turn_count, 1);
    const agents = stmts.listAgentsBySession.all(SESSION_ID);
    assert.equal(agents.length, 2);
    assert.ok(agents.some((agent) => agent.name === "Cursor · Ship the backend"));
    assert.ok(agents.some((agent) => agent.task === "Inspect routes"));
    assert.ok(fs.existsSync(path.join(DATA_DIR, "cursor-transcripts", `${SESSION_ID}.jsonl`)));

    const unchanged = await syncCursorSessions(require("../db"));
    assert.equal(
      unchanged.skipped,
      1,
      "unchanged Cursor history should not be reparsed every poll"
    );

    fs.appendFileSync(
      SUBAGENT_TRANSCRIPT,
      jsonl([
        {
          role: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "sub-tool-1", name: "Read", input: { path: "app.js" } },
            ],
          },
        },
        { type: "turn_ended", status: "completed" },
      ])
    );
    const refreshedSubagent = await syncCursorSessions(require("../db"));
    assert.equal(refreshedSubagent.backfilled, 1);
    const subagent = stmts.getAgent.get(`${SESSION_ID}-cursor-worker-a`);
    assert.equal(subagent.status, "completed");
    assert.equal(JSON.parse(subagent.metadata).tool_count, 1);

    const stale = new Date(Date.now() - 11 * 60 * 1000);
    fs.utimesSync(TRANSCRIPT, stale, stale);
    const chatDir = path.join(CURSOR_HOME, "chats", "workspace-a", SESSION_ID);
    fs.writeFileSync(
      path.join(chatDir, "meta.json"),
      JSON.stringify({
        createdAtMs: Date.parse("2026-09-19T04:02:00.000Z"),
        updatedAtMs: stale.getTime(),
        hasConversation: true,
        title: "Ship the backend",
        cwd: "/Users/example/project",
      })
    );
    fs.utimesSync(path.join(chatDir, "meta.json"), stale, stale);
    fs.utimesSync(path.join(chatDir, "prompt_history.json"), stale, stale);
    fs.utimesSync(chatDir, stale, stale);
    const completed = await syncCursorSessions(require("../db"));
    assert.equal(completed.backfilled, 1);
    assert.equal(stmts.getSession.get(SESSION_ID).status, "completed");
    assert.equal(stmts.getAgent.get(`${SESSION_ID}-main`).status, "completed");

    fs.appendFileSync(TRANSCRIPT, jsonl([{ type: "turn_started" }]));
    const reactivated = await syncCursorSessions(require("../db"));
    assert.equal(reactivated.backfilled, 1);
    assert.equal(stmts.getSession.get(SESSION_ID).status, "active");
    assert.equal(stmts.getAgent.get(`${SESSION_ID}-main`).status, "waiting");
  });

  it("creates a session from chat metadata and surfaces a submitted prompt before JSONL", async () => {
    const chatDir = path.join(CURSOR_HOME, "chats", "workspace-a", CHAT_ONLY_ID);
    fs.mkdirSync(chatDir, { recursive: true });
    const launchedAt = Date.now();
    fs.writeFileSync(
      path.join(chatDir, "meta.json"),
      JSON.stringify({
        schemaVersion: 1,
        createdAtMs: launchedAt,
        updatedAtMs: launchedAt,
        hasConversation: false,
        cwd: "/Users/example/chat-only",
      })
    );

    const launched = await syncCursorSessions(require("../db"));
    assert.equal(launched.imported, 1);
    const session = stmts.getSession.get(CHAT_ONLY_ID);
    assert.equal(session.provider, "cursor");
    assert.equal(session.status, "active");
    assert.equal(session.transcript_path, null);
    assert.equal(stmts.getAgent.get(`${CHAT_ONLY_ID}-main`).status, "waiting");

    const prompt = "Explain the failing integration test";
    fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify([prompt]));
    fs.writeFileSync(
      path.join(chatDir, "meta.json"),
      JSON.stringify({
        schemaVersion: 1,
        createdAtMs: launchedAt,
        updatedAtMs: Date.now(),
        hasConversation: true,
        cwd: "/Users/example/chat-only",
      })
    );
    const submitted = await syncCursorSessions(require("../db"));
    assert.equal(submitted.backfilled, 1);
    assert.equal(stmts.getSession.get(CHAT_ONLY_ID).card_prompt_preview, prompt);
    assert.equal(stmts.getAgent.get(`${CHAT_ONLY_ID}-main`).status, "working");
    const promptEvents = stmts.listEventsBySession
      .all(CHAT_ONLY_ID)
      .filter((event) => event.event_type === "cursor_user_message");
    assert.equal(promptEvents.length, 1);
    assert.equal(promptEvents[0].summary, prompt);

    const conversation = await request(`/api/sessions/${CHAT_ONLY_ID}/transcript?limit=50`);
    assert.equal(conversation.status, 200);
    assert.equal(conversation.body.messages.length, 1);
    assert.equal(conversation.body.messages[0].id, "cursor-prompt:0");
    assert.equal(conversation.body.messages[0].content[0].text, prompt);

    const list = await request(`/api/sessions/${CHAT_ONLY_ID}/transcripts`);
    assert.deepEqual(
      list.body.transcripts.map((item) => item.id),
      ["main"]
    );

    const transcript = path.join(
      CURSOR_HOME,
      "projects",
      "Users-chat-only",
      "agent-transcripts",
      CHAT_ONLY_ID,
      `${CHAT_ONLY_ID}.jsonl`
    );
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(
      transcript,
      jsonl([
        { role: "user", message: { content: [{ type: "text", text: prompt }] } },
        { role: "assistant", message: { content: [{ type: "text", text: "I found it." }] } },
      ])
    );
    await syncCursorSessions(require("../db"));
    const handedOff = await request(`/api/sessions/${CHAT_ONLY_ID}/transcript?after=1&limit=50`);
    assert.equal(handedOff.body.refresh, true);
    assert.equal(handedOff.body.messages.length, 2);
    assert.equal(
      handedOff.body.messages.filter((message) => message.id === "cursor-prompt:0").length,
      1
    );
  });

  it("reacts to Cursor chat filesystem changes even when periodic polling is disabled", async () => {
    const broadcasts = [];
    const sync = startCursorSessionSync((type, data) => broadcasts.push({ type, data }), {
      dbModule: require("../db"),
      bootDelayMs: 0,
    });
    const chatDir = path.join(CURSOR_HOME, "chats", "workspace-a", WATCHED_ID);
    try {
      await sync.tick();
      fs.mkdirSync(chatDir, { recursive: true });
      const launchedAt = Date.now();
      fs.writeFileSync(
        path.join(chatDir, "meta.json"),
        JSON.stringify({
          schemaVersion: 1,
          createdAtMs: launchedAt,
          updatedAtMs: launchedAt,
          hasConversation: false,
          cwd: "/Users/example/watched",
        })
      );
      await waitUntil(() => !!stmts.getSession.get(WATCHED_ID));
      assert.ok(
        broadcasts.some(({ type, data }) => type === "session_created" && data.id === WATCHED_ID)
      );

      fs.writeFileSync(
        path.join(chatDir, "prompt_history.json"),
        JSON.stringify(["Implement the watcher fix"])
      );
      fs.writeFileSync(
        path.join(chatDir, "meta.json"),
        JSON.stringify({
          schemaVersion: 1,
          createdAtMs: launchedAt,
          updatedAtMs: Date.now(),
          hasConversation: true,
          cwd: "/Users/example/watched",
        })
      );
      await waitUntil(
        () => stmts.getSession.get(WATCHED_ID)?.card_prompt_preview === "Implement the watcher fix"
      );
      assert.equal(stmts.getAgent.get(`${WATCHED_ID}-main`).status, "working");
      assert.ok(
        broadcasts.some(({ type, data }) => type === "session_updated" && data.id === WATCHED_ID)
      );
      assert.ok(
        broadcasts.some(
          ({ type, data }) =>
            type === "new_event" &&
            data.session_id === WATCHED_ID &&
            data.event_type === "cursor_user_message"
        )
      );
    } finally {
      sync.close();
    }
  });

  it("renders Cursor conversation records and survives source cleanup", async () => {
    fs.rmSync(path.join(CURSOR_HOME, "projects"), { recursive: true, force: true });
    const response = await request(`/api/sessions/${SESSION_ID}/transcript?limit=50`);
    assert.equal(response.status, 200);
    assert.equal(response.body.messages.length, 2);
    assert.equal(response.body.messages[0].content[0].text, "Build the API");
    assert.equal(response.body.messages[0].timestamp, "2026-09-19T04:02:00.000Z");
    assert.equal(response.body.messages[1].content[1].name, "Read");

    const list = await request(`/api/sessions/${SESSION_ID}/transcripts`);
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body.transcripts.map((item) => item.id),
      ["main", "worker-a"]
    );

    const traversal = await request(
      `/api/sessions/${SESSION_ID}/transcript?agent_id=${encodeURIComponent(`../../${SESSION_ID}`)}`
    );
    assert.equal(traversal.status, 200);
    assert.deepEqual(traversal.body.messages, []);
  });

  it("includes Cursor in the Claude-compatible product scope", async () => {
    const claudeScope = await request("/api/sessions?providers=claude&limit=100");
    assert.equal(claudeScope.status, 200);
    assert.ok(claudeScope.body.sessions.some((session) => session.id === SESSION_ID));

    const cursorScope = await request("/api/sessions?providers=cursor&limit=100");
    assert.equal(cursorScope.status, 200);
    assert.ok(cursorScope.body.sessions.some((session) => session.id === SESSION_ID));

    const codexScope = await request("/api/sessions?providers=codex&limit=100");
    assert.equal(codexScope.status, 200);
    assert.ok(!codexScope.body.sessions.some((session) => session.id === SESSION_ID));
  });

  it("intersects product scope with an exact Sessions provider filter", async () => {
    const exactCursor = await request("/api/sessions?providers=claude&provider=cursor&limit=100");
    assert.equal(exactCursor.status, 200);
    assert.ok(exactCursor.body.sessions.some((session) => session.id === SESSION_ID));

    const exactClaude = await request("/api/sessions?providers=claude&provider=claude&limit=100");
    assert.equal(exactClaude.status, 200);
    assert.ok(!exactClaude.body.sessions.some((session) => session.id === SESSION_ID));
  });
});

describe("Cursor session lifecycle", () => {
  function writeCursorChat(sessionId, prompts, activityMs) {
    const chatDir = path.join(CURSOR_HOME, "chats", "workspace-b", sessionId);
    fs.mkdirSync(chatDir, { recursive: true });
    fs.writeFileSync(
      path.join(chatDir, "meta.json"),
      JSON.stringify({
        createdAtMs: activityMs - 60_000,
        updatedAtMs: activityMs,
        hasConversation: true,
        title: `Lifecycle ${sessionId.slice(0, 8)}`,
        cwd: "/Users/example/lifecycle",
      })
    );
    fs.writeFileSync(path.join(chatDir, "prompt_history.json"), JSON.stringify(prompts));
    const at = new Date(activityMs);
    fs.utimesSync(path.join(chatDir, "meta.json"), at, at);
    fs.utimesSync(path.join(chatDir, "prompt_history.json"), at, at);
    fs.utimesSync(chatDir, at, at);
    return chatDir;
  }

  function cursorTranscriptPath(sessionId) {
    return path.join(
      CURSOR_HOME,
      "projects",
      "Users-example-lifecycle",
      "agent-transcripts",
      sessionId,
      `${sessionId}.jsonl`
    );
  }

  it("does not revive the main agent when a prompt is imported for an ended session", async () => {
    const sessionId = "4aa0f943-0b42-4aa0-92d0-dd56e28bca01";
    const endedMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    writeCursorChat(sessionId, ["Build the backend"], endedMs);
    await syncCursorSessions(require("../db"));
    assert.equal(stmts.getSession.get(sessionId).status, "completed");
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "completed");

    // A later prompt that the dashboard only discovers after the recency
    // window (it was down, or Cursor rewrote history) must not flip the main
    // agent back to "working" on a session that stays completed.
    writeCursorChat(sessionId, ["Build the backend", "/usage"], endedMs + 3 * 60 * 60 * 1000);
    await syncCursorSessions(require("../db"));
    const session = stmts.getSession.get(sessionId);
    const main = stmts.getAgent.get(`${sessionId}-main`);
    assert.equal(session.status, "completed");
    assert.equal(main.status, "completed");
    assert.ok(main.ended_at, "completed main agent keeps an end time");
  });

  it("heals working agents already stranded on ended Cursor sessions", () => {
    const sessionId = "5bb0f943-0b42-4aa0-92d0-dd56e28bca02";
    const endedAt = "2026-09-20T04:03:38.474Z";
    stmts.insertSession.run(sessionId, "Stranded", "completed", null, null, null);
    db.prepare("UPDATE sessions SET provider = 'cursor', ended_at = ? WHERE id = ?").run(
      endedAt,
      sessionId
    );
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Cursor · Stranded",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    // Claude sessions are owned by the hook lifecycle and must be left alone.
    const claudeId = "6cc0f943-0b42-4aa0-92d0-dd56e28bca03";
    stmts.insertSession.run(claudeId, "Claude", "completed", null, null, null);
    stmts.insertAgent.run(
      `${claudeId}-main`,
      claudeId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );

    assert.deepEqual(healCursorOrphanAgents(require("../db")), [sessionId]);
    const main = stmts.getAgent.get(`${sessionId}-main`);
    assert.equal(main.status, "completed");
    assert.equal(main.ended_at, endedAt);
    assert.equal(stmts.getAgent.get(`${claudeId}-main`).status, "working");
    assert.deepEqual(healCursorOrphanAgents(require("../db")), [], "heal is idempotent");
  });

  it("does not heal an agent whose session is reactivated mid-heal", () => {
    const sessionId = "8ee0f943-0b42-4aa0-92d0-dd56e28bca05";
    stmts.insertSession.run(sessionId, "Reactivated", "completed", null, null, null);
    db.prepare("UPDATE sessions SET provider = 'cursor' WHERE id = ?").run(sessionId);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Cursor · Reactivated",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    // Simulate a hook reactivating the session after the heal's SELECT ran.
    const racingDb = Object.create(db);
    racingDb.prepare = (sql) => {
      const statement = db.prepare(sql);
      if (!/^\s*SELECT a\.id/.test(sql)) return statement;
      return {
        all: (...args) => {
          const rows = statement.all(...args);
          db.prepare("UPDATE sessions SET status = 'active' WHERE id = ?").run(sessionId);
          return rows;
        },
      };
    };
    racingDb.transaction = (fn) => db.transaction(fn);

    assert.deepEqual(healCursorOrphanAgents({ db: racingDb, stmts }), []);
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "working");
  });

  it("moves a live Cursor session from working to waiting once the turn goes idle", async () => {
    const sessionId = "7dd0f943-0b42-4aa0-92d0-dd56e28bca04";
    const transcript = cursorTranscriptPath(sessionId);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(
      transcript,
      jsonl([
        { role: "user", message: { content: [{ type: "text", text: "Refactor it" }] } },
        { role: "assistant", message: { content: [{ type: "text", text: "Working on it" }] } },
      ])
    );
    const chatDir = writeCursorChat(sessionId, ["Refactor it"], Date.now());
    await syncCursorSessions(require("../db"));
    assert.equal(stmts.getSession.get(sessionId).status, "active");
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "working");

    // The turn ends: nothing under ~/.cursor changes and no hook arrives, but
    // the session is still inside Cursor's 10-minute recency window.
    const idle = new Date(Date.now() - 3 * 60 * 1000);
    for (const file of [
      transcript,
      path.join(chatDir, "meta.json"),
      path.join(chatDir, "prompt_history.json"),
      chatDir,
    ]) {
      fs.utimesSync(file, idle, idle);
    }
    const setUpdatedAt = db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?");
    setUpdatedAt.run(new Date().toISOString(), sessionId);
    await syncCursorSessions(require("../db"));
    assert.equal(
      stmts.getAgent.get(`${sessionId}-main`).status,
      "working",
      "a fresh hook write keeps the turn working"
    );

    setUpdatedAt.run(idle.toISOString(), sessionId);
    db.prepare("UPDATE agents SET current_tool = 'Shell' WHERE id = ?").run(`${sessionId}-main`);
    await syncCursorSessions(require("../db"));
    assert.equal(
      stmts.getAgent.get(`${sessionId}-main`).status,
      "working",
      "a hook-reported tool in flight keeps the turn working"
    );

    // Unchanged fingerprint: the idle transition must not depend on new file
    // activity, since an ended turn is exactly the absence of it.
    db.prepare("UPDATE agents SET current_tool = NULL WHERE id = ?").run(`${sessionId}-main`);
    await syncCursorSessions(require("../db"));
    assert.equal(stmts.getSession.get(sessionId).status, "active");
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "waiting");

    const settled = await syncCursorSessions(require("../db"));
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "waiting");
    assert.equal(settled.backfilled, 0, "a waiting session is not re-enriched every poll");
  });
});
