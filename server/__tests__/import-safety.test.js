/**
 * @file Import-safety regressions for the remote-source mirror pipeline.
 *
 * A remote staging tree must never write into a session row that belongs to a
 * different source (including `local`): no events, no token rows, no transcript
 * snapshot, no `sessions.source` re-tagging, and no exposure to
 * `DELETE /api/remote-sources/:id?purge=true`. Sessions of the SAME source and
 * new ones keep importing as before. Also covers the existing-session branch of
 * importSession (tokens are always reconciled, not only when subagents carry
 * tokens) and the tail-first reader behind lastTranscriptActivityMs.
 *
 * Covers both providers (Claude `importFromDirectory`, Codex
 * `importCodexFromDirectory`) through `remote-sync.ingestStagedProvider`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
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

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const remoteSync = require("../lib/remote-sync");
const { importFromDirectory } = require("../../scripts/import-history");
const { getTranscriptSnapshotDir } = require("../lib/claude-home");
const { getCodexImportSnapshotDir } = require("../lib/codex-import");

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
const newSource = () => {
  const id = uid("src");
  stmts.insertRemoteSource.run(id, "Box", "u@box", null, null, null, null, 1);
  return { id };
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

describe("remote staging never writes into another source's session (Claude)", () => {
  for (const imported of [true, false]) {
    it(`leaves a local row untouched (metadata.imported=${imported})`, async () => {
      const sid = uid("loc");
      const localStage = mkStage();
      writeSession(localStage, sid, 1);
      if (imported) {
        await importFromDirectory(dbModule, localStage);
        assert.equal(JSON.parse(stmts.getSession.get(sid).metadata).imported, true);
      } else {
        stmts.insertSession.run(sid, "local live", "active", "/tmp/proj", MODEL, null);
        fs.mkdirSync(getTranscriptSnapshotDir(), { recursive: true });
        fs.writeFileSync(claudeSnap(sid), "LOCAL-BYTES\n");
      }
      const before = state(sid, claudeSnap(sid));

      // The remote machine has a longer transcript of the same id (+ a subagent).
      const src = newSource();
      const stage = mkStage();
      writeSession(stage, sid, 4, [2]);
      const res = await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);

      assert.deepEqual(state(sid, claudeSnap(sid)), before);
      assert.equal(stmts.getSession.get(sid).source, "local");
      assert.ok(!res.ids.includes(sid), "foreign id must not be reported as tagged");
      assert.equal(
        fs.existsSync(path.join(getTranscriptSnapshotDir(), sid, "subagents")),
        false,
        "subagent snapshot must not be written either"
      );

      const purge = await del(`/api/remote-sources/${src.id}?purge=true`);
      assert.equal(purge.status, 200);
      assert.ok(stmts.getSession.get(sid), "purge must not delete the local row");
      assert.deepEqual(state(sid, claudeSnap(sid)), before);
    });
  }

  it("leaves another remote source's row untouched", async () => {
    const sid = uid("other");
    const a = newSource();
    const b = newSource();
    const stageA = mkStage();
    writeSession(stageA, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, a, "claude", stageA);
    assert.equal(stmts.getSession.get(sid).source, a.id);
    const before = state(sid, claudeSnap(sid));

    const stageB = mkStage();
    writeSession(stageB, sid, 3, [1]);
    await remoteSync.ingestStagedProvider(dbModule, b, "claude", stageB);
    assert.deepEqual(state(sid, claudeSnap(sid)), before);
  });

  it("does not attach a staged orphan subagent to a foreign session", async () => {
    const sid = uid("orph");
    stmts.insertSession.run(sid, "local", "active", "/tmp/proj", MODEL, null);
    stmts.insertAgent.run(`${sid}-main`, sid, "Main", "main", null, "working", null, null, null);
    const before = state(sid, claudeSnap(sid));
    const stage = mkStage();
    const sd = path.join(stage, "-tmp-proj", "subagents", sid);
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, "agent-z.jsonl"), subLines(2));
    await remoteSync.ingestStagedProvider(dbModule, newSource(), "claude", stage);
    assert.deepEqual(state(sid, claudeSnap(sid)), before);
  });

  it("keeps importing sessions of the same source and new ones", async () => {
    const src = newSource();
    const sid = uid("mine");
    const stage = mkStage();
    writeSession(stage, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.equal(stmts.getSession.get(sid).source, src.id);
    const e1 = state(sid).events;

    const fresh = uid("fresh");
    writeSession(stage, sid, 3);
    writeSession(stage, fresh, 2);
    const res = await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.ok(state(sid).events > e1, "same-source session must gain events");
    assert.equal(stmts.getSession.get(fresh).source, src.id);
    assert.ok(res.ids.includes(sid) && res.ids.includes(fresh));
  });
});

describe("existing imported session: tokens always reconciled", () => {
  async function cleanTokens(turns, subs) {
    const sid = uid("clean");
    const stage = mkStage();
    writeSession(stage, sid, turns, subs);
    await importFromDirectory(dbModule, stage);
    return tokenRows(sid);
  }

  it("a session without subagents growing over 3 cycles equals a clean import", async () => {
    const src = newSource();
    const sid = uid("grow");
    const stage = mkStage();
    for (const turns of [1, 2, 4]) {
      writeSession(stage, sid, turns);
      await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    }
    assert.deepEqual(tokenRows(sid), await cleanTokens(4, []));
  });

  it("parent imported before its subagents equals a clean import", async () => {
    const src = newSource();
    const sid = uid("late");
    const stage = mkStage();
    writeSession(stage, sid, 2);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    writeSession(stage, sid, 3, [2, 1]);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    writeSession(stage, sid, 4, [3, 1]);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    assert.deepEqual(tokenRows(sid), await cleanTokens(4, [3, 1]));
  });
});

describe("existing imported session: subagents without tokens", () => {
  it("parent growth is still recorded when its subagent files carry no tokens", async () => {
    const src = newSource();
    const sid = uid("zero");
    const stage = mkStage();
    writeSession(stage, sid, 2);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    writeSession(stage, sid, 4, [0]);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    const clean = uid("clean0");
    const cleanStage = mkStage();
    writeSession(cleanStage, clean, 4, [0]);
    await importFromDirectory(dbModule, cleanStage);
    assert.deepEqual(tokenRows(sid), tokenRows(clean));
  });
});

describe("lastTranscriptActivityMs reads from the tail", () => {
  it("returns the newest timestamp of a large file without reading it whole", () => {
    const f = path.join(TMP_ROOT, "big.jsonl");
    const filler = JSON.stringify({ timestamp: "2020-01-01T00:00:00.000Z", pad: "x".repeat(900) });
    const lines = Array.from({ length: 400 }, () => filler); // ~360 KiB
    lines.push(JSON.stringify({ timestamp: "2026-09-01T10:00:00.000Z" }));
    fs.writeFileSync(f, lines.join("\n") + "\n");
    const orig = fs.readFileSync;
    let wholeReads = 0;
    fs.readFileSync = function (p, ...rest) {
      if (p === f) wholeReads++;
      return orig.call(this, p, ...rest);
    };
    try {
      assert.equal(
        remoteSync.lastTranscriptActivityMs(f),
        new Date("2026-09-01T10:00:00.000Z").getTime()
      );
    } finally {
      fs.readFileSync = orig;
    }
    assert.equal(wholeReads, 0, "must not readFileSync the whole transcript");
  });

  it("skips a partial first line of the tail and a torn last line", () => {
    const f = path.join(TMP_ROOT, "torn.jsonl");
    const pad = JSON.stringify({ timestamp: "2020-01-01T00:00:00.000Z", pad: "y".repeat(900) });
    const good = JSON.stringify({ timestamp: "2026-09-02T00:00:00.000Z" });
    fs.writeFileSync(f, Array(300).fill(pad).join("\n") + "\n" + good + '\n{"timestamp":"2026-');
    assert.equal(
      remoteSync.lastTranscriptActivityMs(f),
      new Date("2026-09-02T00:00:00.000Z").getTime()
    );
  });

  it("finds the timestamp of a final record larger than the first tail window", () => {
    const f = path.join(TMP_ROOT, "huge-last.jsonl");
    const older = JSON.stringify({ timestamp: "2020-01-01T00:00:00.000Z" });
    // One tool-result record of ~300 KiB, as Claude transcripts can contain.
    const last = JSON.stringify({
      timestamp: "2026-09-03T00:00:00.000Z",
      pad: "z".repeat(300 * 1024),
    });
    fs.writeFileSync(f, older + "\n" + last + "\n");
    // The mirror rewrote the file just now, so mtime alone would read as fresh activity.
    const now = new Date();
    fs.utimesSync(f, now, now);
    assert.equal(
      remoteSync.lastTranscriptActivityMs(f),
      new Date("2026-09-03T00:00:00.000Z").getTime()
    );
  });

  it("reaches an earlier timestamped line past a large final line without one", () => {
    const f = path.join(TMP_ROOT, "huge-untimed-last.jsonl");
    const stamped = JSON.stringify({ timestamp: "2026-09-05T00:00:00.000Z" });
    const untimed = JSON.stringify({ type: "summary", pad: "v".repeat(200 * 1024) });
    fs.writeFileSync(f, stamped + "\n" + untimed + "\n");
    const now = new Date();
    fs.utimesSync(f, now, now);
    assert.equal(
      remoteSync.lastTranscriptActivityMs(f),
      new Date("2026-09-05T00:00:00.000Z").getTime()
    );
  });

  it("falls back to mtime only when no line in the file has a timestamp", () => {
    const f = path.join(TMP_ROOT, "no-ts.jsonl");
    fs.writeFileSync(f, JSON.stringify({ pad: "w".repeat(200 * 1024) }) + "\n");
    const when = new Date("2026-09-04T00:00:00.000Z");
    fs.utimesSync(f, when, when);
    assert.equal(remoteSync.lastTranscriptActivityMs(f), when.getTime());
  });
});

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
}
const codexUuid = () => {
  const n = String(++seq).padStart(12, "0");
  return `019fbb99-bd87-7c80-afec-${n}`;
};

describe("remote staging never writes into another source's session (Codex)", () => {
  it("leaves a local Codex row, its tokens and snapshot untouched", async () => {
    const sid = codexUuid();
    // The local row as live ingest would own it: a rollout path in the Codex home.
    const live = path.join(process.env.DASHBOARD_CODEX_HOME, "sessions", `rollout-${sid}.jsonl`);
    fs.mkdirSync(path.dirname(live), { recursive: true });
    fs.writeFileSync(live, "{}\n");
    stmts.insertCodexSession.run(
      sid,
      "local codex",
      "active",
      "/tmp/c",
      "gpt-5.6-terra",
      "local",
      new Date().toISOString(),
      new Date().toISOString(),
      null
    );
    stmts.setSessionTranscriptPath.run(live, sid);
    stmts.upsertCodexTokenDelta.run(sid, "gpt-5.6-terra", "standard", "short", 7, 8, 9, 0);
    const snap = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
    const before = state(sid, snap);

    const src = newSource();
    const stage = mkStage();
    codexRollout(stage, sid, 3);
    await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);

    assert.deepEqual(state(sid, snap), before);
    assert.equal(stmts.getSession.get(sid).source, "local");
    const purge = await del(`/api/remote-sources/${src.id}?purge=true`);
    assert.equal(purge.status, 200);
    assert.ok(stmts.getSession.get(sid));
  });

  it("still imports a same-source and a new Codex session", async () => {
    const src = newSource();
    const sid = codexUuid();
    const stage = mkStage();
    codexRollout(stage, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
    assert.equal(stmts.getSession.get(sid).source, src.id);
    codexRollout(stage, sid, 3);
    await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
    const row = tokenRows(sid)[0];
    assert.equal(row.cache_read_tokens, 30);
  });
});

// Additional ownership regression tests: isolated synthetic data.
describe("ownership at the moment of mutation", () => {
  for (const change of ["patch", "delete"]) {
    it(`stops Claude writes when the transfer registration changes by ${change} during parsing`, async () => {
      const src = stmts.getRemoteSource.get(newSource().id);
      const sid = uid("configuration-race");
      const stage = mkStage();
      writeSession(stage, sid, 4);
      let changed = false;
      await assert.rejects(
        remoteSync.ingestStagedProvider(dbModule, src, "claude", stage, {
          expectedSource: src,
          onProgress: (progress) => {
            if (changed || progress.phase !== "parse" || progress.processed !== 1) return;
            changed = true;
            if (change === "delete") stmts.deleteRemoteSource.run(src.id);
            else
              db.prepare("UPDATE remote_sources SET host = ?, status = 'idle' WHERE id = ?").run(
                "replacement.invalid",
                src.id
              );
          },
        }),
        (error) => error.code === "SOURCE_CHANGED"
      );
      assert.equal(changed, true);
      assert.equal(stmts.getSession.get(sid), undefined);
      assert.equal(fs.existsSync(claudeSnap(sid)), false);
      if (change === "patch") assert.equal(stmts.getRemoteSource.get(src.id).status, "idle");
    });
  }

  it("does not overwrite a local row created while remote Claude is parsing", async () => {
    const sid = uid("race-local");
    const src = newSource();
    const stage = mkStage();
    writeSession(stage, sid, 4);
    let seeded = false;
    let before;
    const result = await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage, {
      onProgress: (progress) => {
        if (seeded || progress.phase !== "parse" || progress.processed !== 1) return;
        seeded = true;
        stmts.insertSession.run(
          sid,
          "local",
          "active",
          "/tmp/local",
          MODEL,
          JSON.stringify({ imported: true })
        );
        stmts.insertAgent.run(
          `${sid}-main`,
          sid,
          "Main",
          "main",
          null,
          "working",
          null,
          null,
          null
        );
        fs.mkdirSync(getTranscriptSnapshotDir(), { recursive: true });
        fs.writeFileSync(claudeSnap(sid), "LOCAL-BYTES\n");
        before = state(sid, claudeSnap(sid));
      },
    });
    assert.ok(seeded, "inject local creation after parse before write");
    const afterState = state(sid, claudeSnap(sid));
    assert.deepEqual(
      afterState,
      before,
      "local row, tokens, events and snapshot must remain unchanged"
    );
    assert.ok(!result.ids.includes(sid));
  });
});

describe("Codex identity and provider boundaries", () => {
  for (const cursorKind of ["primary", "tools"]) {
    it(`rejects a foreign ${cursorKind} cursor before snapshot or ingestion`, async () => {
      const ownedId = codexUuid();
      const foreignId = codexUuid();
      const src = newSource();
      const stage = mkStage();
      codexRollout(stage, ownedId, 1);
      await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
      const foreignStage = mkStage();
      codexRollout(foreignStage, foreignId, 1);
      await require("../lib/codex-import").importCodexFromDirectory(foreignStage);
      const ownSnapshot = path.join(getCodexImportSnapshotDir(), `${ownedId}.jsonl`);
      const foreignSnapshot = path.join(getCodexImportSnapshotDir(), `${foreignId}.jsonl`);
      const beforeOwn = state(ownedId, ownSnapshot);
      const beforeForeign = state(foreignId, foreignSnapshot);
      if (cursorKind === "primary") {
        stmts.upsertCodexIngestState.run(ownSnapshot, foreignId, 0, "", 0, 0, 0, 0, 0);
      } else {
        stmts.upsertCodexToolIngestState.run(ownSnapshot, foreignId, 0);
      }
      codexRollout(stage, ownedId, 4);
      const result = await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
      assert.deepEqual(state(ownedId, ownSnapshot), beforeOwn);
      assert.deepEqual(state(foreignId, foreignSnapshot), beforeForeign);
      assert.equal(result.counters.errors, 1);
    });
  }
  it("does not create a Claude snapshot for an existing Codex row of the same source", async () => {
    const sid = codexUuid();
    const src = newSource();
    const stage = mkStage();
    codexRollout(stage, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
    const snap = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
    const before = state(sid, snap);
    const claudeStage = mkStage();
    writeSession(claudeStage, sid, 4);
    const result = await remoteSync.ingestStagedProvider(dbModule, src, "claude", claudeStage);
    assert.deepEqual(state(sid, snap), before);
    assert.equal(fs.existsSync(claudeSnap(sid)), false);
    assert.equal(result.counters.sessions_excluded, 1);
    assert.ok(!result.ids.includes(sid));
  });

  it("rejects a rollout filename A whose payload targets local session B", async () => {
    const localId = codexUuid();
    const filenameId = codexUuid();
    const localStage = mkStage();
    codexRollout(localStage, localId, 1);
    const { importCodexFromDirectory } = require("../lib/codex-import");
    await importCodexFromDirectory(localStage);
    const snap = path.join(getCodexImportSnapshotDir(), `${localId}.jsonl`);
    const before = state(localId, snap);
    const src = newSource();
    const stage = mkStage();
    codexRollout(stage, filenameId, 4);
    const file = path.join(
      stage,
      "sessions",
      "2026",
      "09",
      "01",
      `rollout-2026-09-01T10-00-00-${filenameId}.jsonl`
    );
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace(`"id":"${filenameId}"`, `"id":"${localId}"`)
    );
    let error;
    try {
      await remoteSync.ingestStagedProvider(dbModule, src, "codex", stage);
    } catch (e) {
      error = e.message;
    }
    const afterState = state(localId, snap);
    assert.deepEqual(afterState, before, "payload id must not bypass local ownership");
  });
  it("rejects a Codex rollout targeting an existing Claude row of the same source", async () => {
    const sid = codexUuid();
    const src = newSource();
    const claudeStage = mkStage();
    writeSession(claudeStage, sid, 1);
    await remoteSync.ingestStagedProvider(dbModule, src, "claude", claudeStage);
    const before = state(sid, claudeSnap(sid));
    const codexStage = mkStage();
    codexRollout(codexStage, sid, 4);
    let error;
    try {
      await remoteSync.ingestStagedProvider(dbModule, src, "codex", codexStage);
    } catch (e) {
      error = e.message;
    }
    const afterState = state(sid, claudeSnap(sid));
    assert.deepEqual(afterState, before, "provider collision must not change tokens or events");
    const foreignProviderSnapshot = path.join(getCodexImportSnapshotDir(), `${sid}.jsonl`);
    assert.equal(
      fs.existsSync(foreignProviderSnapshot),
      false,
      "provider collision must not create a conflicting snapshot"
    );
  });
});

describe("rollback side effects", () => {
  it("does not publish a snapshot when its import rolled back", async () => {
    const sid = uid("rollback-snapshot");
    const src = newSource();
    const stage = mkStage();
    writeSession(stage, sid, 2);
    const real = stmts.setSessionSource;
    let injected = false;
    stmts.setSessionSource = {
      run: (...args) => {
        if (args[1] === sid && !injected) {
          injected = true;
          throw new Error("synthetic stamp failure");
        }
        return real.run(...args);
      },
    };
    let error;
    try {
      await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
    } catch (e) {
      error = e.message;
    } finally {
      stmts.setSessionSource = real;
    }
    const row = stmts.getSession.get(sid);
    const snapshotCreated = fs.existsSync(claudeSnap(sid));
    assert.ok(injected);
    assert.equal(snapshotCreated, false, "failed import must not publish snapshot");
  });
});

describe("ownership during workflow parsing", () => {
  for (const completed of [false, true]) {
    it(`stops ${completed ? "completed" : "live"} workflow writes when ownership changes during parse`, async () => {
      const sid = uid("workflow-race");
      const runId = uid("wf");
      const src = newSource();
      const stage = mkStage();
      writeSession(stage, sid, 1);
      const sessionDir = path.join(stage, "-tmp-proj", sid);
      const agentDir = path.join(sessionDir, "subagents", "workflows", runId);
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "agent-scout.jsonl"), subLines(2));
      if (completed) {
        const journals = path.join(sessionDir, "workflows");
        fs.mkdirSync(journals, { recursive: true });
        fs.writeFileSync(
          path.join(journals, `wf_${runId}.json`),
          JSON.stringify({
            runId,
            workflowName: "review",
            status: "completed",
            startTime: 1700000000000,
            defaultModel: MODEL,
            workflowProgress: [{ type: "workflow_agent", agentId: "scout", state: "done" }],
          })
        );
      }
      const ih = require("../../scripts/import-history");
      const original = ih.parseSubagentFile;
      let switched = false;
      let before;
      ih.parseSubagentFile = async (file) => {
        const parsed = await original(file);
        if (!switched && file.startsWith(agentDir)) {
          switched = true;
          stmts.setSessionSource.run("local", sid);
          db.prepare("UPDATE sessions SET metadata = ? WHERE id = ?").run(
            JSON.stringify({ imported: true }),
            sid
          );
          before = state(sid, claudeSnap(sid));
        }
        return parsed;
      };
      try {
        const result = await remoteSync.ingestStagedProvider(dbModule, src, "claude", stage);
        assert.ok(switched, "the ownership change must occur inside workflow parsing");
        assert.deepEqual(state(sid, claudeSnap(sid)), before);
        assert.ok(!result.ids.includes(sid));
      } finally {
        ih.parseSubagentFile = original;
      }
    });
  }
});
