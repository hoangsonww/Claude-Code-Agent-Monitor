/**
 * @file Real-SQLite integration tests for read-only shareable session
 * snapshots: capture with/without redactions and expiry, redaction-at-capture
 * (persisted blob is already clean), public read incrementing view_count and
 * writing an access audit row, server-side expiry + revoke enforcement (410),
 * unknown token (404), idempotent revoke, delete (snapshot + audit), the
 * redaction options endpoint, and create-time validation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

// Set up test database BEFORE requiring any server modules
const TEST_DB = path.join(os.tmpdir(), `dashboard-snapshots-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");

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
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function post(urlPath, body) {
  return fetch(urlPath, { method: "POST", body });
}

function del(urlPath) {
  return fetch(urlPath, { method: "DELETE" });
}

/**
 * Seed a session plus one agent (with a task) and one event (with data +
 * summary) so redaction assertions have something to null out. Returns the
 * session id.
 */
function seedSession(suffix) {
  const sessionId = `snap-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at, updated_at, transcript_path) VALUES (?, ?, 'active', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)"
  ).run(sessionId, "Seed session", "/Users/leo/secret-project", "claude-opus-4-8", "/tmp/t.jsonl");
  db.prepare(
    "INSERT INTO agents (id, session_id, name, type, status, task, started_at, updated_at) VALUES (?, ?, ?, 'main', 'working', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  ).run(`${sessionId}-main`, sessionId, "Main Agent", "Do the secret thing");
  db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, 'PreToolUse', 'Bash', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  ).run(
    `${sessionId}`,
    `${sessionId}-main`,
    "ran a command",
    JSON.stringify({ cmd: "ls /secret" })
  );
  return sessionId;
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

describe("Snapshot options", () => {
  it("lists the redaction keys", async () => {
    const res = await fetch("/api/snapshots/options");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.redactions));
    const keys = res.body.redactions.map((r) => r.key);
    assert.deepEqual(
      keys.sort(),
      ["agent_tasks", "event_data", "event_summaries", "file_paths"].sort()
    );
    for (const r of res.body.redactions) {
      assert.ok(typeof r.label === "string" && r.label.length > 0);
    }
  });
});

describe("Snapshot creation", () => {
  it("creates a snapshot without redactions/expiry — active, has token, full payload", async () => {
    const sessionId = seedSession("plain");
    const res = await post("/api/snapshots", { session_id: sessionId, title: "Plain snap" });
    assert.equal(res.status, 201);
    const snap = res.body.snapshot;
    assert.ok(/^[0-9a-f]{48}$/.test(snap.token), "token is 48 hex chars");
    assert.equal(snap.session_id, sessionId);
    assert.equal(snap.title, "Plain snap");
    assert.equal(snap.status, "active");
    assert.equal(snap.view_count, 0);
    assert.deepEqual(snap.redactions, []);
    assert.equal(snap.revoked_at, null);
    assert.equal(snap.expires_at, null);

    // Public read returns an un-redacted payload.
    const view = await fetch(`/api/snapshots/${snap.token}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.snapshot.read_only, true);
    assert.ok(view.body.payload.captured_at);
    assert.equal(view.body.payload.session.cwd, "/Users/leo/secret-project");
    assert.equal(view.body.payload.session.transcript_path, "/tmp/t.jsonl");
    assert.equal(view.body.payload.agents[0].task, "Do the secret thing");
    assert.deepEqual(view.body.payload.events[0].data, JSON.stringify({ cmd: "ls /secret" }));
    assert.equal(view.body.payload.events[0].summary, "ran a command");
  });

  it("applies redactions AT CAPTURE — redacted fields null, others intact", async () => {
    const sessionId = seedSession("redact");
    const res = await post("/api/snapshots", {
      session_id: sessionId,
      redactions: ["file_paths", "event_data", "agent_tasks", "event_summaries"],
    });
    assert.equal(res.status, 201);
    const token = res.body.snapshot.token;
    assert.deepEqual(
      res.body.snapshot.redactions.sort(),
      ["agent_tasks", "event_data", "event_summaries", "file_paths"].sort()
    );

    const view = await fetch(`/api/snapshots/${token}`);
    assert.equal(view.status, 200);
    const p = view.body.payload;
    // Redacted
    assert.equal(p.session.cwd, null);
    assert.equal(p.session.transcript_path, null);
    assert.equal(p.events[0].data, null);
    assert.equal(p.agents[0].task, null);
    assert.equal(p.events[0].summary, null);
    // Not redacted — still present
    assert.equal(p.session.id, sessionId);
    assert.equal(p.events[0].event_type, "PreToolUse");
    assert.equal(p.agents[0].name, "Main Agent");
  });

  it("redacts only the chosen keys (event_data only)", async () => {
    const sessionId = seedSession("partial");
    const res = await post("/api/snapshots", {
      session_id: sessionId,
      redactions: ["event_data"],
    });
    assert.equal(res.status, 201);
    const view = await fetch(`/api/snapshots/${res.body.snapshot.token}`);
    const p = view.body.payload;
    assert.equal(p.events[0].data, null); // redacted
    assert.equal(p.session.cwd, "/Users/leo/secret-project"); // not redacted
    assert.equal(p.agents[0].task, "Do the secret thing"); // not redacted
    assert.equal(p.events[0].summary, "ran a command"); // not redacted
  });

  it("supports an expiry window", async () => {
    const sessionId = seedSession("expiry");
    const res = await post("/api/snapshots", { session_id: sessionId, expires_in_hours: 24 });
    assert.equal(res.status, 201);
    assert.ok(res.body.snapshot.expires_at);
    assert.equal(res.body.snapshot.status, "active");
    assert.ok(Date.parse(res.body.snapshot.expires_at) > Date.now());
  });

  it("404s for an unknown session", async () => {
    const res = await post("/api/snapshots", { session_id: "does-not-exist" });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("400s for an unknown redaction key", async () => {
    const sessionId = seedSession("badkey");
    const res = await post("/api/snapshots", {
      session_id: sessionId,
      redactions: ["file_paths", "ssn"],
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
    assert.match(res.body.error.message, /unknown redaction key/);
  });

  it("400s for a non-positive expiry", async () => {
    const sessionId = seedSession("badexpiry");
    const res = await post("/api/snapshots", { session_id: sessionId, expires_in_hours: -5 });
    assert.equal(res.status, 400);
  });

  it("400s without a session_id", async () => {
    const res = await post("/api/snapshots", { title: "no session" });
    assert.equal(res.status, 400);
  });
});

describe("Snapshot list", () => {
  it("returns snapshots newest first", async () => {
    const a = seedSession("list-a");
    const b = seedSession("list-b");
    const first = await post("/api/snapshots", { session_id: a });
    const second = await post("/api/snapshots", { session_id: b });

    const res = await fetch("/api/snapshots");
    assert.equal(res.status, 200);
    const tokens = res.body.snapshots.map((s) => s.token);
    const iFirst = tokens.indexOf(first.body.snapshot.token);
    const iSecond = tokens.indexOf(second.body.snapshot.token);
    assert.ok(iFirst >= 0 && iSecond >= 0);
    assert.ok(iSecond < iFirst, "newer snapshot appears before older one");
  });
});

describe("Public read + audit", () => {
  it("increments view_count and writes create + access audit rows", async () => {
    const sessionId = seedSession("audit");
    const created = await post("/api/snapshots", { session_id: sessionId });
    const token = created.body.snapshot.token;

    await fetch(`/api/snapshots/${token}`);
    await fetch(`/api/snapshots/${token}`);

    // view_count reflects both reads
    const list = await fetch("/api/snapshots");
    const meta = list.body.snapshots.find((s) => s.token === token);
    assert.equal(meta.view_count, 2);

    const audit = await fetch(`/api/snapshots/${token}/audit`);
    assert.equal(audit.status, 200);
    const actions = audit.body.audit.map((a) => a.action);
    assert.ok(actions.includes("create"));
    assert.equal(actions.filter((a) => a === "access").length, 2);
    // newest first
    assert.equal(audit.body.audit[0].action, "access");
  });

  it("404s for an unknown token (no audit row created)", async () => {
    const res = await fetch("/api/snapshots/deadbeef");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
    // No snapshot exists, so an audit fetch is also 404.
    const audit = await fetch("/api/snapshots/deadbeef/audit");
    assert.equal(audit.status, 404);
  });
});

describe("Expiry + revoke enforcement", () => {
  it("returns 410 + access_denied(expired) for an expired snapshot", async () => {
    const sessionId = seedSession("expired");
    const created = await post("/api/snapshots", { session_id: sessionId, expires_in_hours: 24 });
    const token = created.body.snapshot.token;

    // Force expiry into the past directly in the DB.
    db.prepare(
      "UPDATE snapshots SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') WHERE token = ?"
    ).run(token);

    const view = await fetch(`/api/snapshots/${token}`);
    assert.equal(view.status, 410);

    // status reflects expiry, and the access_denied(expired) audit row is present.
    const list = await fetch("/api/snapshots");
    assert.equal(list.body.snapshots.find((s) => s.token === token).status, "expired");

    const audit = await fetch(`/api/snapshots/${token}/audit`);
    const denied = audit.body.audit.find((a) => a.action === "access_denied");
    assert.ok(denied);
    assert.equal(denied.detail, "expired");
  });

  it("returns 410 + access_denied(revoked) after revoke, idempotently", async () => {
    const sessionId = seedSession("revoke");
    const created = await post("/api/snapshots", { session_id: sessionId });
    const token = created.body.snapshot.token;

    const r1 = await post(`/api/snapshots/${token}/revoke`);
    assert.equal(r1.status, 200);
    assert.equal(r1.body.snapshot.status, "revoked");
    assert.ok(r1.body.snapshot.revoked_at);

    // Idempotent: a second revoke keeps the original revoked_at.
    const r2 = await post(`/api/snapshots/${token}/revoke`);
    assert.equal(r2.status, 200);
    assert.equal(r2.body.snapshot.revoked_at, r1.body.snapshot.revoked_at);

    const view = await fetch(`/api/snapshots/${token}`);
    assert.equal(view.status, 410);

    const audit = await fetch(`/api/snapshots/${token}/audit`);
    const denied = audit.body.audit.find((a) => a.action === "access_denied");
    assert.ok(denied);
    assert.equal(denied.detail, "revoked");
    assert.equal(audit.body.audit.filter((a) => a.action === "revoke").length, 2);
  });

  it("404s when revoking an unknown token", async () => {
    const res = await post("/api/snapshots/deadbeef/revoke");
    assert.equal(res.status, 404);
  });
});

describe("Snapshot delete", () => {
  it("removes the snapshot and its audit rows", async () => {
    const sessionId = seedSession("delete");
    const created = await post("/api/snapshots", { session_id: sessionId });
    const token = created.body.snapshot.token;
    await fetch(`/api/snapshots/${token}`); // create + access audit rows

    const res = await del(`/api/snapshots/${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    // Gone from the list, the public read, and the audit endpoint.
    const list = await fetch("/api/snapshots");
    assert.ok(!list.body.snapshots.some((s) => s.token === token));
    assert.equal((await fetch(`/api/snapshots/${token}`)).status, 404);
    assert.equal((await fetch(`/api/snapshots/${token}/audit`)).status, 404);

    // Audit rows are physically gone.
    const remaining = db
      .prepare("SELECT COUNT(*) AS n FROM snapshot_audit WHERE snapshot_token = ?")
      .get(token).n;
    assert.equal(remaining, 0);

    const again = await del(`/api/snapshots/${token}`);
    assert.equal(again.status, 404);
  });
});

describe("Audit log accumulation", () => {
  it("accumulates create → access → revoke in order", async () => {
    const sessionId = seedSession("accumulate");
    const created = await post("/api/snapshots", { session_id: sessionId });
    const token = created.body.snapshot.token;

    await fetch(`/api/snapshots/${token}`);
    await post(`/api/snapshots/${token}/revoke`);

    const audit = await fetch(`/api/snapshots/${token}/audit`);
    const actions = audit.body.audit.map((a) => a.action);
    assert.ok(actions.includes("create"));
    assert.ok(actions.includes("access"));
    assert.ok(actions.includes("revoke"));
  });
});

describe("Snapshot hardening (review follow-ups)", () => {
  it("never exposes session/agent metadata in the public payload", async () => {
    const sessionId = `snap-meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      "INSERT INTO sessions (id, name, status, started_at, updated_at, metadata) VALUES (?, 'meta', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)"
    ).run(sessionId, JSON.stringify({ secret_api_key: "sk-LEAKED-123" }));
    db.prepare(
      "INSERT INTO agents (id, session_id, name, type, status, started_at, updated_at, metadata) VALUES (?, ?, 'Main', 'main', 'working', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)"
    ).run(`${sessionId}-main`, sessionId, JSON.stringify({ agent_secret: "TOKEN-XYZ" }));

    // No redactions selected — metadata must STILL be stripped (always-on).
    const created = await post("/api/snapshots", { session_id: sessionId });
    assert.equal(created.status, 201);
    const view = await fetch(`/api/snapshots/${created.body.snapshot.token}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.payload.session.metadata, null);
    for (const a of view.body.payload.agents) assert.equal(a.metadata, null);
    assert.ok(!JSON.stringify(view.body.payload).includes("sk-LEAKED-123"));
    assert.ok(!JSON.stringify(view.body.payload).includes("TOKEN-XYZ"));
  });

  it("file_paths redaction also scrubs path keys inside event.data", async () => {
    const sessionId = `snap-evpath-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      "INSERT INTO sessions (id, name, status, started_at, updated_at) VALUES (?, 'evpath', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    ).run(sessionId);
    db.prepare(
      "INSERT INTO events (session_id, event_type, tool_name, summary, data, created_at) VALUES (?, 'PreToolUse', 'Bash', 's', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    ).run(
      sessionId,
      JSON.stringify({ cwd: "/Users/leo/secret", transcript_path: "/tmp/t.jsonl", cmd: "ls" })
    );

    const created = await post("/api/snapshots", {
      session_id: sessionId,
      redactions: ["file_paths"],
    });
    const view = await fetch(`/api/snapshots/${created.body.snapshot.token}`);
    const data = JSON.parse(view.body.payload.events[0].data);
    assert.ok(!("cwd" in data), "cwd path key stripped from event.data");
    assert.ok(!("transcript_path" in data), "transcript_path stripped from event.data");
    assert.equal(data.cmd, "ls", "non-path keys are preserved");
  });

  it("rejects an absurdly large expires_in_hours instead of 500ing", async () => {
    const sessionId = seedSession("bigexpiry");
    const r = await post("/api/snapshots", { session_id: sessionId, expires_in_hours: 1e16 });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, "INVALID_INPUT");
  });

  it("treats a corrupt expires_at as expired (fail-closed)", async () => {
    const sessionId = seedSession("corruptexp");
    const created = await post("/api/snapshots", { session_id: sessionId });
    const token = created.body.snapshot.token;
    db.prepare("UPDATE snapshots SET expires_at = 'not-a-date' WHERE token = ?").run(token);
    const view = await fetch(`/api/snapshots/${token}`);
    assert.equal(view.status, 410);
  });
});
