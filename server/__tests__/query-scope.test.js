/**
 * @file Regression coverage for narrow Codex discovery/card queries and the
 * provider boundary of Claude-format watchdog parsing, without timing thresholds.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-query-scope-"));
process.env.DASHBOARD_DB_PATH = path.join(root, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { db, stmts } = require("../db");
const hooks = require("../routes/hooks");
const ingest = require("../lib/codex-ingest");
const Database = require("better-sqlite3");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
const record = (type, payload) => ({ timestamp: new Date().toISOString(), type, payload });
function rollout(id) {
  const file = path.join(root, "codex", "sessions", `rollout-2026-10-10T12-00-00-${id}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record("session_meta", { id, cwd: "/fixture" })) + "\n");
  ingest.ingestCodexTranscript(file);
  return file;
}

it("card totals ignore tool noise while retaining duplicate and legacy prompt semantics", () => {
  const id = crypto.randomUUID();
  const file = rollout(id);
  assert.equal(JSON.parse(stmts.getSession.get(id).metadata).turn_count, undefined);
  const insert = db.prepare(
    "INSERT INTO events(session_id,agent_id,event_type,summary,data,created_at) VALUES(?,?,?,?,?,?)"
  );
  db.transaction(() => {
    for (let n = 0; n < 2000; n++)
      insert.run(id, `codex:${id}`, "codex_tool_call", "noise", "not-json", "2026-10-09T12:00:00Z");
    for (let n = 0; n < 3; n++)
      insert.run(id, `codex:${id}`, "codex_task_started", null, "{}", "2026-10-09T12:00:00Z");
    for (const turn of ["one", "one", "two", null, null])
      insert.run(
        id,
        `codex:${id}`,
        "codex_user_message",
        `prompt ${turn}`,
        JSON.stringify(turn ? { turn_id: turn } : {}),
        "2026-10-09T12:00:00Z"
      );
  })();
  fs.appendFileSync(file, JSON.stringify(record("event_msg", { type: "task_complete" })) + "\n");
  ingest.ingestCodexTranscript(file);
  assert.equal(JSON.parse(stmts.getSession.get(id).metadata).turn_count, 4);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE session_id=? AND event_type='codex_tool_call'"
      )
      .get(id).n,
    2000
  );
});

it("native state selection matches the legacy query across age boundaries and the 50-row limit", () => {
  const statePath = path.join(root, "codex", "state_5.sqlite");
  const state = new Database(statePath);
  state.exec(
    "CREATE TABLE threads(id TEXT PRIMARY KEY,rollout_path TEXT,created_at REAL,cwd TEXT,model TEXT,model_provider TEXT,cli_version TEXT,archived INTEGER)"
  );
  const insert = state.prepare("INSERT INTO threads VALUES(?,?,?,?,?,?,?,?)");
  const now = Math.floor(Date.now() / 1000) * 1000 + 250;
  const ids = [];
  for (let n = 0; n < 120; n++) {
    const id = crypto.randomUUID();
    ids.push(id);
    insert.run(
      id,
      "missing",
      n < 60 ? now / 1000 - n : now / 1000 - 100000 - n,
      "/fixture",
      "gpt-5.6-terra",
      "openai",
      "test",
      0
    );
  }
  for (const [createdAt, archived] of [
    [now / 1000 + 60, 0],
    [now / 1000 - 10, 0],
    [now / 1000 - 10.001, 0],
    [Math.floor(now / 1000) - 10, 0],
    [now / 1000 + 120, 1],
  ]) {
    const id = crypto.randomUUID();
    ids.push(id);
    insert.run(id, "missing", createdAt, "/fixture", "gpt-5.6-terra", "openai", "test", archived);
  }
  state.close();
  const digest = () => crypto.createHash("sha256").update(fs.readFileSync(statePath)).digest("hex");
  const before = digest();
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    for (const maxAgeMs of [15 * 60 * 1000, 10000, 0, Infinity, NaN]) {
      for (const id of ids) db.prepare("DELETE FROM sessions WHERE id=?").run(id);
      const ro = new Database(statePath, { readonly: true, fileMustExist: true });
      const expected = ro
        .prepare(
          "SELECT id,created_at FROM threads WHERE archived=0 ORDER BY created_at DESC LIMIT 50"
        )
        .all()
        .filter(
          (row) =>
            Number.isFinite(Number(row.created_at) * 1000) &&
            !(now - Number(row.created_at) * 1000 > maxAgeMs)
        )
        .map((row) => row.id);
      ro.close();
      assert.ok(expected.length > 0, "parity is checked on nonempty selections");
      const found = ingest.syncCodexStateSessions({ maxAgeMs });
      assert.deepEqual(
        found.map((row) => row.session.id),
        expected
      );
      assert.ok(found.every((row) => row.session.model === "gpt-5.6-terra"));
      assert.equal(digest(), before, "the Codex-owned database is not modified");
    }
  } finally {
    Date.now = originalNow;
    for (const id of ids) db.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }
});

it("title refresh returns complete changed rows and leaves unchanged metadata intact", () => {
  const id = crypto.randomUUID();
  rollout(id);
  db.prepare("UPDATE sessions SET metadata=?,cwd=?,model=? WHERE id=?").run(
    JSON.stringify({ custom: "kept", large: "x".repeat(100000) }),
    "/kept",
    "gpt-5.6-terra",
    id
  );
  fs.writeFileSync(
    path.join(root, "codex", "session_index.jsonl"),
    JSON.stringify({ id, thread_name: "Native rename" }) + "\n"
  );
  const changed = ingest.refreshCodexSessionTitles();
  assert.equal(changed.length, 1);
  assert.deepEqual(changed[0].session, stmts.getSession.get(id));
  assert.equal(changed[0].session.name, "Native rename");
  assert.equal(changed[0].session.cwd, "/kept");
  assert.equal(JSON.parse(changed[0].session.metadata).custom, "kept");
  const before = stmts.getSession.get(id);
  assert.deepEqual(ingest.refreshCodexSessionTitles(), []);
  assert.deepEqual(stmts.getSession.get(id), before);
});

it("Claude-format watchdog parsing retains Cursor/Claude and skips Codex", async () => {
  const file = path.join(root, "error.jsonl");
  fs.writeFileSync(
    file,
    JSON.stringify({
      isApiErrorMessage: true,
      error: "rate_limit_error",
      message: { content: [{ text: "Rate limit exceeded" }] },
      timestamp: new Date().toISOString(),
    }) + "\n"
  );
  const sessions = [];
  for (const provider of ["claude", "cursor", "codex"]) {
    const id = crypto.randomUUID();
    stmts.insertSession.run(id, "Watchdog", "active", "/fixture", "unknown", null);
    stmts.insertAgent.run(`${id}-main`, id, "Main", "main", null, "working", null, null, null);
    db.prepare("UPDATE sessions SET provider=?,updated_at=? WHERE id=?").run(
      provider,
      new Date(Date.now() - 60000).toISOString(),
      id
    );
    db.prepare(
      "INSERT INTO events(session_id,agent_id,event_type,data,created_at) VALUES(?,?,?,?,?)"
    ).run(
      id,
      `${id}-main`,
      "PreToolUse",
      JSON.stringify({ transcript_path: file }),
      new Date(Date.now() - 60000).toISOString()
    );
    sessions.push({ id, provider });
  }
  const codex = sessions.find((row) => row.provider === "codex");
  const before = {
    session: stmts.getSession.get(codex.id),
    agents: stmts.listAgentsBySession.all(codex.id),
    events: stmts.listEventsBySession.all(codex.id),
  };
  hooks.transcriptCache.invalidate(file);
  await hooks.watchdogCheck();
  for (const row of sessions.filter((row) => row.provider !== "codex"))
    assert.equal(stmts.getSession.get(row.id).status, "error");
  assert.deepEqual(
    {
      session: stmts.getSession.get(codex.id),
      agents: stmts.listAgentsBySession.all(codex.id),
      events: stmts.listEventsBySession.all(codex.id),
    },
    before,
    "liveness is disabled; the Claude parser must not modify the Codex row"
  );
});
