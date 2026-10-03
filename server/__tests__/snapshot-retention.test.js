/**
 * @file Tests for transcript snapshot retention (issue #358): compression of
 * snapshots whose original was pruned (and the guards that refuse to compress
 * when the source tree is unreadable or the snapshot is too recent), reading
 * compressed and longer-than-live snapshots through the transcript routes and
 * task progress, purge cleanup, the dry-run-by-default prune API with its
 * confirm gate, tombstones that stop re-imports regrowing pruned snapshots,
 * and the storage report on /api/settings/info.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-retention-"));
const CLAUDE_HOME = path.join(TMP, "home");
const DATA_DIR = path.join(TMP, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = DATA_DIR;
process.env.DASHBOARD_CURSOR_HOME = path.join(TMP, "cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
delete process.env.DASHBOARD_SNAPSHOT_MAX_AGE_DAYS;
delete process.env.DASHBOARD_SNAPSHOT_MAX_BYTES;
delete process.env.DASHBOARD_SNAPSHOT_COMPRESS;

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const retention = require("../lib/snapshot-retention");
const store = require("../lib/snapshot-store");
const { snapshotTranscript } = require("../../scripts/import-history");
const { extractSessionTaskProgress } = require("../lib/task-progress");

const PROJECTS = path.join(CLAUDE_HOME, "projects");
const PROJECT_DIR = path.join(PROJECTS, "-tmp-snap-project");
const SNAP_DIR = path.join(DATA_DIR, "transcripts");
const DAY = 86400 * 1000;

let server;
let base;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      `${base}${urlPath}`,
      {
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null })
        );
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function userLines(count, tag = "msg") {
  let out = "";
  for (let i = 1; i <= count; i++) {
    out += `${JSON.stringify({
      type: "user",
      uuid: `${tag}-${i}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      message: { role: "user", content: `${tag} ${i} ${"pad ".repeat(40)}` },
    })}\n`;
  }
  return out;
}

function insertSession(id, { status = "completed", daysAgo = 1, cwd = "/tmp/snap-project" } = {}) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO sessions (id, name, status, cwd, started_at, updated_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, id, status, cwd, at, at, status === "active" ? null : at);
}

function writeSnapshotFile(sessionId, content, daysAgo) {
  const file = path.join(SNAP_DIR, `${sessionId}.jsonl`);
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  fs.writeFileSync(file, content);
  const t = new Date(Date.now() - daysAgo * DAY);
  fs.utimesSync(file, t, t);
  return file;
}

before(async () => {
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  server = await startServer(createApp(), 0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  try {
    db.close();
  } catch {
    /* already closed */
  }
  try {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Windows can hold the SQLite file briefly after close; the OS temp dir is
    // reclaimed anyway, and cleanup must never fail the suite.
  }
});

describe("compression of snapshots whose original is gone", () => {
  it("compresses only pruned, idle snapshots and leaves live/recent ones plain", async () => {
    const pruned = writeSnapshotFile("pruned-old", userLines(60), 3);
    const recent = writeSnapshotFile("pruned-recent", userLines(60), 0);
    const live = writeSnapshotFile("still-live", userLines(60), 3);
    fs.writeFileSync(path.join(PROJECT_DIR, "still-live.jsonl"), userLines(60));

    const result = await retention.compressOrphanedOriginals();
    assert.equal(result.failed, 0);
    assert.equal(fs.existsSync(pruned), false);
    assert.equal(fs.existsSync(`${pruned}.gz`), true);
    assert.equal(fs.existsSync(recent), true, "inside the grace period → untouched");
    assert.equal(fs.existsSync(live), true, "original still on disk → untouched");
  });

  it("refuses to compress anything when the projects tree is unreadable", async () => {
    const file = writeSnapshotFile("no-tree", userLines(60), 5);
    const saved = process.env.CLAUDE_HOME;
    process.env.CLAUDE_HOME = path.join(TMP, "unmounted-home");
    try {
      const result = await retention.compressOrphanedOriginals();
      assert.ok(result.skipped_roots.includes("claude"));
      assert.equal(fs.existsSync(file), true);
    } finally {
      process.env.CLAUDE_HOME = saved;
    }
  });

  it("can be turned off with DASHBOARD_SNAPSHOT_COMPRESS=0", async () => {
    const file = writeSnapshotFile("compress-off", userLines(60), 5);
    process.env.DASHBOARD_SNAPSHOT_COMPRESS = "0";
    try {
      const summary = await retention.runSnapshotMaintenance(db, { log: { log() {}, warn() {} } });
      assert.equal(summary.compression, null);
      assert.equal(fs.existsSync(file), true);
    } finally {
      delete process.env.DASHBOARD_SNAPSHOT_COMPRESS;
    }
  });
});

describe("reading snapshots through the API", () => {
  it("serves a compressed snapshot's conversation", async () => {
    insertSession("gz-read");
    const file = writeSnapshotFile("gz-read", userLines(12), 3);
    assert.equal((await store.compressSnapshotFile(file)).ok, true);
    const res = await request("GET", "/api/sessions/gz-read/transcript?limit=200");
    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 12);
  });

  it("serves the snapshot when it is longer than a truncated live file", async () => {
    insertSession("truncated-live");
    writeSnapshotFile("truncated-live", userLines(30), 3);
    fs.writeFileSync(path.join(PROJECT_DIR, "truncated-live.jsonl"), userLines(4));
    const res = await request("GET", "/api/sessions/truncated-live/transcript?limit=200");
    assert.equal(res.body.messages.length, 30);
  });

  it("still serves the live file when it is the longer copy", async () => {
    insertSession("live-longer");
    writeSnapshotFile("live-longer", userLines(3), 3);
    fs.writeFileSync(path.join(PROJECT_DIR, "live-longer.jsonl"), userLines(8));
    const res = await request("GET", "/api/sessions/live-longer/transcript?limit=200");
    assert.equal(res.body.messages.length, 8);
  });

  it("lists snapshot-only (compressed) subagent transcripts", async () => {
    insertSession("sub-snap");
    writeSnapshotFile("sub-snap", userLines(2), 3);
    const subDir = path.join(SNAP_DIR, "sub-snap", "subagents");
    fs.mkdirSync(subDir, { recursive: true });
    const subFile = path.join(subDir, "agent-abc123.jsonl");
    fs.writeFileSync(subFile, userLines(5, "sub"));
    assert.equal((await store.compressSnapshotFile(subFile)).ok, true);
    const list = await request("GET", "/api/sessions/sub-snap/transcripts");
    assert.ok(list.body.transcripts.some((t) => t.id === "abc123"));
    const sub = await request("GET", "/api/sessions/sub-snap/transcript?agent_id=abc123&limit=50");
    assert.equal(sub.body.messages.length, 5);
  });

  it("derives task progress from a compressed snapshot", async () => {
    const file = path.join(TMP, "todo-progress.jsonl");
    fs.writeFileSync(
      file,
      `${JSON.stringify({
        type: "assistant",
        timestamp: "2026-08-07T10:00:00.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "todo-1",
              name: "TodoWrite",
              input: { todos: [{ content: "Ship it", status: "completed" }] },
            },
          ],
        },
      })}\n`
    );
    const plain = extractSessionTaskProgress({
      session: { id: "todo-plain", provider: "claude" },
      mainTranscriptPath: file,
    });
    const gz = await store.compressSnapshotFile(file);
    assert.equal(gz.ok, true);
    const compressed = extractSessionTaskProgress({
      session: { id: "todo-gz", provider: "claude" },
      mainTranscriptPath: `${file}.gz`,
    });
    assert.equal(compressed.snapshot.completed, plain.snapshot.completed);
    assert.equal(compressed.snapshot.completed, 1);
  });
});

describe("purge and prune", () => {
  it("purge cleanup deletes the purged sessions' snapshots", async () => {
    insertSession("purge-me", { daysAgo: 400 });
    writeSnapshotFile("purge-me", userLines(5), 400);
    fs.mkdirSync(path.join(SNAP_DIR, "purge-me", "subagents"), { recursive: true });
    fs.writeFileSync(path.join(SNAP_DIR, "purge-me", "subagents", "agent-x.jsonl"), "x\n");
    const res = await request("POST", "/api/settings/cleanup", { purge_days: 365 });
    assert.equal(res.status, 200);
    assert.ok(res.body.purged_sessions >= 1);
    assert.equal(res.body.purged_snapshot_files, 2);
    assert.ok(res.body.purged_snapshot_bytes > 0);
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "purge-me.jsonl")), false);
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "purge-me")), false);
  });

  it("validates prune requests and dry-runs by default", async () => {
    const none = await request("POST", "/api/settings/snapshots/prune", {});
    assert.equal(none.status, 400);
    const badBytes = await request("POST", "/api/settings/snapshots/prune", { max_bytes: "lots" });
    assert.equal(badBytes.status, 400);

    insertSession("old-finished", { daysAgo: 90 });
    const oldFile = writeSnapshotFile("old-finished", userLines(5), 90);
    insertSession("old-active", { status: "active", daysAgo: 90 });
    writeSnapshotFile("old-active", userLines(5), 90);

    const dry = await request("POST", "/api/settings/snapshots/prune", { max_age_days: 30 });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.dry_run, true);
    const ids = dry.body.candidates.map((c) => c.session_id);
    assert.ok(ids.includes("old-finished"));
    assert.ok(!ids.includes("old-active"), "a possibly-running session is never pruned");
    assert.equal(fs.existsSync(oldFile), true, "dry run deletes nothing");

    const noConfirm = await request("POST", "/api/settings/snapshots/prune", {
      max_age_days: 30,
      dry_run: false,
    });
    assert.equal(noConfirm.status, 400);
    assert.equal(fs.existsSync(oldFile), true);
  });

  it("applies with confirm, tombstones, and a re-import does not regrow it", async () => {
    const live = path.join(PROJECT_DIR, "old-finished.jsonl");
    fs.writeFileSync(live, userLines(5));
    const t = new Date(Date.now() - 90 * DAY);
    fs.utimesSync(live, t, t);

    const res = await request("POST", "/api/settings/snapshots/prune", {
      max_age_days: 30,
      dry_run: false,
      confirm: "PRUNE_SNAPSHOTS",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.removed_files >= 1);
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "old-finished.jsonl")), false);
    assert.ok(store.listTombstones(SNAP_DIR).includes("old-finished"));

    snapshotTranscript(live, "old-finished");
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "old-finished.jsonl")), false);

    // Date the tombstone back so the resume write below is strictly newer even
    // when the prune and the append fall in the same clock tick.
    const tomb = path.join(SNAP_DIR, ".pruned", "old-finished");
    const dayAgo = new Date(Date.now() - DAY);
    fs.utimesSync(tomb, dayAgo, dayAgo);

    // The session resumes (its source is written after the prune) → protected again.
    fs.appendFileSync(live, userLines(1, "resumed"));
    snapshotTranscript(live, "old-finished");
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "old-finished.jsonl")), true);
  });

  it("prunes orphans only when asked, without a tombstone", async () => {
    writeSnapshotFile("no-such-session", userLines(3), 2);
    const without = await request("POST", "/api/settings/snapshots/prune", { max_age_days: 3650 });
    assert.ok(!without.body.candidates.some((c) => c.session_id === "no-such-session"));
    const res = await request("POST", "/api/settings/snapshots/prune", {
      orphans: true,
      dry_run: false,
      confirm: "PRUNE_SNAPSHOTS",
    });
    assert.ok(res.body.candidates.some((c) => c.reason === "orphan"));
    assert.equal(fs.existsSync(path.join(SNAP_DIR, "no-such-session.jsonl")), false);
    assert.ok(!store.listTombstones(SNAP_DIR).includes("no-such-session"));
  });

  it("max_bytes prunes oldest finished sessions first", () => {
    insertSession("cap-oldest", { daysAgo: 20 });
    writeSnapshotFile("cap-oldest", userLines(40), 20);
    insertSession("cap-newest", { daysAgo: 2 });
    writeSnapshotFile("cap-newest", userLines(40), 2);
    const total = retention.planSnapshotPrune(db, {}).total_bytes;
    const plan = retention.planSnapshotPrune(db, { maxBytes: total - 1 });
    const ids = plan.candidates.map((c) => c.sessionId);
    // Exactly the oldest eligible session goes: one is enough to get under a
    // cap of total - 1, and the newest must survive.
    assert.equal(plan.candidates.length, 1);
    assert.equal(plan.candidates[0].reason, "max_bytes");
    assert.ok(!ids.includes("cap-newest"));
    // cap-oldest (20 days idle) is the oldest finished session with a
    // snapshot; activity counts the snapshot's mtime too, so the earlier
    // resumed "old-finished" now ranks as recent.
    assert.equal(ids[0], "cap-oldest");
    assert.ok(plan.remaining_bytes <= total - 1);
  });

  it("max_bytes never prunes finished sessions active in the last 24 h", () => {
    insertSession("cap-fresh", { daysAgo: 0.1 });
    writeSnapshotFile("cap-fresh", userLines(40), 0.1);
    const plan = retention.planSnapshotPrune(db, { maxBytes: 1 });
    const ids = plan.candidates.map((c) => c.sessionId);
    assert.ok(!ids.includes("cap-fresh"));
    assert.ok(ids.includes("cap-oldest"), "older finished sessions are still eligible");
    assert.ok(plan.over_cap_bytes > 0, "an unreachable cap is reported, not forced");
  });

  it("deleteSnapshotsForSessions removes across all provider dirs", () => {
    const codexDir = path.join(DATA_DIR, "codex-transcripts");
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, "multi.jsonl"), "c\n");
    writeSnapshotFile("multi", "m\n", 1);
    const removed = retention.deleteSnapshotsForSessions(["multi"]);
    assert.equal(removed.files, 2);
    assert.equal(fs.existsSync(path.join(codexDir, "multi.jsonl")), false);
  });
});

describe("storage report", () => {
  it("is included in /api/settings/info and /api/settings/snapshots", async () => {
    retention.invalidateSnapshotStorage();
    const info = await request("GET", "/api/settings/info");
    assert.equal(info.status, 200);
    assert.ok(info.body.snapshots);
    assert.deepEqual(Object.keys(info.body.snapshots.roots).sort(), ["claude", "codex", "cursor"]);
    assert.equal(info.body.snapshots.policy.compress, true);
    assert.equal(info.body.snapshots.policy.max_age_days, null);
    const direct = await request("GET", "/api/settings/snapshots");
    assert.equal(direct.body.total_files, info.body.snapshots.total_files);
  });

  it("parses byte sizes with binary units", () => {
    assert.equal(retention.parseByteSize("1024"), 1024);
    assert.equal(retention.parseByteSize("5GB"), 5 * 1024 ** 3);
    assert.equal(retention.parseByteSize("1.5 GiB"), Math.floor(1.5 * 1024 ** 3));
    assert.equal(retention.parseByteSize("500mb"), 500 * 1024 ** 2);
    assert.equal(retention.parseByteSize("0"), null);
    assert.equal(retention.parseByteSize("lots"), null);
  });
});
