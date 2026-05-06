/**
 * @file Smoke tests for the orchestrator route and spawner helpers. We avoid
 * actually spawning `claude` (slow, env-dependent) — only validate route
 * gating, request validation, env stripping, and arg construction.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("orchestrator route", () => {
  it("returns 404 when ORCHESTRATOR_ENABLED is not set", async () => {
    delete process.env.ORCHESTRATOR_ENABLED;
    // Module-scoped gate: must require AFTER unsetting.
    delete require.cache[require.resolve("../routes/orchestrator")];
    const router = require("../routes/orchestrator");

    const express = require("express");
    const http = require("node:http");
    const app = express();
    app.use("/api/orchestrator", router);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/`);
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.error, "orchestrator disabled");
    } finally {
      server.close();
    }
  });

  it("buildArgsFromConfig defaults are stream-json + acceptEdits", () => {
    delete require.cache[require.resolve("../lib/profile-schema")];
    const { buildArgsFromConfig } = require("../lib/profile-schema");
    const args = buildArgsFromConfig({}, { prompt: "hi" });
    assert.deepStrictEqual(args, [
      "-p", "hi",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "acceptEdits",
    ]);
  });

  it("cleanSpawnEnv strips OAuth tokens but preserves other vars", () => {
    delete require.cache[require.resolve("../lib/spawner")];
    const { cleanSpawnEnv } = require("../lib/spawner");
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "test";
    process.env.CLAUDECODE = "1";
    process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = "yes";
    try {
      const cleaned = cleanSpawnEnv();
      assert.strictEqual(cleaned.CLAUDE_CODE_OAUTH_TOKEN, undefined);
      assert.strictEqual(cleaned.CLAUDECODE, undefined);
      assert.strictEqual(cleaned.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST, undefined);
      assert.strictEqual(cleaned.PATH, process.env.PATH);
    } finally {
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      delete process.env.CLAUDECODE;
      delete process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST;
    }
  });
});
