/**
 * @file Verifies compact count caching only for an unchanged committed database,
 * with scope/day keys, schema/external-write invalidation and bounded storage.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-count-cache-"));
process.env.DASHBOARD_DB_PATH = path.join(root, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = root;
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
const { ReadonlyQuery } = require("../lib/readonly-query");
const originalRead = ReadonlyQuery.prototype.read;
let reads = 0,
  implementation;
ReadonlyQuery.prototype.read = function (query) {
  reads++;
  return implementation(query);
};
const Module = require("node:module");
const nativeLoad = Module._load;
const useCompat = process.env.CCAM_TEST_CACHE_COMPAT === "1";
if (useCompat)
  Module._load = function (request, parent, ...args) {
    if (request === "better-sqlite3" && parent?.filename === path.resolve(__dirname, "../db.js"))
      throw new Error("Force compatibility driver for this isolated matrix run");
    return nativeLoad.call(this, request, parent, ...args);
  };
let dbModule;
try {
  dbModule = require("../db");
} finally {
  Module._load = nativeLoad;
}
const { db, readCountQuery, readDashboardStats } = dbModule;
const Compat = require("../compat-sqlite");
// better-sqlite3 is optional: without a loadable native driver db.js uses the compat wrapper.
const NativeDatabase = (() => {
  try {
    const Native = require("better-sqlite3");
    new Native(":memory:").close();
    return Native;
  } catch {
    return null;
  }
})();
assert.equal(db instanceof Compat, useCompat || !NativeDatabase);

const D = NativeDatabase || Compat;
const committed = new D(process.env.DASHBOARD_DB_PATH, { readonly: true, fileMustExist: true });
db.prepare("INSERT INTO sessions(id) VALUES('cache-session')").run();
const sql = "SELECT COUNT(*) AS count FROM events";
const insert = () =>
  db
    .prepare("INSERT INTO events(session_id,event_type,data) VALUES('cache-session','test','{}')")
    .run();
function reset() {
  insert();
  reads = 0;
  implementation = (q) =>
    Promise.resolve(
      q.op === "stats"
        ? {
            total_events: committed.prepare(sql).get().count,
            events_today: 1,
            agents_by_status: { working: 1 },
          }
        : committed.prepare(q.sql).get(...q.params)
    );
}
after(() => {
  ReadonlyQuery.prototype.read = originalRead;
  committed.close();
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
it("reuses unchanged static totals without reusing mutable result objects", async () => {
  reset();
  const generation = require("../lib/readonly-query").databaseGeneration;
  const before = generation(db);
  const first = await readCountQuery(sql);
  const after = generation(db);
  const stable = await readCountQuery(sql);
  assert.equal(generation(db), after, "the measured reuse phase must have no commit");
  // Opening the second driver's first WAL read can change data_version. That
  // first flight must be discarded, not cached under its superseded version.
  assert.equal(reads, before === after ? 1 : 2);
  assert.equal(stable.count, first.count);
  const warmedReads = reads;
  const expected = stable.count;
  stable.count = -1;
  assert.equal((await readCountQuery(sql)).count, expected);
  assert.equal(reads, warmedReads);
});
it("invalidates on own and external writes, schema changes and rollbacks", async () => {
  reset();
  await readCountQuery(sql);
  insert();
  await readCountQuery(sql);
  assert.equal(reads, 2);
  const other = new D(process.env.DASHBOARD_DB_PATH);
  try {
    other
      .prepare("INSERT INTO events(session_id,event_type) VALUES('cache-session','external')")
      .run();
  } finally {
    other.close();
  }
  await readCountQuery(sql);
  assert.equal(reads, 3);
  db.exec("CREATE TABLE cache_schema_probe(id INTEGER)");
  await readCountQuery(sql);
  assert.equal(reads, 4);
  db.exec("BEGIN");
  insert();
  db.exec("ROLLBACK");
  await readCountQuery(sql);
  assert.equal(reads, 5);
});
it("bypasses both cache hits and storage during an open transaction", async () => {
  reset();
  await readCountQuery(sql);
  db.exec("BEGIN");
  insert();
  try {
    await readCountQuery(sql);
    await readCountQuery(sql);
    assert.equal(reads, 3);
  } finally {
    db.exec("ROLLBACK");
  }
  await readCountQuery(sql);
  assert.equal(reads, 4);
  await readCountQuery(sql);
  assert.equal(reads, 4);
});
it("does not store a read that began in a transaction but resolves after commit", async () => {
  reset();
  db.exec("BEGIN");
  let resolve;
  implementation = () => new Promise((r) => (resolve = r));
  const flight = readCountQuery(sql);
  db.exec("COMMIT");
  resolve({ count: 7 });
  await flight;
  implementation = () => Promise.resolve({ count: 8 });
  assert.equal((await readCountQuery(sql)).count, 8);
  assert.equal(reads, 2);
});
it("never stores failed reads or payload/rolling-window queries", async () => {
  reset();
  implementation = () => Promise.reject(new Error("busy"));
  await assert.rejects(readCountQuery(sql), /busy/);
  implementation = () => Promise.resolve({ count: 1 });
  await readCountQuery(sql);
  assert.equal(reads, 2);
  for (const query of [
    "SELECT COUNT(*) AS count FROM events WHERE created_at>=datetime('now','-1 hour')",
    "SELECT id FROM events LIMIT 1",
  ]) {
    await readCountQuery(query);
    await readCountQuery(query);
  }
  assert.equal(reads, 6);
});
it("older reordered completions cannot replace or clear a newer generation cache", async () => {
  reset();
  let finishOld;
  implementation = () => new Promise((r) => (finishOld = r));
  const old = readCountQuery(sql);
  insert();
  implementation = () => Promise.resolve({ count: 99 });
  await readCountQuery(sql);
  finishOld({ count: 1 });
  await old;
  assert.equal((await readCountQuery(sql)).count, 99);
  assert.equal(reads, 2);
});
it("stats scope, timezone calendar day and returned nested figures stay independent", async () => {
  reset();
  const now = Date.now;
  let clock = Date.UTC(2026, 9, 11, 6, 59, 59);
  Date.now = () => clock;
  try {
    const a = await readDashboardStats(null, null, "-420 minutes", "420 minutes");
    a.agents_by_status.working = -1;
    assert.equal(
      (await readDashboardStats(null, null, "-420 minutes", "420 minutes")).agents_by_status
        .working,
      1
    );
    assert.equal(reads, 1);
    await readDashboardStats(["local"], null, "-420 minutes", "420 minutes");
    assert.equal(reads, 2);
    clock += 2000;
    await readDashboardStats(null, null, "-420 minutes", "420 minutes");
    assert.equal(reads, 3);
    await readDashboardStats(null, null, "invalid", "420 minutes");
    await readDashboardStats(null, null, "invalid", "420 minutes");
    assert.equal(reads, 5);
  } finally {
    Date.now = now;
  }
});
it("a stats read crossing local midnight is not retained", async () => {
  reset();
  const now = Date.now;
  let clock = Date.UTC(2026, 9, 11, 6, 59, 59);
  Date.now = () => clock;
  try {
    let resolve;
    implementation = () => new Promise((r) => (resolve = r));
    const p = readDashboardStats(null, null, "-420 minutes", "420 minutes");
    clock += 2000;
    resolve({ events_today: 0 });
    await p;
    clock -= 2000;
    implementation = () => Promise.resolve({ events_today: 1 });
    assert.equal(
      (await readDashboardStats(null, null, "-420 minutes", "420 minutes")).events_today,
      1
    );
    assert.equal(reads, 2);
  } finally {
    Date.now = now;
  }
});
it("keeps at most 32 compact keys and bypasses oversized keys and values", async () => {
  reset();
  for (let i = 0; i < 33; i++)
    await readDashboardStats(["src_" + i], null, "0 minutes", "0 minutes");
  await readDashboardStats(["src_0"], null, "0 minutes", "0 minutes");
  assert.equal(reads, 34);
  const huge = ["x".repeat(5000)];
  await readDashboardStats(huge, null, "0 minutes", "0 minutes");
  await readDashboardStats(huge, null, "0 minutes", "0 minutes");
  assert.equal(reads, 36);
  insert();
  reads = 0;
  implementation = () => Promise.resolve({ data: "x".repeat(70000) });
  await readCountQuery(sql);
  await readCountQuery(sql);
  assert.equal(reads, 2);
});

it(
  "does not hide a missing or replaced database file",
  { skip: process.platform === "win32" },
  async () => {
    reset();
    await readCountQuery(sql);
    const moved = path.join(root, "parked.db");
    fs.renameSync(process.env.DASHBOARD_DB_PATH, moved);
    try {
      await readCountQuery(sql);
      assert.equal(reads, 2);
      fs.writeFileSync(process.env.DASHBOARD_DB_PATH, "replacement");
      await readCountQuery(sql);
      assert.equal(reads, 3);
    } finally {
      fs.rmSync(process.env.DASHBOARD_DB_PATH, { force: true });
      fs.renameSync(moved, process.env.DASHBOARD_DB_PATH);
    }
  }
);

it("a committed worker read inside a main transaction cannot become a post-commit cache hit", async () => {
  reset();
  const fakeRead = ReadonlyQuery.prototype.read;
  ReadonlyQuery.prototype.read = originalRead;
  try {
    assert.equal(db.inTransaction, false);
    const before = (await readCountQuery(sql)).count;
    db.exec("BEGIN");
    insert();
    assert.equal(db.inTransaction, true);
    assert.equal((await readCountQuery(sql)).count, before);
    db.exec("COMMIT");
    assert.equal(db.inTransaction, false);
    assert.equal((await readCountQuery(sql)).count, before + 1);
  } finally {
    if (db.inTransaction) db.exec("ROLLBACK");
    ReadonlyQuery.prototype.read = fakeRead;
  }
});
