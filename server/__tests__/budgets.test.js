/**
 * @file Tests for spend budgets: period-window math, current-period spend
 * evaluation, threshold alert firing (fire-once-per-period), and the
 * /api/budgets CRUD routes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-budgets-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
// Keep the scheduler from auto-running during route tests.
process.env.DASHBOARD_BUDGET_CHECK = "off";

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const budgets = require("../lib/budgets");

let server;
let BASE;

function fetch(urlPath, options = {}) {
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
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}
const post = (p, b) => fetch(p, { method: "POST", body: b });
const put = (p, b) => fetch(p, { method: "PUT", body: b });
const del = (p) => fetch(p, { method: "DELETE" });

/** Insert a session + token usage so spend lands in the current period. */
function seedSpend(sessionId, model, input, output, startedAt) {
  db.prepare("INSERT INTO sessions (id, status, started_at) VALUES (?, 'completed', ?)").run(
    sessionId,
    startedAt
  );
  db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens) VALUES (?, ?, ?, ?, 0, 0)"
  ).run(sessionId, model, input, output);
}

function resetData() {
  db.pragma("foreign_keys = OFF");
  db.prepare("DELETE FROM budget_alert_state").run();
  db.prepare("DELETE FROM budgets").run();
  db.prepare("DELETE FROM token_usage").run();
  db.prepare("DELETE FROM sessions").run();
  db.pragma("foreign_keys = ON");
}

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      // ignore
    }
  }
});

beforeEach(() => resetData());

// ── Period windows ─────────────────────────────────────────────────────────
describe("budgets.periodWindow", () => {
  it("computes a UTC daily window and key", () => {
    const now = new Date("2026-06-05T13:30:00Z");
    const w = budgets.periodWindow("daily", now);
    assert.equal(w.start, "2026-06-05T00:00:00.000Z");
    assert.equal(w.end, "2026-06-06T00:00:00.000Z");
    assert.equal(w.key, "2026-06-05");
  });

  it("computes a Monday-start weekly window with ISO week key", () => {
    // 2026-06-05 is a Friday → week starts Monday 2026-06-01.
    const w = budgets.periodWindow("weekly", new Date("2026-06-05T13:30:00Z"));
    assert.equal(w.start, "2026-06-01T00:00:00.000Z");
    assert.equal(w.end, "2026-06-08T00:00:00.000Z");
    assert.equal(w.key, "2026-W23");
  });

  it("rolls weekly window back across a month boundary on Sunday", () => {
    // 2026-03-01 is a Sunday → its ISO week started Monday 2026-02-23.
    const w = budgets.periodWindow("weekly", new Date("2026-03-01T10:00:00Z"));
    assert.equal(w.start, "2026-02-23T00:00:00.000Z");
    assert.equal(w.key, "2026-W09");
  });

  it("computes a monthly window and key", () => {
    const w = budgets.periodWindow("monthly", new Date("2026-06-05T13:30:00Z"));
    assert.equal(w.start, "2026-06-01T00:00:00.000Z");
    assert.equal(w.end, "2026-07-01T00:00:00.000Z");
    assert.equal(w.key, "2026-06");
  });
});

describe("budgets.parseThresholds", () => {
  it("cleans, dedupes, sorts, and clamps", () => {
    assert.deepEqual(budgets.parseThresholds("[100, 50, 50, 200, 0, 75]"), [50, 75, 100]);
  });
  it("falls back to defaults on garbage", () => {
    assert.deepEqual(budgets.parseThresholds("not json"), [80, 100]);
    assert.deepEqual(budgets.parseThresholds([]), [80, 100]);
  });
});

// ── Spend + evaluation ──────────────────────────────────────────────────────
describe("budgets.evaluateBudget", () => {
  it("sums spend within the period and computes pct/status", () => {
    const now = new Date();
    // 1M input + 1M output for Opus 4.8 = $5 + $25 = $30.
    seedSpend("s-now", "claude-opus-4-8", 1_000_000, 1_000_000, now.toISOString());
    // Spend from an old session must NOT count toward this month.
    seedSpend("s-old", "claude-opus-4-8", 5_000_000, 5_000_000, "2000-01-01T00:00:00.000Z");

    const id = db
      .prepare(
        "INSERT INTO budgets (period, limit_usd, alert_thresholds) VALUES ('monthly', 40, '[80,100]')"
      )
      .run().lastInsertRowid;
    const row = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
    const ev = budgets.evaluateBudget(db, row, now);

    assert.equal(ev.spent, 30);
    assert.equal(ev.limit_usd, 40);
    assert.equal(ev.pct, 75);
    assert.equal(ev.status, "ok"); // below the 80% warn threshold
    assert.equal(ev.remaining, 10);
  });

  it("marks status warning then exceeded as spend grows", () => {
    const now = new Date();
    seedSpend("s1", "claude-opus-4-8", 1_000_000, 1_000_000, now.toISOString()); // $30
    const warnId = db
      .prepare("INSERT INTO budgets (period, limit_usd) VALUES ('monthly', 35)")
      .run().lastInsertRowid;
    const overId = db
      .prepare("INSERT INTO budgets (period, limit_usd) VALUES ('monthly', 20)")
      .run().lastInsertRowid;

    const warn = budgets.evaluateBudget(
      db,
      db.prepare("SELECT * FROM budgets WHERE id = ?").get(warnId),
      now
    );
    const over = budgets.evaluateBudget(
      db,
      db.prepare("SELECT * FROM budgets WHERE id = ?").get(overId),
      now
    );
    assert.equal(warn.status, "warning");
    assert.equal(over.status, "exceeded");
  });
});

// ── Alert firing ────────────────────────────────────────────────────────────
describe("budgets.checkAndAlert", () => {
  it("fires once per crossed period and re-fires only on a new period", () => {
    const now = new Date();
    seedSpend("s1", "claude-opus-4-8", 1_000_000, 1_000_000, now.toISOString()); // $30
    db.prepare(
      "INSERT INTO budgets (period, limit_usd, alert_thresholds) VALUES ('monthly', 20, '[80,100]')"
    ).run();

    const alerts = [];
    const broadcasts = [];
    const hooks = {
      notify: (title, body, a) => alerts.push(a),
      broadcast: (type, data) => broadcasts.push({ type, data }),
    };

    const first = budgets.checkAndAlert(db, now, hooks);
    assert.equal(first.length, 1);
    assert.equal(first[0].threshold, 100, "should report the highest crossed threshold");
    assert.equal(alerts.length, 1);
    assert.ok(broadcasts.some((b) => b.type === "budget_alert"));
    assert.ok(broadcasts.some((b) => b.type === "budgets_updated"));

    // Both 80 and 100 are recorded so neither re-fires this period.
    const second = budgets.checkAndAlert(db, now, hooks);
    assert.equal(second.length, 0, "no re-fire within the same period");

    // A different period key (next month) re-arms the thresholds.
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
    seedSpend("s2", "claude-opus-4-8", 1_000_000, 1_000_000, nextMonth.toISOString());
    const third = budgets.checkAndAlert(db, nextMonth, hooks);
    assert.equal(third.length, 1, "re-fires in the new period");
  });

  it("ignores disabled budgets", () => {
    const now = new Date();
    seedSpend("s1", "claude-opus-4-8", 1_000_000, 1_000_000, now.toISOString());
    db.prepare("INSERT INTO budgets (period, limit_usd, enabled) VALUES ('monthly', 1, 0)").run();
    assert.equal(budgets.checkAndAlert(db, now, {}).length, 0);
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
describe("Budgets API", () => {
  it("creates, lists, updates, and deletes a budget", async () => {
    const created = await post("/api/budgets", { period: "monthly", limit_usd: 50 });
    assert.equal(created.status, 201);
    assert.equal(created.body.budget.period, "monthly");
    assert.equal(created.body.budget.limit_usd, 50);
    assert.deepEqual(created.body.budget.alert_thresholds, [80, 100]);
    const id = created.body.budget.id;

    const listed = await fetch("/api/budgets");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.budgets.length, 1);
    assert.ok(listed.body.generated_at);

    const updated = await put(`/api/budgets/${id}`, {
      limit_usd: 75,
      alert_thresholds: [50, 90],
      enabled: false,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.budget.limit_usd, 75);
    assert.equal(updated.body.budget.enabled, false);
    assert.deepEqual(updated.body.budget.alert_thresholds, [50, 90]);

    const removed = await del(`/api/budgets/${id}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.ok, true);

    const after = await fetch("/api/budgets");
    assert.equal(after.body.budgets.length, 0);
  });

  it("rejects invalid period and non-positive limit", async () => {
    const badPeriod = await post("/api/budgets", { period: "yearly", limit_usd: 10 });
    assert.equal(badPeriod.status, 400);
    const badLimit = await post("/api/budgets", { period: "daily", limit_usd: 0 });
    assert.equal(badLimit.status, 400);
  });

  it("404s when updating or deleting a missing budget", async () => {
    assert.equal((await put("/api/budgets/999999", { limit_usd: 5 })).status, 404);
    assert.equal((await del("/api/budgets/999999")).status, 404);
  });
});
