/**
 * @file Verifies event-page filter/order parity and that a slow real event list
 * leaves the application's health endpoint responsive.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-events-responsive-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { ReadonlyQuery } = require("../lib/readonly-query");
const { createApp, startServer } = require("../index");
const { db } = require("../db");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

it("event page and total retain one snapshot across a concurrent commit", async (t) => {
  const session = "page-count-snapshot";
  db.prepare("INSERT INTO sessions(id,provider,source) VALUES(?,'claude','local')").run(session);
  const insert = db.prepare(
    "INSERT INTO events(session_id,event_type,created_at) VALUES(?,'snapshot','2100-01-01')"
  );
  const oldId = Number(insert.run(session).lastInsertRowid);
  let committed = false;
  const commit = () => {
    assert.equal(committed, false);
    insert.run(session);
    committed = true;
  };
  const original = ReadonlyQuery.prototype.read;
  const calls = [];
  ReadonlyQuery.prototype.read = function (query, generation) {
    const page = query.op === "eventPage" ? query.page : query;
    if (!page.params?.includes(session)) return original.call(this, query, generation);
    calls.push(query.op);
    if (!committed && query.op === "eventPage") {
      // The production worker emits started only AFTER pinning its WAL snapshot.
      // A slow SELECT leaves time for the writer to commit before the page/count
      // operation completes, without any production-only synchronization hook.
      this.once("started", commit);
      return original.call(
        this,
        {
          ...query,
          page: {
            sql: `SELECT e.* FROM (WITH RECURSIVE n(x) AS
              (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<500000)
              SELECT MAX(x) AS done FROM n) pause CROSS JOIN events e
              WHERE e.session_id=? AND pause.done=500000
              ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?`,
            params: [session, 5, 0],
          },
        },
        generation
      );
    }
    const result = original.call(this, query, generation);
    // On the old route this deterministically commits after the page result
    // and before its separate count read, reproducing page-old/count-new.
    if (!committed && (query.op === "page" || query.op === "all"))
      return result.then((rows) => {
        commit();
        return rows;
      });
    return result;
  };
  let server;
  t.after(async () => {
    ReadonlyQuery.prototype.read = original;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    db.prepare("DELETE FROM sessions WHERE id=?").run(session);
  });
  server = await startServer(createApp(), 0);
  const url = `http://127.0.0.1:${server.address().port}/api/events?session_id=${session}&limit=5`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const old = await response.json();
  assert.equal(committed, true, "the concurrent writer must actually commit");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE session_id=?").get(session).n, 2);
  assert.deepEqual(
    old.events.map((row) => row.id),
    [oldId]
  );
  assert.equal(old.total, 1, "page and total must describe the same pre-commit snapshot");
  assert.deepEqual(calls, ["eventPage"], "one worker job must serve both page and count");
  const fresh = await (await fetch(url)).json();
  assert.equal(fresh.events.length, 2);
  assert.equal(fresh.total, 2);
});

it("event pages retain every filter, full payloads, tied ordering and offsets", async () => {
  db.exec(`INSERT INTO sessions(id,name,provider,source) VALUES
    ('local','local','claude','local'),('box','box','codex','src_box');`);
  const insert = db.prepare(
    "INSERT INTO events(session_id,event_type,tool_name,summary,data,created_at) VALUES(?,?,?,?,?,?)"
  );
  for (let n = 0; n < 30; n++)
    insert.run(
      n % 2 ? "box" : "local",
      n % 3 ? "PreToolUse" : "PostToolUse",
      n % 3 ? "Read" : "Bash",
      `summary ${n}`,
      "payload ".repeat(8000),
      n < 10 ? "2026-10-09T12:00:00.000Z" : "2026-10-10T12:00:00.000Z"
    );
  const cases = [
    ["", "", []],
    ["providers=claude", "WHERE session_id='local'", []],
    ["sources=src_box&providers=codex", "WHERE session_id='box'", []],
    ["sources=local&providers=codex", "WHERE 0", []],
    ["sources=local&providers=claude", "WHERE session_id='local'", []],
    ["sources=src_box&providers=claude", "WHERE 0", []],
    ["sources=local,src_box&providers=claude,codex", "", []],
    [
      "session_id=local&event_type=PreToolUse&tool_name=Read",
      "WHERE session_id='local' AND event_type='PreToolUse' AND tool_name='Read'",
      [],
    ],
    [
      "q=summary%202",
      "WHERE summary LIKE ? OR tool_name LIKE ? OR data LIKE ?",
      ["%summary 2%", "%summary 2%", "%summary 2%"],
    ],
    [
      "from=2026-10-10T00%3A00%3A00Z&to=2026-10-10T23%3A59%3A59Z",
      "WHERE created_at >= ? AND created_at <= ?",
      ["2026-10-10T00:00:00.000Z", "2026-10-10T23:59:59.000Z"],
    ],
  ];
  const server = await startServer(createApp(), 0);
  try {
    for (const [query, where, params] of cases)
      for (const offset of [0, 3, 100]) {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api/events?${query}&limit=5&offset=${offset}`
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.deepEqual(
          result.events,
          db
            .prepare(
              `SELECT * FROM events ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`
            )
            .all(...params, 5, offset)
        );
        assert.equal(
          result.total,
          db.prepare(`SELECT COUNT(*) AS n FROM events ${where}`).get(...params).n
        );
      }
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

it("bounded scoped pages preserve tied ordering, offsets and old sparse history", async () => {
  const insert = db.prepare(
    "INSERT INTO events(session_id,event_type,summary,data,created_at) VALUES(?,?,?,?,?)"
  );
  db.transaction(() => {
    for (let n = 0; n < 180; n++)
      insert.run("box", "TaskCreated", "old history", "old anchor", "2026-10-08T12:00:00Z");
    for (let n = 0; n < 700; n++)
      insert.run("local", "PreToolUse", "recent history", "recent anchor", "2026-10-11T12:00:00Z");
  })();
  const original = ReadonlyQuery.prototype.read;
  let fullProbe;
  ReadonlyQuery.prototype.read = function (query, generation) {
    if (query.op === "eventPage" && query.page.probe && !fullProbe) {
      fullProbe = query.page.probe;
      // This source has a full page within the newest prefix. Touching the
      // general query would fail, so success proves it avoided the history sort.
      return original.call(
        this,
        {
          ...query,
          page: {
            ...query.page,
            sql: "SELECT * FROM missing_fallback",
            sizeSql: "SELECT id, 0 AS bytes FROM missing_fallback",
          },
        },
        generation
      );
    }
    return original.call(this, query, generation);
  };
  const server = await startServer(createApp(), 0);
  try {
    for (const [query, where, params, offset] of [
      ["sources=local&providers=claude", "WHERE session_id='local'", [], 5],
      ["sources=src_box&providers=codex", "WHERE session_id='box'", [], 5],
      ["sources=src_box&providers=claude", "WHERE 0", [], 0],
      [
        "sources=local&q=old%20anchor",
        "WHERE session_id='local' AND data LIKE ?",
        ["%old anchor%"],
        0,
      ],
      [
        "from=2026-10-08T00%3A00%3A00Z&to=2026-10-08T23%3A59%3A59Z",
        "WHERE created_at>=? AND created_at<=?",
        ["2026-10-08T00:00:00.000Z", "2026-10-08T23:59:59.000Z"],
        0,
      ],
      ["sources=local", "WHERE session_id='local'", [], 550],
    ]) {
      const res = await fetch(
        `http://127.0.0.1:${server.address().port}/api/events?${query}&limit=30&offset=${offset}`
      );
      assert.equal(res.status, 200);
      const row = await res.json();
      assert.deepEqual(
        row.events,
        db
          .prepare(
            `SELECT * FROM events ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`
          )
          .all(...params, 30, offset)
      );
      assert.equal(
        row.total,
        db.prepare(`SELECT COUNT(*) AS n FROM events ${where}`).get(...params).n
      );
    }
    const plan = db
      .prepare("EXPLAIN QUERY PLAN " + fullProbe.sql)
      .all(...fullProbe.params)
      .map((r) => r.detail)
      .join("\n");
    assert.match(plan, /SCAN recent/);
    assert.match(plan, /SEARCH candidate USING INTEGER PRIMARY KEY/);
  } finally {
    ReadonlyQuery.prototype.read = original;
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

it(
  "health completes while the actual event endpoint sorts a slow list",
  { timeout: 30000 },
  async () => {
    db.exec(`DROP TABLE events;
    CREATE VIEW events AS WITH RECURSIVE counter(n) AS (
      VALUES(1) UNION ALL SELECT n+1 FROM counter WHERE n<5000000
    ) SELECT n AS id, 'local' AS session_id, NULL AS summary, NULL AS data,
      '2026-10-10' AS created_at FROM counter;`);
    let resolveStarted;
    const started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    const original = ReadonlyQuery.prototype.read;
    ReadonlyQuery.prototype.read = function (query, generation) {
      if (query.op === "eventPage") this.once("started", resolveStarted);
      return original.call(this, query, generation);
    };
    let server;
    let finished = false;
    try {
      server = await startServer(createApp(), 0);
      const base = `http://127.0.0.1:${server.address().port}`;
      const list = fetch(base + "/api/events?limit=1")
        .then((r) => r.json())
        .then((result) => {
          finished = true;
          return result;
        });
      await started;
      assert.equal((await fetch(base + "/api/health")).status, 200);
      assert.equal(finished, false, "health must not wait for the event-page sort");
      const result = await list;
      assert.equal(result.events[0].id, 5000000);
      assert.equal(result.total, 5000000);
    } finally {
      ReadonlyQuery.prototype.read = original;
      if (server) {
        server.close();
        server.closeAllConnections();
        await once(server, "close");
      }
    }
  }
);
