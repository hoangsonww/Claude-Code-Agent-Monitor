/**
 * @file Verifies global event counts on both SQLite drivers, including atomic
 * migration, concurrent snapshots, cascades, REPLACE/IGNORE write semantics,
 * rowid aliases, schema recovery and conservative read-only fallback.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { once } = require("node:events");
const Native = require("better-sqlite3"),
  Compat = require("../compat-sqlite");
const {
  ensureGlobalEventCount,
  trustedGlobalEventCount,
  globalEventCountSql,
} = require("../lib/global-event-count");
const { ReadonlyQuery } = require("../lib/readonly-query");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-global-count-"));
let sequence = 0;
after(() => fs.rmSync(root, { recursive: true, force: true }));
function fixture(t, Constructor) {
  const file = path.join(root, `${++sequence}.db`),
    db = new Constructor(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY,source TEXT,provider TEXT,status TEXT);
    CREATE TABLE agents(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
    CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT,summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
    INSERT INTO sessions VALUES('local','local','codex','active'),('remote','box','claude','completed');
    INSERT INTO events(id,session_id,summary) VALUES(1,'local','a'),(2,'remote','b'),(3,NULL,'c');`);
  t.after(() => db.close());
  return { db, file };
}
function actual(db) {
  return db.prepare("SELECT COUNT(*) AS count FROM events").get().count;
}
function read(db) {
  return db.prepare(globalEventCountSql(db)).get().count;
}
for (const [driver, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  for (const recursive of [0, 1])
    it(`${driver}: insert counts ignore preceding and nested changes, while tainted or missing singleton skips bucket writes (recursion=${recursive})`, (t) => {
      const { db } = fixture(t, Constructor);
      db.pragma(`recursive_triggers = ${recursive}`);
      db.pragma("trusted_schema = OFF");
      ensureGlobalEventCount(db);
      // Deliberately add DDL after publication: readers must fall back, but
      // the maintained rows still prove nested changes cannot gate the bucket.
      db.exec(`CREATE TABLE fixture_changes(id INTEGER PRIMARY KEY,value INTEGER);
        INSERT INTO fixture_changes VALUES(1,0),(2,0),(3,0);
        CREATE TABLE fixture_audit(value INTEGER);
        CREATE TRIGGER fixture_nested_changes AFTER UPDATE OF total ON monitor_event_count BEGIN
          INSERT INTO fixture_audit VALUES(1),(2),(3);
        END;`);
      const insert = db.prepare("INSERT INTO events(session_id) VALUES(?)");
      for (const precedingChanges of [0, 1, 3]) {
        db.prepare("UPDATE fixture_changes SET value=value+1 WHERE id<=?").run(precedingChanges);
        const result = insert.run(precedingChanges === 3 ? null : "local");
        assert.equal(result.changes, 1, "nested writes must not change the caller's row count");
        assert.equal(
          Number(result.lastInsertRowid),
          db.prepare("SELECT MAX(id) AS id FROM events").get().id
        );
        assert.equal(db.prepare("SELECT total FROM monitor_event_count").get().total, actual(db));
        assert.deepEqual(
          db
            .prepare(
              "SELECT session_id,total FROM monitor_session_event_counts ORDER BY session_id"
            )
            .all()
            .map((row) => ({ ...row })),
          db
            .prepare(
              "SELECT session_id,COUNT(*) AS total FROM events WHERE session_id IS NOT NULL GROUP BY session_id ORDER BY session_id"
            )
            .all()
            .map((row) => ({ ...row }))
        );
      }
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM fixture_audit").get().count, 9);
      assert.equal(trustedGlobalEventCount(db), null, "extra DDL must retain the schema fence");
      assert.equal(read(db), actual(db));
      const buckets = db
        .prepare("SELECT * FROM monitor_session_event_counts ORDER BY session_id")
        .all();
      db.exec("UPDATE monitor_event_count SET trusted=0");
      insert.run("remote");
      assert.deepEqual(
        db.prepare("SELECT * FROM monitor_session_event_counts ORDER BY session_id").all(),
        buckets
      );
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM fixture_audit").get().count, 9);
      db.exec("DELETE FROM monitor_event_count");
      insert.run("local");
      assert.deepEqual(
        db.prepare("SELECT * FROM monitor_session_event_counts ORDER BY session_id").all(),
        buckets
      );
      assert.equal(read(db), actual(db));
      ensureGlobalEventCount(db);
      assert.equal(trustedGlobalEventCount(db), actual(db));
    });
  it(`${driver}: per-session totals match events across NULL transfers, cascades, orphans and ownership changes`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    const scoped = require("../lib/scoped-stats");
    const check = () => {
      assert.deepEqual(
        db
          .prepare("SELECT session_id,total FROM monitor_session_event_counts ORDER BY session_id")
          .all()
          .map((r) => ({ ...r })),
        db
          .prepare(
            "SELECT session_id,COUNT(*) AS total FROM events WHERE session_id IS NOT NULL GROUP BY session_id ORDER BY session_id"
          )
          .all()
          .map((r) => ({ ...r }))
      );
      for (const [sources, providers] of [
        [["local"], ["codex"]],
        [["box"], ["claude"]],
        [null, ["claude"]],
        [["local"], null],
      ]) {
        const expected = db
          .prepare(
            "SELECT COUNT(*) AS count FROM events WHERE session_id IN (SELECT id FROM sessions WHERE (? IS NULL OR source=?) AND (? IS NULL OR provider=?))"
          )
          .get(
            sources?.[0] ?? null,
            sources?.[0] ?? null,
            providers?.[0] ?? null,
            providers?.[0] ?? null
          ).count;
        assert.equal(scoped.statsOverview(db, sources, providers).total_events, expected);
      }
    };
    check();
    for (const sql of [
      "UPDATE events SET session_id='local' WHERE id=3",
      "UPDATE events SET session_id='remote' WHERE id=1",
      "UPDATE events SET session_id=NULL WHERE id=2",
      "UPDATE sessions SET source='local',provider='codex' WHERE id='remote'",
      "DELETE FROM sessions WHERE id='local'",
    ]) {
      db.exec(sql);
      check();
    }
    db.pragma("foreign_keys = OFF");
    db.exec("INSERT INTO events(session_id) VALUES('orphan')");
    check();
    db.exec("INSERT INTO sessions VALUES('orphan','local','claude','completed')");
    check();
    const prepare = db.prepare;
    t.after(() => (db.prepare = prepare));
    db.prepare = function (sql) {
      assert.doesNotMatch(
        sql,
        /COUNT\(\*\).*FROM events/i,
        "trusted scoped totals must avoid historical event scans"
      );
      return prepare.call(this, sql);
    };
    assert.equal(scoped.statsOverview(db, ["local"], ["claude"]).total_events, 1);
  });
  for (const change of ["delete", "transfer"])
    it(`${driver}: missing old session bucket taints all shortcuts before ${change}, preserving the event write`, (t) => {
      const { db } = fixture(t, Constructor);
      ensureGlobalEventCount(db);
      db.exec("DELETE FROM monitor_session_event_counts WHERE session_id='local'");
      db.exec(
        change === "delete"
          ? "DELETE FROM events WHERE id=1"
          : "UPDATE events SET session_id='remote' WHERE id=1"
      );
      assert.equal(trustedGlobalEventCount(db), null);
      assert.equal(
        require("../lib/scoped-stats").statsOverview(db, ["box"], ["claude"]).total_events,
        change === "delete" ? 1 : 2
      );
      assert.equal(read(db), actual(db));
      ensureGlobalEventCount(db);
      assert.equal(trustedGlobalEventCount(db), actual(db));
    });
  it(`${driver}: missing per-session table plus failed repair cannot leave dangling write triggers`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.exec("DROP TABLE monitor_session_event_counts");
    const exec = db.exec;
    db.exec = function (sql) {
      if (sql.startsWith("CREATE TRIGGER monitor_event_count_conflict_update"))
        throw new Error("publication failure");
      return exec.call(this, sql);
    };
    assert.throws(() => ensureGlobalEventCount(db), /publication failure/);
    db.exec = exec;
    db.exec(
      "INSERT INTO events(session_id) VALUES('local');DELETE FROM events WHERE id=1;UPDATE events SET session_id=NULL WHERE id=2;"
    );
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    ensureGlobalEventCount(db);
    assert.equal(
      require("../lib/scoped-stats").statsOverview(db, ["local"], ["codex"]).total_events,
      1
    );
  });
  it(`${driver}: session reassignment during a real scoped worker read remains outside its snapshot`, async (t) => {
    const { db, file } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    const reader = new ReadonlyQuery(file, { driver });
    t.after(() => reader.close());
    const query = {
      op: "stats",
      sources: ["local"],
      providers: ["codex"],
      toLocal: "-420 minutes",
      toUTC: "420 minutes",
    };
    const started = once(reader, "started"),
      pending = reader.read(query);
    await started;
    db.exec("UPDATE events SET session_id='remote' WHERE id=1");
    assert.equal((await pending).total_events, 1);
    assert.equal((await reader.read(query)).total_events, 0);
  });
  it(`${driver}: actual worker session-only COUNT uses validated buckets or exact fallback within the same snapshot`, async (t) => {
    const { db, file } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    const reader = new ReadonlyQuery(file, { driver });
    t.after(() => reader.close());
    const original = "SELECT COUNT(*) AS count FROM events WHERE session_id IN (?)";
    const bucket =
      "SELECT COALESCE(SUM(total),0) AS count FROM monitor_session_event_counts WHERE session_id IN (?)";
    assert.equal(
      (await reader.read({ op: "get", sql: original, counterSql: bucket, params: ["local"] }))
        .count,
      1
    );
    const started = once(reader, "started"),
      pending = reader.read({ op: "get", sql: original, counterSql: bucket, params: ["remote"] });
    await started;
    db.exec("UPDATE events SET session_id='remote' WHERE id=1");
    assert.equal((await pending).count, 1);
    assert.equal(
      (await reader.read({ op: "get", sql: original, counterSql: bucket, params: ["remote"] }))
        .count,
      2
    );
    await assert.rejects(
      reader.read({
        op: "get",
        sql: original,
        counterSql: "DELETE FROM events",
        params: ["remote"],
      }),
      /Only SELECT/
    );
    db.exec("DROP TABLE monitor_session_event_counts");
    assert.equal(
      (await reader.read({ op: "get", sql: original, counterSql: bucket, params: ["remote"] }))
        .count,
      2,
      "missing derived table must not be read or repaired by the worker"
    );
  });
  it(`${driver}: atomic backfill, rollback, cascade, bulk writes and external writers keep exact totals`, async (t) => {
    const { db, file } = fixture(t, Constructor),
      reader = new Native(file);
    reader.exec("BEGIN");
    assert.equal(actual(reader), 3);
    assert.equal(ensureGlobalEventCount(db), true);
    assert.equal(
      reader.prepare("SELECT name FROM sqlite_master WHERE name='monitor_event_count'").get(),
      undefined
    );
    reader.exec("COMMIT");
    assert.equal(trustedGlobalEventCount(reader), 3);
    reader.close();
    assert.equal(ensureGlobalEventCount(db), false);
    db.transaction(() => {
      for (let n = 0; n < 200; n++)
        db.prepare("INSERT INTO events(session_id) VALUES('local')").run();
    })();
    assert.equal(read(db), 203);
    assert.throws(
      db.transaction(() => {
        db.exec("DELETE FROM events");
        throw new Error("rollback");
      }),
      /rollback/
    );
    assert.equal(read(db), 203);
    db.exec(
      "UPDATE events SET session_id='remote' WHERE id=1;UPDATE sessions SET source='local',provider='codex' WHERE id='remote';"
    );
    assert.equal(read(db), actual(db));
    db.exec("DELETE FROM sessions WHERE id='remote'");
    assert.equal(read(db), 201);
    const writer = new Native(file);
    writer.exec("INSERT INTO events(session_id) VALUES(NULL);DELETE FROM events WHERE id=3");
    writer.close();
    assert.equal(read(db), actual(db));
    const prepare = db.prepare;
    t.after(() => (db.prepare = prepare));
    db.prepare = function (sql) {
      assert.doesNotMatch(
        sql,
        /COUNT\(\*\).*FROM events/i,
        "trusted reads must avoid the original scan"
      );
      return prepare.call(this, sql);
    };
    assert.equal(read(db), 201);
  });
  for (const recursive of [0, 1])
    for (const alias of ["INSERT", "id", "rowid", "_rowid_", "oid"])
      it(`${driver}: REPLACE via ${alias}, recursion=${recursive}, preserves rows and exact fallback`, (t) => {
        const { db } = fixture(t, Constructor);
        db.pragma(`recursive_triggers = ${recursive}`);
        ensureGlobalEventCount(db);
        if (alias === "INSERT")
          db.exec(
            "INSERT OR REPLACE INTO events(id,session_id,summary) VALUES(1,'local','replaced')"
          );
        else db.exec(`UPDATE OR REPLACE events SET ${alias}=1,summary='replaced' WHERE id=2`);
        assert.equal(db.prepare("SELECT summary FROM events WHERE id=1").get().summary, "replaced");
        assert.equal(read(db), actual(db));
        assert.equal(trustedGlobalEventCount(db), null);
        {
          db.exec(
            "UPDATE monitor_event_count SET total=0;DELETE FROM events;INSERT INTO events(summary) VALUES('after-taint');"
          );
          assert.equal(read(db), 1, "tainted maintenance must not block existing writes");
          assert.equal(ensureGlobalEventCount(db), true);
          assert.equal(trustedGlobalEventCount(db), 1);
        }
      });
  it(`${driver}: IGNORE remains ignored and rollback also rolls back taint`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    assert.throws(
      db.transaction(() => {
        db.exec("INSERT OR REPLACE INTO events(id) VALUES(1)");
        throw new Error("rollback");
      }),
      /rollback/
    );
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec("INSERT OR IGNORE INTO events(id) VALUES(1)");
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    ensureGlobalEventCount(db);
    db.pragma("recursive_triggers = ON");
    db.exec("INSERT OR IGNORE INTO events(id) VALUES(1)");
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
  });
  it(`${driver}: transient extra UNIQUE indexes cannot leave a trusted stale total`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.transaction(() => {
      db.exec("CREATE UNIQUE INDEX custom_unique ON events(summary)");
      assert.equal(trustedGlobalEventCount(db), null);
      db.exec("INSERT OR REPLACE INTO events(id,summary) VALUES(10,'a');DROP INDEX custom_unique;");
    })();
    assert.equal(read(db), actual(db));
    assert.equal(trustedGlobalEventCount(db), null);
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec("CREATE UNIQUE INDEX custom_unique ON events(summary)");
    assert.equal(ensureGlobalEventCount(db), false);
    db.exec(
      "DROP INDEX custom_unique;DELETE FROM monitor_event_count;INSERT INTO events(summary) VALUES('missing-counter');"
    );
    assert.equal(trustedGlobalEventCount(db), null);
    assert.equal(read(db), 4);
    ensureGlobalEventCount(db);
    assert.equal(read(db), 4);
  });
  it(`${driver}: missing or changed triggers use legacy reads and can be rebuilt; no arbitrary value-corruption promise`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.exec(
      "DROP TRIGGER monitor_event_count_insert;INSERT INTO events(summary) VALUES('missing-trigger');"
    );
    assert.equal(trustedGlobalEventCount(db), null);
    assert.equal(read(db), 4);
    ensureGlobalEventCount(db);
    db.exec(
      "DROP TRIGGER monitor_event_count_delete;CREATE TRIGGER monitor_event_count_delete AFTER DELETE ON events BEGIN SELECT 1;END;DELETE FROM events WHERE id=1;"
    );
    assert.equal(read(db), 3);
    ensureGlobalEventCount(db);
    db.exec("UPDATE monitor_event_count SET total=999");
    ensureGlobalEventCount(db, { rebuild: true });
    assert.equal(read(db), 3);
  });
  it(`${driver}: hardened trusted_schema OFF supports ordinary writes, rollback and conservative REPLACE`, (t) => {
    const { db } = fixture(t, Constructor);
    db.pragma("trusted_schema = OFF");
    ensureGlobalEventCount(db);
    db.exec(
      "INSERT INTO events(summary) VALUES('safe');UPDATE events SET summary='updated' WHERE id=1;DELETE FROM events WHERE id=2;"
    );
    assert.equal(trustedGlobalEventCount(db), 3);
    assert.throws(
      db.transaction(() => {
        db.exec("DELETE FROM events");
        throw new Error("rollback");
      }),
      /rollback/
    );
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec("INSERT OR REPLACE INTO events(id,summary) VALUES(1,'hardened-replace')");
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec(
      "CREATE UNIQUE INDEX hardened_unique ON events(summary);INSERT OR REPLACE INTO events(summary) VALUES('hardened-replace');DROP INDEX hardened_unique;"
    );
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
  });
  it(`${driver}: extra UNIQUE indexes plus incomplete counters do not prevent normal writes after repair`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.exec(
      "CREATE UNIQUE INDEX custom_partial_unique ON events(summary);DROP TABLE monitor_event_count;"
    );
    ensureGlobalEventCount(db);
    db.exec("INSERT OR REPLACE INTO events(summary) VALUES('a')");
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    db.exec("DROP INDEX custom_partial_unique");
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 3);
  });
  for (const all of [false, true])
    it(`${driver}: persisted schema version rejects identical trigger restoration (${all ? "all" : "insert only"})`, (t) => {
      const { db } = fixture(t, Constructor);
      ensureGlobalEventCount(db);
      const triggers = db
        .prepare(
          "SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'monitor_event_count_%'"
        )
        .all();
      const removed = all
        ? triggers
        : triggers.filter((row) => row.name === "monitor_event_count_insert");
      for (const row of removed) db.exec(`DROP TRIGGER ${row.name}`);
      db.exec("INSERT INTO events(summary) VALUES('while-triggers-missing')");
      for (const row of removed) db.exec(row.sql);
      assert.equal(
        db.prepare("SELECT trusted FROM monitor_event_count").get().trusted,
        1,
        "the cookie must catch history that a trust flag cannot"
      );
      assert.equal(trustedGlobalEventCount(db), null);
      assert.equal(read(db), 4);
      ensureGlobalEventCount(db);
      assert.equal(trustedGlobalEventCount(db), 4);
    });
  it(`${driver}: stale partial counters cannot abort DELETE, including after a failed rebuild rolls back`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.exec(
      "DROP TRIGGER monitor_event_count_insert;INSERT INTO events(summary) VALUES('gap-one'),('gap-two');"
    );
    const exec = db.exec;
    db.exec = function (sql) {
      if (sql.startsWith("CREATE TRIGGER monitor_event_count_conflict_update"))
        throw new Error("publication failure");
      return exec.call(this, sql);
    };
    assert.throws(() => ensureGlobalEventCount(db), /publication failure/);
    db.exec = exec;
    assert.equal(actual(db), 5);
    db.exec("DELETE FROM events");
    assert.equal(actual(db), 0);
    assert.equal(trustedGlobalEventCount(db), null);
    assert.equal(read(db), 0);
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 0);
  });
  it(`${driver}: unrelated DDL also conservatively disables the shortcut; DDL rollback does not`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    assert.throws(
      db.transaction(() => {
        db.exec("CREATE TABLE temporary_schema(id)");
        throw new Error("rollback");
      }),
      /rollback/
    );
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec("CREATE TABLE unrelated_schema(id);DROP TABLE unrelated_schema;");
    assert.equal(trustedGlobalEventCount(db), null);
    assert.equal(read(db), 3);
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 3);
  });
  it(`${driver}: failed repair of a missing counter disables only its dangling triggers`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    db.exec("CREATE TRIGGER unrelated_event_trigger AFTER INSERT ON events BEGIN SELECT 1;END;");
    db.exec("DROP TABLE monitor_event_count");
    const exec = db.exec;
    db.exec = function (sql) {
      if (sql.startsWith("CREATE TRIGGER monitor_event_count_conflict_update"))
        throw new Error("publication failure");
      return exec.call(this, sql);
    };
    assert.throws(() => ensureGlobalEventCount(db), /publication failure/);
    db.exec = exec;
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND name LIKE 'monitor_event_count_%'"
        )
        .get().count,
      0
    );
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='unrelated_event_trigger'").get());
    db.exec(
      "INSERT INTO events(summary) VALUES('after-failed-repair');DELETE FROM events WHERE id=1;"
    );
    assert.equal(read(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    ensureGlobalEventCount(db);
    assert.equal(trustedGlobalEventCount(db), 3);
  });
  it(`${driver}: failed explicit rebuild preserves a previously trustworthy counter`, (t) => {
    const { db } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    const exec = db.exec;
    db.exec = function (sql) {
      if (sql.startsWith("CREATE TRIGGER monitor_event_count_conflict_update"))
        throw new Error("publication failure");
      return exec.call(this, sql);
    };
    assert.throws(() => ensureGlobalEventCount(db, { rebuild: true }), /publication failure/);
    db.exec = exec;
    assert.equal(trustedGlobalEventCount(db), 3);
    db.exec("INSERT INTO events(summary) VALUES('old-valid-counter')");
    assert.equal(trustedGlobalEventCount(db), 4);
  });
  it(`${driver}: failed trigger publication rolls back all derived schema and leaves original events`, (t) => {
    const { db } = fixture(t, Constructor),
      exec = db.exec;
    db.exec = function (sql) {
      if (sql.startsWith("CREATE TRIGGER monitor_event_count_conflict_update"))
        throw new Error("publication failure");
      return exec.call(this, sql);
    };
    assert.throws(() => ensureGlobalEventCount(db), /publication failure/);
    db.exec = exec;
    assert.equal(actual(db), 3);
    assert.equal(trustedGlobalEventCount(db), null);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE 'monitor_event_count%'"
        )
        .get().count,
      0
    );
  });
  it(`${driver}: actual worker count and stats hold the pinned snapshot across a writer`, async (t) => {
    const { db, file } = fixture(t, Constructor);
    ensureGlobalEventCount(db);
    const reader = new ReadonlyQuery(file, { driver });
    t.after(() => reader.close());
    for (const query of [
      { op: "get", sql: "SELECT COUNT(*) as count FROM events" },
      { op: "stats", toLocal: "-420 minutes", toUTC: "420 minutes" },
    ]) {
      const before = actual(db),
        started = once(reader, "started"),
        pending = reader.read(query);
      await started;
      db.exec("INSERT INTO events(summary) VALUES('concurrent')");
      const result = await pending;
      assert.equal(query.op === "get" ? result.count : result.total_events, before);
    }
    const scoped = await reader.read({
      op: "stats",
      sources: ["local"],
      providers: ["codex"],
      toLocal: "-420 minutes",
      toUTC: "420 minutes",
    });
    assert.equal(
      scoped.total_events,
      1,
      "scoped totals retain the session predicate; global NULL events are excluded"
    );
  });
}
