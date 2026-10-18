/**
 * @file Exercises real read-only SQLite workers with both supported drivers,
 * including responsive HTTP during an expensive count, mutation freshness,
 * scope parity, deadlines, bounded queues and shutdown without external services.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { once } = require("node:events");
let Native;
try {
  Native = require("better-sqlite3");
  new Native(":memory:").close();
} catch {
  Native = null;
}
const Compat = require("../compat-sqlite");
const { ReadonlyQuery, databaseGeneration } = require("../lib/readonly-query");
const scoped = require("../lib/scoped-stats");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-readonly-test-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let sequence = 0;
const query = { op: "get", sql: "SELECT COUNT(*) AS count FROM events", params: [] };

for (const [driver, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  it(
    `${driver}: cost usage and all rate cards stay on the pinned snapshot during writes`,
    { skip: !Constructor, timeout: 30000 },
    async () => {
      const { file, db } = fixture(Constructor);
      db.exec(`CREATE TABLE token_usage(model TEXT, output_tokens INTEGER);
        INSERT INTO token_usage VALUES('fixture',10);
        CREATE TABLE model_pricing(display_name TEXT, output_per_mtok REAL);
        CREATE TABLE gpt_model_pricing(display_name TEXT, output_per_mtok REAL);
        CREATE TABLE cursor_model_pricing(display_name TEXT, output_per_mtok REAL);
        INSERT INTO model_pricing VALUES('fixture',1);
        INSERT INTO gpt_model_pricing VALUES('fixture',2);
        INSERT INTO cursor_model_pricing VALUES('fixture',3);`);
      const reader = new ReadonlyQuery(file, { driver });
      try {
        const started = once(reader, "started");
        const read = reader.read({
          op: "cost",
          sql: `SELECT * FROM (WITH RECURSIVE n(x) AS
          (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<500000),
          pause AS MATERIALIZED (SELECT MAX(x) AS done FROM n)
          SELECT t.* FROM token_usage t CROSS JOIN pause WHERE pause.done=500000)`,
        });
        await started;
        db.exec(`BEGIN;
          UPDATE token_usage SET output_tokens=20;
          UPDATE model_pricing SET output_per_mtok=11;
          UPDATE gpt_model_pricing SET output_per_mtok=12;
          UPDATE cursor_model_pricing SET output_per_mtok=13;
          COMMIT;`);
        const old = await read;
        assert.equal(old.dailyTokens[0].output_tokens, 10);
        assert.deepEqual(
          [
            old.rules[0].output_per_mtok,
            old.gptRules[0].output_per_mtok,
            old.cursorRules[0].output_per_mtok,
          ],
          [1, 2, 3]
        );
        const fresh = await reader.read({ op: "cost", sql: "SELECT * FROM token_usage" });
        assert.equal(fresh.dailyTokens[0].output_tokens, 20);
        assert.deepEqual(
          [
            fresh.rules[0].output_per_mtok,
            fresh.gptRules[0].output_per_mtok,
            fresh.cursorRules[0].output_per_mtok,
          ],
          [11, 12, 13]
        );
        await assert.rejects(
          reader.read({ op: "cost", sql: "DELETE FROM token_usage" }),
          /Only SELECT/
        );
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM token_usage").get().n, 1);
      } finally {
        await reader.close();
        db.close();
      }
    }
  );
}

for (const [driver, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  it(
    `${driver}: a read that exhausts the worker heap fails alone and queued reads continue`,
    { timeout: 30000, skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor);
      const reader = new ReadonlyQuery(file, { driver });
      try {
        const large = reader.read({
          op: "all",
          sql: `SELECT printf('%.*c', 160000, 'x') AS data
        FROM (WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<500) SELECT i FROM n)`,
        });
        await once(reader, "started");
        const queued = reader.read({ op: "get", sql: "SELECT 1 AS queued" });
        const [failed, served] = await Promise.allSettled([large, queued]);
        assert.equal(failed.status, "rejected");
        assert.equal(failed.reason.status, 503);
        assert.equal(failed.reason.cause.code, "ERR_WORKER_OUT_OF_MEMORY");
        assert.deepEqual(served, { status: "fulfilled", value: { queued: 1 } });
        assert.equal(reader.pending.size, 0);
        assert.equal((await reader.read(query)).count, 3);
      } finally {
        await reader.close();
        db.close();
      }
    }
  );

  it(
    `${driver}: an event page over the byte budget is reported without materializing rows`,
    { timeout: 30000, skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor);
      const reader = new ReadonlyQuery(file, { driver, eventPageBudgetBytes: 250000 });
      const page = (width) => {
        const sql = `SELECT id, session_id, printf('%.*c', ${width}, 'x') AS data FROM events ORDER BY id DESC`;
        return {
          sql,
          sizeSql: `SELECT id, length(CAST(data AS BLOB)) AS bytes FROM (${sql})`,
          fetchSql: "SELECT * FROM events WHERE id IN (SELECT value FROM json_each(?))",
        };
      };
      const count = { sql: "SELECT COUNT(*) AS count FROM events" };
      try {
        const over = reader.read({ op: "eventPage", page: page(100000), count });
        const queued = reader.read(query);
        assert.deepEqual(await over, { overflow: true });
        assert.equal((await queued).count, 3);
        const worker = reader.worker;
        const under = await reader.read({ op: "eventPage", page: page(10), count });
        assert.equal(reader.worker, worker, "the same worker serves the next read");
        assert.deepEqual(
          under.events.map((row) => ({ ...row })),
          db
            .prepare("SELECT * FROM events ORDER BY id DESC")
            .all()
            .map((row) => ({ ...row }))
        );
        assert.equal(under.total, 3);
      } finally {
        await reader.close();
        db.close();
      }
    }
  );
}

function fixture(Constructor, slow = false) {
  const file = path.join(root, `${++sequence}.db`);
  const db = new Constructor(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY, source TEXT, provider TEXT, status TEXT);
    CREATE TABLE agents(id TEXT PRIMARY KEY, session_id TEXT, status TEXT);`);
  if (slow) {
    db.exec(`CREATE TABLE limits(n INTEGER); INSERT INTO limits VALUES(5000000);
      CREATE VIEW events AS WITH RECURSIVE counter(n) AS (
        VALUES(1) UNION ALL SELECT n + 1 FROM counter WHERE n < (SELECT n FROM limits)
      ) SELECT n AS id FROM counter;`);
  } else {
    db.exec(`CREATE TABLE events(id INTEGER PRIMARY KEY, session_id TEXT, created_at TEXT);
      INSERT INTO sessions VALUES('local','local','claude','active'),('box','src_box','codex','completed');
      INSERT INTO agents VALUES('a','local','working'),('b','box','completed');
      INSERT INTO events VALUES(1,'local',datetime('now')),(2,'box',datetime('now')),(3,'box',datetime('now'));`);
  }
  return { file, db };
}

for (const [driver, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  it(
    `${driver}: event page, sparse probe fallback and trusted count retain one snapshot during writes`,
    { skip: !Constructor, timeout: 30000 },
    async () => {
      const { file, db } = fixture(Constructor);
      require("../lib/global-event-count").ensureGlobalEventCount(db);
      const reader = new ReadonlyQuery(file, { driver });
      try {
        const started = once(reader, "started");
        const reading = reader.read({
          op: "eventPage",
          page: {
            sql: "SELECT * FROM events ORDER BY id DESC LIMIT 2",
            probe: {
              sql: `SELECT * FROM (WITH RECURSIVE n(x) AS
              (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<500000)
              SELECT id,session_id,created_at FROM events WHERE id=(SELECT max(x) FROM n))`,
              params: [],
              limit: 2,
            },
          },
          count: { sql: "SELECT COUNT(*) AS count FROM events" },
        });
        await started;
        db.exec("INSERT INTO events VALUES(99,'local',datetime('now'))");
        const old = await reading;
        assert.deepEqual(
          old.events.map((r) => r.id),
          [3, 2]
        );
        assert.equal(old.total, 3, "counter metadata must use the page/probe snapshot");
        assert.equal(db.prepare("SELECT total FROM monitor_event_count").get().total, 4);
        const fresh = await reader.read({
          op: "eventPage",
          page: { sql: "SELECT * FROM events ORDER BY id DESC LIMIT 2" },
          count: { sql: "SELECT COUNT(*) AS count FROM events" },
        });
        assert.deepEqual(
          fresh.events.map((r) => r.id),
          [99, 3]
        );
        assert.equal(fresh.total, 4);
        const scopedPage = {
          op: "eventPage",
          page: {
            sql: "SELECT * FROM events WHERE session_id=? ORDER BY id DESC",
            params: ["box"],
          },
          count: {
            sql: "SELECT COUNT(*) AS count FROM events WHERE session_id=?",
            params: ["box"],
            counterSql:
              "SELECT total AS count FROM monitor_session_event_counts WHERE session_id=?",
          },
        };
        assert.equal((await reader.read(scopedPage)).total, 2);
        assert.equal(
          (
            await reader.read({
              ...scopedPage,
              count: {
                ...scopedPage.count,
                sql: "SELECT COUNT(*) AS count FROM missing_raw_count",
              },
            })
          ).total,
          2,
          "trusted scoped metadata must resolve inside the combined operation"
        );
        db.exec(
          "UPDATE monitor_event_count SET trusted=0;UPDATE monitor_session_event_counts SET total=999"
        );
        assert.equal(
          (await reader.read(scopedPage)).total,
          2,
          "untrusted bucket must fall back to raw count"
        );
        for (const invalid of [
          { ...scopedPage, page: { sql: "DELETE FROM events" } },
          { ...scopedPage, count: { sql: "DELETE FROM events" } },
          { ...scopedPage, count: { ...scopedPage.count, counterSql: "DELETE FROM events" } },
        ])
          await assert.rejects(reader.read(invalid), /Only SELECT/);
        assert.equal(
          (await reader.read(scopedPage)).total,
          2,
          "query errors must release the worker"
        );
      } finally {
        await reader.close();
        db.close();
      }
    }
  );
  it(
    `${driver}: row reads preserve payloads, freshness and SELECT-only errors`,
    { skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor);
      db.exec("ALTER TABLE events ADD COLUMN data TEXT");
      const payload = "large payload ".repeat(5000);
      db.prepare("UPDATE events SET data = ?").run(payload);
      const reader = new ReadonlyQuery(file, { driver });
      const rows = {
        op: "all",
        sql: "SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?",
        params: [2, 1],
      };
      try {
        assert.deepEqual(
          await reader.read(rows, databaseGeneration(db)),
          db
            .prepare(rows.sql)
            .all(...rows.params)
            .map((row) => ({ ...row }))
        );
        db.prepare("INSERT INTO events VALUES(4, 'local', datetime('now'), ?)").run(payload);
        assert.deepEqual(
          await reader.read(rows, databaseGeneration(db)),
          db
            .prepare(rows.sql)
            .all(...rows.params)
            .map((row) => ({ ...row }))
        );
        await assert.rejects(reader.read({ op: "all", sql: "DELETE FROM events" }), /Only SELECT/);
        assert.equal((await reader.read(query)).count, 4);
      } finally {
        await reader.close();
        db.close();
      }
    }
  );

  it(
    `${driver}: serves another HTTP request while a real expensive SQLite count is pending`,
    { timeout: 30000, skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor, true);
      const reader = new ReadonlyQuery(file, { driver });
      let countDone = false;
      const server = http.createServer(async (req, res) => {
        if (req.url === "/health") {
          res.end("ok");
          return;
        }
        try {
          res.end(JSON.stringify(await reader.read(query, databaseGeneration(db))));
        } catch (error) {
          res.statusCode = 500;
          res.end(error.message);
        }
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const base = `http://127.0.0.1:${server.address().port}`;
      try {
        const started = once(reader, "started");
        const count = fetch(base + "/count")
          .then((r) => r.json())
          .then((r) => {
            countDone = true;
            return r;
          });
        await started;
        assert.equal(await (await fetch(base + "/health")).text(), "ok");
        assert.equal(countDone, false, "health must finish before the count");
        assert.equal((await count).count, 5000000);
      } finally {
        await reader.close();
        await new Promise((resolve) => server.close(resolve));
        db.close();
      }
    }
  );

  it(
    `${driver}: shares one generation but does not reuse a pre-mutation snapshot`,
    { timeout: 30000, skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor, true);
      const reader = new ReadonlyQuery(file, { driver });
      try {
        const started = once(reader, "started");
        const old = reader.read(query, databaseGeneration(db));
        assert.equal(reader.read(query, databaseGeneration(db)), old);
        await started;
        db.prepare("UPDATE limits SET n = 5").run();
        const fresh = reader.read(query, databaseGeneration(db));
        assert.notEqual(fresh, old);
        assert.equal((await old).count, 5000000);
        assert.equal((await fresh).count, 5);
        db.prepare("UPDATE limits SET n = 5000000").run();
        const externalStarted = once(reader, "started");
        const beforeExternal = reader.read(query, databaseGeneration(db));
        await externalStarted;
        const external = new Constructor(file);
        external.prepare("UPDATE limits SET n = 3").run();
        external.close();
        const afterExternal = reader.read(query, databaseGeneration(db));
        assert.notEqual(afterExternal, beforeExternal);
        assert.equal((await beforeExternal).count, 5000000);
        assert.equal((await afterExternal).count, 3);
      } finally {
        await reader.close();
        db.close();
      }
    }
  );

  it(
    `${driver}: preserves global/scoped overview, provider filters and status totals`,
    { skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor);
      const reader = new ReadonlyQuery(file, { driver });
      try {
        for (const [sources, providers] of [
          [null, null],
          [["src_box"], null],
          [null, ["codex"]],
          [["local"], ["claude"]],
        ]) {
          const stats = await reader.read(
            { op: "stats", sources, providers, toLocal: "0 minutes", toUTC: "0 minutes" },
            databaseGeneration(db)
          );
          const expected =
            sources || providers
              ? scoped.statsOverview(db, sources, providers)
              : db.prepare(scoped.GLOBAL_STATS_SQL).get();
          for (const key of Object.keys(expected)) assert.equal(stats[key], expected[key], key);
          assert.equal(
            Object.values(stats.sessions_by_status).reduce((a, b) => a + b, 0),
            stats.total_sessions
          );
          assert.equal(
            Object.values(stats.agents_by_status).reduce((a, b) => a + b, 0),
            stats.total_agents
          );
        }
      } finally {
        await reader.close();
        db.close();
      }
    }
  );

  it(
    `${driver}: never creates a missing database and a query error releases the worker for retry`,
    { skip: !Constructor },
    async () => {
      const missing = path.join(root, `missing-${driver}.db`);
      const reader = new ReadonlyQuery(missing, { driver });
      try {
        await assert.rejects(reader.read(query), /open|unable|exist/i);
        assert.equal(fs.existsSync(missing), false);
      } finally {
        await reader.close();
      }
      const { file, db } = fixture(Constructor);
      const valid = new ReadonlyQuery(file, { driver });
      try {
        await assert.rejects(valid.read({ op: "get", sql: "DELETE FROM events" }), /SELECT/);
        await assert.rejects(
          valid.read({ op: "get", sql: "SELECT * FROM missing_table" }),
          /no such table/
        );
        assert.equal((await valid.read(query)).count, 3);
        const readonly = new Constructor(file, { readonly: true, fileMustExist: true });
        assert.throws(() => readonly.exec("DELETE FROM events"), /readonly|read-only/i);
        readonly.close();
      } finally {
        await valid.close();
        db.close();
      }
    }
  );
}

it("bounds unique pending reads and settles every promise on close", async () => {
  const { file, db } = fixture(Native || Compat, true);
  const reader = new ReadonlyQuery(file, { maxPending: 1 });
  const pending = reader.read(query);
  const rejected = assert.rejects(pending, /closed/);
  await assert.rejects(reader.read(query, "another-generation"), /queue is full/);
  await reader.close();
  await rejected;
  await assert.rejects(reader.read(query), /unavailable/);
  db.close();
});

it("a deadline rejects pending work without spawning a replacement before termination", async () => {
  const { file, db } = fixture(Native || Compat, true);
  const reader = new ReadonlyQuery(file, { timeoutMs: 5 });
  try {
    await assert.rejects(reader.read(query), /timed out/);
    reader.timeoutMs = 30000;
    db.prepare("UPDATE limits SET n = 3").run();
    const fence = reader.terminating;
    const next = reader.read(query, databaseGeneration(db));
    if (fence) assert.equal(reader.worker, null, "recovery must wait for the old worker exit");
    assert.equal((await next).count, 3);
  } finally {
    await reader.close();
    db.close();
  }
});

it(
  "a deadline also settles a query that has already pinned its SQLite snapshot",
  { timeout: 30000 },
  async () => {
    const { file, db } = fixture(Native || Compat, true);
    const reader = new ReadonlyQuery(file);
    try {
      await reader.read({ op: "get", sql: "SELECT 1 AS ready" });
      reader.timeoutMs = 300;
      const started = once(reader, "started");
      const pending = reader.read(query);
      const rejected = assert.rejects(pending, /timed out/);
      await started;
      await rejected;
      // Recovery still waits for native SQLite to release the previous worker;
      // the next request gets the normal budget, not the expired test's 300ms.
      reader.timeoutMs = 30000;
      const next = reader.read({ op: "get", sql: "SELECT 1 AS recovered" }, "next");
      assert.equal((await next).recovered, 1);
    } finally {
      await reader.close();
      db.close();
    }
  }
);

for (const [driver, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  it(
    `${driver}: committed write bursts share only the undispatched fresh read`,
    { timeout: 30000, skip: !Constructor },
    async () => {
      const { file, db } = fixture(Constructor, true);
      const reader = new ReadonlyQuery(file, { driver });
      let starts = 0;
      reader.on("started", () => starts++);
      try {
        const started = once(reader, "started");
        const old = reader.read(query, databaseGeneration(db));
        await started;
        const requests = [];
        for (let n = 1; n <= 40; n++) {
          db.prepare("UPDATE limits SET n=?").run(n);
          requests.push(reader.read(query, databaseGeneration(db)));
        }
        assert.notEqual(requests[0], old);
        assert.ok(requests.every((promise) => promise === requests[0]));
        assert.equal(reader.pending.size, 2, "one active read and one future snapshot");
        assert.equal((await old).count, 5000000);
        assert.ok((await Promise.all(requests)).every((row) => row.count === 40));
        assert.equal(starts, 2, "write generation churn must not enqueue 40 SQLite scans");
      } finally {
        await reader.close();
        db.close();
      }
    }
  );
}
