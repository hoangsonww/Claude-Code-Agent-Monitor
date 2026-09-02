/**
 * @file Tests for /api/query — entity list, facets, export, and filter safety.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `query-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE}${path}`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      })
      .on("error", reject);
  });
}

function jsonGet(path) {
  return get(path).then((r) => ({
    status: r.status,
    headers: r.headers,
    data: JSON.parse(r.body),
  }));
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  // Seed minimal data for querying
  db.prepare(`INSERT INTO sessions (id, name, status, started_at) VALUES (?,?,?,?)`).run(
    "qs-sess-1",
    "query-test-session",
    "completed",
    new Date(Date.now() - 60_000).toISOString()
  );

  db.prepare(
    `INSERT INTO agents (id, session_id, name, status, type, started_at) VALUES (?,?,?,?,?,?)`
  ).run(
    "qs-agent-1",
    "qs-sess-1",
    "main agent",
    "completed",
    "main",
    new Date(Date.now() - 50_000).toISOString()
  );

  db.prepare(
    `INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, created_at) VALUES (?,?,?,?,?,?)`
  ).run(
    "qs-sess-1",
    "qs-agent-1",
    "tool_use",
    "Bash",
    "ran bash command",
    new Date().toISOString()
  );
});

after(() => {
  server.close();
  try {
    require("fs").unlinkSync(TEST_DB);
  } catch {
    /* best-effort */
  }
});

describe("GET /api/query", () => {
  it("returns events by default", async () => {
    const { status, data } = await jsonGet("/api/query?entity=events");
    assert.equal(status, 200);
    assert.equal(data.entity, "events");
    assert.ok(Array.isArray(data.rows));
    assert.ok(Array.isArray(data.columns));
    assert.ok(typeof data.total === "number");
  });

  it("returns sessions", async () => {
    const { status, data } = await jsonGet("/api/query?entity=sessions");
    assert.equal(status, 200);
    assert.equal(data.entity, "sessions");
    assert.ok(data.rows.length >= 1);
    assert.ok(data.columns.includes("id"));
    assert.ok(data.columns.includes("status"));
  });

  it("returns agents", async () => {
    const { status, data } = await jsonGet("/api/query?entity=agents");
    assert.equal(status, 200);
    assert.equal(data.entity, "agents");
    assert.ok(data.rows.length >= 1);
  });

  it("paginates with limit and offset", async () => {
    const { data: p1 } = await jsonGet("/api/query?entity=events&limit=1&offset=0");
    assert.equal(p1.limit, 1);
    assert.equal(p1.offset, 0);
    assert.ok(p1.rows.length <= 1);
  });

  it("clamps limit to MAX_LIMIT (500)", async () => {
    const { status, data } = await jsonGet("/api/query?entity=events&limit=9999");
    assert.equal(status, 200);
    assert.ok(data.limit <= 500);
  });

  it("filters events by event_type", async () => {
    const { status, data } = await jsonGet("/api/query?entity=events&event_type=tool_use");
    assert.equal(status, 200);
    data.rows.forEach((r) => assert.equal(r.event_type, "tool_use"));
  });

  it("filters events by tool_name", async () => {
    const { status, data } = await jsonGet("/api/query?entity=events&tool_name=Bash");
    assert.equal(status, 200);
    data.rows.forEach((r) => assert.equal(r.tool_name, "Bash"));
  });

  it("filters sessions by status", async () => {
    const { status, data } = await jsonGet("/api/query?entity=sessions&status=completed");
    assert.equal(status, 200);
    data.rows.forEach((r) => assert.equal(r.status, "completed"));
  });

  it("returns empty rows for non-matching filter", async () => {
    const { data } = await jsonGet("/api/query?entity=sessions&status=nonexistent_status_xyz");
    assert.equal(data.total, 0);
    assert.deepEqual(data.rows, []);
  });

  it("full-text search via q param", async () => {
    const { data } = await jsonGet("/api/query?entity=events&q=bash");
    // rows may be 0 or more — just assert it parses
    assert.ok(Array.isArray(data.rows));
  });

  it("falls back to events for unknown entity", async () => {
    const { data } = await jsonGet("/api/query?entity=unknownXYZ");
    assert.equal(data.entity, "events");
  });

  it("rejects injection via sort_by (falls back to default)", async () => {
    const { status, data } = await jsonGet(
      "/api/query?entity=events&sort_by=1;DROP TABLE events;--"
    );
    assert.equal(status, 200);
    // rows still valid — injection didn't execute
    assert.ok(Array.isArray(data.rows));
  });
});

describe("GET /api/query/facets", () => {
  it("returns event_types and tool_names for events", async () => {
    const { status, data } = await jsonGet("/api/query/facets?entity=events");
    assert.equal(status, 200);
    assert.equal(data.entity, "events");
    assert.ok(Array.isArray(data.event_types));
    assert.ok(Array.isArray(data.tool_names));
    assert.ok(data.event_types.includes("tool_use"));
  });

  it("returns statuses for sessions", async () => {
    const { status, data } = await jsonGet("/api/query/facets?entity=sessions");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.statuses));
    assert.ok(data.statuses.includes("completed"));
  });

  it("returns statuses for agents", async () => {
    const { status, data } = await jsonGet("/api/query/facets?entity=agents");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.statuses));
  });
});

describe("GET /api/query/export", () => {
  it("exports CSV with correct Content-Disposition header", async () => {
    const { status, headers } = await get("/api/query/export?entity=events&format=csv");
    assert.equal(status, 200);
    assert.ok(headers["content-disposition"]?.includes(".csv"));
    assert.ok(headers["content-type"]?.includes("text/csv"));
  });

  it("exports JSON with correct header", async () => {
    const { status, headers, body } = await get("/api/query/export?entity=events&format=json");
    assert.equal(status, 200);
    assert.ok(headers["content-disposition"]?.includes(".json"));
    const parsed = JSON.parse(body);
    assert.ok(Array.isArray(parsed.rows));
  });

  it("defaults to csv when format is unrecognised", async () => {
    const { headers } = await get("/api/query/export?entity=events&format=xml");
    assert.ok(headers["content-type"]?.includes("text/csv"));
  });
});
