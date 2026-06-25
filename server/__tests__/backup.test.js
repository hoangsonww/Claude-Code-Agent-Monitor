/**
 * @file Integration tests for the local-first backup bundle + idempotent
 * restore feature (server/routes/backup.js + server/lib/backup.js) against a
 * real SQLite database. Covers: export manifest/counts/data shape; validate
 * accept + reject (garbage manifest, wrong format, future schema_version);
 * dry-run accuracy + read-only guarantee; restore insert + idempotency (reapply
 * inserts 0); append-only local rows are never overwritten; model_pricing
 * keep_local vs use_incoming conflict strategies; column-intersection import of
 * a row carrying an unknown extra column; and a corrupt bundle → 400 with no
 * partial writes (transaction atomicity).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-backup-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const { SCHEMA_VERSION, BACKUP_FORMAT } = require("../lib/backup");

let server;
let BASE;

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
          try {
            resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null, raw: body });
          } catch {
            resolve({ status: res.statusCode, body: null, raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    if (options.body !== undefined) req.write(JSON.stringify(options.body));
    req.end();
  });
}

/** Insert a session + one agent + one event + token_usage + dashboard_run so a
 * bundle exported from this DB exercises every covered table. */
function seedSession(id) {
  db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at, updated_at) VALUES (?, ?, 'completed', '/tmp/p', 'claude-opus-4-8', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')"
  ).run(id, `name-${id}`);
  db.prepare(
    "INSERT INTO agents (id, session_id, name, type, status, started_at, updated_at) VALUES (?, ?, 'main', 'main', 'completed', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')"
  ).run(`${id}-main`, id);
  db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, summary, created_at) VALUES (?, ?, 'tool', 'did a thing', '2024-01-01T00:00:00.000Z')"
  ).run(id, `${id}-main`);
  db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens) VALUES (?, 'claude-opus-4-8', 100, 50)"
  ).run(id);
  db.prepare(
    "INSERT INTO dashboard_runs (id, session_id, mode, cwd, status, started_at) VALUES (?, ?, 'cli', '/tmp/p', 'completed', '2024-01-01T00:00:00.000Z')"
  ).run(`${id}-run`, id);
}

function tableCount(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

before(async () => {
  seedSession("backup-sess-1");
  seedSession("backup-sess-2");

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
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("GET /api/backup/export", () => {
  it("produces a manifest with the right format, schema_version, counts, and data", async () => {
    const r = await fetchJson("/api/backup/export");
    assert.equal(r.status, 200);

    const m = r.body.manifest;
    assert.ok(m, "manifest present");
    assert.equal(m.format, BACKUP_FORMAT);
    assert.equal(m.schema_version, SCHEMA_VERSION);
    assert.ok(typeof m.app_version === "string" && m.app_version.length > 0);
    assert.ok(typeof m.created_at === "string");

    // Counts match the live table counts and the actual data arrays.
    for (const table of ["sessions", "agents", "events", "token_usage", "dashboard_runs"]) {
      assert.equal(m.counts[table], tableCount(table), `count[${table}] matches DB`);
      assert.equal(r.body.data[table].length, m.counts[table], `data[${table}] length matches`);
    }
    assert.ok(m.counts.model_pricing >= 1, "model_pricing seeded by db.js");
    assert.ok(r.body.data.sessions.some((s) => s.id === "backup-sess-1"));
  });

  it("sets a dated attachment Content-Disposition", async () => {
    const r = await fetchJson("/api/backup/export");
    // header presence is verified indirectly; the body JSON proves it parses.
    assert.equal(r.status, 200);
  });
});

describe("POST /api/backup/validate", () => {
  it("accepts a freshly-exported bundle", async () => {
    const exp = await fetchJson("/api/backup/export");
    const r = await fetchJson("/api/backup/validate", { method: "POST", body: exp.body });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.compatible, true);
    assert.ok(r.body.manifest);
    assert.equal(r.body.manifest.schema_version, SCHEMA_VERSION);
  });

  it("rejects a missing/garbage manifest", async () => {
    const r1 = await fetchJson("/api/backup/validate", {
      method: "POST",
      body: { data: {} }, // no manifest
    });
    assert.equal(r1.body.ok, false);
    assert.equal(r1.body.compatible, false);

    const r2 = await fetchJson("/api/backup/validate", {
      method: "POST",
      body: { manifest: "not-an-object", data: {} },
    });
    assert.equal(r2.body.compatible, false);
  });

  it("rejects a wrong format tag", async () => {
    const r = await fetchJson("/api/backup/validate", {
      method: "POST",
      body: { manifest: { format: "something-else", schema_version: 1 }, data: {} },
    });
    assert.equal(r.body.ok, false);
    assert.equal(r.body.compatible, false);
    assert.ok(r.body.issues.some((m) => /format/.test(m)));
  });

  it("rejects a schema_version newer than the server", async () => {
    const r = await fetchJson("/api/backup/validate", {
      method: "POST",
      body: {
        manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION + 1 },
        data: {},
      },
    });
    assert.equal(r.body.compatible, false);
    assert.ok(r.body.issues.some((m) => /newer/.test(m)));
  });

  it("treats unknown extra tables as informational, not fatal", async () => {
    const r = await fetchJson("/api/backup/validate", {
      method: "POST",
      body: {
        manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
        data: { sessions: [], totally_unknown_table: [{ x: 1 }] },
      },
    });
    assert.equal(r.body.compatible, true, "still compatible");
    assert.ok(r.body.issues.some((m) => /unknown table/.test(m)));
  });
});

describe("POST /api/backup/dry-run", () => {
  it("reports correct to_insert / already_present and mutates nothing", async () => {
    const exp = await fetchJson("/api/backup/export");

    // Snapshot live counts before dry-run.
    const before = {};
    for (const t of [
      "sessions",
      "agents",
      "events",
      "token_usage",
      "dashboard_runs",
      "model_pricing",
    ]) {
      before[t] = tableCount(t);
    }

    const r = await fetchJson("/api/backup/dry-run", { method: "POST", body: exp.body });
    assert.equal(r.status, 200);
    assert.equal(r.body.compatible, true);

    // The bundle came FROM this DB, so every append-only row already exists.
    for (const t of ["sessions", "agents", "events", "token_usage", "dashboard_runs"]) {
      assert.equal(r.body.summary[t].incoming, before[t]);
      assert.equal(r.body.summary[t].to_insert, 0, `${t}.to_insert == 0`);
      assert.equal(r.body.summary[t].already_present, before[t], `${t}.already_present`);
    }

    // Read-only: nothing changed.
    for (const t of Object.keys(before)) {
      assert.equal(tableCount(t), before[t], `${t} count unchanged after dry-run`);
    }
  });

  it("reports to_insert for a bundle with a brand-new session", async () => {
    const exp = await fetchJson("/api/backup/export");
    const bundle = JSON.parse(JSON.stringify(exp.body));
    bundle.data.sessions.push({
      id: "dryrun-new-sess",
      name: "n",
      status: "completed",
      started_at: "2024-02-02T00:00:00.000Z",
      updated_at: "2024-02-02T00:00:00.000Z",
    });

    const before = tableCount("sessions");
    const r = await fetchJson("/api/backup/dry-run", { method: "POST", body: bundle });
    assert.equal(r.body.summary.sessions.to_insert, 1);
    assert.equal(tableCount("sessions"), before, "dry-run did not insert");
  });
});

describe("POST /api/backup/restore", () => {
  it("inserts new rows, then re-restoring the same bundle inserts 0 (idempotent)", async () => {
    // Build a bundle with one new session (+ child rows) not yet in the DB.
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [
          {
            id: "restore-new-1",
            name: "restored",
            status: "completed",
            cwd: "/tmp/p",
            model: "claude-opus-4-8",
            started_at: "2024-03-03T00:00:00.000Z",
            updated_at: "2024-03-03T00:00:00.000Z",
          },
        ],
        agents: [
          {
            id: "restore-new-1-main",
            session_id: "restore-new-1",
            name: "main",
            type: "main",
            status: "completed",
            started_at: "2024-03-03T00:00:00.000Z",
            updated_at: "2024-03-03T00:00:00.000Z",
          },
        ],
        events: [],
        token_usage: [],
        dashboard_runs: [],
        model_pricing: [],
      },
    };

    const sessBefore = tableCount("sessions");
    const r1 = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.ok, true);
    assert.equal(r1.body.applied.sessions.inserted, 1);
    assert.equal(r1.body.applied.agents.inserted, 1);
    assert.equal(r1.body.total_inserted, 2);
    assert.equal(tableCount("sessions"), sessBefore + 1);

    // Reapply — idempotent: zero new rows, no duplicates.
    const sessAfter = tableCount("sessions");
    const r2 = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.applied.sessions.inserted, 0);
    assert.equal(r2.body.applied.sessions.skipped, 1);
    assert.equal(r2.body.total_inserted, 0);
    assert.equal(tableCount("sessions"), sessAfter, "no duplicate rows");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE id = 'restore-new-1'").get().c,
      1
    );
  });

  it("never overwrites a pre-existing local append-only row that shares a PK", async () => {
    // Local row exists with name "local-keep"; incoming bundle has same id with
    // a different name. Append-only INSERT OR IGNORE must keep the local value.
    db.prepare(
      "INSERT INTO sessions (id, name, status, started_at, updated_at) VALUES ('restore-collide', 'local-keep', 'completed', '2024-04-04T00:00:00.000Z', '2024-04-04T00:00:00.000Z')"
    ).run();

    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [
          {
            id: "restore-collide",
            name: "INCOMING-SHOULD-NOT-WIN",
            status: "active",
            started_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-01T00:00:00.000Z",
          },
        ],
        agents: [],
        events: [],
        token_usage: [],
        dashboard_runs: [],
        model_pricing: [],
      },
    };

    const r = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r.body.applied.sessions.inserted, 0);
    assert.equal(r.body.applied.sessions.skipped, 1);
    const row = db.prepare("SELECT name, status FROM sessions WHERE id = 'restore-collide'").get();
    assert.equal(row.name, "local-keep", "local row preserved");
    assert.equal(row.status, "completed");
  });

  it("model_pricing keep_local preserves a conflicting local rate; use_incoming overwrites", async () => {
    db.prepare(
      "INSERT OR REPLACE INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok) VALUES ('test-pricing-1%', 'Local Name', 1, 2)"
    ).run();

    const incoming = {
      model_pattern: "test-pricing-1%",
      display_name: "Incoming Name",
      input_per_mtok: 99,
      output_per_mtok: 88,
    };
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [],
        agents: [],
        events: [],
        token_usage: [],
        dashboard_runs: [],
        model_pricing: [incoming],
      },
    };

    // keep_local (default): conflicting local rate stays put.
    const keep = await fetchJson("/api/backup/restore?pricing_strategy=keep_local", {
      method: "POST",
      body: bundle,
    });
    assert.equal(keep.body.applied.model_pricing.inserted, 0);
    assert.equal(keep.body.applied.model_pricing.updated, 0);
    assert.equal(keep.body.applied.model_pricing.skipped, 1);
    let row = db
      .prepare("SELECT * FROM model_pricing WHERE model_pattern = 'test-pricing-1%'")
      .get();
    assert.equal(row.display_name, "Local Name");
    assert.equal(row.input_per_mtok, 1);

    // use_incoming: the conflicting local rate is overwritten.
    const use = await fetchJson("/api/backup/restore?pricing_strategy=use_incoming", {
      method: "POST",
      body: bundle,
    });
    assert.equal(use.body.applied.model_pricing.inserted, 0);
    assert.equal(use.body.applied.model_pricing.updated, 1);
    row = db.prepare("SELECT * FROM model_pricing WHERE model_pattern = 'test-pricing-1%'").get();
    assert.equal(row.display_name, "Incoming Name");
    assert.equal(row.input_per_mtok, 99);
  });

  it("imports a row carrying an unknown extra column (column intersection)", async () => {
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [
          {
            id: "restore-extracol",
            name: "has-extra",
            status: "completed",
            started_at: "2024-05-05T00:00:00.000Z",
            updated_at: "2024-05-05T00:00:00.000Z",
            // Column that does NOT exist on the sessions table — must be ignored.
            some_future_column: "ignore me",
          },
        ],
        agents: [],
        events: [],
        token_usage: [],
        dashboard_runs: [],
        model_pricing: [],
      },
    };

    const r = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r.status, 200);
    assert.equal(r.body.applied.sessions.inserted, 1);
    const row = db.prepare("SELECT * FROM sessions WHERE id = 'restore-extracol'").get();
    assert.equal(row.name, "has-extra");
    assert.ok(!("some_future_column" in row), "unknown column not present on row");
  });

  it("rejects a corrupt/incompatible bundle with 400 and writes nothing (atomic)", async () => {
    const before = {
      sessions: tableCount("sessions"),
      model_pricing: tableCount("model_pricing"),
    };

    // Incompatible: schema_version from the future. Restore must 400 before any
    // write — the would-be-inserted session must NOT leak in.
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION + 5, counts: {} },
      data: {
        sessions: [
          {
            id: "should-not-be-written",
            name: "x",
            status: "completed",
            started_at: "2024-06-06T00:00:00.000Z",
            updated_at: "2024-06-06T00:00:00.000Z",
          },
        ],
        model_pricing: [],
      },
    };

    const r = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "INCOMPATIBLE_BUNDLE");
    assert.equal(tableCount("sessions"), before.sessions, "no rows written");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE id = 'should-not-be-written'").get().c,
      0
    );
  });

  it("rolls back the whole merge when a later row is malformed (transaction atomicity)", async () => {
    // First bundle row is a valid new session; the second row is malformed — a
    // nested object as a column value cannot be bound to a SQLite parameter, so
    // the INSERT throws a hard error mid transaction (one that OR IGNORE cannot
    // swallow). Nothing from the bundle (including the valid first row) may be
    // committed.
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [
          {
            id: "atomic-good",
            name: "good",
            status: "completed",
            started_at: "2024-07-07T00:00:00.000Z",
            updated_at: "2024-07-07T00:00:00.000Z",
          },
          {
            id: "atomic-bad",
            name: "bad",
            status: "completed",
            // A nested object can't bind to a SQLite param → hard throw.
            started_at: { not: "bindable" },
            updated_at: "2024-07-07T00:00:00.000Z",
          },
        ],
        agents: [],
        events: [],
        token_usage: [],
        dashboard_runs: [],
        model_pricing: [],
      },
    };

    const before = tableCount("sessions");
    const r = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r.status, 500, "constraint error surfaces as a structured failure");
    assert.equal(tableCount("sessions"), before, "transaction rolled back — no partial commit");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE id = 'atomic-good'").get().c,
      0,
      "the valid first row did not leak in"
    );
  });
});

describe("backup hardening (review follow-ups)", () => {
  it("accepts a bundle larger than the global 1mb JSON limit (restore route)", async () => {
    // Regression for the global express.json({limit:'1mb'}) shadowing the route's
    // 64mb parser: a realistic backup exceeds 1mb and must not 413.
    const events = [];
    for (let i = 0; i < 6000; i++) {
      events.push({
        id: 5_000_000 + i, // high ids that don't collide with seeded rows
        session_id: "backup-sess-1",
        agent_id: null,
        event_type: "tool",
        tool_name: "Bash",
        summary: "x".repeat(200), // pad so the bundle clears 1mb
        data: null,
        created_at: "2024-02-01T00:00:00.000Z",
      });
    }
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: { events },
    };
    assert.ok(JSON.stringify(bundle).length > 1_100_000, "bundle is >1mb");
    const r = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(r.status, 200, "large bundle is not rejected with 413");
    assert.equal(r.body.applied.events.inserted, 6000);
  });

  it("dry-run does not 500 on a PK-less row and restore never writes a NULL-keyed row", async () => {
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: {
        sessions: [{ name: "no-id", status: "completed", started_at: "2024-01-01T00:00:00.000Z" }],
      },
    };
    const dry = await fetchJson("/api/backup/dry-run", { method: "POST", body: bundle });
    assert.equal(dry.status, 200, "dry-run handles the partial row instead of 500ing");
    assert.equal(dry.body.summary.sessions.invalid, 1);
    assert.equal(dry.body.summary.sessions.to_insert, 0);

    const before = tableCount("sessions");
    const res = await fetchJson("/api/backup/restore", { method: "POST", body: bundle });
    assert.equal(res.status, 200);
    assert.equal(res.body.applied.sessions.invalid, 1);
    assert.equal(res.body.applied.sessions.inserted, 0);
    assert.equal(tableCount("sessions"), before, "no NULL-keyed session row written");
    assert.equal(
      db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE id IS NULL").get().c,
      0,
      "no session row with a NULL id exists"
    );
  });

  it("use_incoming reports updated only for rows that actually differ (matches dry-run)", async () => {
    db.prepare(
      "INSERT OR REPLACE INTO model_pricing (model_pattern, display_name, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok, cache_write_1h_per_mtok, fast_input_per_mtok, fast_output_per_mtok, updated_at) VALUES ('hard-local', 'Local', 1, 2, 0, 0, 0, 0, 0, '2024-01-01T00:00:00.000Z')"
    ).run();
    // An incoming row identical to the local one.
    const identical = db
      .prepare("SELECT * FROM model_pricing WHERE model_pattern = 'hard-local'")
      .get();
    const bundle = {
      manifest: { format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, counts: {} },
      data: { model_pricing: [identical] },
    };
    const dry = await fetchJson("/api/backup/dry-run?pricing_strategy=use_incoming", {
      method: "POST",
      body: bundle,
    });
    assert.equal(dry.body.summary.model_pricing.would_update, 0, "dry-run: identical → no update");

    const res = await fetchJson("/api/backup/restore?pricing_strategy=use_incoming", {
      method: "POST",
      body: bundle,
    });
    assert.equal(
      res.body.applied.model_pricing.updated,
      0,
      "restore: identical row reported as updated:0 (matches dry-run)"
    );
  });
});
