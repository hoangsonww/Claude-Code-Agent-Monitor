/**
 * @file Regression test for a cost-metering bug found in the live dashboard
 * after the gateway cutover: GET /api/sessions (both the default list and the
 * sort_by=price branch) priced a session's tokens LOWER than GET
 * /api/pricing/cost/:sessionId (used by the session-detail page) for the same
 * completed session — $22.31 vs $23.92 on a real 84.8M-cache-read session.
 *
 * Root cause: the two inline SQL queries in server/routes/sessions.js
 * (buildRows's price-sort branch and its default branch) selected only
 * {session_id, model, input_tokens, output_tokens, cache_read_tokens,
 * cache_write_tokens} from token_usage — omitting speed, inference_geo,
 * service_tier, cache_write_1h_tokens, web_search_requests,
 * web_fetch_requests, and code_execution_requests. calculateCost's
 * ratesForBucket (server/routes/pricing.js) reads those missing fields to
 * pick the correct rate per bucket; with them undefined every bucket priced
 * as though ALL cache-write tokens were 5m-tier (never 1h) and speed/geo/tier
 * modifiers never applied. GET /api/pricing/cost/:sessionId (via
 * stmts.getTokensBySession) always selected the full column set and priced
 * correctly. This is a pre-existing query/schema drift (the bulk-cost query
 * predates the cache_write_1h_tokens/speed/geo/tier columns added later for
 * fast-mode/1h-caching pricing) — unrelated to the remote-ingest-batch work.
 *
 * This test reproduces the exact shape of the live session: a single
 * claude-sonnet-5/standard/global/standard bucket where cache_write_tokens
 * are ENTIRELY 1h-tier (cache_write_1h_tokens === cache_write_tokens), which
 * makes the two rates diverge enough to be unmissable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const STAMP = `session-list-cost-parity-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;

let server;
let BASE;

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const r = http.request(
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
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(b || "{}");
          } catch {
            parsed = b;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const UNREADABLE = "C:\\Users\\matsp\\.claude\\projects\\enc\\does-not-exist.jsonl";
const SESSION = "40000000-0000-0000-0000-000000000001";

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  // Deterministic pricing matching the live rule shape: 1h cache-write costs
  // MORE per token than 5m cache-write, so mispricing every 1h token as 5m
  // undercounts the total — exactly the live symptom (list < detail).
  stmts.upsertPricing.run(
    "claude-sonnet-5%",
    "Claude Sonnet 5",
    3.0,
    15.0,
    0.3,
    3.75, // cache_write_per_mtok (5m)
    6.0, // cache_write_1h_per_mtok
    0,
    0
  );

  // Seed the session via the real SessionStart hook path (transcript
  // unreadable here, same as a remote/forwarded session) so it has a main
  // agent row, then write a token_usage bucket directly — mirrors what
  // ingest-batch's replaceTokenUsage call produces.
  await req("POST", "/api/hooks/event", {
    hook_type: "SessionStart",
    data: { session_id: SESSION, cwd: "/tmp/x", transcript_path: UNREADABLE },
  });

  stmts.replaceTokenUsage.run(
    SESSION,
    "claude-sonnet-5",
    "standard",
    "global",
    "standard",
    3596, // input
    266465, // output
    84802034, // cache_read
    1070688, // cache_write (total)
    1070688, // cache_write_1h — ALL of it is 1h-tier
    0,
    0,
    0
  );
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("GET /api/sessions cost parity with GET /api/pricing/cost/:sessionId", () => {
  it("default-sort list cost matches the detail-page cost", async () => {
    const detail = await req("GET", `/api/pricing/cost/${SESSION}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.body.total_cost > 0, "sanity: detail cost computed");

    const list = await req("GET", `/api/sessions?q=${SESSION}`);
    assert.equal(list.status, 200);
    const row = list.body.sessions.find((s) => s.id === SESSION);
    assert.ok(row, "session present in default list");

    assert.equal(
      row.cost,
      detail.body.total_cost,
      `default list cost (${row.cost}) must match detail cost (${detail.body.total_cost}) — ` +
        `1h cache-write tokens must be priced at the 1h rate, not silently treated as 5m`
    );
  });

  it("sort_by=price list cost matches the detail-page cost", async () => {
    const detail = await req("GET", `/api/pricing/cost/${SESSION}`);
    const list = await req("GET", `/api/sessions?q=${SESSION}&sort_by=price`);
    assert.equal(list.status, 200);
    const row = list.body.sessions.find((s) => s.id === SESSION);
    assert.ok(row, "session present in price-sorted list");

    assert.equal(row.cost, detail.body.total_cost);
  });
});
