/**
 * @file Tests for the privacy controls module and /api/privacy/* endpoints.
 * Covers rule CRUD, global toggle, preview, built-in detectors, nested objects,
 * arrays, large payloads, hash stability, event dropping, and fail-safe behavior.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `privacy-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");

let server;
let BASE;
let privacyModule; // loaded after server starts (so db is seeded)

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port: server.address().port,
      path: urlPath,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const r = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    r.on("error", reject);
    if (body !== undefined) r.write(JSON.stringify(body));
    r.end();
  });
}

const get = (p) => req("GET", p);
const post = (p, b) => req("POST", p, b);
const put = (p, b) => req("PUT", p, b);
const del = (p) => req("DELETE", p);
const patch = (p, b) => req("PATCH", p, b);

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
  privacyModule = require("../lib/privacy");
});

after(() => {
  server.close();
  try {
    require("fs").unlinkSync(TEST_DB);
  } catch {
    /* best-effort */
  }
});

// ---------------------------------------------------------------------------
// Rule CRUD
// ---------------------------------------------------------------------------
describe("GET /api/privacy/rules", () => {
  it("returns built-in rules", async () => {
    const { status, data } = await get("/api/privacy/rules");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    const builtIn = data.filter((r) => r.built_in === 1);
    assert.ok(builtIn.length > 0, "should have built-in rules");
  });
});

describe("POST /api/privacy/rules", () => {
  let createdId;

  it("creates a valid user rule", async () => {
    const { status, data } = await post("/api/privacy/rules", {
      name: "Test mask rule",
      action: "mask",
      pattern: "secret_[a-z]+",
      priority: 200,
    });
    assert.equal(status, 201);
    assert.equal(data.name, "Test mask rule");
    assert.equal(data.built_in, 0);
    assert.equal(data.action, "mask");
    createdId = data.id;
  });

  it("rejects missing name", async () => {
    const { status } = await post("/api/privacy/rules", { action: "mask" });
    assert.equal(status, 400);
  });

  it("rejects invalid action", async () => {
    const { status } = await post("/api/privacy/rules", { name: "bad", action: "explode" });
    assert.equal(status, 400);
  });

  it("rejects invalid regex pattern", async () => {
    const { status } = await post("/api/privacy/rules", {
      name: "bad pattern",
      action: "mask",
      pattern: "[invalid",
    });
    assert.equal(status, 400);
  });

  after(async () => {
    if (createdId) await del(`/api/privacy/rules/${createdId}`);
  });
});

describe("PUT /api/privacy/rules/:id", () => {
  let ruleId;

  before(async () => {
    const { data } = await post("/api/privacy/rules", {
      name: "editable",
      action: "hash",
      pattern: "foo",
    });
    ruleId = data.id;
  });

  it("updates a user rule", async () => {
    const { status, data } = await put(`/api/privacy/rules/${ruleId}`, {
      name: "edited",
      action: "mask",
      pattern: "bar",
      enabled: false,
      priority: 99,
    });
    assert.equal(status, 200);
    assert.equal(data.name, "edited");
    assert.equal(data.action, "mask");
    assert.equal(data.enabled, 0);
  });

  it("rejects editing a built-in rule", async () => {
    const { data: rules } = await get("/api/privacy/rules");
    const builtIn = rules.find((r) => r.built_in === 1);
    const { status } = await put(`/api/privacy/rules/${builtIn.id}`, { name: "hacked" });
    assert.equal(status, 403);
  });

  it("returns 404 for unknown id", async () => {
    const { status } = await put("/api/privacy/rules/99999", { name: "x", action: "mask" });
    assert.equal(status, 404);
  });

  after(async () => {
    if (ruleId) await del(`/api/privacy/rules/${ruleId}`);
  });
});

describe("PATCH /api/privacy/rules/:id/toggle", () => {
  let ruleId;
  before(async () => {
    const { data } = await post("/api/privacy/rules", {
      name: "toggleable",
      action: "mask",
      pattern: "x",
    });
    ruleId = data.id;
  });

  it("toggles enabled state", async () => {
    const { data: before } = await get("/api/privacy/rules");
    const original = before.find((r) => r.id === ruleId);
    const { status, data } = await patch(`/api/privacy/rules/${ruleId}/toggle`);
    assert.equal(status, 200);
    assert.notEqual(data.enabled, original.enabled);
  });

  after(async () => {
    if (ruleId) await del(`/api/privacy/rules/${ruleId}`);
  });
});

describe("DELETE /api/privacy/rules/:id", () => {
  it("deletes a user rule", async () => {
    const { data } = await post("/api/privacy/rules", {
      name: "to-delete",
      action: "mask",
      pattern: "z",
    });
    const { status, data: result } = await del(`/api/privacy/rules/${data.id}`);
    assert.equal(status, 200);
    assert.equal(result.deleted, true);
  });

  it("rejects deleting a built-in rule", async () => {
    const { data: rules } = await get("/api/privacy/rules");
    const builtIn = rules.find((r) => r.built_in === 1);
    const { status } = await del(`/api/privacy/rules/${builtIn.id}`);
    assert.equal(status, 403);
  });

  it("returns 404 for unknown id", async () => {
    const { status } = await del("/api/privacy/rules/99999");
    assert.equal(status, 404);
  });
});

// ---------------------------------------------------------------------------
// Global settings
// ---------------------------------------------------------------------------
describe("GET/PUT /api/privacy/settings", () => {
  it("returns enabled flag", async () => {
    const { status, data } = await get("/api/privacy/settings");
    assert.equal(status, 200);
    assert.ok("enabled" in data);
  });

  it("can disable and re-enable", async () => {
    await put("/api/privacy/settings", { enabled: false });
    const { data: off } = await get("/api/privacy/settings");
    assert.equal(off.enabled, false);

    await put("/api/privacy/settings", { enabled: true });
    const { data: on } = await get("/api/privacy/settings");
    assert.equal(on.enabled, true);
  });

  it("rejects non-boolean enabled", async () => {
    const { status } = await put("/api/privacy/settings", { enabled: "yes" });
    assert.equal(status, 400);
  });
});

// ---------------------------------------------------------------------------
// Preview endpoint
// ---------------------------------------------------------------------------
describe("POST /api/privacy/preview", () => {
  it("transforms sample payload", async () => {
    const { status, data } = await post("/api/privacy/preview", {
      payload: { command: "echo sk-abc123def456ghi789jkl000", user: "test" },
    });
    assert.equal(status, 200);
    assert.ok("before" in data && "after" in data);
  });

  it("requires payload field", async () => {
    const { status } = await post("/api/privacy/preview", {});
    assert.equal(status, 400);
  });

  it("accepts null payload", async () => {
    const { status, data } = await post("/api/privacy/preview", { payload: null });
    assert.equal(status, 200);
    assert.equal(data.before, null);
  });
});

// ---------------------------------------------------------------------------
// Core engine: applyPrivacyPolicy unit tests
// ---------------------------------------------------------------------------
describe("applyPrivacyPolicy unit", () => {
  it("returns original when privacy disabled", async () => {
    await put("/api/privacy/settings", { enabled: false });
    privacyModule.invalidateCache();
    const payload = { secret: "sk-abc123longkeyvalue" };
    const { data, privacy_meta } = privacyModule.applyPrivacyPolicy(payload);
    assert.deepEqual(data, payload);
    assert.equal(privacy_meta, null);
    await put("/api/privacy/settings", { enabled: true });
    privacyModule.invalidateCache();
  });

  it("masks secret-like keys in nested objects", () => {
    privacyModule.invalidateCache();
    const payload = {
      top: "normal",
      nested: { cmd: "Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig" },
    };
    const { data } = privacyModule.applyPrivacyPolicy(payload);
    assert.equal(data.top, "normal", "non-sensitive field should be unchanged");
    assert.ok(!data.nested.cmd.includes("eyJhbGciOiJSUzI1NiJ9"), "bearer token should be masked");
  });

  it("handles arrays of strings", () => {
    privacyModule.invalidateCache();
    const payload = { args: ["--token", "Bearer abc123defghijklmno"] };
    const { data } = privacyModule.applyPrivacyPolicy(payload);
    assert.ok(!data.args[1].includes("abc123defghijklmno"), "token in array should be masked");
  });

  it("handles null payload gracefully (fail-safe)", () => {
    const { data, privacy_meta } = privacyModule.applyPrivacyPolicy(null);
    assert.equal(data, null);
    assert.equal(privacy_meta, null);
  });

  it("handles non-JSON-serializable payload gracefully", () => {
    // circular reference can't be JSON.stringified — should degrade safely
    const circular = {};
    circular.self = circular;
    const { data } = privacyModule.applyPrivacyPolicy(circular);
    // either returns original or null — should not throw
    assert.ok(data !== undefined);
  });

  it("hash action produces stable output for same input", () => {
    privacyModule.invalidateCache();
    // Create a hash rule temporarily
    const { stmts: ps } = privacyModule;
    const info = ps.insertRule.run("hash-test", "hash", "", "FIXED_VALUE", 1, 5);
    privacyModule.invalidateCache();

    try {
      const payload1 = { val: "FIXED_VALUE" };
      const payload2 = { val: "FIXED_VALUE" };
      const { data: r1 } = privacyModule.applyPrivacyPolicy(payload1);
      const { data: r2 } = privacyModule.applyPrivacyPolicy(payload2);
      assert.equal(r1.val, r2.val, "hash must be stable for same input");
      assert.ok(r1.val.startsWith("[hashed:"), "should have hash marker");
    } finally {
      ps.deleteRule.run(info.lastInsertRowid);
      privacyModule.invalidateCache();
    }
  });

  it("drop_event_payload returns null data", () => {
    const { stmts: ps } = privacyModule;
    const info = ps.insertRule.run("drop-test", "drop_event_payload", "", "", 1, 1);
    privacyModule.invalidateCache();

    try {
      const { data, privacy_meta } = privacyModule.applyPrivacyPolicy({ sensitive: "stuff" });
      assert.equal(data, null);
      assert.equal(privacy_meta.dropped, true);
    } finally {
      ps.deleteRule.run(info.lastInsertRowid);
      privacyModule.invalidateCache();
    }
  });

  it("preserve_metadata_only strips nested objects", () => {
    const { stmts: ps } = privacyModule;
    const info = ps.insertRule.run("meta-only-test", "preserve_metadata_only", "", "", 1, 1);
    privacyModule.invalidateCache();

    try {
      const { data } = privacyModule.applyPrivacyPolicy({
        scalar: "keep",
        number_field: 42,
        nested: { secret: "drop" },
        arr: [1, 2, 3],
      });
      assert.equal(data.scalar, "keep");
      assert.equal(data.number_field, 42);
      assert.equal(data.nested, undefined, "nested object should be stripped");
      assert.equal(data.arr, undefined, "array should be stripped");
    } finally {
      ps.deleteRule.run(info.lastInsertRowid);
      privacyModule.invalidateCache();
    }
  });

  it("drop_field action removes targeted field", () => {
    const { stmts: ps } = privacyModule;
    const info = ps.insertRule.run("drop-field-test", "drop_field", "tool_input.api_key", "", 1, 1);
    privacyModule.invalidateCache();

    try {
      const { data } = privacyModule.applyPrivacyPolicy({
        tool_input: { api_key: "super-secret", other: "keep" },
      });
      assert.equal(data.tool_input.api_key, undefined, "targeted field should be removed");
      assert.equal(data.tool_input.other, "keep", "sibling field should be preserved");
    } finally {
      ps.deleteRule.run(info.lastInsertRowid);
      privacyModule.invalidateCache();
    }
  });

  it("handles large payload without crashing", () => {
    privacyModule.invalidateCache();
    const large = { data: "x".repeat(100_000) };
    const { data } = privacyModule.applyPrivacyPolicy(large);
    assert.ok(data !== undefined);
  });

  it("home path detector masks absolute user paths", () => {
    privacyModule.invalidateCache();
    const { data } = privacyModule.applyPrivacyPolicy({
      cwd: "/home/alice/projects/myapp",
    });
    assert.ok(!data.cwd.includes("alice"), "home path should be masked");
  });
});
