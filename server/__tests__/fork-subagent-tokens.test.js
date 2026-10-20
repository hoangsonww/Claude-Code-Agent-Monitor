/**
 * @file Tests that a forked subagent's copy of its parent's spawning message is
 * not counted as usage. A fork transcript starts with a `fork-context-ref` line
 * and repeats the parent's message that holds the Agent tool call (same
 * message.id and usage, `parentUuid: null`); the parent transcript already
 * counts that request. Covers the record predicate, both transcript parsers,
 * the live hook path (main + fork subagents), and the reset-baselines
 * re-derivation that removes an over-count stored by earlier builds.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `fork-subagent-tokens-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const CWD = "/tmp/fork-subagent-tokens";
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", CWD.replace(/[^a-zA-Z0-9]/g, "-"));
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const TranscriptCache = require("../lib/transcript-cache");
const { isInheritedForkRecord } = require("../lib/token-usage");
const { parseSubagentFile, reconcileTokens } = require("../../scripts/import-history");

const OPUS = "claude-opus-5-5";

let server;
let BASE;

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const r = http.request(
      new URL(urlPath, BASE),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    r.on("error", reject);
    r.end(payload);
  });
}

/** One Opus response; `extra` sets the sidechain fields of a fork's copy. */
const assistant = (id, usage, extra = {}) => ({
  type: "assistant",
  uuid: `u-${id}-${extra.isSidechain ? "side" : "main"}`,
  parentUuid: "p-1",
  timestamp: "2026-10-07T09:50:56.729Z",
  message: {
    id,
    model: OPUS,
    usage,
    content: [{ type: "tool_use", id: `t-${id}`, name: "Agent" }],
  },
  ...extra,
});

const SPAWN_USAGE = {
  input_tokens: 2,
  output_tokens: 6093,
  cache_read_input_tokens: 52606,
  cache_creation_input_tokens: 4420,
};
const OWN_USAGE = {
  input_tokens: 3,
  output_tokens: 100,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200,
};

/** A fork transcript: the context ref, the copied spawning message, then its own reply. */
function forkLines(sessionId, agentId) {
  return [
    { type: "fork-context-ref", agentId, parentSessionId: sessionId, contextLength: 4 },
    assistant("msg-spawn", SPAWN_USAGE, { isSidechain: true, agentId, parentUuid: null }),
    {
      type: "user",
      uuid: `r-${agentId}`,
      parentUuid: "u-msg-spawn-side",
      isSidechain: true,
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t-msg-spawn", content: "Fork started" }],
      },
    },
    assistant(`msg-own-${agentId}`, OWN_USAGE, { isSidechain: true, agentId }),
  ];
}

/** Main transcript holding the spawning message, plus `forks` fork transcripts. */
function writeSession(sessionId, forks) {
  const main = path.join(PROJECT_DIR, `${sessionId}.jsonl`);
  const lines = [
    { type: "user", uuid: "p-1", parentUuid: null, message: { role: "user", content: "review" } },
    assistant("msg-spawn", SPAWN_USAGE),
  ];
  fs.writeFileSync(main, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const subDir = path.join(PROJECT_DIR, sessionId, "subagents");
  fs.mkdirSync(subDir, { recursive: true });
  for (let i = 0; i < forks; i++) {
    const agentId = `fork${i}`;
    fs.writeFileSync(
      path.join(subDir, `agent-${agentId}.jsonl`),
      forkLines(sessionId, agentId)
        .map((l) => JSON.stringify(l))
        .join("\n") + "\n"
    );
  }
  return main;
}

const opusTotals = (sessionId) =>
  stmts.getTokensBySession
    .all(sessionId)
    .filter((r) => r.model === OPUS)
    .reduce(
      (t, r) => ({
        output: t.output + r.output_tokens,
        cacheRead: t.cacheRead + r.cache_read_tokens,
        cacheWrite: t.cacheWrite + r.cache_write_tokens,
      }),
      { output: 0, cacheRead: 0, cacheWrite: 0 }
    );

/** Spawning message once, plus each fork's own reply. */
const expected = (forks) => ({
  output: SPAWN_USAGE.output_tokens + forks * OWN_USAGE.output_tokens,
  cacheRead: SPAWN_USAGE.cache_read_input_tokens + forks * OWN_USAGE.cache_read_input_tokens,
  cacheWrite:
    SPAWN_USAGE.cache_creation_input_tokens + forks * OWN_USAGE.cache_creation_input_tokens,
});

describe("forked subagent copies of the parent's spawning message", () => {
  it("isInheritedForkRecord matches only a sidechain assistant record with a null parent", () => {
    assert.equal(
      isInheritedForkRecord({ type: "assistant", isSidechain: true, parentUuid: null }),
      true
    );
    assert.equal(
      isInheritedForkRecord({ type: "assistant", isSidechain: true, parentUuid: "x" }),
      false
    );
    assert.equal(
      isInheritedForkRecord({ type: "assistant", isSidechain: false, parentUuid: null }),
      false
    );
    // Older transcripts carry neither field — their records still count.
    assert.equal(isInheritedForkRecord({ type: "assistant" }), false);
    assert.equal(
      isInheritedForkRecord({ type: "user", isSidechain: true, parentUuid: null }),
      false
    );
    assert.equal(isInheritedForkRecord(null), false);
  });

  it("both parsers count only the fork's own reply", async () => {
    writeSession("fork-parse", 1);
    const file = path.join(PROJECT_DIR, "fork-parse", "subagents", "agent-fork0.jsonl");
    for (const tokensByModel of [
      (await parseSubagentFile(file)).tokensByModel,
      new TranscriptCache().extract(file).tokensByModel,
    ]) {
      const buckets = Object.values(tokensByModel);
      assert.equal(buckets.length, 1);
      assert.equal(buckets[0].output, OWN_USAGE.output_tokens);
      assert.equal(buckets[0].cacheWrite, OWN_USAGE.cache_creation_input_tokens);
    }
  });

  it("the live hook path counts the spawning message once across five forks", async () => {
    const sid = "fork-live-0000-0000-0000-000000000001";
    const main = writeSession(sid, 5);
    const status = await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd: CWD, transcript_path: main },
    });
    assert.equal(status, 200);
    assert.deepEqual(opusTotals(sid), expected(5));
  });

  it("a reset-baselines re-read removes a stored per-fork over-count", async () => {
    const sid = "fork-repair-0000-0000-0000-000000000002";
    const main = writeSession(sid, 5);
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, cwd: CWD, transcript_path: main },
    });
    // What an earlier build stored: the copy counted once per fork.
    db.prepare(
      `UPDATE token_usage SET baseline_cache_write = ?, baseline_output = ?
        WHERE session_id = ? AND model = ?`
    ).run(5 * SPAWN_USAGE.cache_creation_input_tokens, 5 * SPAWN_USAGE.output_tokens, sid, OPUS);
    assert.notDeepEqual(opusTotals(sid), expected(5));

    await reconcileTokens(dbModule, { all: true, sessionIds: [sid], resetBaselines: true });
    assert.deepEqual(opusTotals(sid), expected(5));
  });
});
