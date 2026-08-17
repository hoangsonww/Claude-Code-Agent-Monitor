/**
 * @file Regression tests for the in-memory Codex pre-identity process overlay.
 * Proves immediate startup visibility, strict command filtering, zero SQLite
 * persistence, resume-picker handoff before the first message, same-cwd
 * concurrency, durable-session takeover, and exit cleanup.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const TMP = path.join(os.tmpdir(), `codex-process-overlay-${Date.now()}-${process.pid}`);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");
const {
  collapseCodexProcessTree,
  getCodexProcessAgents,
  getCodexProcessSessions,
  isInteractiveCodexCommand,
  processInfosFromLsof,
  reconcileCodexProcessOverlay,
  refreshCodexProcessOverlay,
  resetCodexProcessOverlayForTests,
} = require("../lib/codex-process-overlay");

let server;
let baseUrl;

function requestJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ status: response.statusCode, body: JSON.parse(body || "{}") });
      });
    });
    request.on("error", reject);
  });
}

function tableCount(table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

before(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  server = await startServer(createApp(), 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  resetCodexProcessOverlayForTests();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  resetCodexProcessOverlayForTests();
});

describe("interactive Codex command classification", () => {
  it("accepts TUI launches and rejects non-interactive or service commands", () => {
    for (const command of [
      "codex",
      "/opt/homebrew/bin/codex --model gpt-5",
      "codex resume --last",
      "codex fork --last",
      "node /usr/local/bin/codex --profile work",
      "codex explain this code",
    ]) {
      assert.equal(isInteractiveCodexCommand(command), true, command);
    }

    for (const command of [
      "codex exec hello",
      "codex e hello",
      "codex review",
      "codex app-server --stdio",
      "codex mcp-server",
      "codex plugin list",
      "codex doctor",
      "codex --help",
      "codex --version",
      "grep codex",
    ]) {
      assert.equal(isInteractiveCodexCommand(command), false, command);
    }
  });

  it("prefers the open resumed rollout over the newer startup writer lock", () => {
    const lockRoot = "/tmp/codex-home/thread-writer-locks";
    const startupId = "019fdf72-0107-7e90-9cc2-7741580c4ce5";
    const resumedId = "019fdab4-3502-7792-9d95-cd5ef25b0e1d";
    const processes = processInfosFromLsof(
      new Map([[60182, "codex --yolo"]]),
      [
        "p60182",
        "fcwd",
        "n/workspace/launch",
        "f43",
        `n/tmp/codex-home/sessions/2026/08/06/rollout-2026-08-06T22-31-11-${resumedId}.jsonl`,
        "f44",
        `n${lockRoot}/${resumedId}.lock`,
        "f46",
        `n${lockRoot}/${startupId}.lock`,
      ].join("\n"),
      {
        lockRoot,
        sessionsRoot: "/tmp/codex-home/sessions",
        statFile(filename) {
          return {
            birthtimeMs: filename.includes(startupId) ? 2_000 : 1_000,
            mtimeMs: filename.includes(startupId) ? 2_000 : 1_000,
          };
        },
      }
    );

    assert.deepEqual(processes, [
      {
        pid: 60182,
        cwd: "/workspace/launch",
        sessionId: resumedId,
      },
    ]);
  });

  it("falls back to the newest writer lock before a rollout is open", () => {
    const lockRoot = "/tmp/codex-home/thread-writer-locks";
    const startupId = "019fdf72-0107-7e90-9cc2-7741580c4ce5";
    const resumedId = "019fdab4-3502-7792-9d95-cd5ef25b0e1d";
    const processes = processInfosFromLsof(
      new Map([[60182, "codex --yolo"]]),
      [
        "p60182",
        "fcwd",
        "n/workspace/launch",
        "f44",
        `n${lockRoot}/${resumedId}.lock`,
        "f46",
        `n${lockRoot}/${startupId}.lock`,
      ].join("\n"),
      {
        lockRoot,
        statFile(filename) {
          return {
            birthtimeMs: filename.includes(resumedId) ? 2_000 : 1_000,
            mtimeMs: filename.includes(resumedId) ? 2_000 : 1_000,
          };
        },
      }
    );

    assert.equal(processes[0].sessionId, resumedId);
  });

  it("counts a Node launcher and its native child as one logical session", () => {
    const processes = collapseCodexProcessTree(
      [
        { pid: 61001, cwd: "/workspace/project" },
        {
          pid: 61002,
          cwd: "/workspace/project",
          sessionId: "019ff6e2-cedb-7f50-b298-c025267b7268",
        },
        { pid: 62001, cwd: "/workspace/other" },
        { pid: 62002, cwd: "/workspace/other" },
      ],
      new Map([
        [61001, 50000],
        [61002, 61001],
        [62001, 50000],
        [62002, 62001],
      ])
    );

    assert.deepEqual(processes, [
      {
        pid: 61002,
        cwd: "/workspace/project",
        sessionId: "019ff6e2-cedb-7f50-b298-c025267b7268",
      },
      { pid: 62002, cwd: "/workspace/other" },
    ]);
  });
});

describe("Codex process overlay lifecycle", () => {
  it("appears immediately in list APIs without writing any durable data", async () => {
    const before = {
      sessions: tableCount("sessions"),
      agents: tableCount("agents"),
      events: tableCount("events"),
      tokens: tableCount("token_usage"),
      workflows: tableCount("workflows"),
    };

    const change = reconcileCodexProcessOverlay(
      [{ pid: 4312, cwd: "/workspace/pre-identity" }],
      [],
      "2026-08-05T12:00:00.000Z"
    );
    assert.equal(change.added.length, 1);
    assert.equal(change.removed.length, 0);
    assert.match(change.added[0].id, /^codex-process:4312:/);
    assert.equal(change.added[0].awaiting_reason, "session_start");
    assert.equal(JSON.parse(change.added[0].metadata).transient_process, true);

    const ordinarySessions = await requestJson("/api/sessions?status=active&providers=codex");
    assert.equal(
      ordinarySessions.body.sessions.some((session) => session.id === change.added[0].id),
      false,
      "ordinary paginated API callers keep their durable-only contract"
    );
    const sessions = await requestJson(
      "/api/sessions?status=active&providers=codex&include_transient=1&include_task_progress=1"
    );
    assert.equal(sessions.status, 200);
    const transientSession = sessions.body.sessions.find(
      (session) => session.id === change.added[0].id
    );
    assert.ok(transientSession);
    assert.equal(transientSession.todo_summary, null);

    const agents = await requestJson(
      "/api/agents?status=waiting&providers=codex&include_transient=1"
    );
    assert.equal(agents.status, 200);
    assert.ok(
      agents.body.agents.some((agent) => agent.session_id === change.added[0].id),
      "the dashboard waiting-agent lane receives the same in-memory process"
    );

    assert.deepEqual(
      {
        sessions: tableCount("sessions"),
        agents: tableCount("agents"),
        events: tableCount("events"),
        tokens: tableCount("token_usage"),
        workflows: tableCount("workflows"),
      },
      before,
      "the process overlay must not enter SQLite, history, analytics, or workflows"
    );
  });

  it("honors source and provider scope filters", async () => {
    reconcileCodexProcessOverlay([{ pid: 4401, cwd: "/workspace/scoped" }], []);

    const claude = await requestJson(
      "/api/sessions?status=active&providers=claude&include_transient=1"
    );
    assert.equal(
      claude.body.sessions.some((session) => session.id.startsWith("codex-process:")),
      false
    );

    const remote = await requestJson(
      "/api/agents?status=waiting&sources=remote-host&include_transient=1"
    );
    assert.equal(
      remote.body.agents.some((agent) => agent.id.includes("codex-process:")),
      false
    );
  });

  it("is idempotent, hands off to durable sessions, and disappears on process exit", () => {
    const processInfo = { pid: 4501, cwd: "/workspace/handoff" };
    const started = reconcileCodexProcessOverlay([processInfo], []);
    const transientId = started.added[0].id;

    const repeated = reconcileCodexProcessOverlay([processInfo], []);
    assert.deepEqual(repeated, { added: [], removed: [] });

    const handoff = reconcileCodexProcessOverlay(
      [processInfo],
      [{ id: "durable-codex-id", cwd: processInfo.cwd }]
    );
    assert.equal(handoff.added.length, 0);
    assert.equal(handoff.removed.length, 1);
    assert.equal(handoff.removed[0].id, transientId);
    assert.equal(handoff.removed[0].status, "abandoned");
    assert.equal(getCodexProcessSessions().length, 0);
    assert.equal(getCodexProcessAgents().length, 0);

    const restarted = reconcileCodexProcessOverlay([{ pid: 4502, cwd: "/workspace/exit" }], []);
    assert.equal(restarted.added.length, 1);
    const exited = reconcileCodexProcessOverlay([], []);
    assert.equal(exited.removed[0].id, restarted.added[0].id);
    assert.equal(getCodexProcessSessions().length, 0, "Ctrl+C leaves no history row");
  });

  it("hides the temporary card immediately when a durable row lands before the next poll", async () => {
    const cwd = "/workspace/read-time-handoff";
    const started = reconcileCodexProcessOverlay([{ pid: 4551, cwd }], []);
    const transientId = started.added[0].id;
    const durableId = "durable-read-time-handoff";
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ provider: "codex", transcript_path: null });
    stmts.insertCodexSession.run(
      durableId,
      "Durable Codex session",
      "active",
      cwd,
      "gpt-5.6-terra",
      "local",
      now,
      now,
      metadata
    );
    stmts.insertAgent.run(
      `codex:${durableId}`,
      durableId,
      "Codex",
      "main",
      null,
      "waiting",
      null,
      null,
      metadata
    );

    const sessions = await requestJson(
      "/api/sessions?status=active&providers=codex&include_transient=1"
    );
    assert.ok(sessions.body.sessions.some((session) => session.id === durableId));
    assert.equal(
      sessions.body.sessions.some((session) => session.id === transientId),
      false
    );

    const agents = await requestJson(
      "/api/agents?status=waiting&providers=codex&include_transient=1"
    );
    assert.ok(agents.body.agents.some((agent) => agent.session_id === durableId));
    assert.equal(
      agents.body.agents.some((agent) => agent.session_id === transientId),
      false
    );

    db.prepare("DELETE FROM sessions WHERE id = ?").run(durableId);
  });

  it("switches from the startup card to a selected resumed thread before its first message", async () => {
    const launchCwd = "/workspace/codex-launch";
    const originalCwd = "/workspace/resumed-thread";
    const sessionId = "019fdeac-fede-7250-b7d2-a4bdf6772d3f";
    const agentId = `codex:${sessionId}`;
    const processInfo = { pid: 4571, cwd: launchCwd };
    const started = reconcileCodexProcessOverlay([processInfo], []);
    assert.equal(started.added.length, 1);

    const timestamp = "2026-08-07T21:16:03.000Z";
    const metadata = JSON.stringify({ provider: "codex", transcript_path: null });
    stmts.insertCodexSession.run(
      sessionId,
      "Resumed Codex session",
      "completed",
      originalCwd,
      "gpt-5.6-luna",
      "local",
      timestamp,
      timestamp,
      metadata
    );
    stmts.insertAgent.run(
      agentId,
      sessionId,
      "Codex",
      "main",
      null,
      "completed",
      null,
      null,
      metadata
    );

    const change = await refreshCodexProcessOverlay({
      probe: {
        available: true,
        processes: [{ ...processInfo, sessionId }],
      },
      now: "2026-08-07T21:16:04.000Z",
    });

    assert.equal(change.resumed.length, 1);
    assert.equal(change.resumed[0].session.id, sessionId);
    assert.equal(change.removed.length, 1);
    assert.equal(change.removed[0].id, started.added[0].id);
    assert.equal(getCodexProcessSessions().length, 0);

    const resumedSession = stmts.getSession.get(sessionId);
    const resumedAgent = stmts.getAgent.get(agentId);
    assert.equal(resumedSession.status, "active");
    assert.equal(resumedSession.awaiting_reason, "session_start");
    assert.equal(resumedAgent.status, "waiting");
    assert.equal(resumedAgent.awaiting_reason, "session_start");

    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  });

  it("keeps exactly one placeholder for a second process sharing a durable cwd", () => {
    const cwd = "/workspace/parallel-codex";
    const change = reconcileCodexProcessOverlay(
      [
        { pid: 4601, cwd },
        { pid: 4602, cwd },
      ],
      [{ id: "durable-in-same-cwd", cwd }]
    );

    assert.equal(change.added.length, 1);
    assert.equal(getCodexProcessSessions().length, 1);
  });

  it("keeps a fresh placeholder beside an exactly matched resumed process in the same cwd", () => {
    const cwd = "/workspace/mixed-resume";
    const resumedId = "durable-resumed-in-same-cwd";
    const change = reconcileCodexProcessOverlay(
      [
        { pid: 4603, cwd, sessionId: resumedId },
        { pid: 4604, cwd },
      ],
      [{ id: resumedId, cwd, status: "active" }]
    );

    assert.equal(change.added.length, 1);
    assert.match(change.added[0].id, /^codex-process:4604:/);
    assert.equal(getCodexProcessSessions([{ id: resumedId, cwd, status: "active" }]).length, 1);
  });

  it("does not let completed history hide an unrelated new process in the same cwd", () => {
    const cwd = "/workspace/reused-cwd";
    const change = reconcileCodexProcessOverlay(
      [{ pid: 4603, cwd }],
      [{ id: "completed-history", cwd, status: "completed" }]
    );

    assert.equal(change.added.length, 1);
    assert.equal(getCodexProcessSessions().length, 1);
  });
});
