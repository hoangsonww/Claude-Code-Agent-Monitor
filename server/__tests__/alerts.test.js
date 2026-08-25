/**
 * @file Tests for the rules-based alerting engine: rule CRUD validation,
 * event-driven evaluation on hook ingest (pattern match, count-in-window
 * threshold, token threshold), cooldown dedup, the time-based sweep
 * (inactivity, stuck-agent status duration), and acknowledge endpoints.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

// Set up test database BEFORE requiring any server modules
const TEST_DB = path.join(os.tmpdir(), `dashboard-alerts-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");
const { sweepTimeRules, evaluateEvent } = require("../lib/alerts");

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

function patch(urlPath, body) {
  return fetch(urlPath, { method: "PATCH", body });
}

function del(urlPath) {
  return fetch(urlPath, { method: "DELETE" });
}

function postHook(hookType, data) {
  return post("/api/hooks/event", { hook_type: hookType, data });
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

describe("Alert rule CRUD", () => {
  it("rejects a rule without a name", async () => {
    const res = await post("/api/alerts/rules", {
      rule_type: "inactivity",
      config: { minutes: 5 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("rejects an unknown rule_type", async () => {
    const res = await post("/api/alerts/rules", {
      name: "bad",
      rule_type: "nope",
      config: {},
    });
    assert.equal(res.status, 400);
  });

  it("rejects event_pattern without any pattern field", async () => {
    const res = await post("/api/alerts/rules", {
      name: "bad pattern",
      rule_type: "event_pattern",
      config: { count: 2 },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /at least one/);
  });

  it("rejects invalid type-specific config values", async () => {
    const badMinutes = await post("/api/alerts/rules", {
      name: "bad minutes",
      rule_type: "inactivity",
      config: { minutes: -3 },
    });
    assert.equal(badMinutes.status, 400);

    const badStatus = await post("/api/alerts/rules", {
      name: "bad status",
      rule_type: "status_duration",
      config: { status: "completed", minutes: 5 },
    });
    assert.equal(badStatus.status, 400);

    const badTokens = await post("/api/alerts/rules", {
      name: "bad tokens",
      rule_type: "token_threshold",
      config: { total_tokens: 0 },
    });
    assert.equal(badTokens.status, 400);
  });

  it("creates, lists, updates, and deletes a rule", async () => {
    const created = await post("/api/alerts/rules", {
      name: "CRUD rule",
      rule_type: "inactivity",
      config: { minutes: 30 },
    });
    assert.equal(created.status, 201);
    const rule = created.body.rule;
    assert.ok(rule.id);
    assert.equal(rule.enabled, true);
    assert.equal(rule.cooldown_seconds, 300);
    assert.deepEqual(rule.config, { minutes: 30 });

    const list = await fetch("/api/alerts/rules");
    assert.equal(list.status, 200);
    assert.ok(list.body.rules.some((r) => r.id === rule.id));

    const updated = await patch(`/api/alerts/rules/${rule.id}`, {
      name: "CRUD rule v2",
      enabled: false,
      cooldown_seconds: 60,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.rule.name, "CRUD rule v2");
    assert.equal(updated.body.rule.enabled, false);
    assert.equal(updated.body.rule.cooldown_seconds, 60);

    const badPatch = await patch(`/api/alerts/rules/${rule.id}`, {
      config: { minutes: "soon" },
    });
    assert.equal(badPatch.status, 400);

    const deleted = await del(`/api/alerts/rules/${rule.id}`);
    assert.equal(deleted.status, 200);
    const again = await del(`/api/alerts/rules/${rule.id}`);
    assert.equal(again.status, 404);
  });
});

describe("Event-driven alert evaluation", () => {
  it("fires on a matching event and dedups within cooldown", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Bash watcher",
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-pattern-${Date.now()}`;
    await postHook("PreToolUse", { session_id: sessionId, tool_name: "Bash" });

    let feed = await fetch("/api/alerts");
    let fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].session_id, sessionId);
    assert.equal(fired[0].rule_name, "Bash watcher");
    assert.equal(fired[0].acknowledged_at, null);

    // Second matching event inside the 300s default cooldown — no new alert.
    await postHook("PreToolUse", { session_id: sessionId, tool_name: "Bash" });
    feed = await fetch("/api/alerts");
    fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("only fires a count threshold once N events land in the window", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Error burst",
      rule_type: "event_pattern",
      config: { event_type: "BurstProbe", count: 3, window_minutes: 5 },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-burst-${Date.now()}`;
    await postHook("BurstProbe", { session_id: sessionId });
    await postHook("BurstProbe", { session_id: sessionId });

    let feed = await fetch("/api/alerts");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 0);

    await postHook("BurstProbe", { session_id: sessionId });
    feed = await fetch("/api/alerts");
    const fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);
    assert.match(fired[0].message, /3 matching events/);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("counts only literal matches when summary_contains holds a LIKE metacharacter", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Percent burst",
      rule_type: "event_pattern",
      config: { event_type: "LikeProbe", summary_contains: "%", count: 2, window_minutes: 5 },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-like-${Date.now()}`;
    db.prepare(
      "INSERT INTO sessions (id, name, status, started_at, updated_at) VALUES (?, ?, 'active', ?, ?)"
    ).run(sessionId, "like probe", new Date().toISOString(), new Date().toISOString());

    // Only one of these summaries literally contains "%". An unescaped LIKE
    // pattern of "%%%" would match all three and fire the count-2 rule.
    const insertEvent = db.prepare(
      "INSERT INTO events (session_id, event_type, summary, created_at) VALUES (?, 'LikeProbe', ?, ?)"
    );
    for (const summary of ["100% done", "no percent", "still none"]) {
      insertEvent.run(sessionId, summary, new Date().toISOString());
    }

    // matchesPattern gates on the literal substring, so drive evaluation with
    // the one event that genuinely contains "%".
    evaluateEvent({
      session_id: sessionId,
      agent_id: null,
      event_type: "LikeProbe",
      tool_name: null,
      summary: "100% done",
    });

    const feed = await fetch("/api/alerts");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 0);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("fires when session token usage crosses the threshold", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Token spike",
      rule_type: "token_threshold",
      config: { total_tokens: 1000000 },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-tokens-${Date.now()}`;
    // Seed the session, then push usage past the threshold directly.
    await postHook("SessionStart", { session_id: sessionId });
    stmts.upsertTokenUsage.run(sessionId, "claude-test-model", 700000, 600000, 0, 0);

    // PostToolUse is a token-bearing event type, so evaluation runs.
    await postHook("PostToolUse", { session_id: sessionId, tool_name: "Read" });

    const feed = await fetch("/api/alerts");
    const fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].session_id, sessionId);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("does not fire disabled rules", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Disabled watcher",
      rule_type: "event_pattern",
      config: { tool_name: "Grep" },
      enabled: false,
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-disabled-${Date.now()}`;
    await postHook("PreToolUse", { session_id: sessionId, tool_name: "Grep" });

    const feed = await fetch("/api/alerts");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 0);

    await del(`/api/alerts/rules/${ruleId}`);
  });
});

describe("Time-based alert sweep", () => {
  it("fires inactivity alerts for stale active sessions", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Idle session",
      rule_type: "inactivity",
      config: { minutes: 30 },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-idle-${Date.now()}`;
    await postHook("SessionStart", { session_id: sessionId });
    // Backdate the session's last activity to one hour ago.
    db.prepare(
      "UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 minutes') WHERE id = ?"
    ).run(sessionId);

    sweepTimeRules();

    const feed = await fetch("/api/alerts");
    const fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].session_id, sessionId);

    // Re-sweeping inside the cooldown must not duplicate the alert.
    sweepTimeRules();
    const again = await fetch("/api/alerts");
    assert.equal(again.body.alerts.filter((a) => a.rule_id === ruleId).length, 1);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("fires status_duration alerts for stuck agents", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Stuck agent",
      rule_type: "status_duration",
      config: { status: "working", minutes: 10 },
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-stuck-${Date.now()}`;
    await postHook("SessionStart", { session_id: sessionId });
    // ensureSession created `<id>-main` as working; backdate its activity.
    db.prepare(
      "UPDATE agents SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-20 minutes') WHERE id = ?"
    ).run(`${sessionId}-main`);

    sweepTimeRules();

    const feed = await fetch("/api/alerts");
    const fired = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(fired.length, 1);
    assert.equal(fired[0].agent_id, `${sessionId}-main`);
    assert.equal(fired[0].session_id, sessionId);

    await del(`/api/alerts/rules/${ruleId}`);
  });
});

describe("Alert feed and acknowledgement", () => {
  it("acks a single alert, filters unacked, and acks all", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Ack target",
      rule_type: "event_pattern",
      config: { event_type: "AckProbe" },
      cooldown_seconds: 0,
    });
    assert.equal(created.status, 201);
    const ruleId = created.body.rule.id;

    const sessionA = `alerts-ack-a-${Date.now()}`;
    const sessionB = `alerts-ack-b-${Date.now()}`;
    await postHook("AckProbe", { session_id: sessionA });
    await postHook("AckProbe", { session_id: sessionB });

    let feed = await fetch("/api/alerts?unacked=true");
    const mine = feed.body.alerts.filter((a) => a.rule_id === ruleId);
    assert.equal(mine.length, 2);

    const ackOne = await post(`/api/alerts/${mine[0].id}/ack`);
    assert.equal(ackOne.status, 200);
    assert.ok(ackOne.body.alert.acknowledged_at);

    feed = await fetch("/api/alerts?unacked=true");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 1);

    const missing = await post("/api/alerts/999999/ack");
    assert.equal(missing.status, 404);

    const ackAll = await post("/api/alerts/ack-all");
    assert.equal(ackAll.status, 200);
    assert.ok(ackAll.body.acknowledged >= 1);

    feed = await fetch("/api/alerts?unacked=true");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 0);
    assert.equal(feed.body.unacked, 0);

    await del(`/api/alerts/rules/${ruleId}`);
  });

  it("deleting a rule cascades its alert history away", async () => {
    const created = await post("/api/alerts/rules", {
      name: "Cascade check",
      rule_type: "event_pattern",
      config: { event_type: "CascadeProbe" },
    });
    const ruleId = created.body.rule.id;

    const sessionId = `alerts-cascade-${Date.now()}`;
    await postHook("CascadeProbe", { session_id: sessionId });

    let feed = await fetch("/api/alerts");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 1);

    await del(`/api/alerts/rules/${ruleId}`);
    feed = await fetch("/api/alerts");
    assert.equal(feed.body.alerts.filter((a) => a.rule_id === ruleId).length, 0);
  });
});
