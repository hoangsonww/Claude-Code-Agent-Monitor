/**
 * @file API tests for POST /api/pricing/simulate. Seeds real token_usage, then
 * asserts: (1) the identity guard — an empty transform list reprices to exactly
 * what GET /api/pricing/cost reports (a standing guard against the two code
 * paths drifting); (2) a model remap lowers the simulated cost and produces a
 * per-model waterfall; (3) scope filters and input validation behave.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-simulate-api-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = ROOT;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const { createApp, startServer } = require("../index");

let server;
let base;

function seedSession(id, cwd, startedAt) {
  stmts.insertSession.run(id, id, "completed", cwd, "claude-opus-4-8", null);
  db.prepare("UPDATE sessions SET started_at = ? WHERE id = ?").run(startedAt, id);
}

function seedUsage(sessionId, model, tokens) {
  db.prepare(
    `INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cache_read_tokens)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, model, tokens.input || 0, tokens.output || 0, tokens.cache_read || 0);
}

async function getJson(url) {
  const r = await fetch(`${base}${url}`);
  return { status: r.status, body: await r.json() };
}

async function postJson(url, payload) {
  const r = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: r.status, body: await r.json() };
}

describe("POST /api/pricing/simulate", () => {
  before(async () => {
    // Two projects, two models, so remap and scope filters have something to bite.
    seedSession("sess-a", "/work/api", "2026-10-01T12:00:00.000Z");
    seedSession("sess-b", "/work/web", "2026-10-15T12:00:00.000Z");
    seedUsage("sess-a", "claude-opus-4-8", {
      input: 2_000_000,
      output: 1_000_000,
      cache_read: 500_000,
    });
    seedUsage("sess-b", "claude-opus-4-8", { input: 1_000_000, output: 500_000 });
    server = await startServer(createApp(), 0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it("identity guard: empty transforms reprice to exactly /api/pricing/cost", async () => {
    const cost = await getJson("/api/pricing/cost");
    const sim = await postJson("/api/pricing/simulate", { transforms: [] });
    assert.equal(sim.status, 200);
    assert.equal(sim.body.actual.total_cost, cost.body.total_cost);
    assert.equal(sim.body.simulated.total_cost, cost.body.total_cost);
    assert.equal(sim.body.delta.total, 0);
  });

  it("remapping opus to a cheaper model lowers simulated cost with a per-model waterfall", async () => {
    const sim = await postJson("/api/pricing/simulate", {
      transforms: [{ type: "remap_model", from: "claude-opus-*", to: "claude-haiku-4-5" }],
    });
    assert.equal(sim.status, 200);
    assert.ok(sim.body.actual.total_cost > 0);
    assert.ok(sim.body.simulated.total_cost < sim.body.actual.total_cost);
    assert.ok(sim.body.delta.total < 0);
    // Waterfall: opus disappears (goes negative), the remapped model appears positive.
    const opus = sim.body.delta.by_model.find((m) => m.model === "claude-opus-4-8");
    const haiku = sim.body.delta.by_model.find((m) => m.model === "claude-haiku-4-5");
    assert.ok(opus && opus.delta < 0);
    assert.ok(haiku && haiku.delta > 0);
    // The honesty caveat travels with the result.
    assert.ok(sim.body.assumptions.some((a) => /cost model/i.test(a)));
  });

  it("scope.project restricts the usage that is repriced", async () => {
    const all = await postJson("/api/pricing/simulate", { transforms: [] });
    const scoped = await postJson("/api/pricing/simulate", {
      scope: { project: "/work/api" },
      transforms: [],
    });
    assert.equal(scoped.status, 200);
    assert.ok(scoped.body.actual.total_cost > 0);
    assert.ok(scoped.body.actual.total_cost < all.body.actual.total_cost);
  });

  it("scope.since / until window the usage by day", async () => {
    const before = await postJson("/api/pricing/simulate", {
      scope: { until: "2026-10-10" },
      transforms: [],
    });
    // Only sess-a (2026-10-01) falls on/before 2026-10-10; sess-b (10-15) is excluded.
    const projectA = await postJson("/api/pricing/simulate", {
      scope: { project: "/work/api" },
      transforms: [],
    });
    assert.equal(before.body.actual.total_cost, projectA.body.actual.total_cost);
  });

  it("rejects an unknown transform type with 400", async () => {
    const r = await postJson("/api/pricing/simulate", { transforms: [{ type: "bogus" }] });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "INVALID_TRANSFORM");
  });

  it("rejects a malformed scope date with 400", async () => {
    const r = await postJson("/api/pricing/simulate", {
      scope: { since: "10/01/2026" },
      transforms: [],
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "INVALID_SCOPE");
  });
});
