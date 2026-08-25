/**
 * @file Tests for the read-only alert rule preview (backtest) endpoint:
 * historical replay of event_pattern rules including the per-session
 * count-in-window and cooldown simulation, current-state evaluation of
 * inactivity / status_duration / token_threshold, input validation, and the
 * guarantee that a preview never persists, broadcasts, or delivers anything.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

// Set up test database BEFORE requiring any server modules
const TEST_DB = path.join(os.tmpdir(), `dashboard-preview-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");

let server;
let BASE;

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** ISO timestamp `secondsAgo` seconds in the past, in the schema's format. */
function ago(secondsAgo) {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

const SESSION_A = "preview-session-a";
const SESSION_B = "preview-session-b";

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  const insertSession = db.prepare(
    "INSERT INTO sessions (id, name, status, cwd, model, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insertSession.run(
    SESSION_A,
    "Session A",
    "active",
    "/tmp/a",
    "claude-opus-5",
    ago(3600),
    ago(30)
  );
  // Session B has not been touched for two hours — the inactivity case.
  insertSession.run(
    SESSION_B,
    "Session B",
    "active",
    "/tmp/b",
    "claude-opus-5",
    ago(7200),
    ago(7200)
  );

  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  // Six Bash calls on session A, 10s apart, all inside the last two minutes.
  for (let i = 0; i < 6; i++) {
    insertEvent.run(SESSION_A, null, "PreToolUse", "Bash", `npm run test ${i}`, ago(120 - i * 10));
  }
  // One Bash call on session B, and one non-matching tool on A.
  insertEvent.run(SESSION_B, null, "PreToolUse", "Bash", "git status", ago(60));
  insertEvent.run(SESSION_A, null, "PreToolUse", "Read", "read a file", ago(45));
  // An old event well outside a 1h lookback.
  insertEvent.run(SESSION_A, null, "PreToolUse", "Bash", "stale call", ago(60 * 60 * 40));
  // Summaries that expose SQL LIKE metacharacter handling: only the first
  // literally contains "%", and only the third literally contains "a_b".
  insertEvent.run(SESSION_A, null, "Notification", "Edit", "100% coverage", ago(40));
  insertEvent.run(SESSION_A, null, "Notification", "Edit", "no percent here", ago(39));
  insertEvent.run(SESSION_A, null, "Notification", "Edit", "value a_b set", ago(38));
  insertEvent.run(SESSION_A, null, "Notification", "Edit", "value axb set", ago(37));

  db.prepare(
    "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)"
  ).run(SESSION_A, "claude-opus-5", 900_000, 100_000);
});

after(() => {
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

describe("Alert rule preview — validation", () => {
  it("rejects an unknown rule_type", async () => {
    const res = await post("/api/alerts/rules/preview", { rule_type: "nope", config: {} });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("rejects a config the CRUD route would also reject", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { count: 2 },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /at least one/);
  });

  it("rejects a non-positive lookback_hours", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "inactivity",
      config: { minutes: 5 },
      lookback_hours: 0,
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /lookback_hours/);
  });

  it("rejects a negative cooldown_seconds", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      cooldown_seconds: -1,
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /cooldown_seconds/);
  });

  it("clamps an absurd lookback to the 30-day ceiling", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      lookback_hours: 100_000,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.preview.lookback_hours, 24 * 30);
  });
});

describe("Alert rule preview — event_pattern replay", () => {
  it("counts every match in the lookback window and honours the window bound", async () => {
    const res = await post("/api/alerts/rules/preview", {
      name: "Bash watcher",
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    assert.equal(res.status, 200);
    const p = res.body.preview;
    assert.equal(p.evaluated, "history");
    // 6 on session A + 1 on session B; the 40h-old row is excluded.
    assert.equal(p.matched_count, 7);
    assert.equal(p.would_fire_count, 7);
    assert.equal(p.suppressed_by_cooldown, 0);
    assert.equal(p.truncated, false);
  });

  it("renders sample messages in the same wording a real firing produces", async () => {
    const res = await post("/api/alerts/rules/preview", {
      name: "Bash watcher",
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    const sample = res.body.preview.samples[0];
    assert.equal(sample.message, "Bash watcher: event matched (PreToolUse · Bash)");
    assert.ok(sample.session_id);
    assert.equal(sample.session_name, "Session A");
  });

  it("applies the count-in-window threshold per session", async () => {
    const res = await post("/api/alerts/rules/preview", {
      name: "Bash burst",
      rule_type: "event_pattern",
      config: { tool_name: "Bash", count: 4, window_minutes: 5 },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    const p = res.body.preview;
    // Session A's 4th, 5th and 6th Bash calls each see >= 4 in the window.
    // Session B only ever has one, so it never crosses.
    assert.equal(p.would_fire_count, 3);
    assert.match(p.samples[0].message, /^Bash burst: 4 matching events in 5 min \(threshold 4\)$/);
    assert.equal(p.samples[0].details.observed_count, 4);
  });

  it("does not count events from a different session toward the window", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { tool_name: "Bash", count: 7, window_minutes: 5 },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    // 7 matching events exist overall, but no single session reaches 7.
    assert.equal(res.body.preview.matched_count, 7);
    assert.equal(res.body.preview.would_fire_count, 0);
  });

  it("suppresses repeat firings inside the simulated cooldown", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      lookback_hours: 1,
      cooldown_seconds: 300,
    });
    const p = res.body.preview;
    assert.equal(p.matched_count, 7);
    // One firing per session scope; the rest fall inside the 5 min cooldown.
    assert.equal(p.would_fire_count, 2);
    assert.equal(p.suppressed_by_cooldown, 5);
  });

  it("filters on summary_contains case-insensitively", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { summary_contains: "GIT STATUS" },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    assert.equal(res.body.preview.matched_count, 1);
    assert.equal(res.body.preview.samples[0].session_id, SESSION_B);
  });

  it("treats % in summary_contains as a literal, not a SQL wildcard", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { event_type: "Notification", summary_contains: "%" },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    // Exactly one seeded Notification summary contains a literal "%". Without
    // an ESCAPE clause the LIKE pattern would match all four.
    assert.equal(res.body.preview.matched_count, 1);
    assert.match(res.body.preview.samples[0].details.summary, /100% coverage/);
  });

  it("treats _ in summary_contains as a literal, not a single-character wildcard", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { event_type: "Notification", summary_contains: "a_b" },
      lookback_hours: 1,
      cooldown_seconds: 0,
    });
    // "value a_b set" matches literally; "value axb set" must not.
    assert.equal(res.body.preview.matched_count, 1);
    assert.match(res.body.preview.samples[0].details.summary, /a_b/);
  });

  it("caps returned samples at the requested limit without changing the counts", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "event_pattern",
      config: { tool_name: "Bash" },
      lookback_hours: 1,
      cooldown_seconds: 0,
      limit: 2,
    });
    assert.equal(res.body.preview.matched_count, 7);
    assert.equal(res.body.preview.samples.length, 2);
    assert.equal(res.body.preview.sample_limit, 2);
  });
});

describe("Alert rule preview — current-state rules", () => {
  it("reports inactive sessions for an inactivity rule", async () => {
    const res = await post("/api/alerts/rules/preview", {
      name: "Idle check",
      rule_type: "inactivity",
      config: { minutes: 60 },
    });
    const p = res.body.preview;
    assert.equal(p.evaluated, "current_state");
    assert.equal(p.matched_count, 1);
    assert.equal(p.samples[0].session_id, SESSION_B);
    assert.equal(p.samples[0].message, 'Idle check: no activity on "Session B" for 60 min');
  });

  it("reports no matches when the inactivity threshold is not reached", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "inactivity",
      config: { minutes: 600 },
    });
    assert.equal(res.body.preview.matched_count, 0);
    assert.deepEqual(res.body.preview.samples, []);
  });

  it("reports sessions already over a token threshold", async () => {
    const res = await post("/api/alerts/rules/preview", {
      name: "Token guard",
      rule_type: "token_threshold",
      config: { total_tokens: 500_000 },
      lookback_hours: 24,
    });
    const p = res.body.preview;
    assert.equal(p.evaluated, "current_state");
    assert.equal(p.matched_count, 1);
    assert.equal(p.samples[0].session_id, SESSION_A);
    assert.equal(p.samples[0].details.total_tokens, 1_000_000);
  });

  it("reports the candidate activity window it used for a token threshold", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "token_threshold",
      config: { total_tokens: 500_000 },
      lookback_hours: 24,
    });
    // The lookback is a candidate filter here, not a replay window, and the
    // response says so rather than leaving the client to infer it.
    assert.equal(res.body.preview.candidate_window_hours, 24);
  });

  it("excludes a session that can no longer fire a token rule", async () => {
    // Session B has been idle for two hours and receives no token-bearing
    // events, so evaluateEvent can never fire a token rule for it again.
    db.prepare(
      "INSERT INTO token_usage (session_id, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)"
    ).run(SESSION_B, "claude-opus-5", 5_000_000, 1_000_000);

    const wide = await post("/api/alerts/rules/preview", {
      rule_type: "token_threshold",
      config: { total_tokens: 500_000 },
      lookback_hours: 24,
    });
    assert.equal(wide.body.preview.matched_count, 2);

    const narrow = await post("/api/alerts/rules/preview", {
      rule_type: "token_threshold",
      config: { total_tokens: 500_000 },
      lookback_hours: 1,
    });
    const ids = narrow.body.preview.samples.map((sample) => sample.session_id);
    assert.deepEqual(ids, [SESSION_A]);
    assert.equal(narrow.body.preview.candidate_window_hours, 1);
  });

  it("reports nothing for a token threshold above every session", async () => {
    const res = await post("/api/alerts/rules/preview", {
      rule_type: "token_threshold",
      config: { total_tokens: 50_000_000 },
    });
    assert.equal(res.body.preview.matched_count, 0);
  });
});

describe("Alert rule preview — side effects", () => {
  it("never persists a rule or an alert", async () => {
    const rulesBefore = db.prepare("SELECT COUNT(*) as c FROM alert_rules").get().c;
    const alertsBefore = db.prepare("SELECT COUNT(*) as c FROM alert_events").get().c;

    for (const body of [
      { rule_type: "event_pattern", config: { tool_name: "Bash" }, cooldown_seconds: 0 },
      { rule_type: "inactivity", config: { minutes: 1 } },
      { rule_type: "status_duration", config: { status: "working", minutes: 1 } },
      { rule_type: "token_threshold", config: { total_tokens: 1 } },
    ]) {
      const res = await post("/api/alerts/rules/preview", body);
      assert.equal(res.status, 200);
    }

    assert.equal(db.prepare("SELECT COUNT(*) as c FROM alert_rules").get().c, rulesBefore);
    assert.equal(db.prepare("SELECT COUNT(*) as c FROM alert_events").get().c, alertsBefore);
  });
});
