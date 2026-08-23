/**
 * @file app-config.test.ts
 * @description Unit tests for the app configuration loader, which reads environment variables and constructs a configuration object for the MCP server. The tests cover default values, parsing of different transport modes, HTTP port and host parsing with validation, boolean parsing for mutation/destructive flags, timeout and retry parsing with clamping, log level parsing with fallback, dashboard URL validation to ensure it targets a local host and uses http/https, and custom server name/version parsing. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
    assert.equal(cfg.dashboardApiToken, undefined);
    assert.equal(cfg.requestTimeoutMs, 10_000);
    assert.equal(cfg.retryCount, 2);
    assert.equal(cfg.retryBackoffMs, 250);
    assert.equal(cfg.allowMutations, false);
    assert.equal(cfg.allowDestructive, false);
    assert.equal(cfg.logLevel, "info");
    assert.equal(cfg.transport, "stdio");
    assert.equal(cfg.httpPort, 8819);
    assert.equal(cfg.httpHost, "127.0.0.1");
    assert.equal(cfg.httpAuthToken, undefined);
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

  it("defaults the HTTP session timeout to 30 minutes", () => {
    assert.equal(loadConfig(env({})).httpSessionTimeoutMs, 1_800_000);
  });

  it("parses and clamps MCP_HTTP_SESSION_TIMEOUT_MS", () => {
    assert.equal(
      loadConfig(env({ MCP_HTTP_SESSION_TIMEOUT_MS: "120000" })).httpSessionTimeoutMs,
      120_000
    );
    // Below the floor, a typo like "500" would otherwise reap live sessions.
    assert.equal(
      loadConfig(env({ MCP_HTTP_SESSION_TIMEOUT_MS: "500" })).httpSessionTimeoutMs,
      60_000
    );
    assert.equal(
      loadConfig(env({ MCP_HTTP_SESSION_TIMEOUT_MS: "999999999" })).httpSessionTimeoutMs,
      86_400_000
    );
    assert.equal(
      loadConfig(env({ MCP_HTTP_SESSION_TIMEOUT_MS: "banana" })).httpSessionTimeoutMs,
      1_800_000
    );
  });

  it("treats MCP_HTTP_SESSION_TIMEOUT_MS=0 as an explicit opt-out", () => {
    assert.equal(loadConfig(env({ MCP_HTTP_SESSION_TIMEOUT_MS: "0" })).httpSessionTimeoutMs, 0);
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

  it("accepts the isolated Compose dashboard service with a bearer token", () => {
    const cfg = loadConfig(
      env({
        MCP_DASHBOARD_BASE_URL: "http://agent-monitor:4820",
        MCP_DASHBOARD_API_TOKEN: "test-token",
      })
    );
    assert.equal(cfg.dashboardBaseUrl.hostname, "agent-monitor");
    assert.equal(cfg.dashboardApiToken, "test-token");
  });

  it("loads an optional dashboard bearer token", () => {
    const cfg = loadConfig(env({ MCP_DASHBOARD_API_TOKEN: "test-token" }));
    assert.equal(cfg.dashboardApiToken, "test-token");
  });

  it("loads the dashboard bearer token from a mounted secret file", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-mcp-token-"));
    const tokenPath = path.join(directory, "dashboard-token");
    try {
      fs.writeFileSync(tokenPath, "file-token\n");
      const cfg = loadConfig(env({ MCP_DASHBOARD_API_TOKEN_FILE: tokenPath }));
      assert.equal(cfg.dashboardApiToken, "file-token");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("loads the MCP HTTP bearer token from a mounted secret file", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-mcp-http-token-"));
    const tokenPath = path.join(directory, "mcp-token");
    try {
      fs.writeFileSync(tokenPath, "mcp-file-token\n");
      const cfg = loadConfig(env({ MCP_HTTP_AUTH_TOKEN_FILE: tokenPath }));
      assert.equal(cfg.httpAuthToken, "mcp-file-token");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("requires HTTPS for bearer tokens sent through container-host aliases", () => {
    assert.throws(
      () =>
        loadConfig(
          env({
            MCP_DASHBOARD_BASE_URL: "http://host.docker.internal:4820",
            MCP_DASHBOARD_API_TOKEN: "test-token",
          })
        ),
      /require HTTPS/
    );
    const cfg = loadConfig(
      env({
        MCP_DASHBOARD_BASE_URL: "https://host.docker.internal:4820",
        MCP_DASHBOARD_API_TOKEN: "test-token",
      })
    );
    assert.equal(cfg.dashboardApiToken, "test-token");
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
