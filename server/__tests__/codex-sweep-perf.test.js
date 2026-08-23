/**
 * @file Regression guards for the two idle-CPU amplifiers in the Codex
 * discovery sweep (issue #295), both of which burned CPU continuously with no
 * Codex process running and no user activity.
 *
 *   1. The codex-home watcher treated the SQLite `-shm` sidecar as a change
 *      worth sweeping for. SQLite touches the wal-index on every WAL-mode
 *      reader open — including the sweep's own read-only open of that same
 *      state database — so each sweep scheduled the next one: a permanent
 *      full-scan loop that profiling put at ~40% of all CPU samples.
 *   2. `findCodexTranscripts` called `statSync` INSIDE its sort comparator, so
 *      ordering N rollouts newest-first cost O(N log N) stat syscalls rather
 *      than N (measured 25.5k syscalls per sweep on a 4k-file corpus).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `codex-sweep-perf-${process.pid}-`));
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const { codexHomeChangeTriggersSweep } = require("../index");
const { findCodexTranscripts } = require("../lib/codex-ingest");

after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("codex-home watcher trigger filter", () => {
  it("does NOT sweep on the SQLite -shm sidecar", () => {
    // The self-trigger: the sweep's own read-only open of state_N.sqlite
    // touches state_N.sqlite-shm, which would schedule the next sweep forever.
    assert.equal(codexHomeChangeTriggersSweep("state_5.sqlite-shm"), false);
    assert.equal(codexHomeChangeTriggersSweep("state_0.sqlite-shm"), false);
    assert.equal(codexHomeChangeTriggersSweep("/abs/path/state_12.sqlite-shm"), false);
  });

  it("still sweeps on the durable state database and its WAL", () => {
    // Every durable change lands in one of these two, so excluding -shm loses
    // no real signal.
    assert.equal(codexHomeChangeTriggersSweep("state_5.sqlite"), true);
    assert.equal(codexHomeChangeTriggersSweep("state_5.sqlite-wal"), true);
    assert.equal(codexHomeChangeTriggersSweep("state_0.sqlite"), true);
  });

  it("still sweeps on the session index", () => {
    assert.equal(codexHomeChangeTriggersSweep("session_index.jsonl"), true);
  });

  it("sweeps when the platform reports no filename", () => {
    // Some platforms/filesystems omit the filename. Failing open keeps the
    // watcher useful there; the debounce is the frequency cap in that case.
    for (const absent of [null, undefined, ""]) {
      assert.equal(codexHomeChangeTriggersSweep(absent), true, `absent: ${String(absent)}`);
    }
  });

  it("ignores unrelated files in the Codex home", () => {
    for (const name of ["config.toml", "history.jsonl", "state.sqlite", "state_x.sqlite"]) {
      assert.equal(codexHomeChangeTriggersSweep(name), false, name);
    }
  });

  it("accepts a full path, matching only on the basename", () => {
    assert.equal(codexHomeChangeTriggersSweep("/home/u/.codex/state_3.sqlite-wal"), true);
    assert.equal(codexHomeChangeTriggersSweep("/home/u/.codex/state_3.sqlite-shm"), false);
  });
});

describe("findCodexTranscripts stat cost", () => {
  const ROLLOUTS = 300;
  let sessionsDir;

  before(() => {
    sessionsDir = path.join(TMP_ROOT, "codex", "sessions", "2026", "08", "15");
    fs.mkdirSync(sessionsDir, { recursive: true });
    for (let i = 0; i < ROLLOUTS; i++) {
      const file = path.join(sessionsDir, `rollout-2026-08-15T00-00-00-${i}.jsonl`);
      fs.writeFileSync(file, "{}\n");
      // Distinct mtimes so the ordering assertion below is meaningful.
      const stamp = new Date(Date.now() - i * 1000);
      fs.utimesSync(file, stamp, stamp);
    }
  });

  /** Count statSync calls made while running `fn`. */
  function countStats(fn) {
    const real = fs.statSync;
    let calls = 0;
    fs.statSync = function (...args) {
      calls++;
      return real.apply(this, args);
    };
    try {
      const result = fn();
      return { calls, result };
    } finally {
      fs.statSync = real;
    }
  }

  it("stats each rollout at most once per discovery pass", () => {
    const { calls, result } = countStats(() =>
      findCodexTranscripts(path.join(TMP_ROOT, "codex", "sessions"))
    );

    assert.equal(result.length, ROLLOUTS, "every rollout must still be discovered");
    // A comparator-based sort costs roughly 2 * N * log2(N) stats — ~4,900 for
    // 300 files. Stat-once-during-discovery is N. Allow modest slack for any
    // unrelated stat in the walk, but stay far below the comparator cost.
    const comparatorCost = 2 * ROLLOUTS * Math.log2(ROLLOUTS);
    assert.ok(
      calls <= ROLLOUTS * 1.5,
      `expected ~${ROLLOUTS} stats, got ${calls} (comparator sort would be ~${Math.round(comparatorCost)})`
    );
  });

  it("still returns rollouts newest-first", () => {
    const files = findCodexTranscripts(path.join(TMP_ROOT, "codex", "sessions"));
    const mtimes = files.map((file) => fs.statSync(file).mtimeMs);
    for (let i = 1; i < mtimes.length; i++) {
      assert.ok(mtimes[i - 1] >= mtimes[i], `ordering broke at index ${i}`);
    }
  });

  it("promotes a file whose mtime moves to the newest", () => {
    const before = findCodexTranscripts(path.join(TMP_ROOT, "codex", "sessions"));
    const target = before[before.length - 1]; // currently the oldest
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(target, future, future);

    const after = findCodexTranscripts(path.join(TMP_ROOT, "codex", "sessions"));
    assert.equal(after[0], target, "the freshly touched rollout must sort first");
  });

  it("sorts an unstattable entry last instead of throwing", () => {
    // A rollout deleted between the directory read and the stat must not abort
    // the whole sweep — discovery has to stay resilient.
    const real = fs.statSync;
    const doomed = path.join(sessionsDir, `rollout-2026-08-15T00-00-00-0.jsonl`);
    fs.statSync = function (target, ...rest) {
      if (String(target) === doomed) throw new Error("ENOENT");
      return real.call(this, target, ...rest);
    };
    let files;
    try {
      files = findCodexTranscripts(path.join(TMP_ROOT, "codex", "sessions"));
    } finally {
      fs.statSync = real;
    }
    assert.equal(files.length, ROLLOUTS, "the unstattable file is still returned");
    assert.equal(files[files.length - 1], doomed, "and sorts last");
  });
});

describe("ingestCodexToolEvents failure signalling", () => {
  const { ingestCodexToolEvents } = require("../lib/codex-ingest");
  // `root` scopes the "is this a Codex transcript?" check to the fixture tree;
  // without it the function short-circuits on the path test and never reaches
  // the I/O these tests are about.
  const root = path.join(TMP_ROOT, "codex", "sessions");

  it("flags an unreadable transcript as failed, not as a completed no-op", () => {
    // The sweep clears a file's retry marker after a completed ingest. Because
    // this function swallows I/O errors and returns { changed: false } — the
    // same shape a legitimate no-op returns — it must say so explicitly, or a
    // transient read error would clear the marker and leave the file's
    // response-item tool calls unindexed until it next grew.
    const missing = path.join(TMP_ROOT, "codex", "sessions", "rollout-does-not-exist.jsonl");
    const result = ingestCodexToolEvents(missing, { root });
    assert.equal(result.changed, false);
    assert.equal(result.failed, true, "an unreadable file must report failed");
  });

  it("does not flag a genuine no-op as failed", () => {
    // A readable rollout with no session row is a completed no-op: nothing to
    // do, nothing to retry. Marking it failed would re-queue it every sweep.
    const file = path.join(TMP_ROOT, "codex", "sessions", "2026", "08", "15", "rollout-noop.jsonl");
    fs.writeFileSync(file, `${JSON.stringify({ type: "response_item" })}\n`);
    const result = ingestCodexToolEvents(file, { root });
    assert.equal(result.changed, false);
    assert.ok(!result.failed, "a completed no-op must not be marked failed");
  });
});

describe("ingestCodexToolEvents read-path failure", () => {
  const { ingestCodexToolEvents } = require("../lib/codex-ingest");
  const { stmts } = require("../db");
  const root = path.join(TMP_ROOT, "codex", "sessions");
  // The basename must carry a UUID for sessionIdFromPath to resolve a session,
  // otherwise the function exits before it ever reaches the read.
  const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  let rollout;

  before(() => {
    rollout = path.join(root, `rollout-2026-08-15T00-00-00-${SESSION_ID}.jsonl`);
    fs.writeFileSync(rollout, `${JSON.stringify({ type: "response_item" })}\n`);
    try {
      stmts.insertCodexSession.run(
        SESSION_ID,
        "codex",
        "active",
        "/tmp/proj",
        "gpt-5",
        "local",
        "2026-08-15T10:00:00.000Z",
        "2026-08-15T10:00:00.000Z",
        null
      );
    } catch {
      /* already present */
    }
  });

  it("reports a post-stat read error as failed, not as a no-op", () => {
    // The missing-file test covers the statSync catch. This covers the OTHER
    // failure path — the file stats fine and has unread bytes, but the read
    // itself throws — which previously also had to be distinguishable from a
    // completed no-op for the sweep's retry marker to be correct.
    const realRead = fs.readSync;
    fs.readSync = function () {
      throw new Error("EIO");
    };
    let result;
    try {
      result = ingestCodexToolEvents(rollout, { root });
    } finally {
      fs.readSync = realRead;
    }
    assert.equal(result.changed, false);
    assert.equal(result.failed, true, "a read error must be reported as failed");
  });

  it("closes the descriptor even when the read throws", () => {
    // Failed rollouts are retried on every later sweep, so a descriptor leaked
    // on this path leaks once per sweep and would eventually exhaust the
    // process limit. Drive the failing path repeatedly and assert every opened
    // descriptor was closed.
    const realOpen = fs.openSync;
    const realRead = fs.readSync;
    const opened = [];
    const closed = [];
    const realClose = fs.closeSync;
    fs.openSync = function (...args) {
      const fd = realOpen.apply(this, args);
      opened.push(fd);
      return fd;
    };
    fs.closeSync = function (fd) {
      closed.push(fd);
      return realClose.call(this, fd);
    };
    fs.readSync = function () {
      throw new Error("EIO");
    };
    try {
      for (let i = 0; i < 5; i++) ingestCodexToolEvents(rollout, { root });
    } finally {
      fs.openSync = realOpen;
      fs.readSync = realRead;
      fs.closeSync = realClose;
    }

    assert.ok(opened.length >= 5, `expected repeated opens, got ${opened.length}`);
    for (const fd of opened) {
      assert.ok(closed.includes(fd), `descriptor ${fd} was opened but never closed`);
    }
  });
});

describe("ingestCodexTranscript failure signalling", () => {
  const { ingestCodexTranscript } = require("../lib/codex-ingest");
  const { stmts } = require("../db");
  const root = path.join(TMP_ROOT, "codex", "sessions");
  const SESSION_ID = "11111111-2222-3333-4444-555555555555";
  let rollout;

  before(() => {
    rollout = path.join(root, `rollout-2026-08-15T01-00-00-${SESSION_ID}.jsonl`);
    fs.writeFileSync(
      rollout,
      `${JSON.stringify({ type: "session_meta", payload: { id: SESSION_ID } })}\n`
    );
    try {
      stmts.insertCodexSession.run(
        SESSION_ID,
        "codex",
        "active",
        "/tmp/proj",
        "gpt-5",
        "local",
        "2026-08-15T10:00:00.000Z",
        "2026-08-15T10:00:00.000Z",
        null
      );
    } catch {
      /* already present */
    }
  });

  it("reports a read failure as failed rather than a no-op", () => {
    // The sweep records this file's fingerprint after any non-throwing return.
    // Reporting an I/O error as an ordinary no-op would let the next sweep skip
    // the transcript entirely, leaving its lifecycle and token events
    // unprocessed until some later write moved the fingerprint.
    const realRead = fs.readSync;
    fs.readSync = function () {
      throw new Error("EIO");
    };
    let result;
    try {
      result = ingestCodexTranscript(rollout, { root });
    } finally {
      fs.readSync = realRead;
    }
    assert.equal(result.changed, false);
    assert.equal(result.failed, true, "a read error must be reported as failed");
  });

  it("reports an unstattable transcript as failed", () => {
    const missing = path.join(root, `rollout-2026-08-15T01-00-00-gone.jsonl`);
    const result = ingestCodexTranscript(missing, { root });
    assert.equal(result.changed, false);
    assert.equal(result.failed, true);
  });

  it("does not flag a genuine no-op as failed", () => {
    // Unchanged bytes: nothing to do, nothing to retry. Marking this failed
    // would make the sweep re-ingest the same file forever.
    ingestCodexTranscript(rollout, { root });
    const second = ingestCodexTranscript(rollout, { root });
    assert.equal(second.changed, false);
    assert.ok(!second.failed, "an up-to-date transcript must not be marked failed");
  });

  it("closes the descriptor when the main read throws", () => {
    // Append unread bytes first: the previous test advanced the byte cursor to
    // EOF, and with nothing left to read the function returns before opening
    // anything.
    fs.appendFileSync(
      rollout,
      `${JSON.stringify({ type: "event_msg", payload: { type: "user_message" } })}\n`
    );
    const realOpen = fs.openSync;
    const realClose = fs.closeSync;
    const realRead = fs.readSync;
    const opened = [];
    const closed = [];
    fs.openSync = function (...args) {
      const fd = realOpen.apply(this, args);
      opened.push(fd);
      return fd;
    };
    fs.closeSync = function (fd) {
      closed.push(fd);
      return realClose.call(this, fd);
    };
    fs.readSync = function () {
      throw new Error("EIO");
    };
    try {
      for (let i = 0; i < 3; i++) ingestCodexTranscript(rollout, { root });
    } finally {
      fs.openSync = realOpen;
      fs.closeSync = realClose;
      fs.readSync = realRead;
    }

    // Assert the precondition: with the byte cursor already at EOF there is no
    // unread range, the read is never attempted, and this test would pass
    // without exercising anything at all.
    assert.ok(opened.length >= 3, `expected a read attempt per call, got ${opened.length}`);
    for (const fd of opened) {
      assert.ok(closed.includes(fd), `descriptor ${fd} was opened but never closed`);
    }
  });
});
