/**
 * @file Checks asynchronous Codex discovery ordering, bounded metadata reads,
 * filesystem error handling and old-home cache isolation against the sync reader.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-discovery-"));
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "current");
const { db } = require("../db");
const {
  findCodexTranscripts,
  findCodexTranscriptsAsync,
  findCodexTranscriptForSession,
} = require("../lib/codex-ingest");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
it("async discovery matches exact sync order with tied mtimes, arbitrary JSONL, errors and symlinks", async (t) => {
  const home = path.join(root, "history");
  fs.mkdirSync(path.join(home, "nested"), { recursive: true });
  fs.mkdirSync(path.join(home, "blocked"));
  for (let n = 0; n < 65; n++) {
    const file = path.join(home, n % 2 ? "nested" : "", `rollout-${n}.jsonl`);
    fs.writeFileSync(file, "{}\n");
    fs.utimesSync(file, 1000 + (n % 3), 1000 + (n % 3));
  }
  fs.writeFileSync(path.join(home, "other.jsonl"), "{}\n");
  fs.writeFileSync(path.join(home, "ignore.txt"), "{}\n");
  fs.symlinkSync(path.join(home, "nested"), path.join(home, "linked"), "dir");
  const stat = fs.promises.stat,
    readdir = fs.promises.readdir;
  const syncStat = fs.statSync,
    syncReaddir = fs.readdirSync;
  t.after(() => {
    fs.promises.stat = stat;
    fs.promises.readdir = readdir;
    fs.statSync = syncStat;
    fs.readdirSync = syncReaddir;
  });
  const denied = (file) => file.endsWith("blocked");
  fs.readdirSync = (file, ...args) => {
    if (denied(file)) throw new Error("unreadable");
    return syncReaddir(file, ...args);
  };
  fs.statSync = (file, ...args) => {
    if (file.endsWith("rollout-3.jsonl")) throw new Error("gone");
    return syncStat(file, ...args);
  };
  const expected = [false, true].map((includeAllJsonl) =>
    findCodexTranscripts(home, { includeAllJsonl })
  );
  fs.readdirSync = () => {
    throw new Error("sync directory walk");
  };
  fs.statSync = () => {
    throw new Error("sync stat");
  };
  let active = 0,
    max = 0,
    ticks = 0;
  const timer = setInterval(() => ticks++, 1);
  t.after(() => clearInterval(timer));
  fs.promises.readdir = async (file, ...args) => {
    if (denied(file)) throw new Error("unreadable");
    return readdir(file, ...args);
  };
  fs.promises.stat = async (file, ...args) => {
    active++;
    max = Math.max(max, active);
    try {
      await new Promise((r) => setTimeout(r, (file.length % 4) + 2));
      if (file.endsWith("rollout-3.jsonl")) throw new Error("gone");
      return await stat(file, ...args);
    } finally {
      active--;
    }
  };
  for (const includeAllJsonl of [false, true]) {
    const observations = new Map();
    const actual = await findCodexTranscriptsAsync(home, { includeAllJsonl, observations });
    assert.deepEqual(actual, expected[Number(includeAllJsonl)]);
    assert.equal(observations.has(path.join(home, "nested", "rollout-3.jsonl")), false);
    assert.equal(observations.size, actual.length - 1);
  }
  assert.ok(ticks > 0);
  assert.ok(max > 1 && max <= 16);
});
it("a stale old-home scan cannot displace a newer hook path or keep scanning", async (t) => {
  const id = "00000000-0000-4000-8000-000000000001";
  const old = path.join(root, "old", "sessions"),
    current = path.join(root, "current", "sessions");
  for (const dir of [old, current]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `rollout-${id}.jsonl`), "{}\n");
  }
  const readdir = fs.promises.readdir,
    syncReaddir = fs.readdirSync;
  t.after(() => {
    fs.promises.readdir = readdir;
    fs.readdirSync = syncReaddir;
  });
  let release, started;
  const entered = new Promise((r) => (started = r)),
    wait = new Promise((r) => (release = r));
  fs.promises.readdir = async (file, ...args) => {
    if (file === old) {
      started();
      await wait;
    }
    return readdir(file, ...args);
  };
  let valid = true;
  const pending = findCodexTranscriptsAsync(old, { isCurrent: () => valid });
  await entered;
  const expected = path.join(current, `rollout-${id}.jsonl`);
  await findCodexTranscriptsAsync(current);
  valid = false;
  release();
  assert.deepEqual(await pending, []);
  fs.readdirSync = () => {
    throw new Error("hook cache missed");
  };
  assert.equal(findCodexTranscriptForSession(id), expected);
});

it("duplicate IDs retain the synchronous hook-cache winner independently of mtime ordering", async (t) => {
  const home = path.join(root, "current", "sessions");
  const id = "00000000-0000-4000-8000-000000000002";
  fs.mkdirSync(home, { recursive: true });
  for (const [prefix, time] of [
    ["a", 100],
    ["b", 200],
  ]) {
    const file = path.join(home, `rollout-${prefix}-${id}.jsonl`);
    fs.writeFileSync(file, "{}\n");
    fs.utimesSync(file, time, time);
  }
  const sync = findCodexTranscripts(home);
  const winner = findCodexTranscriptForSession(id);
  const asyncResult = await findCodexTranscriptsAsync(home);
  assert.deepEqual(asyncResult, sync);
  const readdir = fs.readdirSync;
  t.after(() => {
    fs.readdirSync = readdir;
  });
  fs.readdirSync = () => {
    throw new Error("hook cache missed");
  };
  assert.equal(findCodexTranscriptForSession(id), winner);
});
