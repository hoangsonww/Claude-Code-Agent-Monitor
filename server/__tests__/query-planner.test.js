/**
 * @file Verifies bounded planner statistics improve skewed history access paths
 * using existing indexes, without changing rows or forcing a particular index.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-planner-test-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "app.db");
const { optimizeQueryPlanner, db: appDb } = require("../db");
const Compat = require("../compat-sqlite");
let Native;
try {
  Native = require("better-sqlite3");
  new Native(":memory:").close();
} catch {
  Native = null;
}
after(() => {
  appDb.close();
  fs.rmSync(root, { recursive: true, force: true });
});

for (const [name, Constructor] of [
  ["native", Native],
  ["compat", Compat],
]) {
  it(
    `${name}: statistics select narrower existing paths without changing history`,
    { skip: !Constructor },
    () => {
      const db = new Constructor(path.join(root, name + ".db"));
      try {
        db.exec(`CREATE TABLE events(session_id TEXT,agent_id TEXT,event_type TEXT,tool_name TEXT,data TEXT);
        CREATE INDEX by_session ON events(session_id,event_type);
        CREATE INDEX by_agent ON events(agent_id,event_type);
        CREATE INDEX by_tool ON events(tool_name) WHERE tool_name IS NOT NULL;
        CREATE TABLE sessions(id TEXT,provider TEXT,source TEXT,status TEXT,cwd TEXT);
        CREATE INDEX by_status ON sessions(status);
        CREATE INDEX by_provider ON sessions(provider);`);
        db.transaction(() => {
          const event = db.prepare("INSERT INTO events VALUES(?,?,?,?,?)");
          for (let i = 0; i < 20000; i++)
            event.run(
              `s${Math.floor(i / 10)}`,
              `a${Math.floor(i / 10)}`,
              "PreToolUse",
              i % 2 ? "Read" : "Agent",
              "payload"
            );
          const session = db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?)");
          for (let i = 0; i < 2000; i++)
            session.run(`s${i}`, "codex", "local", i < 10 ? "active" : "completed", "/project");
        })();
        const queries = [
          {
            sql: "SELECT 1 FROM events WHERE session_id=? AND agent_id=? AND event_type='PreToolUse' AND tool_name='Agent' AND data LIKE ? LIMIT 1",
            params: ["s1", "a1", "%absent%"],
          },
          {
            sql: "SELECT id,cwd,status FROM sessions WHERE provider='codex' AND (source='local' OR source IS NULL) AND status='active'",
            params: [],
          },
        ];
        const checksum = () =>
          crypto
            .createHash("sha256")
            .update(
              JSON.stringify([
                db.prepare("SELECT * FROM events ORDER BY rowid").all(),
                db.prepare("SELECT * FROM sessions ORDER BY rowid").all(),
              ])
            )
            .digest("hex");
        const before = checksum();
        const indexes = db
          .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
          .all();
        const results = queries.map((q) => db.prepare(q.sql).all(...q.params));
        assert.equal(optimizeQueryPlanner(db), true);
        assert.ok(db.prepare("SELECT COUNT(*) AS n FROM sqlite_stat1").get().n > 0);
        assert.equal(checksum(), before);
        assert.deepEqual(
          db.prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name").all(),
          indexes
        );
        for (let i = 0; i < queries.length; i++)
          assert.deepEqual(db.prepare(queries[i].sql).all(...queries[i].params), results[i]);
        const paths = queries.map((q) =>
          db
            .prepare("EXPLAIN QUERY PLAN " + q.sql)
            .all(...q.params)
            .map((r) => r.detail)
            .join("\n")
        );
        assert.match(paths[0], /session_id=\?|agent_id=\?/);
        assert.match(paths[1], /status=\?/);
      } finally {
        db.close();
      }
    }
  );
}

it("an older SQLite version is skipped instead of running unrestricted analysis", () => {
  let maintenance = false;
  assert.equal(
    optimizeQueryPlanner({
      prepare: () => ({ get: () => ({ version: "3.45.0" }) }),
      pragma: () => {
        maintenance = true;
      },
    }),
    false
  );
  assert.equal(maintenance, false);
});
