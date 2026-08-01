/**
 * @file privacy.test.js
 * @description Unit + HTTP tests for ingest-time privacy redaction: built-in
 * detectors, settings persistence, preview endpoint, fail-safe behavior, and
 * hook event persistence under the active policy.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-privacy-"));
const dbPath = path.join(tmpDir, "test.db");
process.env.DASHBOARD_DB_PATH = dbPath;

const privacy = require("../lib/privacy");
const { stmts, db } = require("../db");

privacy.bindStmts(stmts);
privacy.invalidateCache();

function resetSettings(overrides = {}) {
  privacy.setPrivacySettings({
    ...privacy.DEFAULT_SETTINGS,
    ...overrides,
  });
}

describe("privacy.redactForStorage", () => {
  beforeEach(() => {
    resetSettings();
  });

  it("masks secret-like keys", () => {
    const { data, meta } = privacy.redactForStorage({
      api_key: "sk-ant-should-not-leak",
      nested: { password: "hunter2", ok: "visible" },
    });
    assert.equal(data.api_key, privacy.REDACTED);
    assert.equal(data.nested.password, privacy.REDACTED);
    assert.equal(data.nested.ok, "visible");
    assert.equal(data._privacy.redacted, true);
    assert.ok(meta.rules_applied >= 2);
  });

  it("masks nested secret value patterns", () => {
    const { data } = privacy.redactForStorage({
      tool_input: {
        command: "export KEY=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV && echo hi",
      },
      auth_header: "Bearer FAKESECRET_m4n5o6p7q8r9s0t1u2v3",
      github: "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    });
    assert.match(data.tool_input.command, /<redacted>/);
    assert.equal(data.auth_header, privacy.REDACTED); // key match
    assert.match(JSON.stringify(data.github), /redacted/i);
  });

  it("masks PEM private key blocks", () => {
    const pem = [
      "-----BEGIN PRIVATE KEY-----",
      "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const { data } = privacy.redactForStorage({ note: `key follows\n${pem}\ndone` });
    assert.equal(data.note.includes("BEGIN PRIVATE KEY"), false);
    assert.match(data.note, /<redacted>/);
  });

  it("leaves emails alone unless redact_emails is on", () => {
    const payload = { contact: "alice@example.com" };
    const off = privacy.redactForStorage(payload, {
      ...privacy.DEFAULT_SETTINGS,
      redact_emails: false,
    });
    assert.equal(off.data.contact, "alice@example.com");

    const on = privacy.redactForStorage(payload, {
      ...privacy.DEFAULT_SETTINGS,
      redact_emails: true,
    });
    assert.equal(on.data.contact, privacy.REDACTED);
  });

  it("hashes home-directory prefixes when enabled", () => {
    const home = os.homedir();
    const payload = { cwd: path.join(home, "projects", "app"), other: "/var/tmp/x" };
    const { data } = privacy.redactForStorage(payload, {
      ...privacy.DEFAULT_SETTINGS,
      redact_secret_keys: false,
      redact_secret_values: false,
      hash_home_paths: true,
    });
    assert.equal(data.cwd.includes(home), false);
    assert.match(data.cwd, /~\/<home:[a-f0-9]{12}>\//);
    assert.equal(data.other, "/var/tmp/x");
  });

  it("is a no-op when disabled", () => {
    const payload = { api_key: "secret", token: "x" };
    const { data, meta } = privacy.redactForStorage(payload, {
      ...privacy.DEFAULT_SETTINGS,
      enabled: false,
    });
    assert.deepEqual(data, payload);
    assert.equal(meta.redacted, false);
  });

  it("walks arrays and deep objects", () => {
    const { data } = privacy.redactForStorage({
      items: [{ secret: "a" }, { secret: "b" }, "sk-ant-api03-ABCDEFGHIJKLMNOP"],
    });
    assert.equal(data.items[0].secret, privacy.REDACTED);
    assert.equal(data.items[1].secret, privacy.REDACTED);
    assert.equal(data.items[2], privacy.REDACTED);
  });

  it("hash is stable for the same home prefix", () => {
    const home = os.homedir();
    const opts = {
      ...privacy.DEFAULT_SETTINGS,
      redact_secret_keys: false,
      redact_secret_values: false,
      hash_home_paths: true,
    };
    const a = privacy.redactForStorage({ p: home }, opts).data.p;
    const b = privacy.redactForStorage({ p: home }, opts).data.p;
    assert.equal(a, b);
  });
});

describe("privacy settings persistence", () => {
  it("round-trips through the DB", () => {
    const saved = privacy.setPrivacySettings({
      enabled: true,
      redact_emails: true,
      hash_home_paths: true,
      redact_secret_keys: false,
    });
    privacy.invalidateCache();
    const loaded = privacy.getPrivacySettings();
    assert.deepEqual(loaded, saved);
    assert.equal(loaded.redact_emails, true);
    assert.equal(loaded.redact_secret_keys, false);
  });
});

describe("privacy HTTP + hook ingest", () => {
  let server;
  let BASE;

  before(async () => {
    const { createApp, startServer } = require("../index");
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
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  beforeEach(() => {
    resetSettings({
      enabled: true,
      redact_secret_keys: true,
      redact_secret_values: true,
      redact_emails: false,
      hash_home_paths: false,
    });
  });

  function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, BASE);
      const opts = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { "Content-Type": "application/json" },
      };
      const req = http.request(opts, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, data });
        });
      });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it("GET /api/settings/privacy returns settings", async () => {
    const { status, data } = await request("GET", "/api/settings/privacy");
    assert.equal(status, 200);
    assert.equal(typeof data.settings.enabled, "boolean");
    assert.equal(data.defaults.enabled, true);
  });

  it("PUT /api/settings/privacy updates toggles", async () => {
    const { status, data } = await request("PUT", "/api/settings/privacy", {
      redact_emails: true,
      hash_home_paths: true,
    });
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.settings.redact_emails, true);
    assert.equal(data.settings.hash_home_paths, true);
  });

  it("PUT rejects non-boolean values", async () => {
    const { status, data } = await request("PUT", "/api/settings/privacy", {
      enabled: "yes",
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, "INVALID_INPUT");
  });

  it("POST /api/settings/privacy/preview shows before/after", async () => {
    const payload = { api_key: "sk-ant-api03-ABCDEFGHIJKLMNOP", keep: "ok" };
    const { status, data } = await request("POST", "/api/settings/privacy/preview", {
      payload,
    });
    assert.equal(status, 200);
    assert.equal(data.before.api_key, "sk-ant-api03-ABCDEFGHIJKLMNOP");
    assert.equal(data.after.api_key, privacy.REDACTED);
    assert.equal(data.after.keep, "ok");
    assert.equal(data.meta.redacted, true);
  });

  it("hook ingest stores redacted event data", async () => {
    const sessionId = `privacy-hook-session-${Date.now()}`;
    const { status, data } = await request("POST", "/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sessionId,
        cwd: "/tmp/privacy-test",
        tool_name: "Bash",
        tool_input: {
          command: "echo sk-ant-api03-HOOKINGESTSECRETVALUE01",
          api_key: "should-be-masked",
        },
      },
    });
    assert.equal(status, 200);
    assert.equal(data.ok, true);

    const row = db
      .prepare(
        "SELECT data FROM events WHERE session_id = ? AND event_type = 'PreToolUse' ORDER BY id DESC LIMIT 1"
      )
      .get(sessionId);
    assert.ok(row, "event row should exist");
    const stored = JSON.parse(row.data);
    assert.equal(stored.tool_input.api_key, privacy.REDACTED);
    assert.match(stored.tool_input.command, /<redacted>/);
    assert.equal(stored._privacy.redacted, true);
  });
});
