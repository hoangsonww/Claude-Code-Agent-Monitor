/**
 * @file Verifies incremental Codex rollout ingestion: session metadata, token
 * deltas, context bands, duplicate safety, native live-thread startup cards,
 * transcript-derived prompt context, and transcript-driven card lifecycle.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-codex-ingest-"));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.DASHBOARD_CODEX_HOME = path.join(TMP, "codex");

const { db, stmts } = require("../db");
const hooksRouter = require("../routes/hooks");
const {
  findCodexTranscriptForSession,
  ingestCodexHook,
  ingestCodexTranscript,
  reconcileCodexSessionLiveness,
  refreshCodexSessionTitles,
  syncCodexStateSessions,
} = require("../lib/codex-ingest");

const SESSION_ID = "019a4ba6-a2b6-75f0-b186-bddd23ae4f2f";
const ROLLOUT = path.join(
  process.env.DASHBOARD_CODEX_HOME,
  "sessions",
  "2026",
  "08",
  "01",
  `rollout-2026-08-01T12-00-00-${SESSION_ID}.jsonl`
);

const RENAMED_SESSION_ID = "019fbb99-bd87-7c80-afec-ee65e2ebbe1c";
const RENAMED_ROLLOUT = path.join(
  process.env.DASHBOARD_CODEX_HOME,
  "sessions",
  "2026",
  "08",
  "01",
  `rollout-2026-08-01T13-00-00-${RENAMED_SESSION_ID}.jsonl`
);

function append(record) {
  fs.mkdirSync(path.dirname(ROLLOUT), { recursive: true });
  fs.appendFileSync(ROLLOUT, `${JSON.stringify(record)}\n`);
}

function record(type, payload) {
  return { timestamp: "2026-08-01T12:00:00.000Z", type, payload };
}

function writeLiveThread(thread) {
  const statePath = path.join(process.env.DASHBOARD_CODEX_HOME, "state_5.sqlite");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const state = new Database(statePath);
  state.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      rollout_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cwd TEXT NOT NULL,
      model TEXT,
      model_provider TEXT,
      cli_version TEXT,
      archived INTEGER NOT NULL DEFAULT 0
    )
  `);
  state
    .prepare(
      `
      INSERT OR REPLACE INTO threads
        (id, rollout_path, created_at, cwd, model, model_provider, cli_version, archived)
      VALUES (@id, @rollout_path, @created_at, @cwd, @model, @model_provider, @cli_version, @archived)
    `
    )
    .run(thread);
  state.close();
}

after(() => {
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("Codex rollout ingestor", () => {
  it("accounts cumulatives exactly once and splits long/short requests", () => {
    append(
      record("session_meta", {
        id: SESSION_ID,
        timestamp: "2026-08-01T12:00:00.000Z",
        cwd: "/workspace/demo",
        cli_version: "1.0.0",
        model_provider: "openai",
      })
    );
    append(record("turn_context", { model: "gpt-5.6-terra", service_tier: "standard" }));
    append(record("event_msg", { type: "user_message", message: "Track my Codex session" }));
    append(
      record("response_item", {
        type: "function_call",
        name: "exec_command",
        call_id: "cmd-1",
        arguments: '{"cmd":"rg session_index"}',
      })
    );
    append(
      record("response_item", {
        type: "custom_tool_call",
        name: "apply_patch",
        call_id: "patch-1",
        input: "*** Begin Patch",
      })
    );
    append(
      record("response_item", {
        type: "custom_tool_call",
        name: "exec",
        call_id: "plan-1",
        input:
          'const r = await tools.update_plan({plan:[{step:"Inspect",status:"completed"},{step:"Verify",status:"in_progress"}]}); text(r);',
      })
    );
    append(
      record("event_msg", {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 300_000,
            cached_input_tokens: 100_000,
            cache_write_input_tokens: 20_000,
            output_tokens: 1_000,
            reasoning_output_tokens: 250,
          },
        },
      })
    );

    const first = ingestCodexTranscript(ROLLOUT);
    assert.equal(first.changed, true);
    assert.equal(first.created, true);
    assert.equal(first.session.provider, "codex");
    assert.equal(first.session.transcript_path, ROLLOUT);
    assert.equal(first.session.name, "Track my Codex session");
    assert.equal(stmts.getAgent.get(`codex:${SESSION_ID}`).status, "working");
    assert.equal(
      stmts.getAgent.get(`codex:${SESSION_ID}`).task,
      "Track my Codex session",
      "a real Codex user message becomes the main-card task context"
    );
    // Historical sessions from an earlier dashboard build do not have that
    // promoted task yet. The list query still makes their persisted human turn
    // available to cards immediately, before another live Codex prompt arrives.
    db.prepare("UPDATE agents SET task = NULL WHERE id = ?").run(`codex:${SESSION_ID}`);
    assert.equal(
      stmts.listSessions.all(20, 0).find((row) => row.id === SESSION_ID).prompt_preview,
      "Track my Codex session",
      "the session-list fallback reads the existing Codex user-message event"
    );
    assert.equal(findCodexTranscriptForSession(SESSION_ID), ROLLOUT);
    const toolEvents = stmts.listEventsBySession
      .all(SESSION_ID)
      .filter((event) => event.event_type === "codex_tool_call");
    assert.deepEqual(
      toolEvents.map((event) => event.tool_name).sort(),
      ["Bash", "Edit", "update_plan"],
      "response-item calls are retained for provider-aware tool analytics"
    );
    const planEvent = toolEvents.find((event) => event.tool_name === "update_plan");
    assert.equal(JSON.parse(planEvent.data).raw_tool_name, "exec");
    assert.equal(planEvent.summary, "Called update_plan");
    assert.equal(
      hooksRouter.codexTranscriptPath({ thread_id: SESSION_ID }),
      ROLLOUT,
      "a hook can resolve a thread id even when its payload omits transcript_path"
    );

    const long = stmts.getTokensBySession
      .all(SESSION_ID)
      .find((row) => row.context_size === "long");
    assert.equal(long.input_tokens, 180_000); // total less cached and cache-write tokens
    assert.equal(long.cache_read_tokens, 100_000);
    assert.equal(long.cache_write_tokens, 20_000);
    assert.equal(long.output_tokens, 1_250); // output + reasoning output

    assert.equal(ingestCodexTranscript(ROLLOUT).changed, false, "unchanged bytes must be free");
    assert.equal(
      stmts.listEventsBySession
        .all(SESSION_ID)
        .filter((event) => event.event_type === "codex_tool_call").length,
      3,
      "a repeated watcher/hook notification never double-counts response-item tools"
    );

    append(
      record("event_msg", {
        type: "token_count",
        info: {
          total_token_usage: {
            input_tokens: 300_100,
            cached_input_tokens: 100_000,
            cache_write_input_tokens: 20_000,
            output_tokens: 1_020,
            reasoning_output_tokens: 250,
          },
        },
      })
    );
    assert.equal(ingestCodexTranscript(ROLLOUT).changed, true);
    const short = stmts.getTokensBySession
      .all(SESSION_ID)
      .find((row) => row.context_size === "short");
    assert.equal(short.input_tokens, 100);
    assert.equal(short.output_tokens, 20);
  });

  it("maps task completion, resumed work, and interrupted work to Claude-equivalent card states", () => {
    append(record("event_msg", { type: "task_complete" }));
    ingestCodexTranscript(ROLLOUT);
    let session = stmts.getSession.get(SESSION_ID);
    let agent = stmts.getAgent.get(`codex:${SESSION_ID}`);
    assert.equal(session.status, "active", "a finished turn keeps the session resumable");
    assert.equal(session.awaiting_reason, "stop");
    assert.equal(agent.status, "waiting");
    assert.equal(agent.awaiting_reason, "stop");

    append(record("event_msg", { type: "user_message", message: "Continue the session" }));
    append(record("event_msg", { type: "task_started" }));
    ingestCodexTranscript(ROLLOUT);
    session = stmts.getSession.get(SESSION_ID);
    agent = stmts.getAgent.get(`codex:${SESSION_ID}`);
    assert.equal(session.awaiting_input_since, null);
    assert.equal(agent.status, "working");
    assert.equal(agent.awaiting_input_since, null);
    assert.equal(
      agent.task,
      "Continue the session",
      "the newest human prompt replaces stale card text"
    );
    assert.equal(
      stmts.listSessions.all(20, 0).find((row) => row.id === SESSION_ID).prompt_preview,
      "Track my Codex session\nContinue the session",
      "Codex cards keep the last two human turns so terse follow-ups retain context"
    );

    append(record("event_msg", { type: "turn_aborted" }));
    ingestCodexTranscript(ROLLOUT);
    session = stmts.getSession.get(SESSION_ID);
    agent = stmts.getAgent.get(`codex:${SESSION_ID}`);
    assert.equal(session.status, "active");
    assert.equal(session.awaiting_reason, "interrupted");
    assert.equal(agent.status, "waiting");
    assert.equal(agent.awaiting_reason, "interrupted");

    // Simulate a dashboard restart from a pre-fix cursor: the terminal event
    // is already recorded, but its old card state lacks awaiting markers.
    stmts.clearSessionAwaitingInput.run(SESSION_ID);
    stmts.clearAgentAwaitingInput.run(`codex:${SESSION_ID}`);
    stmts.updateAgent.run(null, "working", null, null, null, null, `codex:${SESSION_ID}`);
    const repaired = reconcileCodexSessionLiveness();
    assert.equal(repaired.length, 1);
    assert.equal(stmts.getSession.get(SESSION_ID).awaiting_reason, "interrupted");
    assert.equal(stmts.getAgent.get(`codex:${SESSION_ID}`).status, "waiting");

    // A silent working turn has no completed-turn record to reconcile. The
    // short test threshold models the production 90-second conservative
    // fallback and ensures cards cannot remain Active forever after Codex
    // stops writing.
    append(record("event_msg", { type: "task_started" }));
    ingestCodexTranscript(ROLLOUT);
    const staleAt = new Date(Date.now() - 1_000);
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
      staleAt.toISOString(),
      SESSION_ID
    );
    fs.utimesSync(ROLLOUT, staleAt, staleAt);
    const idleRepaired = reconcileCodexSessionLiveness({ workingIdleMs: 1 });
    assert.equal(idleRepaired.length, 1);
    assert.equal(stmts.getSession.get(SESSION_ID).awaiting_reason, "interrupted");
    assert.equal(stmts.getAgent.get(`codex:${SESSION_ID}`).status, "waiting");
  });

  it("applies SessionEnd immediately even when no additional rollout line exists", () => {
    const result = ingestCodexHook(ROLLOUT, "SessionEnd");
    assert.equal(result.changed, true);
    assert.equal(stmts.getSession.get(SESSION_ID).status, "completed");
    assert.equal(stmts.getAgent.get(`codex:${SESSION_ID}`).status, "completed");
  });

  it("creates a Waiting card directly from SessionStart before Codex flushes a rollout", () => {
    const sessionId = "019fd06f-f70e-7420-922e-16bf51732ce6";
    const rollout = path.join(
      process.env.DASHBOARD_CODEX_HOME,
      "sessions",
      "2026",
      "08",
      "04",
      `rollout-2026-08-04T22-40-26-${sessionId}.jsonl`
    );
    const started = ingestCodexHook(null, "SessionStart", {
      session_id: sessionId,
      cwd: "/workspace/fresh-codex-session",
      model: "gpt-5.6-terra",
      timestamp: "2026-08-04T22:40:26.000Z",
    });

    assert.equal(started.created, true);
    assert.equal(started.changed, true);
    assert.equal(started.session.id, sessionId);
    assert.equal(started.session.model, "gpt-5.6-terra");
    assert.equal(started.session.transcript_path, null);
    assert.equal(started.session.awaiting_reason, "session_start");
    assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "waiting");

    fs.mkdirSync(path.dirname(rollout), { recursive: true });
    fs.writeFileSync(
      rollout,
      `${JSON.stringify(
        record("session_meta", {
          id: sessionId,
          cwd: "/workspace/fresh-codex-session",
          model_provider: "openai",
        })
      )}\n`
    );
    const enriched = ingestCodexTranscript(rollout);

    assert.equal(enriched.created, false, "the rollout enriches the hook-created row");
    assert.equal(enriched.session.id, sessionId);
    assert.equal(enriched.session.transcript_path, rollout);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE id = ?").get(sessionId).count,
      1,
      "a delayed rollout never creates a duplicate session"
    );
  });

  it("creates a Waiting card from Codex's live-thread state when SessionStart is delayed", () => {
    const sessionId = "019fd086-d75c-7a91-9743-2788d849c223";
    const rollout = path.join(
      process.env.DASHBOARD_CODEX_HOME,
      "sessions",
      "2026",
      "08",
      "04",
      `rollout-2026-08-04T23-20-00-${sessionId}.jsonl`
    );
    writeLiveThread({
      id: sessionId,
      rollout_path: rollout,
      created_at: Math.floor(Date.now() / 1_000),
      cwd: "/workspace/live-codex-session",
      model: "gpt-5.6-terra",
      model_provider: "openai",
      cli_version: "0.146.0",
      archived: 0,
    });

    const started = syncCodexStateSessions();

    assert.equal(started.length, 1);
    assert.equal(started[0].created, true);
    assert.equal(started[0].session.id, sessionId);
    assert.equal(started[0].session.model, "gpt-5.6-terra");
    assert.equal(started[0].session.transcript_path, null);
    assert.equal(started[0].session.awaiting_reason, "session_start");
    assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "waiting");
    assert.equal(syncCodexStateSessions().length, 0, "the live-thread scan is idempotent");

    fs.mkdirSync(path.dirname(rollout), { recursive: true });
    fs.writeFileSync(
      rollout,
      `${JSON.stringify(
        record("session_meta", {
          id: sessionId,
          cwd: "/workspace/live-codex-session",
          model_provider: "openai",
        })
      )}\n`
    );
    const enriched = ingestCodexTranscript(rollout);

    assert.equal(enriched.created, false, "the rollout enriches the live-thread row");
    assert.equal(enriched.session.transcript_path, rollout);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE id = ?").get(sessionId).count,
      1,
      "a delayed rollout never creates a duplicate session"
    );
  });

  it("self-heals a completed Codex session when its rollout receives a new turn", () => {
    append(record("event_msg", { type: "task_started" }));
    const result = ingestCodexTranscript(ROLLOUT);
    assert.equal(result.changed, true);
    assert.equal(stmts.getSession.get(SESSION_ID).status, "active");
    assert.equal(stmts.getSession.get(SESSION_ID).ended_at, null);
    assert.equal(stmts.getAgent.get(`codex:${SESSION_ID}`).status, "working");
  });

  it("imports an inactive historical rollout as completed without replaying task_started", () => {
    const sessionId = "019fd086-d75c-7a91-9743-2788d849c224";
    const rollout = path.join(
      process.env.DASHBOARD_CODEX_HOME,
      "sessions",
      "2026",
      "08",
      "05",
      `rollout-2026-08-05T12-00-00-${sessionId}.jsonl`
    );
    fs.mkdirSync(path.dirname(rollout), { recursive: true });
    fs.writeFileSync(
      rollout,
      [
        record("session_meta", { id: sessionId, cwd: "/workspace/shared-cwd" }),
        record("event_msg", { type: "task_started" }),
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n"
    );

    const result = ingestCodexTranscript(rollout, { liveTranscripts: new Set() });

    assert.equal(result.created, true);
    assert.equal(stmts.getSession.get(sessionId).status, "completed");
    assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "completed");
  });

  it("uses and live-syncs Codex's native /rename title from session_index.jsonl", () => {
    const indexPath = path.join(process.env.DASHBOARD_CODEX_HOME, "session_index.jsonl");
    fs.writeFileSync(
      indexPath,
      `${JSON.stringify({ id: RENAMED_SESSION_ID, thread_name: "hehe" })}\n`
    );
    fs.mkdirSync(path.dirname(RENAMED_ROLLOUT), { recursive: true });
    fs.writeFileSync(
      RENAMED_ROLLOUT,
      `${JSON.stringify(
        record("session_meta", { id: RENAMED_SESSION_ID, cwd: "/workspace/renamed" })
      )}\n`
    );

    const created = ingestCodexTranscript(RENAMED_ROLLOUT);
    assert.equal(created.session.name, "hehe");

    fs.appendFileSync(
      indexPath,
      `${JSON.stringify({ id: RENAMED_SESSION_ID, thread_name: "ship transcript fixes" })}\n`
    );
    const updates = refreshCodexSessionTitles();
    assert.equal(updates.length, 1);
    assert.equal(updates[0].session.name, "ship transcript fixes");
  });
});
