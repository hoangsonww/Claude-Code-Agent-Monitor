/**
 * @file Checks recent-thread discovery against real SQLite query plans, legacy
 * schemas and disappearing indexes without modifying the owner's native DB.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-native-query-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "dashboard.db");
const { readRecentCodexThreads } = require("../lib/codex-ingest");
const { db: dashboardDb } = require("../db");
after(() => {
  dashboardDb.close();
  fs.rmSync(root, { recursive: true, force: true });
});

function fixture(indexSql = "") {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE threads (
    id TEXT PRIMARY KEY, rollout_path TEXT, created_at INTEGER, cwd TEXT,
    model TEXT, model_provider TEXT, cli_version TEXT, archived INTEGER
  ); CREATE INDEX idx_threads_archived ON threads(archived); ${indexSql}`);
  const insert = db.prepare("INSERT INTO threads VALUES(?,?,?,?,'gpt-test','openai','test',?)");
  db.transaction(() => {
    for (let n = 0; n < 200; n++)
      insert.run(`thread-${n}`, `/tmp/${n}.jsonl`, n, "/tmp", n % 3 === 0 ? 1 : 0);
  })();
  return db;
}
const creationIndex = "CREATE INDEX idx_threads_created_at ON threads(created_at DESC,id DESC);";
function capture(db, prepare = (sql) => db.prepare(sql)) {
  const queries = [];
  return {
    queries,
    state: {
      pragma: (sql) => db.pragma(sql),
      prepare: (sql) => {
        queries.push(sql);
        return prepare(sql);
      },
    },
  };
}
const oracle = (db, cutoff = 100) =>
  db
    .prepare(
      `SELECT id,rollout_path,created_at,cwd,model,model_provider,cli_version
  FROM threads WHERE archived=0 AND created_at>=? ORDER BY created_at DESC,id DESC LIMIT 50`
    )
    .all(cutoff);
it("bounded discovery uses the creation range without sorting wide archived rows", () => {
  const db = fixture(creationIndex);
  try {
    const { state, queries } = capture(db);
    assert.deepEqual(readRecentCodexThreads(state, 100), oracle(db));
    const plan = db
      .prepare("EXPLAIN QUERY PLAN " + queries[0])
      .all(100)
      .map((row) => row.detail);
    assert.ok(
      plan.some((line) => line.includes("idx_threads_created_at") && line.includes("created_at>?"))
    );
    assert.ok(
      plan.every((line) => !line.includes("TEMP B-TREE")),
      plan.join("\n")
    );
  } finally {
    db.close();
  }
});
for (const [label, index] of [
  ["legacy missing index", ""],
  [
    "same name with the wrong leading key",
    "CREATE INDEX idx_threads_created_at ON threads(archived,created_at);",
  ],
  ["partial index", "CREATE INDEX idx_threads_created_at ON threads(created_at) WHERE archived=1;"],
  ["expression leading key", "CREATE INDEX idx_threads_created_at ON threads(created_at+0);"],
])
  it(`portable fallback preserves recent rows for ${label}`, () => {
    const db = fixture(index);
    try {
      const { state, queries } = capture(db);
      assert.deepEqual(readRecentCodexThreads(state, 100), oracle(db));
      assert.ok(queries.every((sql) => !sql.includes("INDEXED BY")));
    } finally {
      db.close();
    }
  });
it("an index disappearing after inspection retries the SELECT before any lifecycle writes", () => {
  const db = fixture(creationIndex);
  try {
    const { state, queries } = capture(db, (sql) => {
      if (sql.includes("INDEXED BY")) db.exec("DROP INDEX idx_threads_created_at");
      return db.prepare(sql);
    });
    assert.deepEqual(readRecentCodexThreads(state, 100), oracle(db));
    assert.equal(queries.length, 2);
    assert.ok(queries.every((sql) => sql.trimStart().startsWith("SELECT")));
  } finally {
    db.close();
  }
});
it("schema inspection failure still reads the portable selection", () => {
  const db = fixture(creationIndex);
  try {
    assert.deepEqual(
      readRecentCodexThreads(
        {
          prepare: db.prepare.bind(db),
          pragma: () => {
            throw new Error("schema unavailable");
          },
        },
        100
      ),
      oracle(db)
    );
  } finally {
    db.close();
  }
});
it("a busy indexed read is not repeated through the fallback", () => {
  const db = fixture(creationIndex);
  try {
    const busy = Object.assign(new Error("database is busy"), { code: "SQLITE_BUSY" });
    const { state, queries } = capture(db, (sql) => {
      if (sql.includes("INDEXED BY"))
        return {
          all: () => {
            throw busy;
          },
        };
      return db.prepare(sql);
    });
    assert.throws(
      () => readRecentCodexThreads(state, 100),
      (error) => error === busy
    );
    assert.equal(queries.length, 1);
  } finally {
    db.close();
  }
});
it("a busy schema inspection does not start a second database read", () => {
  const db = fixture(creationIndex);
  try {
    const busy = Object.assign(new Error("database is busy"), { code: "SQLITE_BUSY" });
    let reads = 0;
    assert.throws(
      () =>
        readRecentCodexThreads(
          {
            pragma: () => {
              throw busy;
            },
            prepare: () => {
              reads++;
            },
          },
          100
        ),
      (error) => error === busy
    );
    assert.equal(reads, 0);
  } finally {
    db.close();
  }
});
it("unbounded legacy age behavior does not require the creation index", () => {
  const db = fixture(creationIndex);
  try {
    const { state, queries } = capture(db);
    const rows = readRecentCodexThreads(state, NaN);
    assert.equal(rows.length, 50);
    assert.ok(
      queries.every((sql) => !sql.includes("INDEXED BY") && !sql.includes("created_at >= ?"))
    );
  } finally {
    db.close();
  }
});
it("equal timestamps keep the legacy fallback selection and the indexed 50-row limit", () => {
  const db = fixture(creationIndex);
  try {
    db.exec("DELETE FROM threads");
    const insert = db.prepare("INSERT INTO threads(id,created_at,archived) VALUES(?,100,0)");
    for (let n = 0; n < 70; n++) insert.run(`tie-${String(n).padStart(3, "0")}`);
    const indexed = readRecentCodexThreads(db, 100).map((row) => row.id);
    assert.equal(indexed.length, 50);
    assert.equal(new Set(indexed).size, 50);
    assert.ok(indexed.every((id) => /^tie-\d{3}$/.test(id)));
    db.exec("DROP INDEX idx_threads_created_at");
    const legacy = db
      .prepare("SELECT id FROM threads WHERE archived=0 ORDER BY created_at DESC LIMIT 50")
      .all()
      .map((row) => row.id);
    assert.deepEqual(
      readRecentCodexThreads(db, 100).map((row) => row.id),
      legacy
    );
  } finally {
    db.close();
  }
});
