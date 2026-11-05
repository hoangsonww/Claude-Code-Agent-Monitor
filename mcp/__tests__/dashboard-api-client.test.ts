/**
 * @file dashboard-api-client.test.ts
 * @description Contract tests for MCP dashboard HTTP requests, including
 * bearer-token propagation and DELETE request bodies used by config tools.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/dashboard-api-client.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Contract tests for MCP dashboard HTTP requests, including bearer-token propagation and DELETE
 * request bodies used by config tools.
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
 * - `../src/clients/dashboard-api-client.js` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 * - `../src/config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../src/core/logger.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:fs/promises` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:os` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:path` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `config` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `originalFetch` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Literal API paths
 * - `/api/codex-config/file` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/health` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/import/upload` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/sessions/id/transcript-image` — route literal present in this source; keep
 *   request/response expectations aligned with the server and API docs.
 *
 * ## Named test contracts
 * - `DashboardApiClient` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `rejects automatic redirects so bearer headers never cross routes` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `rejects multipart uploads above the cumulative size cap before fetch` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `rejects oversized binary responses from Content-Length` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `sends JSON bodies with DELETE requests` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `sends the configured dashboard bearer token` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/dashboard-api-client.test.ts` .
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
 * Path: `mcp/__tests__/dashboard-api-client.test.ts`
 *
 * Scope
 * Contract tests for MCP dashboard HTTP requests, including bearer-token propagation and DELETE
 * request bodies used by config tools.
 *
 * Subjects and collaborators
 * - `../src/config/app-config.js` — local module imported by this suite.
 * - `../src/clients/dashboard-api-client.js` — local module imported by this suite.
 * - `../src/core/logger.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 * - Network boundaries are replaced with deterministic responses; no test depends on an external
 *   service.
 *
 * Suite groups
 * - `DashboardApiClient`
 *
 * Protected behavior
 * - sends the configured dashboard bearer token
 * - sends JSON bodies with DELETE requests
 * - rejects multipart uploads above the cumulative size cap before fetch
 * - rejects oversized binary responses from Content-Length
 * - rejects automatic redirects so bearer headers never cross routes
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

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "../src/config/app-config.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";
import { Logger } from "../src/core/logger.js";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    serverName: "test",
    serverVersion: "1.0.0",
    dashboardBaseUrl: new URL("http://127.0.0.1:4820"),
    dashboardApiToken: undefined,
    requestTimeoutMs: 5_000,
    retryCount: 0,
    retryBackoffMs: 50,
    allowMutations: false,
    allowDestructive: false,
    logLevel: "error",
    transport: "stdio",
    httpPort: 8819,
    httpHost: "127.0.0.1",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DashboardApiClient", () => {
  it("sends the configured dashboard bearer token", async () => {
    globalThis.fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer dashboard-secret");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const client = new DashboardApiClient(
      config({ dashboardApiToken: "dashboard-secret" }),
      new Logger("error")
    );
    assert.deepEqual(await client.get("/api/health"), { ok: true });
  });

  it("sends JSON bodies with DELETE requests", async () => {
    globalThis.fetch = (async (_input, init) => {
      assert.equal(init?.method, "DELETE");
      assert.deepEqual(JSON.parse(String(init?.body)), { path: "/tmp/config.toml" });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    assert.deepEqual(
      await client.delete("/api/codex-config/file", {
        body: { path: "/tmp/config.toml" },
      }),
      { ok: true }
    );
  });

  it("rejects multipart uploads above the cumulative size cap before fetch", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ccam-mcp-upload-"));
    const first = path.join(directory, "first.jsonl");
    const second = path.join(directory, "second.jsonl");
    await writeFile(first, Buffer.alloc(50 * 1024 * 1024));
    await writeFile(second, Buffer.alloc(50 * 1024 * 1024 + 1));
    globalThis.fetch = (async () => {
      assert.fail("fetch must not run for oversized uploads");
    }) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    await assert.rejects(() => client.postFiles("/api/import/upload", [first, second]), {
      code: "TOO_LARGE",
    });
  });

  it("rejects oversized binary responses from Content-Length", async () => {
    globalThis.fetch = (async () =>
      new Response("x", {
        status: 200,
        headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      })) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    await assert.rejects(() => client.getBinary("/api/sessions/id/transcript-image"), {
      code: "TOO_LARGE",
    });
  });

  it("rejects automatic redirects so bearer headers never cross routes", async () => {
    globalThis.fetch = (async (_input, init) => {
      assert.equal(init?.redirect, "error");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const client = new DashboardApiClient(
      config({ dashboardApiToken: "dashboard-secret" }),
      new Logger("error")
    );
    await client.get("/api/health");
  });
});
