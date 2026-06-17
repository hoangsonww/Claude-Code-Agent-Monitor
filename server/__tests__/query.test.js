/**
 * @file Integration tests for the safe Query Explorer (/api/query). Exercises a
 * real on-disk SQLite DB (temp file) through the HTTP layer: filter operators,
 * match/sort/limit semantics, the truncation/warning contract, CSV export, and
 * saved-query CRUD. The security block asserts that the DSL rejects unknown
 * entities/fields, type-mismatched operators, and SQL-injection attempts in
 * both field names and values, with the underlying table left intact.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

// Set up the test database BEFORE requiring any server modules.
const TEST_DB = path.join(os.tmpdir(), `dashboard-query-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...options.headers },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          const contentType = res.headers["content-type"] || "";
          if (contentType.includes("application/json")) {
            try {
              resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
              return;
            } catch {
              /* fall through to raw */
            }
          }
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on("error", reject);
    if (options.body !== undefined) req.write(JSON.stringify(options.body));
    req.end();
  });
}

before(async () => {
  // Seed one session, two agents, several events with controlled values.
  db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    "sess-1",
    "Session One",
    "active",
    "/tmp/proj",
    "claude-opus-4-8",
    "2026-01-01T00:00:00.000Z"
  );

  db.prepare(
    "INSERT INTO agents (id, session_id, name, type, status, task, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run("agent-1", "sess-1", "Main", "main", "working", "do work", "2026-01-01T00:00:00.000Z");
  // ended_at left NULL on this one for is_null testing.

  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertEvent.run("sess-1", "agent-1", "tool", "Bash", "ran ls", "2026-01-01T01:00:00.000Z");
  insertEvent.run("sess-1", "agent-1", "tool", "Bash", "ran git", "2026-02-01T01:00:00.000Z");
  insertEvent.run("sess-1", "agent-1", "tool", "Read", "read file", "2026-03-01T01:00:00.000Z");
  insertEvent.run("sess-1", "agent-1", "tool", "Edit", "edited file", "2026-04-01T01:00:00.000Z");
  // An event whose tool_name is NULL, for is_null coverage.
  insertEvent.run("sess-1", "agent-1", "message", null, "a message", "2026-05-01T01:00:00.000Z");
  // An event whose summary contains a SQL-ish literal to prove value params are
  // compared literally, never executed.
  insertEvent.run(
    "sess-1",
    "agent-1",
    "tool",
    "Bash",
    "'; DROP TABLE events; --",
    "2026-06-01T01:00:00.000Z"
  );

  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(TEST_DB, { force: true });
  } catch {
    /* ignore */
  }
});

describe("POST /api/query/run — filters", () => {
  it("eq filter returns only matching rows", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "tool_name", op: "eq", value: "Read" }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.entity, "events");
    assert.equal(r.body.total, 1);
    assert.equal(r.body.rows.length, 1);
    assert.equal(r.body.rows[0].tool_name, "Read");
    // columns are the explicit allowlist, not SELECT *.
    assert.ok(r.body.columns.includes("id"));
    assert.ok(!r.body.columns.includes("data"));
    assert.equal(typeof r.body.tookMs, "number");
  });

  it("gte on a datetime field uses an ISO string bound", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "created_at", op: "gte", value: "2026-03-01T00:00:00.000Z" }],
      },
    });
    assert.equal(r.status, 200);
    // 2026-03, 2026-04, 2026-05, 2026-06 → 4 rows.
    assert.equal(r.body.total, 4);
  });

  it("like filter matches a substring", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "summary", op: "like", value: "%file%" }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
  });

  it("in filter expands to a parameterized list", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "tool_name", op: "in", value: ["Read", "Edit"] }],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
  });

  it("is_null filter finds rows with a NULL column", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "tool_name", op: "is_null" }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 1);
    assert.equal(r.body.rows[0].event_type, "message");
  });

  it("match=or unions the filters", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        match: "or",
        filters: [
          { field: "tool_name", op: "eq", value: "Read" },
          { field: "tool_name", op: "eq", value: "Edit" },
        ],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
  });

  it("sort asc/desc orders rows by an allowlisted column", async () => {
    const desc = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "tool_name", op: "eq", value: "Bash" }],
        sort: [{ field: "created_at", dir: "desc" }],
      },
    });
    assert.equal(desc.status, 200);
    const descTimes = desc.body.rows.map((x) => x.created_at);
    assert.deepEqual(descTimes, [...descTimes].sort().reverse());

    const asc = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "tool_name", op: "eq", value: "Bash" }],
        sort: [{ field: "created_at", dir: "asc" }],
      },
    });
    assert.equal(asc.status, 200);
    const ascTimes = asc.body.rows.map((x) => x.created_at);
    assert.deepEqual(ascTimes, [...ascTimes].sort());
  });

  it("clamps an over-limit and flags truncation + a warning", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", limit: 99999 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.limit, 1000); // clamped to maxLimit
    // 6 events total, all returned → not truncated, no warning.
    assert.equal(r.body.truncated, false);
    assert.equal(r.body.warnings.length, 0);

    const limited = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", limit: 2 },
    });
    assert.equal(limited.status, 200);
    assert.equal(limited.body.limit, 2);
    assert.equal(limited.body.rows.length, 2);
    assert.equal(limited.body.total, 6);
    assert.equal(limited.body.truncated, true);
    assert.equal(limited.body.warnings.length, 1);
    assert.match(limited.body.warnings[0], /truncated to 2 rows/);
  });

  it("queries the agents entity (NULL ended_at via is_null)", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "agents", filters: [{ field: "ended_at", op: "is_null" }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 1);
    assert.equal(r.body.rows[0].id, "agent-1");
  });
});

describe("POST /api/query/run — security / abuse", () => {
  it("rejects an unknown entity", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "secrets" },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown entity/);
  });

  it("rejects an unknown field", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "password", op: "eq", value: "x" }] },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown field/);
  });

  it("rejects a disallowed operator for the field type (like on int)", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "id", op: "like", value: "1" }] },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /not allowed on int/);
  });

  it("rejects a SQL-injection attempt in the field name and leaves the table intact", async () => {
    const before = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "id; DROP TABLE events", op: "eq", value: 1 }],
      },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown field/);
    const after = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
    assert.equal(after, before, "events table still intact");
  });

  it("treats an injection payload in a VALUE as a literal (parameterized, not executed)", async () => {
    const before = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "summary", op: "eq", value: "'; DROP TABLE events; --" }],
      },
    });
    assert.equal(r.status, 200);
    // Matched the one seeded row literally; table not dropped.
    assert.equal(r.body.total, 1);
    const after = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
    assert.equal(after, before, "events table still intact");
  });

  it("rejects an `in` operator with a non-array value", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "tool_name", op: "in", value: "Bash" }] },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /non-empty array/);
  });

  it("rejects an oversized `in` array (> 100 values)", async () => {
    const big = Array.from({ length: 101 }, (_, i) => `v${i}`);
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "tool_name", op: "in", value: big }] },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /at most 100 values/);
  });

  it("rejects an unknown top-level key", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", drop: "events" },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown query key/);
  });

  it("rejects an unknown key smuggled inside a filter object", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: {
        entity: "events",
        filters: [{ field: "tool_name", op: "eq", value: "Bash", evil: "DROP" }],
      },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown key "evil"/);
  });

  it("rejects a non-string field (array) instead of coercing it", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: [{ field: ["id"], op: "eq", value: 1 }] },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown field/);
  });

  it("rejects too many filters (DoS bound)", async () => {
    const many = Array.from({ length: 51 }, () => ({ field: "id", op: "gte", value: 0 }));
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", filters: many },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Too many filters/);
  });

  it("rejects too many sort fields (DoS bound)", async () => {
    const many = Array.from({ length: 11 }, () => ({ field: "created_at", dir: "asc" }));
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", sort: many },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Too many sort/);
  });

  it("clamps a huge offset to a safe integer instead of crashing", async () => {
    const r = await request("/api/query/run", {
      method: "POST",
      body: { entity: "events", offset: 1e18 },
    });
    assert.equal(r.status, 200);
    assert.ok(Number.isSafeInteger(r.body.offset), "offset must be clamped to a safe integer");
  });
});

describe("POST /api/query/run?format=csv", () => {
  it("returns text/csv with a header row", async () => {
    const r = await request("/api/query/run?format=csv", {
      method: "POST",
      body: { entity: "events", filters: [{ field: "tool_name", op: "eq", value: "Read" }] },
    });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /text\/csv/);
    assert.match(r.headers["content-disposition"], /attachment; filename="query-events-/);
    const lines = r.body.split("\r\n");
    assert.match(lines[0], /^id,session_id,agent_id,event_type,tool_name,summary,created_at$/);
    assert.equal(lines.length, 2); // header + 1 data row
  });
});

describe("GET /api/query/schema", () => {
  it("returns the entity/operator allowlist", async () => {
    const r = await request("/api/query/schema");
    assert.equal(r.status, 200);
    assert.ok(r.body.entities.events);
    assert.ok(r.body.entities.agents);
    assert.ok(r.body.entities.sessions);
    assert.equal(r.body.limits.maxLimit, 1000);
    assert.ok(r.body.operators.includes("like"));
  });
});

describe("saved queries CRUD", () => {
  let savedId;

  it("creates a valid saved query", async () => {
    const r = await request("/api/query/saved", {
      method: "POST",
      body: {
        name: "Bash events",
        query: { entity: "events", filters: [{ field: "tool_name", op: "eq", value: "Bash" }] },
        tags: ["debug"],
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.saved.name, "Bash events");
    assert.equal(r.body.saved.entity, "events");
    assert.deepEqual(r.body.saved.tags, ["debug"]);
    assert.ok(r.body.saved.query.filters);
    savedId = r.body.saved.id;
  });

  it("lists saved queries newest first", async () => {
    const r = await request("/api/query/saved");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.saved));
    assert.ok(r.body.saved.some((s) => s.id === savedId));
  });

  it("rejects a saved query with an invalid DSL", async () => {
    const r = await request("/api/query/saved", {
      method: "POST",
      body: { name: "bad", query: { entity: "nope" } },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Unknown entity/);
  });

  it("rejects a saved query with an empty name", async () => {
    const r = await request("/api/query/saved", {
      method: "POST",
      body: { name: "  ", query: { entity: "events" } },
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /name is required/);
  });

  it("deletes a saved query", async () => {
    const r = await request(`/api/query/saved/${savedId}`, { method: "DELETE" });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);

    const missing = await request(`/api/query/saved/${savedId}`, { method: "DELETE" });
    assert.equal(missing.status, 404);
  });
});
