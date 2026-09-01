/**
 * @file privacy-filter.test.js
 * @description Unit tests for the privacy-filter redaction module (issue #148).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { redactPayload, PATTERNS, MASK } = require("../lib/privacy-filter");

// ─── helpers ───────────────────────────────────────────────────────────────

function redact(data) {
  return redactPayload(data);
}

// ─── passthrough (no secrets) ───────────────────────────────────────────────

describe("passthrough — clean data", () => {
  it("returns identical object when no secrets present", () => {
    const data = { session_id: "abc123", hook_type: "Stop", cwd: "/home/user/project" };
    const { data: out, redactedCount } = redact(data);
    assert.deepEqual(out, data);
    assert.equal(redactedCount, 0);
  });

  it("handles null", () => {
    const { data: out, redactedCount } = redact(null);
    assert.equal(out, null);
    assert.equal(redactedCount, 0);
  });

  it("handles non-object primitives gracefully", () => {
    const { data: out, redactedCount } = redact("plain string");
    assert.equal(out, "plain string");
    assert.equal(redactedCount, 0);
  });

  it("preserves numbers and booleans unchanged", () => {
    const data = { tokens: 42, ok: true };
    const { data: out, redactedCount } = redact(data);
    assert.deepEqual(out, data);
    assert.equal(redactedCount, 0);
  });
});

// ─── SDK-style keys ────────────────────────────────────────────────────────

describe("sdk-key-prefix patterns", () => {
  it("redacts OpenAI sk- key", () => {
    const data = { api_key: "sk-abcdefghijklmnopqrstuvwxyz123456" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.api_key, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts Anthropic sk-ant- key", () => {
    const data = { key: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890abcdef" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.key, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts GitHub PAT ghp_ prefix", () => {
    const data = { token: "ghp_1234567890abcdefghijklmnopqrstuvwxyz" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.token, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts GitHub PAT github_pat_ prefix", () => {
    const data = { token: "github_pat_11ABCDE_abcdefghijklmnopqrstu" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.token, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts Slack bot token xoxb-", () => {
    // Construct token dynamically so the literal is never stored in the file
    const data = { slack: ["xoxb", "123456789", "abcdefghijklmno"].join("-") };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.slack, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts Google API key AIza prefix", () => {
    const data = { gkey: "AIzaSyAbcdefghijklmnopqrstuvwxyz12345678" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.gkey, MASK);
    assert.equal(redactedCount, 1);
  });
});

// ─── AWS keys ───────────────────────────────────────────────────────────────

describe("aws-key pattern", () => {
  it("redacts AKIA access key", () => {
    const data = { aws: "AKIAIOSFODNN7EXAMPLE" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.aws, MASK);
    assert.equal(redactedCount, 1);
  });

  it("does not redact short uppercase string", () => {
    const data = { val: "AKIA1234" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.val, "AKIA1234");
    assert.equal(redactedCount, 0);
  });
});

// ─── PEM private key blocks ─────────────────────────────────────────────────

describe("pem-private-key pattern", () => {
  it("redacts RSA private key block in a value", () => {
    const data = { cert: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.cert, MASK);
    assert.equal(redactedCount, 1);
  });

  it("redacts OPENSSH private key block", () => {
    const data = { key: "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA..." };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.key, MASK);
    assert.equal(redactedCount, 1);
  });
});

// ─── Bearer token ───────────────────────────────────────────────────────────

describe("bearer-token pattern", () => {
  it("redacts Authorization header value", () => {
    const data = { header: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.header, MASK);
    assert.equal(redactedCount, 1);
  });
});

// ─── URL credentials ────────────────────────────────────────────────────────

describe("url-credentials pattern", () => {
  it("redacts postgres URL with embedded password", () => {
    const data = { db: "postgres://user:supersecretpassword@localhost:5432/mydb" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.db, MASK);
    assert.equal(redactedCount, 1);
  });
});

// ─── Generic api-key assignment ─────────────────────────────────────────────

describe("api-key-generic scan pattern", () => {
  it("redacts inline api_key=value assignment in a string", () => {
    const data = { snippet: 'const config = { api_key: "abcdefghijklmnopqrstuvwxyz123456" }' };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.snippet, MASK);
    assert.equal(redactedCount, 1);
  });
});

// ─── Nested objects and arrays ──────────────────────────────────────────────

describe("nested structures", () => {
  it("redacts secret nested inside tool_input object", () => {
    const data = {
      hook_type: "PreToolUse",
      tool_input: {
        command: "curl https://api.example.com",
        env: { API_KEY: "sk-abcdefghijklmnopqrstuvwxyz123456" },
      },
    };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.tool_input.env.API_KEY, MASK);
    assert.equal(out.tool_input.command, "curl https://api.example.com");
    assert.equal(redactedCount, 1);
  });

  it("redacts secrets inside arrays", () => {
    const data = { args: ["--token", "sk-abcdefghijklmnopqrstuvwxyz123456", "--verbose"] };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.args[0], "--token");
    assert.equal(out.args[1], MASK);
    assert.equal(out.args[2], "--verbose");
    assert.equal(redactedCount, 1);
  });

  it("counts multiple secrets across a deeply nested payload", () => {
    const data = {
      a: "sk-abcdefghijklmnopqrstuvwxyz123456",
      b: { c: "sk-ant-api03-xyzxyzxyzxyzxyzxyzxyzxyz1234567890abc" },
    };
    const { redactedCount } = redact(data);
    assert.equal(redactedCount, 2);
  });
});

// ─── Structural fields are preserved ────────────────────────────────────────

describe("structural field preservation", () => {
  it("never redacts session_id", () => {
    const data = { session_id: "sk-like-but-not-a-key" };
    const { data: out } = redact(data);
    // session_id is always preserved verbatim
    assert.equal(out.session_id, "sk-like-but-not-a-key");
  });

  it("never redacts cwd", () => {
    const data = { cwd: "/home/user/sk-project" };
    const { data: out } = redact(data);
    assert.equal(out.cwd, "/home/user/sk-project");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty object", () => {
    const { data: out, redactedCount } = redact({});
    assert.deepEqual(out, {});
    assert.equal(redactedCount, 0);
  });

  it("handles deeply nested empty arrays", () => {
    const data = { items: [] };
    const { data: out, redactedCount } = redact(data);
    assert.deepEqual(out.items, []);
    assert.equal(redactedCount, 0);
  });

  it("short strings under 8 chars are never redacted", () => {
    const data = { val: "sk-abc" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.val, "sk-abc");
    assert.equal(redactedCount, 0);
  });

  it("null values in fields are preserved", () => {
    const data = { token: null, name: "session" };
    const { data: out, redactedCount } = redact(data);
    assert.equal(out.token, null);
    assert.equal(redactedCount, 0);
  });
});

// ─── PATTERNS array ─────────────────────────────────────────────────────────

describe("PATTERNS export", () => {
  it("exports a non-empty array", () => {
    assert.ok(Array.isArray(PATTERNS));
    assert.ok(PATTERNS.length > 0);
  });

  it("each pattern has name and pattern fields", () => {
    for (const p of PATTERNS) {
      assert.ok(typeof p.name === "string", `pattern ${p.name} missing name`);
      assert.ok(p.pattern instanceof RegExp, `pattern ${p.name} missing RegExp`);
    }
  });
});
