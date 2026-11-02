/**
 * @file Verifies savepoint isolation and outer rollback across SQLite drivers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const Compat = require("../compat-sqlite");

/**
 * better-sqlite3 is optional and resolves its native addon lazily, so probe it
 * the way server/db.js does. Only an unloadable native driver skips its cases;
 * the builtin cases always run.
 */
function probeNativeDriver() {
  try {
    const NativeDatabase = require("better-sqlite3");
    new NativeDatabase(":memory:").close();
    return { Database: NativeDatabase, skip: false };
  } catch (error) {
    return { Database: null, skip: `better-sqlite3 native driver unavailable: ${error.message}` };
  }
}
const native = probeNativeDriver();
const drivers = [
  ["builtin", Compat, false],
  ["native", native.Database, native.skip],
];
for (const [name, Database, skip] of drivers) {
  it(`${name}: a failed nested session does not abort its surrounding batch`, { skip }, () => {
    const db = new Database(":memory:");
    try {
      db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY)");
      const insert = db.prepare("INSERT INTO items VALUES(?)");
      const result = db.transaction(() => {
        insert.run(1);
        assert.throws(
          () =>
            db.transaction(() => {
              insert.run(2);
              throw new Error("session failed after an insert");
            })(),
          /session failed/
        );
        assert.equal(db.inTransaction, true);
        insert.run(3);
        return db.transaction(() => 42)();
      })();
      assert.equal(result, 42);
      assert.equal(db.inTransaction, false);
      assert.deepEqual(
        db
          .prepare("SELECT id FROM items ORDER BY id")
          .all()
          .map((r) => r.id),
        [1, 3]
      );
    } finally {
      db.close();
    }
  });
  it(`${name}: outer rollback includes a released inner savepoint`, { skip }, () => {
    const db = new Database(":memory:");
    try {
      db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY)");
      assert.throws(
        () =>
          db.transaction(() => {
            db.transaction(() => db.prepare("INSERT INTO items VALUES(1)").run())();
            throw new Error("outer failed");
          })(),
        /outer failed/
      );
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items").get().n, 0);
      assert.equal(db.inTransaction, false);
    } finally {
      db.close();
    }
  });
  it(`${name}: a wrapper inside an externally opened transaction leaves it open`, { skip }, () => {
    const db = new Database(":memory:");
    try {
      db.exec("CREATE TABLE items(id INTEGER PRIMARY KEY); BEGIN");
      db.transaction(() => db.prepare("INSERT INTO items VALUES(1)").run())();
      assert.equal(db.inTransaction, true);
      db.exec("ROLLBACK");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items").get().n, 0);
    } finally {
      db.close();
    }
  });
}
