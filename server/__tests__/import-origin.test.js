/**
 * @file Source ownership of mirrored sessions: the source is stamped in the same
 * transaction as the row, ownership follows an origin mark in metadata (surviving
 * deletion of the source without purge), and the exclusion counters are unique ids.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

// Module-level paths are read at require time: set the environment first.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `import-safety-${process.pid}-`));
process.env.CLAUDE_HOME = path.join(TMP_ROOT, "claude");
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");
process.env.DASHBOARD_CODEX_HOME = path.join(TMP_ROOT, "codex");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer, isCodexForeignSessionError } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const remoteSync = require("../lib/remote-sync");
const importHistory = require("../../scripts/import-history");
const { importFromDirectory, syncDefaultProjects, importAllSessions } = importHistory;
const { getTranscriptSnapshotDir } = require("../lib/claude-home");
const { ingestAllWorkflows } = require("../lib/workflow-ingest");
const { getCodexImportSnapshotDir, importCodexFromDirectory } = require("../lib/codex-import");
const {
  ingestCodexTranscript,
  ingestCodexHook,
  refreshCodexSessionTitles,
} = require("../lib/codex-ingest");

const MODEL = "claude-opus-4-8";
let server;
let BASE;
let seq = 0;

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function del(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "DELETE" },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const uid = (p) => `${p}-${process.pid}-${++seq}`;
const newSource = (host = "u@box", config = {}) => {
  const id = uid("src");
  stmts.insertRemoteSource.run(
    id,
    "Box",
    host,
    config.ssh_port ?? null,
    config.identity_file ?? null,
    config.remote_home ?? null,
    config.remote_codex_home ?? null,
    1
  );
  return stmts.getRemoteSource.get(id);
};

// ── Claude fixtures ──────────────────────────────────────────────────────────
function usage(n) {
  return {
    input_tokens: 10 * n,
    output_tokens: 20 * n,
    cache_read_input_tokens: 300 * n,
    cache_creation_input_tokens: 4 * n,
  };
}
function claudeLines(turns) {
  const out = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-09-01T10:00:00.000Z",
      cwd: "/tmp/proj",
      message: { role: "user", content: "hello" },
    }),
  ];
  for (let i = 1; i <= turns; i++) {
    out.push(
      JSON.stringify({
        type: "assistant",
        timestamp: `2026-09-01T10:0${i}:00.000Z`,
        cwd: "/tmp/proj",
        message: {
          id: `msg_${i}`,
          model: MODEL,
          usage: usage(i),
          content: [{ type: "text", text: "x" }],
        },
      })
    );
  }
  return out.join("\n") + "\n";
}
function subLines(n) {
  const rows = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-09-01T10:00:30.000Z",
      message: { role: "user", content: "recon" },
    }),
  ];
  for (let i = 1; i <= n; i++) {
    rows.push(
      JSON.stringify({
        type: "assistant",
        timestamp: `2026-09-01T10:00:${30 + i}.000Z`,
        message: {
          id: `sub_${i}`,
          model: MODEL,
          usage: usage(i),
          content: [{ type: "text", text: "y" }],
        },
      })
    );
  }
  return rows.join("\n") + "\n";
}
function writeSession(stage, sid, turns, subs = []) {
  const dir = path.join(stage, "-tmp-proj");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${sid}.jsonl`), claudeLines(turns));
  subs.forEach((n, i) => {
    const sd = path.join(dir, sid, "subagents");
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, `agent-a${i}.jsonl`), subLines(n));
  });
}
const mkStage = () => fs.mkdtempSync(path.join(TMP_ROOT, "stage-"));

// ── Row snapshots ────────────────────────────────────────────────────────────
function tokenRows(sid) {
  return db
    .prepare(
      `SELECT model, speed, inference_geo, service_tier, context_size, input_tokens, output_tokens,
              cache_read_tokens, cache_write_tokens, cache_write_1h_tokens,
              baseline_input, baseline_output, baseline_cache_read, baseline_cache_write
         FROM token_usage WHERE session_id = ? ORDER BY model, speed, context_size`
    )
    .all(sid);
}
function state(sid, snapPath) {
  const s = stmts.getSession.get(sid);
  return {
    source: s && s.source,
    metadata: s && s.metadata,
    events: db.prepare("SELECT COUNT(*) AS n FROM events WHERE session_id = ?").get(sid).n,
    agents: db.prepare("SELECT COUNT(*) AS n FROM agents WHERE session_id = ?").get(sid).n,
    tokens: tokenRows(sid),
    snapshot: snapPath && fs.existsSync(snapPath) ? fs.readFileSync(snapPath, "utf8") : null,
  };
}
const claudeSnap = (sid) => path.join(getTranscriptSnapshotDir(), `${sid}.jsonl`);

// ── Codex ────────────────────────────────────────────────────────────────────
function codexRollout(stage, sid, turns) {
  const file = path.join(
    stage,
    "sessions",
    "2026",
    "09",
    "01",
    `rollout-2026-09-01T10-00-00-${sid}.jsonl`
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rec = (type, payload, i = 0) =>
    JSON.stringify({ timestamp: `2026-09-01T10:0${i}:00.000Z`, type, payload });
  const lines = [
    rec("session_meta", { id: sid, cwd: "/remote/codex" }),
    rec("turn_context", { model: "gpt-5.6-terra" }),
    rec("event_msg", { type: "user_message", message: "go" }),
  ];
  for (let i = 1; i <= turns; i++) {
    lines.push(
      rec(
        "event_msg",
        {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 100 * i,
              cached_input_tokens: 10 * i,
              output_tokens: 20 * i,
              reasoning_output_tokens: 0,
            },
          },
        },
        i
      )
    );
  }
  lines.push(rec("event_msg", { type: "task_complete" }, turns));
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}
const codexUuid = () => {
  const n = String(++seq).padStart(12, "0");
  return `019fbb99-bd87-7c80-afec-${n}`;
};

const tokensOf = (sid) =>
  db
    .prepare("SELECT COALESCE(SUM(input_tokens),0) AS n FROM token_usage WHERE session_id = ?")
    .get(sid).n;

it("cached remote Codex metadata remains protected after source deletion", async (t) => {
  const { isLocalHistoryOwner } = require("../lib/session-origin");
  for (const [label, metadata, apiMetadata] of [
    ["legacy SQL NULL", null],
    ["legacy empty text", ""],
    ["legacy whitespace text", "  "],
    ["malformed nonempty text", "{broken"],
    ["JSON null", "null"],
    ["API array", "[]", []],
    ["API scalar", "1", 1],
    ["valid object", '{"fixture":"retained"}'],
  ])
    await t.test(label, async () => {
      const sid = codexUuid(),
        source = newSource(),
        stage = mkStage();
      codexRollout(stage, sid, 1);
      await remoteSync.ingestStagedProvider(dbModule, source, "codex", stage);
      const snap = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
      const cursor = { ...stmts.getCodexIngestState.get(snap) };
      assert.equal(
        cursor.byte_offset,
        fs.statSync(snap).size,
        "real importer must consume its canonical snapshot"
      );
      db.prepare("UPDATE sessions SET status='completed' WHERE id=?").run(sid);
      if (apiMetadata !== undefined) {
        const response = await fetch(`${BASE}/api/sessions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metadata: apiMetadata }),
        });
        assert.equal(
          response.status,
          200,
          "non-object metadata must actually be accepted by existing API"
        );
      } else {
        // A schema-valid legacy/corruption fixture, not a claim that the modern
        // importer creates NULL/empty/malformed metadata for new remote rows.
        db.prepare("UPDATE sessions SET metadata=? WHERE id=?").run(metadata, sid);
      }
      assert.equal(stmts.getSession.get(sid).metadata, metadata);
      const result = await remoteSync.ingestStagedProvider(dbModule, source, "codex", stage);
      assert.equal(result.counters.skipped, 1, "cached unchanged import must take the no-op path");
      assert.deepEqual({ ...stmts.getCodexIngestState.get(snap) }, cursor);
      assert.ok(result.ids.includes(sid), "active matching source must still own its cached row");
      const stamped = stmts.getSession.get(sid).metadata;
      assert.equal((await del(`/api/remote-sources/${source.id}`)).status, 200);
      const row = stmts.getSession.get(sid);
      assert.equal(row.source, "local");
      assert.equal(
        isLocalHistoryOwner(row, "codex"),
        false,
        `${label}: cached tail tag and local guard must preserve foreign history`
      );
      if (metadata === null || metadata.trim() === "" || label === "valid object") {
        assert.match(JSON.parse(stamped).origin_host, /^collector-v2:[a-f0-9]{64}$/);
        if (label === "valid object") assert.equal(JSON.parse(stamped).fixture, "retained");
      } else
        assert.equal(stamped, metadata, "nonempty malformed/nonobject bytes must not be migrated");
      const before = { row: { ...row }, state: state(sid, snap) },
        local = mkStage();
      codexRollout(local, sid, 4);
      const refused = await importCodexFromDirectory(local);
      assert.equal(refused.excluded, 1);
      assert.deepEqual({ row: { ...stmts.getSession.get(sid) }, state: state(sid, snap) }, before);
    });
});

it("local Claude directory excludes clean-metadata Codex collisions before snapshot and workflow writes", async () => {
  const sid = uid("local-codex-collision"),
    stage = mkStage(),
    runId = uid("foreign-workflow");
  stmts.insertSession.run(sid, "native Codex", "active", "/tmp/proj", "gpt-fixture", "{}");
  db.prepare("UPDATE sessions SET provider='codex' WHERE id=?").run(sid);
  writeSession(stage, sid, 2, [1]);
  const sessionDir = path.join(stage, "-tmp-proj", sid),
    journals = path.join(sessionDir, "workflows");
  fs.mkdirSync(journals, { recursive: true });
  fs.writeFileSync(
    path.join(journals, `wf_${runId}.json`),
    JSON.stringify({
      runId,
      workflowName: "foreign Claude workflow",
      status: "completed",
      startTime: 1700000000000,
      defaultModel: MODEL,
      workflowProgress: [{ type: "workflow_agent", agentId: "scout", state: "done" }],
    })
  );
  const agents = path.join(sessionDir, "subagents", "workflows", runId);
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(agents, "agent-scout.jsonl"), subLines(2));
  const capture = () => ({
    row: { ...stmts.getSession.get(sid) },
    state: state(sid, claudeSnap(sid)),
    workflows: stmts.listWorkflowsBySession.all(sid),
  });
  const before = capture(),
    result = await importFromDirectory(dbModule, stage);
  assert.deepEqual(
    capture(),
    before,
    "provider collision must not publish Claude snapshot/workflow or mutate events/tokens/agents"
  );
  assert.equal(result.imported, 0);
  assert.equal(result.backfilled, 0);
  assert.equal(result.skipped, 0, "foreign transcripts are excluded, not accepted as skipped");
  assert.equal(result.excluded, 1);
  assert.deepEqual(result.excludedIds, [sid]);
  assert.equal(result.excludedSubagentFiles, 2);
  assert.equal(result.sessionsSeen, 0);
});

it("local-history owner normalizes legacy missing providers but preserves source/origin/metadata gates", () => {
  const { isLocalHistoryOwner } = require("../lib/session-origin");
  for (const provider of [null, "", undefined, "claude"])
    assert.equal(
      isLocalHistoryOwner({ source: "local", metadata: "{}", provider }, "claude"),
      true
    );
  for (const row of [
    { source: "local", provider: "codex", metadata: "{}" },
    { source: "remote", provider: "claude", metadata: "{}" },
    { source: "local", provider: "claude", metadata: '{"origin_host":"legacy"}' },
    { source: "local", provider: "claude", metadata: "{broken" },
  ])
    assert.equal(isLocalHistoryOwner(row, "claude"), false);
  assert.equal(isLocalHistoryOwner(null, "claude"), true);
  assert.equal(
    isLocalHistoryOwner({ source: "local", provider: "codex", metadata: "{}" }, "codex"),
    true
  );
});

describe("configured collector origin prevents cross-configuration orphan adoption", () => {
  for (const provider of ["claude", "codex"]) {
    const write = (stage, sid, turns) =>
      provider === "claude" ? writeSession(stage, sid, turns) : codexRollout(stage, sid, turns);
    const snapshot = (sid) =>
      provider === "claude"
        ? claudeSnap(sid)
        : path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
    it(`${provider}: identical non-default configured collector can re-adopt its orphan`, async () => {
      const sid = provider === "claude" ? uid("same-collector") : codexUuid();
      const config = {
        ssh_port: 2222,
        identity_file: "/tmp/fixture-identity",
        remote_home: "/fixture/claude",
        remote_codex_home: "/fixture/codex",
      };
      const first = newSource("User@box", config),
        stage = mkStage();
      for (const [field, value] of Object.entries(config)) assert.equal(first[field], value);
      write(stage, sid, 1);
      await remoteSync.ingestStagedProvider(dbModule, first, provider, stage);
      const oldTokens = tokensOf(sid),
        origin = JSON.parse(stmts.getSession.get(sid).metadata).origin_host;
      assert.match(origin, /^collector-v2:[a-f0-9]{64}$/);
      assert.equal((await del(`/api/remote-sources/${first.id}`)).status, 200);
      const same = newSource("User@box", config);
      write(stage, sid, 4);
      const result = await remoteSync.ingestStagedProvider(dbModule, same, provider, stage);
      assert.equal(stmts.getSession.get(sid).source, same.id);
      assert.equal(JSON.parse(stmts.getSession.get(sid).metadata).origin_host, origin);
      assert.ok(tokensOf(sid) > oldTokens);
      assert.equal(result.counters.sessions_excluded, 0);
      assert.ok(result.ids.includes(sid));
    });
    for (const [label, host, config] of [
      ["Claude home", "User@box", { remote_home: "/other/claude" }],
      ["Codex home", "User@box", { remote_codex_home: "/other/codex" }],
      ["identity file", "User@box", { identity_file: "/tmp/fixture-identity" }],
      ["absent versus explicit port", "User@box", { ssh_port: 22 }],
      ["SSH user case", "user@box", {}],
    ])
      it(`${provider}: changed ${label} cannot reclaim deleted-source history`, async () => {
        const sid = provider === "claude" ? uid("collector-collision") : codexUuid(),
          first = newSource("User@box"),
          stage = mkStage();
        write(stage, sid, 1);
        await remoteSync.ingestStagedProvider(dbModule, first, provider, stage);
        assert.equal((await del(`/api/remote-sources/${first.id}`)).status, 200);
        const capture = () => ({
          row: { ...stmts.getSession.get(sid) },
          state: state(sid, snapshot(sid)),
        });
        const before = capture(),
          other = newSource(host, config);
        for (const [field, value] of Object.entries(config)) assert.equal(other[field], value);
        write(stage, sid, 4);
        const result = await remoteSync.ingestStagedProvider(dbModule, other, provider, stage);
        assert.deepEqual(capture(), before);
        assert.equal(result.counters.sessions_excluded, 1);
        assert.deepEqual(result.ids, []);
      });
    it(`${provider}: an active different source remains authoritative even with identical collector config`, async () => {
      const sid = provider === "claude" ? uid("active-collector") : codexUuid(),
        first = newSource(),
        stage = mkStage();
      write(stage, sid, 1);
      await remoteSync.ingestStagedProvider(dbModule, first, provider, stage);
      const before = { row: { ...stmts.getSession.get(sid) }, state: state(sid, snapshot(sid)) };
      write(stage, sid, 4);
      const result = await remoteSync.ingestStagedProvider(dbModule, newSource(), provider, stage);
      assert.deepEqual(
        { row: { ...stmts.getSession.get(sid) }, state: state(sid, snapshot(sid)) },
        before
      );
      assert.equal(result.counters.sessions_excluded, 1);
      assert.deepEqual(result.ids, []);
    });
    it(`${provider}: legacy host-only origin cannot authorize orphan re-adoption`, async () => {
      const sid = provider === "claude" ? uid("legacy-collector") : codexUuid(),
        first = newSource(),
        stage = mkStage();
      write(stage, sid, 1);
      await remoteSync.ingestStagedProvider(dbModule, first, provider, stage);
      const meta = JSON.parse(stmts.getSession.get(sid).metadata);
      meta.origin_host = "u@box|";
      db.prepare("UPDATE sessions SET metadata=? WHERE id=?").run(JSON.stringify(meta), sid);
      assert.equal((await del(`/api/remote-sources/${first.id}`)).status, 200);
      const before = { row: { ...stmts.getSession.get(sid) }, state: state(sid, snapshot(sid)) };
      write(stage, sid, 4);
      const result = await remoteSync.ingestStagedProvider(dbModule, newSource(), provider, stage);
      assert.deepEqual(
        { row: { ...stmts.getSession.get(sid) }, state: state(sid, snapshot(sid)) },
        before
      );
      assert.equal(result.counters.sessions_excluded, 1);
      assert.deepEqual(result.ids, []);
    });
  }
});

describe("source is stamped atomically with the row (Claude)", () => {
  it("a failure while stamping leaves no half-imported local row", async () => {
    const sid = uid("atomic");
    const stage = mkStage();
    writeSession(stage, sid, 2);
    const src = newSource();
    const real = stmts.setSessionSource;
    let failed = 0;
    stmts.setSessionSource = {
      run: (...args) => {
        if (args[1] === sid && failed === 0) {
          failed++;
          throw new Error("database is locked");
        }
        return real.run(...args);
      },
    };
    try {
      await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    } finally {
      stmts.setSessionSource = real;
    }
    assert.equal(failed, 1, "the injection must have fired");
    const row = stmts.getSession.get(sid);
    assert.ok(
      !row || row.source === src.id,
      `row must be absent or owned, got source=${row && row.source}`
    );
    // The next cycle imports it with its source.
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.equal(stmts.getSession.get(sid).source, src.id);
    assert.equal(
      JSON.parse(stmts.getSession.get(sid).metadata).origin_host,
      "collector-v2:3d8649ef744fd64b11f130f04af62689285cb0d4704d08bedf6b39c902c0477f"
    );
  });

  it("a crash between insert and tag cannot freeze the session (origin mark wins)", async () => {
    const sid = uid("crash");
    const stage = mkStage();
    writeSession(stage, sid, 1);
    const src = newSource();
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    // Simulate the old failure mode: the row exists but its column says local.
    db.prepare("UPDATE sessions SET source = 'local' WHERE id = ?").run(sid);
    const t1 = tokensOf(sid);
    writeSession(stage, sid, 4);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.ok(tokensOf(sid) > t1, "history keeps growing");
    assert.equal(stmts.getSession.get(sid).source, src.id);
  });
});

describe("source atomic stamp (Codex)", () => {
  it("a new Codex row is born with its source and origin mark", async () => {
    const sid = codexUuid();
    const src = newSource();
    const stage = mkStage();
    codexRollout(stage, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
    const row = stmts.getSession.get(sid);
    assert.equal(row.source, src.id);
    assert.equal(
      JSON.parse(row.metadata).origin_host,
      "collector-v2:3d8649ef744fd64b11f130f04af62689285cb0d4704d08bedf6b39c902c0477f"
    );
  });
});

describe("ownership survives deleting the source without purge", () => {
  it("re-adding the same host adopts its earlier rows again (Claude)", async () => {
    const sid = uid("readd");
    const stage = mkStage();
    writeSession(stage, sid, 1);
    const a = newSource("me@readd-box");
    await remoteSync.ingestStagedProvider(dbModule, a, "claude", stage);
    const t1 = tokensOf(sid);
    assert.equal((await del(`/api/remote-sources/${a.id}`)).status, 200);
    assert.equal(stmts.getSession.get(sid).source, "local");

    const b = newSource("me@readd-box");
    writeSession(stage, sid, 4);
    await remoteSync.ingestStagedProvider(dbModule, b, "claude", stage);
    assert.ok(tokensOf(sid) > t1, "adopted row must grow");
    assert.equal(stmts.getSession.get(sid).source, b.id);
  });

  it("re-adding the same host adopts its earlier rows again (Codex)", async () => {
    const sid = codexUuid();
    const stage = mkStage();
    codexRollout(stage, sid, 1);
    const a = newSource("me@readd-codex");
    await remoteSync.ingestStagedProvider(dbModule, a, "codex", stage);
    assert.equal((await del(`/api/remote-sources/${a.id}`)).status, 200);
    const b = newSource("me@readd-codex");
    codexRollout(stage, sid, 3);
    await remoteSync.ingestStagedProvider(dbModule, b, "codex", stage);
    assert.equal(tokenRows(sid)[0].cache_read_tokens, 30);
    assert.equal(stmts.getSession.get(sid).source, b.id);
  });

  it("a different host does not adopt them; a Mac-local row is never touched", async () => {
    const sid = uid("hostA");
    const stage = mkStage();
    writeSession(stage, sid, 1);
    const a = newSource("me@host-a");
    await remoteSync.ingestStagedProvider(dbModule, a, "claude", stage);
    await del(`/api/remote-sources/${a.id}`);
    const before = state(sid, claudeSnap(sid));
    const other = newSource("me@host-b");
    const stageB = mkStage();
    writeSession(stageB, sid, 5, [1]);
    await remoteSync.ingestStagedProvider(dbModule, other, "claude", stageB);
    assert.deepEqual(state(sid, claudeSnap(sid)), before);

    const loc = uid("macrow");
    stmts.insertSession.run(loc, "mac", "active", "/tmp/proj", MODEL, null);
    const beforeLoc = state(loc);
    const st = mkStage();
    writeSession(st, loc, 3);
    await remoteSync.ingestStagedProvider(dbModule, newSource("me@host-a"), "claude", st);
    assert.deepEqual(state(loc), beforeLoc);
    assert.equal(stmts.getSession.get(loc).source, "local");
  });
});

describe("exclusion counters", () => {
  it("counts unique main ids, subagent files apart, and caps the id list", async () => {
    const stage = mkStage();
    const owned = [];
    for (let i = 0; i < 60; i++) {
      const sid = uid("loc");
      owned.push(sid);
      stmts.insertSession.run(sid, "mac", "active", "/tmp/proj", MODEL, null);
    }
    // 60 foreign main sessions; the first one appears in two project dirs.
    for (const sid of owned) writeSession(stage, sid, 1);
    const dup = path.join(stage, "-tmp-proj-2");
    fs.mkdirSync(dup, { recursive: true });
    fs.writeFileSync(path.join(dup, `${owned[0]}.jsonl`), claudeLines(1));
    // Two orphan subagent files whose parent is a foreign session.
    const sd = path.join(stage, "-tmp-proj", "subagents", owned[1]);
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, "agent-p.jsonl"), subLines(1));
    fs.writeFileSync(path.join(sd, "agent-q.jsonl"), subLines(1));

    const src = newSource();
    const res = await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.equal(res.counters.sessions_excluded, 60);
    assert.equal(res.counters.subagent_files_excluded, 2);
    assert.equal(res.counters.excluded_ids.length, 50);
    assert.ok(res.counters.excluded_ids.every((id) => owned.includes(id)));
    assert.equal(new Set(res.counters.excluded_ids).size, 50);
  });
});

describe("native Codex rollout ownership after remote ingestion", () => {
  for (const deleted of [false, true]) {
    it(`preserves a remote row and cursors when a shorter native copy appears${deleted ? " after source deletion" : ""}`, async () => {
      const sid = codexUuid();
      const stage = mkStage();
      codexRollout(stage, sid, 4);
      const source = newSource();
      await remoteSync.ingestStagedProvider(dbModule, source, "codex", stage);
      if (deleted) await del(`/api/remote-sources/${source.id}`);
      const capture = () => ({
        row: { ...stmts.getSession.get(sid) },
        state: state(sid, path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`)),
        primary: db.prepare("SELECT * FROM codex_ingest_state WHERE session_id=?").all(sid),
        tools: db.prepare("SELECT * FROM codex_tool_ingest_state WHERE session_id=?").all(sid),
      });
      const before = capture();
      const live = codexRollout(process.env.DASHBOARD_CODEX_HOME, sid, 2);
      let thrown = null;
      try {
        // The live sweep calls the ingestor without an import exclusion callback.
        ingestCodexTranscript(live, { liveTranscripts: new Set([path.resolve(live)]) });
      } catch (err) {
        thrown = err;
      }
      assert.match(thrown?.message || "", /another source or provider/);
      // The sweep must classify this as a permanent skip, not a retryable failure.
      assert.equal(isCodexForeignSessionError(thrown), true);
      assert.equal(isCodexForeignSessionError(new Error("SQLITE_BUSY")), false);
      assert.deepEqual(capture(), before);
      assert.equal(stmts.getCodexIngestState.get(live), undefined);
    });
  }

  it("the live sweep skips a foreign-owned rollout without logging an ingest failure", () => {
    // Run the real sweep in a child process with its own database and Codex home,
    // so its watchers cannot touch the other tests in this file.
    const root = fs.mkdtempSync(path.join(TMP_ROOT, "sweep-"));
    const sid = codexUuid();
    const code = `
      const fs = require("node:fs");
      const path = require("node:path");
      const { db, stmts } = require(${JSON.stringify(path.join(__dirname, "../db.js"))});
      stmts.insertSession.run(process.argv[1], "remote", "completed", "/remote", "gpt-5.6-terra", null);
      db.prepare("UPDATE sessions SET provider = 'codex', source = 'src-foreign' WHERE id = ?").run(process.argv[1]);
      const file = path.join(process.env.DASHBOARD_CODEX_HOME, "sessions", "2026", "09", "01",
        "rollout-2026-09-01T10-00-00-" + process.argv[1] + ".jsonl");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const rec = (type, payload) => JSON.stringify({ timestamp: "2026-09-01T10:00:00.000Z", type, payload });
      fs.writeFileSync(file, [
        rec("session_meta", { id: process.argv[1], cwd: "/local/codex" }),
        rec("turn_context", { model: "gpt-5.6-terra" }),
        rec("event_msg", { type: "user_message", message: "go" }),
      ].join("\\n") + "\\n");
      // A locally owned rollout with an older mtime: the sweep takes the newest
      // file first, so once this one is ingested the foreign one was handled.
      const ownedId = process.argv[2];
      const owned = path.join(path.dirname(file), "rollout-2026-09-01T09-00-00-" + ownedId + ".jsonl");
      fs.writeFileSync(owned, [
        rec("session_meta", { id: ownedId, cwd: "/local/codex" }),
        rec("turn_context", { model: "gpt-5.6-terra" }),
        rec("event_msg", { type: "user_message", message: "go" }),
      ].join("\\n") + "\\n");
      const old = new Date(fs.statSync(file).mtimeMs - 60000);
      fs.utimesSync(owned, old, old);
      const warnings = [];
      console.warn = (...args) => warnings.push(args.join(" "));
      require(${JSON.stringify(path.join(__dirname, "../index.js"))}).startCodexSessionSync(() => {});
      const deadline = Date.now() + 20000;
      const report = () => {
        const sweptOwned = !!stmts.getSession.get(ownedId);
        if (!sweptOwned && Date.now() < deadline) return setTimeout(report, 50);
        const row = stmts.getSession.get(process.argv[1]);
        process.stdout.write(JSON.stringify({
          sweptOwned,
          failures: warnings.filter((w) => w.includes("[CODEX SYNC]")),
          source: row.source,
          cursor: stmts.getCodexIngestState.get(file) || null,
        }));
        process.exit(0);
      };
      report();
    `;
    const result = spawnSync(process.execPath, ["-e", code, sid, codexUuid()], {
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_HOME: path.join(root, "claude"),
        DASHBOARD_DATA_DIR: path.join(root, "data"),
        DASHBOARD_DB_PATH: path.join(root, "dashboard.db"),
        DASHBOARD_CODEX_HOME: path.join(root, "codex"),
        DASHBOARD_CODEX_SYNC_MS: "0",
        DASHBOARD_LIVENESS_PROBE: "0",
        DASHBOARD_REMOTE_SYNC_MS: "0",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.sweptOwned, true, "the sweep ran past the foreign rollout");
    assert.deepEqual(out.failures, [], "a foreign owner is a skip, not a retryable ingest failure");
    assert.equal(out.source, "src-foreign");
    assert.equal(out.cursor, null);
  });

  it("keeps the native owner when the remote copy arrives later", async () => {
    const sid = codexUuid();
    const live = codexRollout(process.env.DASHBOARD_CODEX_HOME, sid, 2);
    ingestCodexTranscript(live, { liveTranscripts: new Set([path.resolve(live)]) });
    const before = { row: { ...stmts.getSession.get(sid) }, state: state(sid) };
    const stage = mkStage();
    codexRollout(stage, sid, 4);
    await remoteSync.ingestStagedProvider(dbModule, newSource(), "codex", stage);
    assert.deepEqual({ row: { ...stmts.getSession.get(sid) }, state: state(sid) }, before);
  });
});

it("a local Codex archive cannot overwrite a remote-owned snapshot", async () => {
  const sid = codexUuid();
  const stage = mkStage();
  codexRollout(stage, sid, 4);
  await remoteSync.ingestStagedProvider(dbModule, newSource(), "codex", stage);
  const snap = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
  const before = state(sid, snap);
  const local = mkStage();
  codexRollout(local, sid, 2);
  await importCodexFromDirectory(local);
  assert.deepEqual(state(sid, snap), before);
});

for (const deleted of [false, true]) {
  it(`a local Claude sweep preserves remote ownership${deleted ? " after source deletion" : ""}`, async () => {
    const sid = uid("local-collision");
    const stage = mkStage();
    writeSession(stage, sid, 2);
    const source = newSource();
    await remoteSync.ingestStagedProvider(dbModule, source, "claude", stage);
    if (deleted) await del(`/api/remote-sources/${source.id}`);
    const before = { row: { ...stmts.getSession.get(sid) }, state: state(sid, claudeSnap(sid)) };
    const projects = path.join(process.env.CLAUDE_HOME, "projects");
    writeSession(projects, sid, 4);
    const localFile = path.join(projects, "-tmp-proj", `${sid}.jsonl`);
    const future = new Date("2099-01-01T00:00:00Z");
    fs.utimesSync(localFile, future, future);
    await syncDefaultProjects(dbModule, new Map());
    assert.deepEqual(
      { row: { ...stmts.getSession.get(sid) }, state: state(sid, claudeSnap(sid)) },
      before
    );
  });
}

it("a shorter native copy does not reset an imported local snapshot cursor", async () => {
  const sid = codexUuid();
  const stage = mkStage();
  codexRollout(stage, sid, 4);
  await importCodexFromDirectory(stage);
  const snap = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
  const before = {
    row: { ...stmts.getSession.get(sid) },
    state: state(sid, snap),
    tools: db.prepare("SELECT * FROM codex_tool_ingest_state WHERE session_id=?").all(sid),
  };
  const live = codexRollout(process.env.DASHBOARD_CODEX_HOME, sid, 2);
  ingestCodexTranscript(live, { liveTranscripts: new Set([path.resolve(live)]) });
  assert.deepEqual(
    {
      row: { ...stmts.getSession.get(sid) },
      state: state(sid, snap),
      tools: db.prepare("SELECT * FROM codex_tool_ingest_state WHERE session_id=?").all(sid),
    },
    before
  );
  assert.equal(stmts.getCodexIngestState.get(live), undefined);
  assert.equal(stmts.getCodexToolIngestState.get(live), undefined);
});

for (const deleted of [false, true]) {
  it(`native Codex titles and no-rollout hooks preserve remote history${deleted ? " after source deletion" : ""}`, async () => {
    const sid = codexUuid();
    const stage = mkStage();
    codexRollout(stage, sid, 2);
    const source = newSource();
    await remoteSync.ingestStagedProvider(dbModule, source, "codex", stage);
    if (deleted) await del(`/api/remote-sources/${source.id}`);
    const before = { row: { ...stmts.getSession.get(sid) }, state: state(sid) };
    fs.writeFileSync(
      path.join(process.env.DASHBOARD_CODEX_HOME, "session_index.jsonl"),
      JSON.stringify({ id: sid, thread_name: `Foreign native title ${deleted}` }) + "\n"
    );
    refreshCodexSessionTitles();
    ingestCodexHook(null, "SessionStart", { session_id: sid, cwd: "/local/codex" });
    assert.deepEqual({ row: { ...stmts.getSession.get(sid) }, state: state(sid) }, before);
  });
}

// ── Default Claude history: rescan and periodic sweep ───────────────────────
const projectsDir = () => path.join(process.env.CLAUDE_HOME, "projects");
function writeLiveWorkflow(root, sid, runId, agentId) {
  const runDir = path.join(root, "-tmp-proj", sid, "subagents", "workflows", runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, `agent-${agentId}.jsonl`), subLines(2));
  fs.writeFileSync(
    path.join(runDir, "journal.jsonl"),
    [
      JSON.stringify({ type: "started", agentId }),
      JSON.stringify({ type: "result", agentId, result: "ok" }),
    ].join("\n") + "\n"
  );
}

for (const deleted of [false, true]) {
  it(`the default rescan leaves remote-owned history untouched${deleted ? " after source deletion" : ""}`, async () => {
    const sid = uid("rescan-collision");
    const stage = mkStage();
    writeSession(stage, sid, 2);
    const source = newSource();
    await remoteSync.ingestStagedProvider(dbModule, source, "claude", stage);
    if (deleted) assert.equal((await del(`/api/remote-sources/${source.id}`)).status, 200);
    writeSession(projectsDir(), sid, 4, [1]);
    writeLiveWorkflow(projectsDir(), sid, uid("wf-foreign"), "scout");
    const capture = () => ({
      row: { ...stmts.getSession.get(sid) },
      state: state(sid, claudeSnap(sid)),
      workflows: stmts.listWorkflowsBySession.all(sid),
    });
    const before = capture();
    await importAllSessions(dbModule);
    assert.deepEqual(
      capture(),
      before,
      "a foreign row gets no events, tokens, agents, snapshot or workflow links"
    );
  });
}

for (const remote of [true, false]) {
  it(`the first-boot workflow backfill ${remote ? "leaves a remote-owned row alone" : "still links a local row"}`, async () => {
    const sid = uid(remote ? "backfill-foreign" : "backfill-local");
    const runId = uid("wf-backfill");
    if (remote) {
      const stage = mkStage();
      writeSession(stage, sid, 2);
      await remoteSync.ingestStagedProvider(dbModule, newSource(), "claude", stage);
      // A legacy row without a stored transcript path resolves through its cwd to a same-id local file.
      db.prepare("UPDATE sessions SET transcript_path = NULL WHERE id = ?").run(sid);
    } else {
      stmts.insertSession.run(sid, "live local", "active", "/tmp/proj", MODEL, null);
      stmts.insertAgent.run(
        `${sid}-main`,
        sid,
        "Main Agent",
        "main",
        null,
        "working",
        null,
        null,
        null
      );
    }
    writeSession(projectsDir(), sid, 4, [1]);
    writeLiveWorkflow(projectsDir(), sid, runId, "scout");
    const before = stmts.listWorkflowsBySession.all(sid);
    await ingestAllWorkflows(dbModule);
    const linked = stmts.getAgent.get(`${sid}-jsonl-scout`)?.workflow_run_id ?? null;
    if (remote) {
      assert.deepEqual(stmts.listWorkflowsBySession.all(sid), before, "no workflow rows");
      assert.equal(linked, null, "no local workflow agents under the remote row");
    } else {
      assert.equal(linked, runId, "the local row's workflow agents are linked");
    }
  });
}

it("the default rescan still publishes a locally owned row it leaves unchanged", async () => {
  const sid = uid("rescan-local");
  const runId = uid("wf-local");
  stmts.insertSession.run(sid, "live local", "active", "/tmp/proj", MODEL, null);
  // Workflow agents are inserted under the session's main agent, so the live row needs one.
  stmts.insertAgent.run(
    `${sid}-main`,
    sid,
    "Main Agent",
    "main",
    null,
    "working",
    null,
    null,
    null
  );
  writeSession(projectsDir(), sid, 2);
  writeLiveWorkflow(projectsDir(), sid, runId, "scout");
  const metadata = stmts.getSession.get(sid).metadata;
  await importAllSessions(dbModule);
  assert.equal(stmts.getSession.get(sid).metadata, metadata, "hook-owned row stays unimported");
  assert.ok(fs.existsSync(claudeSnap(sid)), "its transcript is still snapshotted");
  const linked = db
    .prepare("SELECT workflow_run_id FROM agents WHERE id = ?")
    .get(`${sid}-jsonl-scout`);
  assert.equal(linked?.workflow_run_id, runId, "its workflow agents are still linked");
});

it("the periodic sweep re-checks ownership after its awaited parse", async () => {
  const sid = uid("sweep-race");
  writeSession(projectsDir(), sid, 2);
  const file = path.resolve(projectsDir(), "-tmp-proj", `${sid}.jsonl`);
  const source = newSource();
  const realStream = fs.createReadStream;
  let claimed = false;
  fs.createReadStream = function (target, ...rest) {
    if (!claimed && path.resolve(String(target)) === file) {
      // Remote-sync creates and owns the row while the transcript is parsed.
      claimed = true;
      const origin = JSON.stringify({ origin_host: "fixture-remote" });
      stmts.insertSession.run(sid, "remote", "completed", "/tmp/proj", MODEL, origin);
      stmts.setSessionSource.run(source.id, sid);
    }
    return realStream.call(this, target, ...rest);
  };
  let result;
  try {
    result = await syncDefaultProjects(dbModule, { mtimeCache: new Map() });
  } finally {
    fs.createReadStream = realStream;
  }
  assert.equal(claimed, true, "the claim fired during the parse");
  assert.equal(
    result.changed.some((entry) => entry.sessionId === sid),
    false
  );
  assert.equal(fs.existsSync(claudeSnap(sid)), false, "no local snapshot of remote history");
  assert.equal(state(sid).events, 0);
  assert.deepEqual(tokenRows(sid), []);
  assert.equal(stmts.getSession.get(sid).source, source.id);
});
