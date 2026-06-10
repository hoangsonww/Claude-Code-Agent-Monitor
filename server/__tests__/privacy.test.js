/**
 * @file Tests for ingest-time privacy controls: policy CRUD + validation,
 * built-in detectors over nested payloads, custom key/value rules with all
 * four actions, hash stability, summary sanitization on ingest + broadcast
 * shapes, the non-persisting preview endpoint, opt-in detectors, disabled
 * policy passthrough, and large-payload behavior.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

// Set up test database BEFORE requiring any server modules
const TEST_DB = path.join(os.tmpdir(), `dashboard-privacy-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp, startServer } = require("../index");
const { db } = require("../db");
const { DEFAULT_POLICY } = require("../lib/privacy");

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

function put(urlPath, body) {
  return fetch(urlPath, { method: "PUT", body });
}

function postHook(hookType, data) {
  return post("/api/hooks/event", { hook_type: hookType, data });
}

function lastEventFor(sessionId) {
  return db
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY id DESC LIMIT 1")
    .get(sessionId);
}

async function resetPolicy(policy) {
  const res = await put("/api/privacy", { policy: policy || DEFAULT_POLICY });
  assert.equal(res.status, 200);
  return res.body.policy;
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

beforeEach(async () => {
  await resetPolicy();
});

describe("Privacy policy API", () => {
  it("returns the conservative default policy", async () => {
    const res = await fetch("/api/privacy");
    assert.equal(res.status, 200);
    assert.equal(res.body.policy.enabled, true);
    assert.equal(res.body.policy.detectors.secret_keys, true);
    assert.equal(res.body.policy.detectors.api_key_formats, true);
    assert.equal(res.body.policy.detectors.email_addresses, false);
    assert.equal(res.body.policy.detectors.home_paths, false);
    assert.equal(res.body.policy.default_action, "mask");
    assert.deepEqual(res.body.policy.rules, []);
    assert.ok(Array.isArray(res.body.actions));
    assert.ok(Array.isArray(res.body.match_types));
  });

  it("rejects invalid policies", async () => {
    const badRegex = await put("/api/privacy", {
      policy: {
        rules: [{ name: "broken", match_type: "value", pattern: "([", action: "mask" }],
      },
    });
    assert.equal(badRegex.status, 400);
    assert.match(badRegex.body.error.message, /invalid regex/);

    const badAction = await put("/api/privacy", {
      policy: {
        rules: [{ name: "bad", match_type: "key", pattern: "x", action: "explode" }],
      },
    });
    assert.equal(badAction.status, 400);

    const dropFieldOnValue = await put("/api/privacy", {
      policy: {
        rules: [{ name: "bad", match_type: "value", pattern: "x", action: "drop_field" }],
      },
    });
    assert.equal(dropFieldOnValue.status, 400);
    assert.match(dropFieldOnValue.body.error.message, /drop_field requires/);
  });

  it("normalizes and persists a valid policy", async () => {
    const saved = await put("/api/privacy", {
      policy: {
        enabled: true,
        detectors: { email_addresses: true },
        rules: [{ name: "Cust rule", match_type: "key", pattern: "internal", action: "mask" }],
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.policy.detectors.email_addresses, true);
    // Untouched detectors keep their defaults
    assert.equal(saved.body.policy.detectors.secret_keys, true);
    assert.ok(saved.body.policy.rules[0].id, "rule gets a generated id");
    assert.equal(saved.body.policy.rules[0].enabled, true);

    const reread = await fetch("/api/privacy");
    assert.equal(reread.body.policy.rules.length, 1);
  });
});

describe("Ingest-time sanitization", () => {
  it("masks secrets in nested objects and arrays before persisting", async () => {
    const sessionId = `privacy-nested-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: {
        command: "curl -H 'Authorization: Bearer abc123def456ghi789' https://x.test",
        env: [{ api_key: "super-secret-value" }, { harmless: "keep-me" }],
        nested: { deeper: { password: "hunter2" } },
      },
    });

    const row = lastEventFor(sessionId);
    assert.ok(row, "event stored");
    const stored = JSON.parse(row.data);

    assert.ok(!row.data.includes("abc123def456ghi789"), "bearer token gone");
    assert.ok(!row.data.includes("super-secret-value"), "api_key value gone");
    assert.ok(!row.data.includes("hunter2"), "deep password gone");
    assert.equal(stored.tool_input.env[1].harmless, "keep-me", "non-secret fields untouched");
    assert.ok(stored._privacy, "redaction metadata present");
    assert.ok(stored._privacy.rules_applied >= 3);
    assert.ok(stored._privacy.fields_masked >= 3);
    assert.equal(stored._privacy.payload_dropped, false);
  });

  it("catches common API key formats and private key blocks in strings", async () => {
    const sessionId = `privacy-formats-${Date.now()}`;
    await postHook("PostToolUse", {
      session_id: sessionId,
      tool_name: "Read",
      tool_response: {
        content:
          "found sk-ant-api03-AbCdEfGh1234567890 and ghp_aaaabbbbccccdddd1111222233334444 plus\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow…\n-----END RSA PRIVATE KEY-----",
      },
    });

    const row = lastEventFor(sessionId);
    assert.ok(!row.data.includes("sk-ant-api03"), "anthropic key gone");
    assert.ok(!row.data.includes("ghp_aaaabbbbccccdddd"), "github token gone");
    assert.ok(!row.data.includes("BEGIN RSA PRIVATE KEY"), "private key block gone");
    assert.ok(row.data.includes("[REDACTED:api_key_formats]"));
    assert.ok(row.data.includes("[REDACTED:private_key_blocks]"));
  });

  it("sanitizes the summary on both the stored row and the ingest response", async () => {
    const sessionId = `privacy-summary-${Date.now()}`;
    const res = await postHook("Notification", {
      session_id: sessionId,
      message: "Login failed for token Bearer zzz999yyy888xxx777",
    });
    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(res.body.event).includes("zzz999yyy888xxx777"));

    const row = lastEventFor(sessionId);
    assert.ok(!row.summary.includes("zzz999yyy888xxx777"));
    assert.ok(row.summary.includes("[REDACTED:bearer_tokens]"));
  });

  it("hashes instead of masking when default_action=hash, with stable output", async () => {
    await resetPolicy({ ...DEFAULT_POLICY, default_action: "hash" });

    const sessionId = `privacy-hash-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: { api_key: "stable-secret-input" },
    });
    const stored = JSON.parse(lastEventFor(sessionId).data);
    const hashed = stored.tool_input.api_key;
    assert.match(hashed, /^sha256:[0-9a-f]{12}$/);

    // Same input through the preview endpoint → same digest (correlation works)
    const preview = await post("/api/privacy/preview", {
      data: { api_key: "stable-secret-input" },
    });
    assert.equal(preview.body.after.api_key, hashed);

    const different = await post("/api/privacy/preview", {
      data: { api_key: "another-secret" },
    });
    assert.notEqual(different.body.after.api_key, hashed);
  });

  it("applies custom drop_field and drop_event_payload rules", async () => {
    await resetPolicy({
      ...DEFAULT_POLICY,
      rules: [
        { name: "drop notes", match_type: "key", pattern: "^internal_note$", action: "drop_field" },
        {
          name: "kill classified",
          match_type: "value",
          pattern: "TOPSECRET",
          action: "drop_event_payload",
        },
      ],
    });

    const sessionA = `privacy-dropfield-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionA,
      tool_name: "Bash",
      tool_input: { command: "ls", internal_note: "do not store this" },
    });
    const a = JSON.parse(lastEventFor(sessionA).data);
    assert.equal(a.tool_input.internal_note, undefined, "field dropped");
    assert.equal(a.tool_input.command, "ls");
    assert.ok(a._privacy.fields_dropped >= 1);

    const sessionB = `privacy-droppayload-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionB,
      tool_name: "Bash",
      tool_input: { command: "cat TOPSECRET-file" },
    });
    const b = JSON.parse(lastEventFor(sessionB).data);
    assert.equal(b.tool_input, undefined, "payload reduced to metadata stub");
    assert.equal(b.session_id, sessionB, "operational metadata preserved");
    assert.equal(b.tool_name, "Bash");
    assert.equal(b._privacy.payload_dropped, true);
  });

  it("leaves payloads untouched when the policy is disabled", async () => {
    await resetPolicy({ ...DEFAULT_POLICY, enabled: false });

    const sessionId = `privacy-disabled-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: { api_key: "raw-when-disabled" },
    });
    const row = lastEventFor(sessionId);
    assert.ok(row.data.includes("raw-when-disabled"));
    assert.ok(!row.data.includes("_privacy"));
  });

  it("opt-in detectors (emails, home paths) work when enabled", async () => {
    await resetPolicy({
      ...DEFAULT_POLICY,
      detectors: { ...DEFAULT_POLICY.detectors, email_addresses: true, home_paths: true },
    });

    const sessionId = `privacy-optin-${Date.now()}`;
    await postHook("PreToolUse", {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: {
        command: "mail alice@example.com < /Users/alice/notes.txt",
        win: "C:\\Users\\alice\\file.txt",
      },
    });
    const row = lastEventFor(sessionId);
    assert.ok(!row.data.includes("alice@example.com"));
    assert.ok(!row.data.includes("/Users/alice"));
    assert.ok(!row.data.includes("C:\\\\Users\\\\alice"), "windows home path gone");
  });

  it("survives large payloads without failing ingestion", async () => {
    const sessionId = `privacy-large-${Date.now()}`;
    const big = "x".repeat(500_000); // beyond the per-string scan cap
    const res = await postHook("PreToolUse", {
      session_id: sessionId,
      tool_name: "Write",
      tool_input: { content: big, api_key: "still-caught-by-key-detector" },
    });
    assert.equal(res.status, 200);
    const stored = JSON.parse(lastEventFor(sessionId).data);
    // Key-based detection is size-independent; oversized strings skip value
    // regexes but never break ingestion.
    assert.ok(!JSON.stringify(stored).includes("still-caught-by-key-detector"));
    assert.equal(stored.tool_input.content.length, big.length);
  });
});

describe("Preview endpoint", () => {
  it("shows before/after without persisting anything", async () => {
    const countBefore = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
    const res = await post("/api/privacy/preview", {
      data: { token: "abc", note: "fine" },
      summary: "uses Bearer abcdefgh12345678",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.before.token, "abc");
    assert.equal(res.body.after.token, "[REDACTED:secret_keys]");
    assert.equal(res.body.after.note, "fine");
    assert.ok(res.body.meta.rules_applied >= 1);
    assert.ok(res.body.summary_after.includes("[REDACTED:bearer_tokens]"));

    const countAfter = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
    assert.equal(countAfter, countBefore, "preview persisted nothing");
  });

  it("supports previewing a draft policy without saving it", async () => {
    const res = await post("/api/privacy/preview", {
      data: { codename: "PROJECT-X" },
      policy: {
        ...DEFAULT_POLICY,
        rules: [{ name: "codenames", match_type: "value", pattern: "PROJECT-X", action: "mask" }],
      },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.after.codename.includes("[REDACTED:codenames]"));

    // The draft was not persisted
    const active = await fetch("/api/privacy");
    assert.equal(active.body.policy.rules.length, 0);
  });

  it("rejects non-object samples and invalid draft policies", async () => {
    const badData = await post("/api/privacy/preview", { data: "just a string" });
    assert.equal(badData.status, 400);

    const badPolicy = await post("/api/privacy/preview", {
      data: { x: 1 },
      policy: { rules: [{ name: "b", match_type: "value", pattern: "([", action: "mask" }] },
    });
    assert.equal(badPolicy.status, 400);
  });
});
