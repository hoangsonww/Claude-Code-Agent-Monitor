/**
 * @file Tests for the Prometheus metrics endpoint (GET /api/metrics). Verifies
 * the exposition format (HELP/TYPE headers, content-type, no NaN samples), that
 * the enumerated status gauges are always present (so a series never drops out
 * at zero), and that the numbers track real data seeded through the hook API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-metrics-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

/** Parse a `name{labels} value` sample line's value, or null if not present. */
function sampleValue(text, name, labels) {
  const needle = labels ? `${name}{${labels}}` : name;
  for (const line of text.split("\n")) {
    if (line.startsWith("#")) continue;
    if (labels ? line.startsWith(needle + " ") : line.startsWith(needle + " ")) {
      return Number(line.slice(needle.length).trim());
    }
  }
  return null;
}

describe("GET /api/metrics", () => {
  it("serves a well-formed Prometheus exposition", async () => {
    const res = await request("GET", "/api/metrics");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/plain/);
    assert.match(res.headers["content-type"], /version=0\.0\.4/);

    // Core families present with HELP + TYPE headers.
    for (const name of [
      "ccam_up",
      "ccam_build_info",
      "ccam_process_uptime_seconds",
      "ccam_process_resident_memory_bytes",
      "ccam_sessions",
      "ccam_agents",
      "ccam_events_total",
      "ccam_websocket_clients",
      "ccam_remote_sources",
      "ccam_tokens_total",
    ]) {
      assert.ok(res.body.includes(`# HELP ${name} `), `HELP for ${name}`);
      assert.ok(res.body.includes(`# TYPE ${name} `), `TYPE for ${name}`);
    }

    assert.equal(sampleValue(res.body, "ccam_up"), 1);
    // No sample line may carry a NaN/undefined value.
    for (const line of res.body.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const value = line.slice(line.lastIndexOf(" ") + 1);
      assert.ok(!Number.isNaN(Number(value)), `numeric sample value on line: ${line}`);
    }
  });

  it("emits every enumerated status series even at zero", async () => {
    const res = await request("GET", "/api/metrics");
    for (const status of ["active", "completed", "error", "abandoned"]) {
      assert.notEqual(
        sampleValue(res.body, "ccam_sessions", `status="${status}"`),
        null,
        `ccam_sessions status=${status} present`
      );
    }
    for (const status of ["working", "waiting", "completed", "error"]) {
      assert.notEqual(
        sampleValue(res.body, "ccam_agents", `status="${status}"`),
        null,
        `ccam_agents status=${status} present`
      );
    }
  });

  it("reflects real data seeded through the hook API", async () => {
    const before = sampleValue(await scrapeText(), "ccam_sessions", 'status="active"') || 0;

    await request("POST", "/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: "metrics-sess-1", cwd: "/tmp/metrics" },
    });

    const after = sampleValue(await scrapeText(), "ccam_sessions", 'status="active"');
    assert.equal(after, before + 1, "a new active session bumps the gauge by 1");
  });

  async function scrapeText() {
    return (await request("GET", "/api/metrics")).body;
  }
});
