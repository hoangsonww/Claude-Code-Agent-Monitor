/**
 * @file Tests for editing time-limited introductory pricing via PUT /api/pricing.
 *
 * The Settings page lets users edit a model's introductory (promo) rates, not
 * just its standard rates. This suite verifies the route contract that backs
 * that UI, and that the mechanism is generic (works for any model pattern, not
 * just the seeded Sonnet 5 promo):
 *
 *   1. PUT with intro fields + a valid intro_until persists the intro rates.
 *   2. PUT that omits every intro field preserves an existing promo (backward
 *      compatible with older clients that only send standard rates).
 *   3. PUT with an empty intro_until clears the promo AND zeroes the intro
 *      rates so a stale value can't resurface later.
 *   4. A malformed intro_until is rejected with 400 and writes nothing.
 *   5. Editing standard rates never disturbs the intro block.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-intro-edit-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const PATTERN = "test-promo-model%";

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

describe("PUT /api/pricing — introductory rate editing", () => {
  it("persists intro rates when a valid intro_until is supplied", async () => {
    const res = await fetch("/api/pricing", {
      method: "PUT",
      body: {
        model_pattern: PATTERN,
        display_name: "Test Promo Model",
        input_per_mtok: 3,
        output_per_mtok: 15,
        intro_until: "2026-08-31",
        intro_input_per_mtok: 2,
        intro_output_per_mtok: 10,
        intro_cache_read_per_mtok: 0.2,
        intro_cache_write_per_mtok: 2.5,
        intro_cache_write_1h_per_mtok: 4,
      },
    });
    assert.equal(res.status, 200);
    const row = stmts.getPricing.get(PATTERN);
    assert.equal(row.intro_until, "2026-08-31");
    assert.equal(row.intro_input_per_mtok, 2);
    assert.equal(row.intro_output_per_mtok, 10);
    assert.equal(row.intro_cache_read_per_mtok, 0.2);
    assert.equal(row.intro_cache_write_per_mtok, 2.5);
    assert.equal(row.intro_cache_write_1h_per_mtok, 4);
    // Standard rates persisted too.
    assert.equal(row.input_per_mtok, 3);
    assert.equal(row.output_per_mtok, 15);
  });

  it("preserves an existing promo when the PUT omits all intro fields", async () => {
    // Older client shape: standard rates only, no intro_* keys at all.
    const res = await fetch("/api/pricing", {
      method: "PUT",
      body: {
        model_pattern: PATTERN,
        display_name: "Test Promo Model (renamed)",
        input_per_mtok: 4,
        output_per_mtok: 16,
      },
    });
    assert.equal(res.status, 200);
    const row = stmts.getPricing.get(PATTERN);
    // Standard rates updated…
    assert.equal(row.input_per_mtok, 4);
    assert.equal(row.display_name, "Test Promo Model (renamed)");
    // …but the promo is untouched.
    assert.equal(row.intro_until, "2026-08-31");
    assert.equal(row.intro_input_per_mtok, 2);
    assert.equal(row.intro_output_per_mtok, 10);
  });

  it("rejects a malformed intro_until without mutating the row", async () => {
    const before = stmts.getPricing.get(PATTERN);
    const res = await fetch("/api/pricing", {
      method: "PUT",
      body: {
        model_pattern: PATTERN,
        display_name: "Test Promo Model",
        input_per_mtok: 4,
        output_per_mtok: 16,
        intro_until: "August 31",
        intro_input_per_mtok: 1,
      },
    });
    assert.equal(res.status, 400);
    const after = stmts.getPricing.get(PATTERN);
    assert.deepEqual(after, before);
  });

  it("clears the promo and zeroes intro rates when intro_until is emptied", async () => {
    const res = await fetch("/api/pricing", {
      method: "PUT",
      body: {
        model_pattern: PATTERN,
        display_name: "Test Promo Model",
        input_per_mtok: 4,
        output_per_mtok: 16,
        intro_until: "",
        // Even though rates are still sent, an empty date clears them so a
        // re-added date later can't silently resurrect stale values.
        intro_input_per_mtok: 2,
        intro_output_per_mtok: 10,
      },
    });
    assert.equal(res.status, 200);
    const row = stmts.getPricing.get(PATTERN);
    assert.equal(row.intro_until, null);
    assert.equal(row.intro_input_per_mtok, 0);
    assert.equal(row.intro_output_per_mtok, 0);
  });
});
