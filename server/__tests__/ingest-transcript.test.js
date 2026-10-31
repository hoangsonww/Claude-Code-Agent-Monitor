/**
 * @file ingest-transcript.test.js
 * @description HTTP-level regression coverage for authenticated remote transcript uploads,
 * storage containment, and metadata-only synchronization that preserves session liveness
 * and remote title precedence.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const STAMP = `ingest-transcript-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
fs.mkdirSync(TMP, { recursive: true });

const { createApp, startServer } = require("../index");
const { closeWebSocket } = require("../websocket");
const { db, stmts } = require("../db");

const TOKEN = "test-ingest-transcript-token-xyz";

let server;
let baseUrl;

before(async () => {
  server = await startServer(createApp(), 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  closeWebSocket();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db.open) db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.REMOTE_PUSH_TOKEN = TOKEN;
});

afterEach(() => {
  delete process.env.REMOTE_PUSH_TOKEN;
  delete process.env.REMOTE_PUSH_TOKEN_FILE;
});

async function postJson(route, body, token = TOKEN) {
  const headers = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function registerRemoteSession(sessionId) {
  const result = await postJson("/api/hooks/ingest-batch", {
    session_id: sessionId,
    provider: "claude",
    session_name: "fixed-name",
  });
  assert.equal(result.response.status, 200);
  assert.equal(stmts.getSession.get(sessionId).source, "remote_push");
}

async function waitFor(readValue, predicate, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = readValue();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("timed out waiting for asynchronous transcript synchronization");
}

describe("POST /api/hooks/ingest-transcript", () => {
  it("authenticates malformed JSON before invoking the enlarged body parser", async () => {
    const response = await fetch(`${baseUrl}/api/hooks/ingest-transcript`, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
        "content-type": "application/json",
      },
      body: "{",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "EUNAUTHORIZED", message: "missing or invalid remote-push token" },
    });
  });

  it("preserves the inactivity timestamp while syncing transcript-derived metadata", async () => {
    const sessionId = crypto.randomUUID();
    await registerRemoteSession(sessionId);

    const staleTimestamp = "2000-01-01T00:00:00.000Z";
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(staleTimestamp, sessionId);
    const transcriptLine =
      JSON.stringify({
        type: "user",
        uuid: crypto.randomUUID(),
        timestamp: "2026-10-11T00:00:00.000Z",
        message: { role: "user", content: "review prompt" },
      }) + "\n";

    const result = await postJson("/api/hooks/ingest-transcript", {
      session_id: sessionId,
      rel_path: `remote-project/${sessionId}.jsonl`,
      offset: 0,
      content_b64: Buffer.from(transcriptLine).toString("base64"),
      sync: true,
    });
    assert.equal(result.response.status, 200);

    const session = await waitFor(
      () => stmts.getSession.get(sessionId),
      (row) => row.card_prompt_preview === "review prompt"
    );
    assert.equal(session.updated_at, staleTimestamp);
    assert.equal(session.status, "active");
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM events WHERE session_id = ? AND event_type = 'RemoteSync'"
        )
        .get(sessionId).count,
      0
    );
  });

  it("keeps a remote custom title matching the cwd folder over the first prompt", async () => {
    const sessionId = crypto.randomUUID();
    const created = await postJson("/api/hooks/ingest-batch", {
      session_id: sessionId,
      provider: "claude",
      session_name: "[workstation] myrepo",
      cwd: "/tmp/myrepo",
    });
    assert.equal(created.response.status, 200);

    const transcript = [
      { type: "user", message: { role: "user", content: "Fix the build errors please" } },
      { type: "custom-title", customTitle: "myrepo", sessionId },
    ]
      .map((line) => JSON.stringify(line))
      .join("\n");
    const uploaded = await postJson("/api/hooks/ingest-transcript", {
      session_id: sessionId,
      rel_path: `myrepo/${sessionId}.jsonl`,
      offset: 0,
      content_b64: Buffer.from(`${transcript}\n`).toString("base64"),
      sync: true,
    });
    assert.equal(uploaded.response.status, 200);

    const session = await waitFor(
      () => stmts.getSession.get(sessionId),
      (row) => row.card_prompt_preview === "Fix the build errors please"
    );
    assert.equal(session.name, "[workstation] myrepo");
  });

  it("does not reactivate an error session during metadata-only synchronization", async () => {
    const sessionId = crypto.randomUUID();
    await registerRemoteSession(sessionId);
    db.prepare("UPDATE sessions SET status = 'error' WHERE id = ?").run(sessionId);
    db.prepare("UPDATE agents SET status = 'error' WHERE id = ?").run(`${sessionId}-main`);
    const transcriptLine =
      JSON.stringify({
        type: "user",
        uuid: crypto.randomUUID(),
        timestamp: "2026-10-11T00:00:00.000Z",
        message: { role: "user", content: "error-session-sync" },
      }) + "\n";

    const result = await postJson("/api/hooks/ingest-transcript", {
      session_id: sessionId,
      rel_path: `error-project/${sessionId}.jsonl`,
      offset: 0,
      content_b64: Buffer.from(transcriptLine).toString("base64"),
      sync: true,
    });
    assert.equal(result.response.status, 200);

    const session = await waitFor(
      () => stmts.getSession.get(sessionId),
      (row) => row.card_prompt_preview === "error-session-sync"
    );
    assert.equal(session.status, "error");
    assert.equal(stmts.getAgent.get(`${sessionId}-main`).status, "error");
  });

  it("replaces an origin-machine transcript path with the uploaded local main file", async () => {
    const sessionId = crypto.randomUUID();
    await registerRemoteSession(sessionId);
    stmts.replaceSessionTranscriptPath.run(
      "/origin-machine/.claude/projects/session.jsonl",
      sessionId
    );
    const transcriptLine =
      JSON.stringify({
        type: "user",
        uuid: crypto.randomUUID(),
        timestamp: "2026-10-11T00:00:00.000Z",
        message: { role: "user", content: "local-path-sync" },
      }) + "\n";

    const result = await postJson("/api/hooks/ingest-transcript", {
      session_id: sessionId,
      rel_path: `path-project/${sessionId}.jsonl`,
      offset: 0,
      content_b64: Buffer.from(transcriptLine).toString("base64"),
      sync: true,
    });
    assert.equal(result.response.status, 200);

    const session = await waitFor(
      () => stmts.getSession.get(sessionId),
      (row) => row.card_prompt_preview === "local-path-sync"
    );
    assert.equal(
      session.transcript_path,
      path.join(process.env.CLAUDE_HOME, "projects", "path-project", `${sessionId}.jsonl`)
    );
  });

  it(
    "returns INVALID_INPUT when the final transcript target is a symbolic link",
    {
      skip:
        process.platform === "win32"
          ? "creating file symlinks requires elevated privileges"
          : false,
    },
    async () => {
      const sessionId = crypto.randomUUID();
      await registerRemoteSession(sessionId);
      const projectsDir = path.join(process.env.CLAUDE_HOME, "projects");
      const projectDir = path.join(projectsDir, "symlink-project");
      fs.mkdirSync(projectDir, { recursive: true });
      const realFile = path.join(projectsDir, "safe-target.jsonl");
      fs.writeFileSync(realFile, "");
      fs.symlinkSync(realFile, path.join(projectDir, `${sessionId}.jsonl`), "file");

      const result = await postJson("/api/hooks/ingest-transcript", {
        session_id: sessionId,
        rel_path: `symlink-project/${sessionId}.jsonl`,
        offset: 0,
        content_b64: Buffer.from("must-not-follow\n").toString("base64"),
      });

      assert.equal(result.response.status, 400);
      assert.deepEqual(result.body, {
        error: {
          code: "INVALID_INPUT",
          message: "transcript target must not be a symbolic link",
        },
      });
      assert.equal(fs.readFileSync(realFile, "utf8"), "");
    }
  );
});
