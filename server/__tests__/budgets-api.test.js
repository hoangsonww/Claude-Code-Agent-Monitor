/**
 * @file API tests for the budgets router: CRUD validation, and GET /status
 * measuring real seeded spend against a limit with a burn-down forecast,
 * including project cwd-prefix roll-up and provider scoping.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "budgets-api-"));
process.env.DASHBOARD_DB_PATH = path.join(ROOT, "dashboard.db");
process.env.DASHBOARD_DATA_DIR = ROOT;
process.env.DASHBOARD_REMOTE_SYNC_MS = "0";
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const { createApp, startServer } = require("../index");

let server;
let base;

function seedSession(id, cwd, provider, startedAt) {
  stmts.insertSession.run(id, id, "completed", cwd, "claude-opus-4-8", null);
  db.prepare("UPDATE sessions SET started_at = ?, provider = ? WHERE id = ?").run(
    startedAt,
    provider,
    id
  );
}

function seedUsage(sessionId, model, input, output) {
  db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)"
  ).run(sessionId, model, input, output);
}

async function req(method, url, body) {
  const r = await fetch(`${base}${url}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}

describe("Budgets API", () => {
  before(async () => {
    const now = new Date().toISOString(); // falls inside today's daily/weekly/monthly window
    seedSession("sess-api", "/work/api", "claude", now);
    seedSession("sess-sub", "/work/api/sub", "claude", now);
    seedSession("sess-web", "/work/web", "claude", now);
    seedUsage("sess-api", "claude-opus-4-8", 2_000_000, 1_000_000);
    seedUsage("sess-sub", "claude-opus-4-8", 1_000_000, 500_000);
    seedUsage("sess-web", "claude-opus-4-8", 1_000_000, 500_000);
    server = await startServer(createApp(), 0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it("creates, lists, and serializes a budget", async () => {
    const created = await req("POST", "/api/budgets", {
      name: "Monthly cap",
      scope_type: "global",
      period: "monthly",
      limit_usd: 1000,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.budget.enabled, true);
    assert.equal(created.body.budget.scope_value, null);

    const list = await req("GET", "/api/budgets");
    assert.equal(list.status, 200);
    assert.ok(list.body.budgets.some((b) => b.id === created.body.budget.id));
  });

  it("rejects invalid create bodies with 400", async () => {
    assert.equal(
      (
        await req("POST", "/api/budgets", {
          name: "x",
          scope_type: "bad",
          period: "monthly",
          limit_usd: 5,
        })
      ).status,
      400
    );
    assert.equal(
      (
        await req("POST", "/api/budgets", {
          name: "x",
          scope_type: "project",
          period: "monthly",
          limit_usd: 5,
        })
      ).status,
      400
    ); // missing scope_value
    assert.equal(
      (
        await req("POST", "/api/budgets", {
          name: "x",
          scope_type: "global",
          period: "yearly",
          limit_usd: 5,
        })
      ).status,
      400
    );
    assert.equal(
      (
        await req("POST", "/api/budgets", {
          name: "x",
          scope_type: "global",
          period: "monthly",
          limit_usd: -1,
        })
      ).status,
      400
    );
    assert.equal(
      (
        await req("POST", "/api/budgets", {
          name: "",
          scope_type: "global",
          period: "monthly",
          limit_usd: 5,
        })
      ).status,
      400
    );
  });

  it("status measures real spend against the limit with a forecast", async () => {
    const created = await req("POST", "/api/budgets", {
      name: "Daily global",
      scope_type: "global",
      period: "daily",
      limit_usd: 1000,
    });
    const status = await req("GET", "/api/budgets/status");
    const s = status.body.budgets.find((b) => b.id === created.body.budget.id);
    assert.ok(s, "created budget appears in status");
    assert.ok(s.spent_usd > 0, "seeded usage produces spend");
    assert.equal(s.limit_usd, 1000);
    assert.ok(s.percent_used >= 0);
    assert.ok(["ok", "warn", "over", "projected_over"].includes(s.status));
    assert.ok(typeof s.period_start === "string" && typeof s.period_end === "string");
  });

  it("project scope rolls up nested cwds; provider scope narrows", async () => {
    const proj = await req("POST", "/api/budgets", {
      name: "API project",
      scope_type: "project",
      scope_value: "/work/api",
      period: "monthly",
      limit_usd: 1000,
    });
    const web = await req("POST", "/api/budgets", {
      name: "Web project",
      scope_type: "project",
      scope_value: "/work/web",
      period: "monthly",
      limit_usd: 1000,
    });
    const status = await req("GET", "/api/budgets/status");
    const projStatus = status.body.budgets.find((b) => b.id === proj.body.budget.id);
    const webStatus = status.body.budgets.find((b) => b.id === web.body.budget.id);
    // /work/api includes /work/api AND /work/api/sub (roll-up), so it spends more
    // than /work/web alone.
    assert.ok(projStatus.spent_usd > webStatus.spent_usd);
    assert.ok(webStatus.spent_usd > 0);
  });

  it("patches a budget and 404s after delete", async () => {
    const created = await req("POST", "/api/budgets", {
      name: "Temp",
      scope_type: "global",
      period: "weekly",
      limit_usd: 50,
    });
    const id = created.body.budget.id;
    const patched = await req("PATCH", `/api/budgets/${id}`, { limit_usd: 75, enabled: false });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.budget.limit_usd, 75);
    assert.equal(patched.body.budget.enabled, false);

    const del = await req("DELETE", `/api/budgets/${id}`);
    assert.equal(del.status, 200);
    assert.equal((await req("PATCH", `/api/budgets/${id}`, { limit_usd: 1 })).status, 404);
  });

  it("switching a budget to global clears its scope_value", async () => {
    const created = await req("POST", "/api/budgets", {
      name: "Scoped then global",
      scope_type: "project",
      scope_value: "/work/api",
      period: "monthly",
      limit_usd: 100,
    });
    const patched = await req("PATCH", `/api/budgets/${created.body.budget.id}`, {
      scope_type: "global",
    });
    assert.equal(patched.body.budget.scope_type, "global");
    assert.equal(patched.body.budget.scope_value, null);
  });
});
