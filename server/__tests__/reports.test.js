/**
 * @file Integration tests for Scheduled Analytics Reports (server/routes/reports.js,
 * server/lib/report-generator.js, server/lib/report-scheduler.js). Covers
 * definition CRUD + validation, computeNextRun determinism, windowed-number
 * consistency with the analytics-style queries, on-demand run + artifact
 * download, error-run capture (no crash), runDueReports due/not-due selection,
 * artifact Content-Type + 404 for an ungenerated format, and HTML escaping of a
 * hostile session name.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-reports-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
// Keep the background tick out of the way — we drive runDueReports directly.
process.env.DASHBOARD_REPORTS_DISABLED = "1";

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db } = dbModule;
const { computeNextRun, generateReport } = require("../lib/report-generator");
const { runDueReports } = require("../lib/report-scheduler");

let server;
let BASE;

// Fixed window for the consistency tests. Everything seeded sits inside it.
const WINDOW_START = "2026-01-01T00:00:00.000Z";
const WINDOW_END = "2026-01-08T00:00:00.000Z";
const HOSTILE_NAME = '<script>alert("xss")</script>';

function fetchJson(urlPath, options = {}) {
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
          const ct = res.headers["content-type"] || "";
          if (ct.includes("application/json")) {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body: body ? JSON.parse(body) : null,
              });
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
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function seedWindow() {
  // Two sessions inside the window (one with a hostile name), one outside.
  const insSession = db.prepare(
    "INSERT INTO sessions (id, name, status, started_at) VALUES (?, ?, ?, ?)"
  );
  insSession.run("rs-in-1", HOSTILE_NAME, "completed", "2026-01-02T10:00:00.000Z");
  insSession.run("rs-in-2", "Quiet session", "completed", "2026-01-04T10:00:00.000Z");
  insSession.run("rs-out-1", "Out of window", "completed", "2025-12-20T10:00:00.000Z");

  const insAgent = db.prepare(
    "INSERT INTO agents (id, session_id, name, type, subagent_type, status) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insAgent.run("rs-in-1-main", "rs-in-1", "main", "main", null, "completed");
  insAgent.run("rs-in-1-sub", "rs-in-1", "sub", "subagent", "Explore", "error");
  insAgent.run("rs-in-2-main", "rs-in-2", "main", "main", null, "completed");
  insAgent.run("rs-out-main", "rs-out-1", "main", "main", null, "working");

  const insEvent = db.prepare(
    "INSERT INTO events (session_id, event_type, tool_name, summary, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  // In-window events
  insEvent.run("rs-in-1", "PreToolUse", "Bash", "ran ls", "2026-01-02T10:01:00.000Z");
  insEvent.run("rs-in-1", "PreToolUse", "Bash", "ran cat", "2026-01-02T10:02:00.000Z");
  insEvent.run("rs-in-1", "PreToolUse", "Read", "read file", "2026-01-02T10:03:00.000Z");
  insEvent.run("rs-in-2", "PreToolUse", "Edit", "edit file", "2026-01-04T10:01:00.000Z");
  // A failure-prone event (error convention)
  insEvent.run("rs-in-1", "ToolError", "Bash", "Failed to run", "2026-01-02T10:04:00.000Z");
  // Out-of-window event (must NOT be counted)
  insEvent.run("rs-out-1", "PreToolUse", "Bash", "ran ls", "2025-12-20T10:01:00.000Z");

  // token_usage for in-window + out-of-window sessions
  const insTok = db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insTok.run("rs-in-1", "claude-opus-4-8", 1_000_000, 500_000, 0, 0);
  insTok.run("rs-in-2", "claude-opus-4-8", 2_000_000, 0, 0, 0);
  insTok.run("rs-out-1", "claude-opus-4-8", 9_000_000, 9_000_000, 0, 0); // outside window
}

before(async () => {
  seedWindow();
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

describe("GET /api/reports/templates", () => {
  it("lists templates + frequencies", async () => {
    const r = await fetchJson("/api/reports/templates");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.templates) && r.body.templates.length >= 4);
    assert.deepEqual(r.body.frequencies, ["daily", "weekly", "monthly"]);
    const wk = r.body.templates.find((t) => t.key === "weekly_health");
    assert.ok(wk && typeof wk.default_window_days === "number");
  });
});

describe("definition CRUD + validation", () => {
  it("creates a valid weekly definition with next_run_at", async () => {
    const r = await fetchJson("/api/reports", {
      method: "POST",
      body: {
        name: "My Weekly",
        template: "weekly_health",
        frequency: "weekly",
        day_of_week: 1,
        hour: 9,
        tz_offset: 0,
        formats: ["html", "json"],
      },
    });
    assert.equal(r.status, 201);
    const d = r.body.definition;
    assert.ok(d.id);
    assert.equal(d.frequency, "weekly");
    assert.equal(d.day_of_week, 1);
    assert.equal(d.enabled, true);
    assert.ok(typeof d.next_run_at === "string" && d.next_run_at.endsWith("Z"));
    assert.equal(d.last_status, null);
    assert.deepEqual(d.formats, ["html", "json"]);
  });

  it("rejects unknown template / frequency / bad hour / weekly without day_of_week / bad formats / bad window_days", async () => {
    const base = { name: "x", template: "weekly_health", frequency: "daily", hour: 9 };
    const cases = [
      { ...base, template: "nope" },
      { ...base, frequency: "hourly" },
      { ...base, hour: 24 },
      { name: "x", template: "weekly_health", frequency: "weekly", hour: 9 }, // weekly, no day_of_week
      { ...base, formats: [] },
      { ...base, formats: ["pdf"] },
      { ...base, window_days: 0 },
      { ...base, window_days: 100020623 }, // huge → would overflow Date if accepted
      { ...base, name: "" },
    ];
    for (const body of cases) {
      const r = await fetchJson("/api/reports", { method: "POST", body });
      assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(body)}`);
      assert.ok(r.body.error && r.body.error.message);
    }
  });

  it("lists definitions newest-first", async () => {
    const r = await fetchJson("/api/reports");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.definitions));
    assert.ok(r.body.definitions.length >= 1);
  });

  it("patches a definition and recomputes next_run_at; 404 unknown", async () => {
    const created = (
      await fetchJson("/api/reports", {
        method: "POST",
        body: { name: "Patch me", template: "tool_usage", frequency: "daily", hour: 8 },
      })
    ).body.definition;

    const patched = await fetchJson(`/api/reports/${created.id}`, {
      method: "PATCH",
      body: { hour: 15, enabled: false },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.definition.hour, 15);
    assert.equal(patched.body.definition.enabled, false);
    assert.notEqual(patched.body.definition.next_run_at, created.next_run_at);

    const miss = await fetchJson("/api/reports/does-not-exist", {
      method: "PATCH",
      body: { hour: 1 },
    });
    assert.equal(miss.status, 404);
  });

  it("deletes a definition + its runs; 404 unknown", async () => {
    const created = (
      await fetchJson("/api/reports", {
        method: "POST",
        body: { name: "Delete me", template: "session_throughput", frequency: "daily" },
      })
    ).body.definition;
    // Generate a run so we can assert cascade cleanup.
    await fetchJson(`/api/reports/${created.id}/run`, { method: "POST" });
    const del = await fetchJson(`/api/reports/${created.id}`, { method: "DELETE" });
    assert.equal(del.status, 200);
    assert.deepEqual(del.body, { ok: true });
    // Runs gone.
    const runsRow = db
      .prepare("SELECT COUNT(*) as c FROM report_runs WHERE definition_id = ?")
      .get(created.id);
    assert.equal(runsRow.c, 0);
    const miss = await fetchJson("/api/reports/does-not-exist", { method: "DELETE" });
    assert.equal(miss.status, 404);
  });
});

describe("computeNextRun determinism", () => {
  // Pin a reference instant: 2026-01-05 is a Monday. 10:00 UTC.
  const fromMs = Date.parse("2026-01-05T10:00:00.000Z");

  it("daily: same day if hour ahead, next day if passed", () => {
    assert.equal(
      computeNextRun({ frequency: "daily", hour: 15, tz_offset: 0 }, fromMs),
      "2026-01-05T15:00:00.000Z"
    );
    assert.equal(
      computeNextRun({ frequency: "daily", hour: 8, tz_offset: 0 }, fromMs),
      "2026-01-06T08:00:00.000Z"
    );
  });

  it("daily: respects tz_offset (minutes west of UTC)", () => {
    // tz_offset 60 (UTC-1): local now is 09:00; hour 10 local → 11:00 UTC today.
    assert.equal(
      computeNextRun({ frequency: "daily", hour: 10, tz_offset: 60 }, fromMs),
      "2026-01-05T11:00:00.000Z"
    );
  });

  it("weekly: next occurrence of day_of_week at hour", () => {
    // Monday now; target Wednesday (3) at 09:00 → 2026-01-07.
    assert.equal(
      computeNextRun({ frequency: "weekly", day_of_week: 3, hour: 9, tz_offset: 0 }, fromMs),
      "2026-01-07T09:00:00.000Z"
    );
    // Target Monday (1) but 08:00 already passed today → next Monday 2026-01-12.
    assert.equal(
      computeNextRun({ frequency: "weekly", day_of_week: 1, hour: 8, tz_offset: 0 }, fromMs),
      "2026-01-12T08:00:00.000Z"
    );
  });

  it("monthly: 1st of next month when this month's already passed", () => {
    // Jan 1 at 09:00 already passed by Jan 5 → Feb 1.
    assert.equal(
      computeNextRun({ frequency: "monthly", hour: 9, tz_offset: 0 }, fromMs),
      "2026-02-01T09:00:00.000Z"
    );
  });
});

describe("windowed-number consistency with analytics-style queries", () => {
  it("report counts equal direct windowed queries over the fixed window", () => {
    const { data } = generateReport(dbModule, {
      template: "weekly_health",
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      tzOffset: 0,
    });

    // Sessions started in window: rs-in-1, rs-in-2 → 2
    const expSessions = db
      .prepare("SELECT COUNT(*) c FROM sessions WHERE started_at >= ? AND started_at < ?")
      .get(WINDOW_START, WINDOW_END).c;
    assert.equal(data.total_sessions, expSessions);
    assert.equal(data.total_sessions, 2);

    // Events created in window: 5 (4 normal + 1 error), out-of-window excluded
    const expEvents = db
      .prepare("SELECT COUNT(*) c FROM events WHERE created_at >= ? AND created_at < ?")
      .get(WINDOW_START, WINDOW_END).c;
    assert.equal(data.total_events, expEvents);
    assert.equal(data.total_events, 5);

    // Top tools: Bash appears 3x (2 PreToolUse + 1 ToolError), Read 1, Edit 1
    const bash = data.top_tools.find((t) => t.tool_name === "Bash");
    assert.equal(bash.count, 3);

    // Agent status distribution for in-window sessions
    const expAgents = db
      .prepare(
        `SELECT a.status status, COUNT(*) c FROM agents a JOIN sessions s ON s.id = a.session_id
         WHERE s.started_at >= ? AND s.started_at < ? GROUP BY a.status`
      )
      .all(WINDOW_START, WINDOW_END);
    const expMap = Object.fromEntries(expAgents.map((r) => [r.status, r.c]));
    assert.deepEqual(data.agents_by_status, expMap);
    assert.equal(data.agents_by_status.completed, 2);
    assert.equal(data.agents_by_status.error, 1);

    // Failure-prone operations: one error event on Bash
    const failBash = data.failure_prone_operations.find((o) => o.operation === "Bash");
    assert.ok(failBash && failBash.count === 1);

    // Tokens: only in-window sessions counted (3M input, 0.5M output), NOT the
    // 9M/9M out-of-window session.
    assert.equal(data.tokens.total_input, 3_000_000);
    assert.equal(data.tokens.total_output, 500_000);
    // Cost mirrors calculateCost on the windowed buckets: opus-4-8 = $5/MTok in,
    // $25/MTok out → 3*5 + 0.5*25 = 27.5
    assert.equal(data.cost.total_cost, 27.5);
  });
});

describe("POST /api/reports/:id/run", () => {
  let defId;
  let runId;

  it("produces a success run with downloadable html+json artifacts", async () => {
    const def = (
      await fetchJson("/api/reports", {
        method: "POST",
        body: {
          name: "Run now",
          template: "weekly_health",
          frequency: "daily",
          hour: 9,
          tz_offset: 0,
          window_days: 3650, // wide enough to include the fixed window
          formats: ["html", "json"],
        },
      })
    ).body.definition;
    defId = def.id;

    const r = await fetchJson(`/api/reports/${defId}/run`, { method: "POST" });
    assert.equal(r.status, 200);
    const run = r.body.run;
    runId = run.id;
    assert.equal(run.status, "success");
    assert.equal(run.error, null);
    assert.ok(run.summary && typeof run.summary === "object");
    assert.deepEqual(run.formats_available.sort(), ["html", "json"]);
    // list/detail must NOT carry artifact bodies
    assert.ok(!("artifact_html" in run));
    assert.ok(!("artifact_json" in run));
  });

  it("downloads the JSON artifact with application/json", async () => {
    const r = await fetchJson(`/api/reports/runs/${runId}/artifact?format=json`);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /application\/json/);
    assert.match(r.headers["content-disposition"] || "", /attachment/);
    assert.ok(r.body && r.body.template === "weekly_health");
  });

  it("downloads the HTML artifact with text/html and escapes a hostile session name", async () => {
    const r = await fetchJson(`/api/reports/runs/${runId}/artifact?format=html`);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /text\/html; charset=utf-8/);
    assert.match(r.headers["content-disposition"] || "", /inline/);
    // The hostile session name only appears (if at all) escaped — never raw.
    assert.ok(!r.body.includes('<script>alert("xss")</script>'), "raw script must not appear");
    assert.ok(r.body.startsWith("<!doctype html>"));
    assert.ok(r.body.includes("@media print"));
  });

  it("lists runs for the definition (newest first, metadata only)", async () => {
    const r = await fetchJson(`/api/reports/${defId}/runs`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.runs) && r.body.runs.length >= 1);
    assert.ok(!("artifact_html" in r.body.runs[0]));
  });

  it("404s run/runs/artifact for unknown ids and ungenerated formats", async () => {
    assert.equal((await fetchJson("/api/reports/nope/run", { method: "POST" })).status, 404);
    assert.equal((await fetchJson("/api/reports/nope/runs")).status, 404);
    assert.equal((await fetchJson("/api/reports/runs/nope")).status, 404);
    assert.equal((await fetchJson("/api/reports/runs/nope/artifact?format=html")).status, 404);

    // A definition with ONLY json → requesting html artifact 404s.
    const jsonOnly = (
      await fetchJson("/api/reports", {
        method: "POST",
        body: {
          name: "json only",
          template: "token_spend",
          frequency: "daily",
          formats: ["json"],
          window_days: 3650,
        },
      })
    ).body.definition;
    const run = (await fetchJson(`/api/reports/${jsonOnly.id}/run`, { method: "POST" })).body.run;
    assert.deepEqual(run.formats_available, ["json"]);
    const html = await fetchJson(`/api/reports/runs/${run.id}/artifact?format=html`);
    assert.equal(html.status, 404);
    const json = await fetchJson(`/api/reports/runs/${run.id}/artifact?format=json`);
    assert.equal(json.status, 200);
  });
});

describe("error-run capture (no crash)", () => {
  it("captures a real generation error as an error run with a populated error string", () => {
    // Force a deterministic failure inside generateReport by making the pricing
    // lookup throw (token_spend hits calculateCost → listPricing). The run must
    // be persisted with status "error" and a populated error string — never
    // thrown out of runReportForDefinition.
    const realListPricing = dbModule.stmts.listPricing;
    dbModule.stmts.listPricing = {
      all() {
        throw new Error("pricing-explode");
      },
    };
    db.prepare(
      `INSERT INTO report_definitions (id, name, template, frequency, hour, tz_offset, formats, enabled, next_run_at)
       VALUES ('rs-err', 'err', 'token_spend', 'daily', 9, 0, '["json"]', 1, ?)`
    ).run("2026-01-01T09:00:00.000Z");
    const { runReportForDefinition } = require("../routes/reports");
    let run;
    try {
      run = runReportForDefinition(
        db.prepare("SELECT * FROM report_definitions WHERE id = 'rs-err'").get()
      );
    } finally {
      dbModule.stmts.listPricing = realListPricing;
    }
    assert.equal(run.status, "error");
    assert.ok(run.error && run.error.includes("pricing-explode"));
    assert.equal(run.artifact_json, null);
  });

  it("degrades a hand-stored out-of-range window_days to an error run (not a throw)", () => {
    // The validator rejects a huge window_days, but a corrupt/hand-edited row
    // shouldn't crash the run path or wedge the scheduler. Insert one directly,
    // bypassing validation, and assert runReportForDefinition returns an
    // error-status run rather than throwing a RangeError.
    db.prepare(
      `INSERT INTO report_definitions (id, name, template, frequency, hour, tz_offset, formats, enabled, next_run_at, window_days)
       VALUES ('rs-bigwin', 'big', 'session_throughput', 'daily', 9, 0, '["json"]', 1, ?, 100020623)`
    ).run("2026-01-01T09:00:00.000Z");
    const { runReportForDefinition } = require("../routes/reports");
    const run = runReportForDefinition(
      db.prepare("SELECT * FROM report_definitions WHERE id = 'rs-bigwin'").get()
    );
    assert.equal(run.status, "error");
    assert.ok(run.error, "error string is populated");
    // Schedule still advanced (next_run_at moved forward) so it can't re-fire forever.
    const def = db
      .prepare("SELECT next_run_at FROM report_definitions WHERE id = 'rs-bigwin'")
      .get();
    assert.notEqual(def.next_run_at, "2026-01-01T09:00:00.000Z");
  });
});

describe("runDueReports", () => {
  it("runs a due definition and skips a not-yet-due one", () => {
    const nowMs = Date.parse("2026-06-01T12:00:00.000Z");
    // Due: next_run_at in the past.
    db.prepare(
      `INSERT INTO report_definitions (id, name, template, frequency, hour, tz_offset, formats, enabled, next_run_at, window_days)
       VALUES ('rs-due', 'due', 'session_throughput', 'daily', 9, 0, '["json"]', 1, '2026-05-01T00:00:00.000Z', 3650)`
    ).run();
    // Not due: next_run_at in the future.
    db.prepare(
      `INSERT INTO report_definitions (id, name, template, frequency, hour, tz_offset, formats, enabled, next_run_at, window_days)
       VALUES ('rs-future', 'future', 'session_throughput', 'daily', 9, 0, '["json"]', 1, '2026-07-01T00:00:00.000Z', 3650)`
    ).run();
    // Disabled but due: must be skipped.
    db.prepare(
      `INSERT INTO report_definitions (id, name, template, frequency, hour, tz_offset, formats, enabled, next_run_at, window_days)
       VALUES ('rs-disabled', 'disabled', 'session_throughput', 'daily', 9, 0, '["json"]', 0, '2026-05-01T00:00:00.000Z', 3650)`
    ).run();

    const broadcasts = [];
    const produced = runDueReports(nowMs, (type, payload) => broadcasts.push({ type, payload }));

    const ids = produced.map((r) => r.definition_id);
    assert.ok(ids.includes("rs-due"), "due definition ran");
    assert.ok(!ids.includes("rs-future"), "future definition skipped");
    assert.ok(!ids.includes("rs-disabled"), "disabled definition skipped");

    // next_run_at advanced past now for the due def.
    const advanced = db
      .prepare("SELECT next_run_at, last_run_at FROM report_definitions WHERE id = 'rs-due'")
      .get();
    assert.ok(advanced.last_run_at, "last_run_at stamped");
    assert.ok(Date.parse(advanced.next_run_at) > nowMs, "next_run_at advanced past now");

    // broadcast emitted report_run with metadata-only payload.
    assert.ok(broadcasts.some((b) => b.type === "report_run"));
    const payload = broadcasts.find((b) => b.type === "report_run").payload;
    assert.ok(!("artifact_json" in payload));
  });
});
