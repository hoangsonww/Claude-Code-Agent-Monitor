/**
 * @file app-config.test.ts
 * @description Unit tests for the app configuration loader, which reads environment variables and constructs a configuration object for the MCP server. The tests cover default values, parsing of different transport modes, HTTP port and host parsing with validation, boolean parsing for mutation/destructive flags, timeout and retry parsing with clamping, log level parsing with fallback, dashboard URL validation to ensure it targets a local host and uses http/https, and custom server name/version parsing. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/app-config.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the app configuration loader, which reads environment variables and constructs a
 * configuration object for the MCP server. The tests cover default values, parsing of different
 * transport modes, HTTP port and host parsing with validation, boolean parsing for
 * mutation/destructive flags, timeout and retry parsing with clamping, log level parsing with
 * fallback, dashboard URL validation to ensure it targets a local host and uses http/https, and
 * custom server name/version parsing. The tests use Node's built-in test runner and assert module
 * for assertions.
 *
 * ## Architectural boundary
 * - Protects MCP schema, policy, API-client, formatting, lifecycle, or transport behavior using
 *   Node's test runner.
 * - Tests should exercise public contracts with realistic SDK and HTTP boundaries while keeping
 *   external state local.
 * - Fixtures must not contain usable credentials or depend on the operator's real dashboard
 *   configuration.
 *
 * ## Local dependency edges
 * - `../src/config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:fs` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:os` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:path` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `env` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `accepts host.docker.internal` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `accepts localhost` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `accepts the isolated Compose dashboard service with a bearer token` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `clamps MCP_HTTP_PORT to valid range` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `defaults invalid log level to info` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `defaults the HTTP session timeout to 30 minutes` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `defaults unknown transport to stdio` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `falls back to default on invalid MCP_HTTP_PORT` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `is case-insensitive for transport` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `loadConfig` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `loads an optional dashboard bearer token` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `loads the dashboard bearer token from a mounted secret file` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `loads the MCP HTTP bearer token from a mounted secret file` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `parses allowDestructive` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses and clamps MCP_HTTP_SESSION_TIMEOUT_MS` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `parses custom server name and version` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `parses MCP_HTTP_HOST` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses MCP_HTTP_PORT` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses MCP_TRANSPORT=http` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses MCP_TRANSPORT=repl` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses MCP_TRANSPORT=stdio` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses retry count` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `parses timeout with clamping` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `parses valid log level` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `rejects invalid URLs` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `rejects non-http protocols` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `rejects non-local dashboard hosts` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `requires HTTPS for bearer tokens sent through container-host aliases` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `returns sane defaults when no env vars set` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `treats MCP_HTTP_SESSION_TIMEOUT_MS=0 as an explicit opt-out` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the exact protocol or policy contract in each test so a failure identifies the broken
 *   boundary.
 * - Use ephemeral ports, temporary directories, and isolated environment values for concurrent-safe
 *   execution.
 * - Restore process globals, environment variables, clocks, fetch stubs, and listeners after every
 *   case.
 * - Assert structured results and error shapes rather than only checking that a call throws.
 * - Cover redaction and permission denial for every secret-bearing or state-changing path.
 * - Avoid snapshotting unstable SDK internals when a focused schema or result assertion is clearer.
 * - Test cleanup and idempotence because abandoned transports and timers can keep the process
 *   alive.
 * - Keep test doubles behaviorally faithful to the API client methods used by the subject.
 * - Exercise malformed and boundary inputs at schema and direct-function layers where each owns
 *   distinct validation.
 * - Prove regression tests fail against the broken behavior before accepting a fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/app-config.test.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `mcp/__tests__/app-config.test.ts`
 *
 * Scope
 * Unit tests for the app configuration loader, which reads environment variables and constructs a
 * configuration object for the MCP server. The tests cover default values, parsing of different
 * transport modes, HTTP port and host parsing with validation, boolean parsing for
 * mutation/destructive flags, timeout and retry parsing with clamping, log level parsing with
 * fallback, dashboard URL validation to ensure it targets a local host and uses http/https, and
 * custom server name/version parsing. The tests use Node's built-in test runner and assert module
 * for assertions.
 *
 * Subjects and collaborators
 * - `../src/config/app-config.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `loadConfig`
 *
 * Protected behavior
 * - returns sane defaults when no env vars set
 * - parses MCP_TRANSPORT=http
 * - parses MCP_TRANSPORT=repl
 * - parses MCP_TRANSPORT=stdio
 * - defaults unknown transport to stdio
 * - is case-insensitive for transport
 * - parses MCP_HTTP_PORT
 * - clamps MCP_HTTP_PORT to valid range
 * - falls back to default on invalid MCP_HTTP_PORT
 * - defaults the HTTP session timeout to 30 minutes
 * - parses and clamps MCP_HTTP_SESSION_TIMEOUT_MS
 * - treats MCP_HTTP_SESSION_TIMEOUT_MS=0 as an explicit opt-out
 * - parses MCP_HTTP_HOST
 * - parses allowMutations='${truthy}' as true
 * - parses allowMutations='${falsy}' as false
 * - parses allowDestructive
 * - parses timeout with clamping
 * - parses retry count
 * - parses valid log level
 * - defaults invalid log level to info
 * - rejects non-local dashboard hosts
 * - rejects non-http protocols
 * - rejects invalid URLs
 * - accepts localhost
 * - accepts host.docker.internal
 * - accepts the isolated Compose dashboard service with a bearer token
 * - loads an optional dashboard bearer token
 * - loads the dashboard bearer token from a mounted secret file
 * - loads the MCP HTTP bearer token from a mounted secret file
 * - requires HTTPS for bearer tokens sent through container-host aliases
 * - parses custom server name and version
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep MCP assertions aligned with tool schemas and JSON-RPC error semantics; transport failures must
 *   stay diagnosable.
 *
 * Verification
 * - Run `npm run test:mcp`, `npm run mcp:typecheck`, and `npm run mcp:build` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

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
