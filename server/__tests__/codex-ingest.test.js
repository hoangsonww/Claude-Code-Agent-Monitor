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

  it("zeroes the delta when cumulative token counters regress, then resumes from the lower baseline", () => {
    const sessionId = "019fde70-aaaa-7b71-8c90-000000000001";
    const rollout = path.join(
      process.env.DASHBOARD_CODEX_HOME,
      "sessions",
      "2026",
      "08",
      "06",
      `rollout-2026-08-06T09-00-00-${sessionId}.jsonl`
    );
    const appendLocal = (entry) => {
      fs.mkdirSync(path.dirname(rollout), { recursive: true });
      fs.appendFileSync(rollout, `${JSON.stringify(entry)}\n`);
    };
    const tokenCount = (usage) =>
      record("event_msg", { type: "token_count", info: { total_token_usage: usage } });

    appendLocal(record("session_meta", { id: sessionId, cwd: "/workspace/regression" }));
    appendLocal(
      tokenCount({
        input_tokens: 300_000,
        cached_input_tokens: 100_000,
        cache_write_input_tokens: 20_000,
        output_tokens: 1_000,
        reasoning_output_tokens: 250,
      })
    );
    assert.equal(ingestCodexTranscript(rollout).changed, true);
    const rowsAfterFirst = stmts.getTokensBySession.all(sessionId);
    assert.equal(rowsAfterFirst.length, 1);
    assert.equal(rowsAfterFirst[0].input_tokens, 180_000);
    assert.equal(rowsAfterFirst[0].output_tokens, 1_250);

    // A rewritten or resumed rollout can re-open with lower cumulative counters.
    // The regressed snapshot itself must contribute nothing…
    appendLocal(
      tokenCount({
        input_tokens: 50_000,
        cached_input_tokens: 10_000,
        cache_write_input_tokens: 0,
        output_tokens: 200,
        reasoning_output_tokens: 50,
      })
    );
    assert.equal(ingestCodexTranscript(rollout).changed, true);
    assert.deepEqual(
      stmts.getTokensBySession.all(sessionId),
      rowsAfterFirst,
      "a regressed cumulative snapshot must not emit a token delta"
    );

    // …and growth after the regression is measured against the lower baseline.
    appendLocal(
      tokenCount({
        input_tokens: 50_100,
        cached_input_tokens: 10_000,
        cache_write_input_tokens: 0,
        output_tokens: 205,
        reasoning_output_tokens: 50,
      })
    );
    assert.equal(ingestCodexTranscript(rollout).changed, true);
    const resumed = stmts.getTokensBySession
      .all(sessionId)
      .find((row) => row.context_size === "short");
    assert.equal(resumed.input_tokens, 100);
    assert.equal(resumed.output_tokens, 5);
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

  // The payloads below are verbatim captures from `codex exec --ephemeral`
  // (codex-cli 0.147.0). Every one carries `transcript_path: null` — the mode
  // runs "without persisting session files to disk" — so the thread id is the
  // only identity the dashboard ever gets. See issue #309.
  describe("hook-only sessions (codex exec --ephemeral)", () => {
    const EPHEMERAL_ID = "01a040c6-69a3-7590-9ee0-5962bae412ce";
    const TURN_ID = "01a040c6-6c2b-7480-8b72-8b62ded890ed";
    const base = { session_id: EPHEMERAL_ID, transcript_path: null, cwd: "/private/tmp" };

    function eventsFor(sessionId) {
      return db.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY id").all(sessionId);
    }

    /**
     * Replay the captured `codex exec --ephemeral` hook sequence for one session
     * id. Each test drives its own so none depends on the order the runner
     * happens to pick (`--test-name-pattern` can select a single case).
     */
    function runEphemeralSession(sessionId, { stop = true, end = true } = {}) {
      const own = { ...base, session_id: sessionId };
      ingestCodexHook(null, "SessionStart", {
        ...own,
        hook_event_name: "SessionStart",
        model: "gpt-5.6-sol",
        source: "startup",
      });
      ingestCodexHook(null, "UserPromptSubmit", {
        ...own,
        turn_id: TURN_ID,
        hook_event_name: "UserPromptSubmit",
        prompt: "Run the shell command 'echo hello-ccam' and then reply DONE.",
      });
      ingestCodexHook(null, "PreToolUse", {
        ...own,
        turn_id: TURN_ID,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "echo hello-ccam" },
        tool_use_id: "exec-3c2ba208-b1e2-4980-8d9e-756175454f02",
      });
      ingestCodexHook(null, "PostToolUse", {
        ...own,
        turn_id: TURN_ID,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "echo hello-ccam" },
        tool_response: "hello-ccam\n",
        tool_use_id: "exec-3c2ba208-b1e2-4980-8d9e-756175454f02",
      });
      if (stop) {
        ingestCodexHook(null, "Stop", {
          ...own,
          turn_id: TURN_ID,
          hook_event_name: "Stop",
          last_assistant_message: "DONE",
        });
      }
      if (end) {
        ingestCodexHook(null, "SessionEnd", {
          ...own,
          hook_event_name: "SessionEnd",
          reason: "other",
        });
      }
      return sessionId;
    }

    it("runs the full lifecycle from hooks alone and lands on completed", () => {
      const started = ingestCodexHook(null, "SessionStart", {
        ...base,
        hook_event_name: "SessionStart",
        model: "gpt-5.6-sol",
        source: "startup",
      });
      assert.equal(started.created, true);
      assert.equal(started.session.transcript_path, null);
      assert.equal(started.session.awaiting_reason, "session_start");

      const prompted = ingestCodexHook(null, "UserPromptSubmit", {
        ...base,
        turn_id: TURN_ID,
        hook_event_name: "UserPromptSubmit",
        prompt: "Run the shell command 'echo hello-ccam' and then reply DONE.",
      });
      assert.equal(prompted.session.status, "active");
      assert.equal(stmts.getAgent.get(`codex:${EPHEMERAL_ID}`).status, "working");
      assert.equal(
        prompted.session.name,
        "Run the shell command 'echo hello-ccam' and then reply DONE.",
        "the hook prompt names the session exactly as a rollout user_message would"
      );

      ingestCodexHook(null, "PreToolUse", {
        ...base,
        turn_id: TURN_ID,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "echo hello-ccam" },
        tool_use_id: "exec-3c2ba208-b1e2-4980-8d9e-756175454f02",
      });
      ingestCodexHook(null, "PostToolUse", {
        ...base,
        turn_id: TURN_ID,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "echo hello-ccam" },
        tool_response: "hello-ccam\n",
        tool_use_id: "exec-3c2ba208-b1e2-4980-8d9e-756175454f02",
      });

      const stopped = ingestCodexHook(null, "Stop", {
        ...base,
        turn_id: TURN_ID,
        hook_event_name: "Stop",
        last_assistant_message: "DONE",
      });
      assert.equal(stopped.session.status, "active");
      assert.equal(stopped.session.awaiting_reason, "stop");
      assert.equal(stmts.getAgent.get(`codex:${EPHEMERAL_ID}`).status, "waiting");

      const ended = ingestCodexHook(null, "SessionEnd", {
        ...base,
        hook_event_name: "SessionEnd",
        reason: "other",
      });
      assert.equal(ended.changed, true);
      assert.equal(ended.session.status, "completed");
      assert.ok(ended.session.ended_at, "a terminated session records when it ended");
      assert.equal(ended.session.awaiting_input_since, null);
      assert.equal(stmts.getAgent.get(`codex:${EPHEMERAL_ID}`).status, "completed");
    });

    it("rebuilds the turn's history from the hook payloads", () => {
      const rows = eventsFor(runEphemeralSession("01a040d0-0001-7000-8000-000000000001"));
      assert.deepEqual(
        rows.map((row) => row.event_type),
        [
          "codex_user_message",
          "codex_tool_call",
          "codex_exec_command_end",
          "codex_task_complete",
          "SessionEnd",
        ]
      );
      const [prompt, call, end, complete] = rows;
      assert.equal(prompt.summary, "Run the shell command 'echo hello-ccam' and then reply DONE.");
      assert.equal(call.tool_name, "Bash");
      assert.equal(call.summary, "Called Bash");
      assert.equal(end.summary, "echo hello-ccam");
      assert.equal(complete.summary, "DONE");
      for (const row of rows) {
        assert.equal(JSON.parse(row.data).source, "hook", "every synthesized row is tagged");
      }
    });

    it("marks the session hook-only so the UI can explain the missing transcript", () => {
      const sessionId = runEphemeralSession("01a040d0-0002-7000-8000-000000000002");
      const metadata = JSON.parse(stmts.getSession.get(sessionId).metadata);
      assert.equal(metadata.hook_only, true);
      assert.equal(metadata.provider, "codex", "the pre-existing metadata keys survive");
    });

    it("never resurrects a deleted session from a non-SessionStart hook", () => {
      const unknown = "01a040ff-0000-7000-8000-000000000000";
      const result = ingestCodexHook(null, "SessionEnd", {
        session_id: unknown,
        transcript_path: null,
        hook_event_name: "SessionEnd",
      });
      assert.equal(result.changed, false);
      assert.equal(stmts.getSession.get(unknown), undefined);
    });

    it("withdraws the reconstruction when the real rollout turns up", () => {
      const sessionId = "01a04100-1111-7000-8000-111111111111";
      ingestCodexHook(null, "SessionStart", {
        session_id: sessionId,
        transcript_path: null,
        cwd: "/workspace/late-rollout",
        hook_event_name: "SessionStart",
      });
      ingestCodexHook(null, "UserPromptSubmit", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "UserPromptSubmit",
        prompt: "first prompt",
      });
      assert.equal(eventsFor(sessionId).length, 1);
      assert.equal(JSON.parse(stmts.getSession.get(sessionId).metadata).hook_only, true);

      const rollout = path.join(
        process.env.DASHBOARD_CODEX_HOME,
        "sessions",
        "2026",
        "08",
        "05",
        `rollout-2026-08-05T10-00-00-${sessionId}.jsonl`
      );
      fs.mkdirSync(path.dirname(rollout), { recursive: true });
      fs.writeFileSync(
        rollout,
        [
          JSON.stringify(record("session_meta", { id: sessionId, cwd: "/workspace/late-rollout" })),
          JSON.stringify(record("event_msg", { type: "user_message", message: "first prompt" })),
        ].join("\n") + "\n"
      );
      ingestCodexTranscript(rollout);

      const rows = eventsFor(sessionId);
      assert.equal(rows.length, 1, "the rollout's own record replaces the synthesized one");
      assert.equal(JSON.parse(rows[0].data).source, undefined);
      assert.equal(JSON.parse(stmts.getSession.get(sessionId).metadata).hook_only, undefined);
      assert.equal(
        db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE id = ?").get(sessionId).count,
        1
      );
    });

    it("retires a hook-only session whose Stop was never answered by SessionEnd", () => {
      const sessionId = "01a04200-2222-7000-8000-222222222222";
      ingestCodexHook(null, "SessionStart", {
        session_id: sessionId,
        transcript_path: null,
        cwd: "/workspace/lost-sessionend",
        hook_event_name: "SessionStart",
      });
      ingestCodexHook(null, "Stop", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "Stop",
        last_assistant_message: "done",
      });
      assert.equal(stmts.getSession.get(sessionId).status, "active");

      // Inside the idle window the card is left alone.
      assert.equal(
        reconcileCodexSessionLiveness({ hookOnlyIdleMs: 60_000 }).some(
          (result) => result.session.id === sessionId
        ),
        false
      );
      assert.equal(stmts.getSession.get(sessionId).status, "active");

      const repaired = reconcileCodexSessionLiveness({ hookOnlyIdleMs: 0 });
      assert.ok(repaired.some((result) => result.session.id === sessionId));
      assert.equal(stmts.getSession.get(sessionId).status, "completed");
      assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "completed");
    });

    // The reason silence alone can never be the trigger: a rollout-less run
    // emits NO hooks for the whole of a tool call. A captured `sleep 12`
    // produced a 12,119 ms PreToolUse→PostToolUse gap, and a CI build or test
    // suite is unbounded — an idle-time rule would complete a live run.
    it("never retires a hook-only session that is mid-tool, however long it is quiet", () => {
      const sessionId = "01a04201-3333-7000-8000-333333333333";
      ingestCodexHook(null, "SessionStart", {
        session_id: sessionId,
        transcript_path: null,
        cwd: "/workspace/slow-build",
        hook_event_name: "SessionStart",
      });
      ingestCodexHook(null, "PreToolUse", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm run build" },
      });
      assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "working");

      // Even with the window fully elapsed, a working turn is untouchable.
      const swept = reconcileCodexSessionLiveness({ hookOnlyIdleMs: 0, workingIdleMs: 10_000_000 });
      assert.equal(
        swept.some((result) => result.session.id === sessionId),
        false
      );
      assert.equal(stmts.getSession.get(sessionId).status, "active");
      assert.equal(stmts.getAgent.get(`codex:${sessionId}`).status, "working");

      // The build finishes minutes later and the session carries on normally.
      ingestCodexHook(null, "PostToolUse", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: { command: "npm run build" },
        tool_response: "built",
      });
      assert.equal(stmts.getSession.get(sessionId).status, "active");
    });

    it("does not promote the idle-working guess into a terminal state", () => {
      const sessionId = "01a04202-4444-7000-8000-444444444444";
      ingestCodexHook(null, "SessionStart", {
        session_id: sessionId,
        transcript_path: null,
        cwd: "/workspace/silent-turn",
        hook_event_name: "SessionStart",
      });
      ingestCodexHook(null, "PreToolUse", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "sleep 600" },
      });

      // The 90 s idle-working heuristic parks it in Waiting/interrupted. That
      // is the dashboard's own inference, not something Codex reported, so it
      // must never cascade into `completed`.
      reconcileCodexSessionLiveness({ workingIdleMs: 0, hookOnlyIdleMs: 0 });
      assert.equal(stmts.getSession.get(sessionId).awaiting_reason, "interrupted");
      assert.equal(stmts.getSession.get(sessionId).status, "active");

      reconcileCodexSessionLiveness({ workingIdleMs: 0, hookOnlyIdleMs: 0 });
      assert.equal(
        stmts.getSession.get(sessionId).status,
        "active",
        "an interrupted guess never becomes a terminal state on its own"
      );
    });

    it("still records the turn when the main agent row is missing", () => {
      // events.agent_id is a FOREIGN KEY; attributing a row to an absent agent
      // would throw inside the fail-safe hook path and lose the notification.
      const sessionId = "01a04203-5555-7000-8000-555555555555";
      ingestCodexHook(null, "SessionStart", {
        session_id: sessionId,
        transcript_path: null,
        cwd: "/workspace/orphan-agent",
        hook_event_name: "SessionStart",
      });
      db.prepare("DELETE FROM agents WHERE id = ?").run(`codex:${sessionId}`);

      const result = ingestCodexHook(null, "UserPromptSubmit", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "UserPromptSubmit",
        prompt: "orphaned but recorded",
      });
      assert.equal(result.changed, true);
      const rows = db
        .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY id")
        .all(sessionId);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].summary, "orphaned but recorded");
      assert.equal(rows[0].agent_id, null, "the event is unattributed rather than lost");
    });

    it("refuses to drive a non-Codex session from a hook payload id", () => {
      // The id is caller-supplied, so it must not reach a session this module
      // does not own — otherwise a colliding or forged id could complete a
      // Claude session.
      const claudeId = "01a04204-6666-7000-8000-666666666666";
      db.prepare(
        `INSERT INTO sessions (id, name, status, provider, source, started_at, updated_at)
         VALUES (?, 'Claude session', 'active', 'claude', 'local', ?, ?)`
      ).run(claudeId, "2026-08-26T10:00:00.000Z", "2026-08-26T10:00:00.000Z");

      const result = ingestCodexHook(null, "SessionEnd", {
        session_id: claudeId,
        transcript_path: null,
        hook_event_name: "SessionEnd",
      });

      assert.equal(result.changed, false);
      assert.equal(
        stmts.getSession.get(claudeId).status,
        "active",
        "a Claude session is never completed by a Codex hook"
      );
      assert.equal(
        db.prepare("SELECT COUNT(*) AS n FROM events WHERE session_id = ?").get(claudeId).n,
        0
      );
    });

    it("restarts the idle clock on every hook, even one that changes no state", () => {
      // The reconciler measures the window from updated_at, and each write in
      // the lifecycle path is conditional — a repeated Stop changes nothing.
      const sessionId = runEphemeralSession("01a040d0-0004-7000-8000-000000000004", {
        end: false,
      });
      const stale = "2020-01-01T00:00:00.000Z";
      db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(stale, sessionId);

      ingestCodexHook(null, "Stop", {
        session_id: sessionId,
        transcript_path: null,
        hook_event_name: "Stop",
        last_assistant_message: "DONE",
      });

      assert.notEqual(
        stmts.getSession.get(sessionId).updated_at,
        stale,
        "a repeated Stop still counts as activity"
      );
    });

    it("no longer rejects a transcript-less hook at the route", async () => {
      const express = require("express");
      const app = express();
      app.use(express.json());
      app.use("/api/hooks", hooksRouter);
      const server = app.listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      const port = server.address().port;
      const post = async (body) => {
        const response = await fetch(`http://127.0.0.1:${port}/api/hooks/codex`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        return response.json();
      };

      const accepted = await post({
        hook_type: "SessionEnd",
        data: {
          session_id: "01a04300-3333-7000-8000-333333333333",
          transcript_path: null,
          hook_event_name: "SessionEnd",
        },
      });
      assert.equal(accepted.queued, true, "a thread id is enough to identify the session");

      const rejected = await post({
        hook_type: "SessionEnd",
        data: { hook_event_name: "SessionEnd" },
      });
      assert.equal(rejected.queued, false, "a payload identifying nothing is still a no-op");

      await new Promise((resolve) => server.close(resolve));
    });

    it("leaves a rollout-backed session out of the hook-only fallback", () => {
      // Build the session this asserts on rather than relying on one an earlier
      // test happened to leave behind — otherwise it can pass simply because no
      // rollout-backed session exists.
      const sessionId = "01a040d0-0003-7000-8000-000000000003";
      const rollout = path.join(
        process.env.DASHBOARD_CODEX_HOME,
        "sessions",
        "2026",
        "08",
        "06",
        `rollout-2026-08-06T09-00-00-${sessionId}.jsonl`
      );
      fs.mkdirSync(path.dirname(rollout), { recursive: true });
      fs.writeFileSync(
        rollout,
        `${[
          JSON.stringify(
            record("session_meta", { id: sessionId, cwd: "/workspace/rollout-backed" })
          ),
          JSON.stringify(record("event_msg", { type: "task_complete", message: "done" })),
        ].join("\n")}\n`
      );
      ingestCodexTranscript(rollout);
      const before = stmts.getSession.get(sessionId);
      assert.equal(before.status, "active");
      assert.ok(before.transcript_path, "the fixture is genuinely rollout-backed");

      reconcileCodexSessionLiveness({ hookOnlyIdleMs: 0 });

      const after = stmts.getSession.get(sessionId);
      assert.equal(after.status, "active", "a rollout-backed session is never hook-reaped");
      assert.notEqual(stmts.getAgent.get(`codex:${sessionId}`).status, "completed");
    });
  });
});
