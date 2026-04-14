/**
 * @file app-config.test.ts
 * @description Unit tests for the app configuration loader, which reads environment variables and constructs a configuration object for the MCP server. The tests cover default values, parsing of different transport modes, HTTP port and host parsing with validation, boolean parsing for mutation/destructive flags, timeout and retry parsing with clamping, log level parsing with fallback, dashboard URL validation to ensure it targets a local host and uses http/https, and custom server name/version parsing. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, type TransportMode } from "../src/config/app-config.js";

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    MCP_DASHBOARD_BASE_URL: "http://127.0.0.1:4820",
    ...overrides,
  };
}

describe("loadConfig", () => {
  it("returns sane defaults when no env vars set", () => {
    const cfg = loadConfig(env());
    assert.equal(cfg.serverName, "agent-dashboard-mcp");
    assert.equal(cfg.serverVersion, "1.0.0");
    assert.equal(cfg.dashboardBaseUrl.toString(), "http://127.0.0.1:4820/");
    assert.equal(cfg.requestTimeoutMs, 10_000);
    assert.equal(cfg.retryCount, 2);
    assert.equal(cfg.retryBackoffMs, 250);
    assert.equal(cfg.allowMutations, false);
    assert.equal(cfg.allowDestructive, false);
    assert.equal(cfg.logLevel, "info");
    assert.equal(cfg.transport, "stdio");
    assert.equal(cfg.httpPort, 8819);
    assert.equal(cfg.httpHost, "127.0.0.1");
  });

  // ── Transport parsing ───────────────────────────────────────
  it("parses MCP_TRANSPORT=http", () => {
    const cfg = loadConfig(env({ MCP_TRANSPORT: "http" }));
    assert.equal(cfg.transport, "http");
  });

  it("parses MCP_TRANSPORT=repl", () => {
    const cfg = loadConfig(env({ MCP_TRANSPORT: "repl" }));
    assert.equal(cfg.transport, "repl");
  });

  it("parses MCP_TRANSPORT=stdio", () => {
    const cfg = loadConfig(env({ MCP_TRANSPORT: "stdio" }));
    assert.equal(cfg.transport, "stdio");
  });

  it("defaults unknown transport to stdio", () => {
    const cfg = loadConfig(env({ MCP_TRANSPORT: "grpc" }));
    assert.equal(cfg.transport, "stdio");
  });

  it("is case-insensitive for transport", () => {
    const cfg = loadConfig(env({ MCP_TRANSPORT: "HTTP" }));
    assert.equal(cfg.transport, "http");
  });

  // ── HTTP port/host ──────────────────────────────────────────
  it("parses MCP_HTTP_PORT", () => {
    const cfg = loadConfig(env({ MCP_HTTP_PORT: "9999" }));
    assert.equal(cfg.httpPort, 9999);
  });

  it("clamps MCP_HTTP_PORT to valid range", () => {
    const low = loadConfig(env({ MCP_HTTP_PORT: "0" }));
    assert.equal(low.httpPort, 1);
    const high = loadConfig(env({ MCP_HTTP_PORT: "99999" }));
    assert.equal(high.httpPort, 65535);
  });

  it("falls back to default on invalid MCP_HTTP_PORT", () => {
    const cfg = loadConfig(env({ MCP_HTTP_PORT: "banana" }));
    assert.equal(cfg.httpPort, 8819);
  });

  it("parses MCP_HTTP_HOST", () => {
    const cfg = loadConfig(env({ MCP_HTTP_HOST: "0.0.0.0" }));
    assert.equal(cfg.httpHost, "0.0.0.0");
  });

  // ── Boolean parsing ─────────────────────────────────────────
  for (const truthy of ["1", "true", "yes", "on", "TRUE", "Yes"]) {
    it(`parses allowMutations='${truthy}' as true`, () => {
      const cfg = loadConfig(env({ MCP_DASHBOARD_ALLOW_MUTATIONS: truthy }));
      assert.equal(cfg.allowMutations, true);
    });
  }

  for (const falsy of ["0", "false", "no", "off", "FALSE", "No"]) {
    it(`parses allowMutations='${falsy}' as false`, () => {
      const cfg = loadConfig(env({ MCP_DASHBOARD_ALLOW_MUTATIONS: falsy }));
      assert.equal(cfg.allowMutations, false);
    });
  }

  it("parses allowDestructive", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_ALLOW_DESTRUCTIVE: "true" }));
    assert.equal(cfg.allowDestructive, true);
  });

  // ── Timeout / retry parsing ─────────────────────────────────
  it("parses timeout with clamping", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_TIMEOUT_MS: "200" }));
    assert.equal(cfg.requestTimeoutMs, 500); // min 500
  });

  it("parses retry count", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_RETRY_COUNT: "5" }));
    assert.equal(cfg.retryCount, 5);
  });

  // ── Log level ───────────────────────────────────────────────
  it("parses valid log level", () => {
    const cfg = loadConfig(env({ MCP_LOG_LEVEL: "debug" }));
    assert.equal(cfg.logLevel, "debug");
  });

  it("defaults invalid log level to info", () => {
    const cfg = loadConfig(env({ MCP_LOG_LEVEL: "verbose" }));
    assert.equal(cfg.logLevel, "info");
  });

  // ── Dashboard URL validation ────────────────────────────────
  it("rejects non-local dashboard hosts", () => {
    assert.throws(
      () => loadConfig(env({ MCP_DASHBOARD_BASE_URL: "http://evil.com:4820" })),
      /must target a local dashboard host/
    );
  });

  it("rejects non-http protocols", () => {
    assert.throws(
      () => loadConfig(env({ MCP_DASHBOARD_BASE_URL: "ftp://127.0.0.1:4820" })),
      /must use http or https/
    );
  });

  it("rejects invalid URLs", () => {
    assert.throws(
      () => loadConfig(env({ MCP_DASHBOARD_BASE_URL: "not a url" })),
      /Invalid MCP_DASHBOARD_BASE_URL/
    );
  });

  it("accepts localhost", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_BASE_URL: "http://localhost:4820" }));
    assert.equal(cfg.dashboardBaseUrl.hostname, "localhost");
  });

  it("accepts host.docker.internal", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_BASE_URL: "http://host.docker.internal:4820" }));
    assert.equal(cfg.dashboardBaseUrl.hostname, "host.docker.internal");
  });

  // ── Custom server name/version ──────────────────────────────
  it("parses custom server name and version", () => {
    const cfg = loadConfig(
      env({
        MCP_SERVER_NAME: "my-mcp",
        MCP_SERVER_VERSION: "2.0.0",
      })
    );
    assert.equal(cfg.serverName, "my-mcp");
    assert.equal(cfg.serverVersion, "2.0.0");
  });
});
