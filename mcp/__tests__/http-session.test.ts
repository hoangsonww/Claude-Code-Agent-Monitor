/**
 * @file http-session.test.ts
 * @description End-to-end regression tests for Streamable HTTP session tracking. These start a real listener because the defect they guard against was in the wiring rather than in any pure helper: the session id handed to the client in the `mcp-session-id` response header must be the key the server tracks the transport under, so every follow-up request routes back to the same session instead of falling through to "Bad Request: No valid session or initialization". Also covers session release on DELETE, rejection of unknown session ids, and the legacy SSE endpoint continuing to hand out its own session.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/http-session.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * End-to-end regression tests for Streamable HTTP session tracking. These start a real listener
 * because the defect they guard against was in the wiring rather than in any pure helper: the
 * session id handed to the client in the `mcp-session-id` response header must be the key the
 * server tracks the transport under, so every follow-up request routes back to the same session
 * instead of falling through to "Bad Request: No valid session or initialization". Also covers
 * session release on DELETE, rejection of unknown session ids, and the legacy SSE endpoint
 * continuing to hand out its own session.
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
 * - `../src/server.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../src/transports/http-server.js` — repository-local contract consumed by this module; review
 *   its exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:net` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `firstSsePayload` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `freePort` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `INITIALIZE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `JSON_HEADERS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `counts exactly one active session per handshake and releases it on DELETE` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `leaves an active session alone` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `reaps a session abandoned without DELETE` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `rejects an unknown session id` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `still serves the legacy SSE endpoint its own session` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `Streamable HTTP session tracking` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `tracks the session under the id it returns to the client` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/http-session.test.ts` .
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
 * Path: `mcp/__tests__/http-session.test.ts`
 *
 * Scope
 * End-to-end regression tests for Streamable HTTP session tracking. These start a real listener
 * because the defect they guard against was in the wiring rather than in any pure helper: the
 * session id handed to the client in the `mcp-session-id` response header must be the key the server
 * tracks the transport under, so every follow-up request routes back to the same session instead of
 * falling through to "Bad Request: No valid session or initialization". Also covers session release
 * on DELETE, rejection of unknown session ids, and the legacy SSE endpoint continuing to hand out
 * its own session.
 *
 * Subjects and collaborators
 * - `../src/config/app-config.js` — local module imported by this suite.
 * - `../src/core/logger.js` — local module imported by this suite.
 * - `../src/clients/dashboard-api-client.js` — local module imported by this suite.
 * - `../src/server.js` — local module imported by this suite.
 * - `../src/transports/http-server.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 * - Network boundaries are replaced with deterministic responses; no test depends on an external
 *   service.
 *
 * Suite groups
 * - `Streamable HTTP session tracking`
 *
 * Protected behavior
 * - tracks the session under the id it returns to the client
 * - counts exactly one active session per handshake and releases it on DELETE
 * - rejects an unknown session id
 * - reaps a session abandoned without DELETE
 * - leaves an active session alone
 * - still serves the legacy SSE endpoint its own session
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

import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, it } from "node:test";
import { loadConfig } from "../src/config/app-config.js";
import { Logger } from "../src/core/logger.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";
import { buildServer } from "../src/server.js";
import { startHttpServer } from "../src/transports/http-server.js";

/** Reserve a free port by binding to 0 and releasing it immediately. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "http-session-test", version: "1.0.0" },
  },
};

/** Pull the first SSE `data:` payload out of a response body. */
function firstSsePayload(body: string): Record<string, unknown> {
  const line = body.split("\n").find((l) => l.startsWith("data: "));
  assert.ok(line, `no SSE data frame in response: ${body}`);
  return JSON.parse(line.slice(6));
}

describe("Streamable HTTP session tracking", () => {
  let port: number;
  let base: string;
  let shutdown: () => Promise<void>;
  let reapIdleSessions: (now?: number) => Promise<number>;
  let writeSpy: typeof process.stdout.write;

  before(async () => {
    port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const config = loadConfig({
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_LOG_LEVEL: "error",
    } as NodeJS.ProcessEnv);
    const logger = new Logger(config.logLevel);
    const api = new DashboardApiClient(config, logger);

    // startHttpServer prints a banner/endpoint table; keep the test output clean.
    writeSpy = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      ({ shutdown, reapIdleSessions } = await startHttpServer(
        config,
        () => buildServer(config, api, logger),
        logger,
        0
      ));
    } finally {
      process.stdout.write = writeSpy;
    }
  });

  after(async () => {
    await shutdown?.();
  });

  it("tracks the session under the id it returns to the client", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    assert.equal(res.status, 200);
    const sessionId = res.headers.get("mcp-session-id");
    assert.ok(sessionId, "initialize must return an mcp-session-id header");
    await res.text();

    // The regression: this used to 400, because the transport was filed under
    // a second randomUUID() rather than the id the client was just handed.
    const initialized = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    assert.equal(initialized.status, 202);

    const listed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert.equal(listed.status, 200);
    const payload = firstSsePayload(await listed.text()) as {
      result?: { tools?: unknown[] };
    };
    assert.ok((payload.result?.tools?.length ?? 0) > 0, "tools/list must resolve on the session");

    await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
  });

  it("counts exactly one active session per handshake and releases it on DELETE", async () => {
    const activeSessions = async () =>
      (await (await fetch(`${base}/health`)).json()).activeSessions as number;

    const before = await activeSessions();

    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();

    assert.equal(await activeSessions(), before + 1, "handshake must track exactly one session");

    const deleted = await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
    assert.ok(deleted.ok, `DELETE should succeed, got ${deleted.status}`);
    assert.equal(await activeSessions(), before, "DELETE must release the session");
  });

  it("rejects an unknown session id", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": "not-a-real-session" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { message?: string } };
    assert.match(String(body.error?.message), /No valid session/);
  });

  it("reaps a session abandoned without DELETE", async () => {
    const activeSessions = async () =>
      (await (await fetch(`${base}/health`)).json()).activeSessions as number;

    const before = await activeSessions();
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();
    assert.equal(await activeSessions(), before + 1);

    // A client that simply vanishes never sends DELETE, so only the idle
    // sweep can reclaim it. Force it with a clock far past the timeout.
    const reaped = await reapIdleSessions(Date.now() + 2 * 60 * 60 * 1000);
    assert.ok(reaped >= 1, `expected at least one reaped session, got ${reaped}`);
    assert.equal(await activeSessions(), 0, "idle sweep must release the session");

    // The reaped session must no longer route.
    const afterReap = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
    });
    assert.equal(afterReap.status, 400);
  });

  it("leaves an active session alone", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();

    // Swept at "now": the session was just used, so it must survive.
    assert.equal(await reapIdleSessions(Date.now()), 0);

    const listed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
    });
    assert.equal(listed.status, 200);
    await listed.text();

    await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
  });

  it("still serves the legacy SSE endpoint its own session", async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/sse`, { signal: controller.signal });
    assert.equal(res.status, 200);
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const chunk = Buffer.from(value!).toString("utf8");
    assert.match(chunk, /\/messages\?sessionId=/);
    controller.abort();
    await reader.cancel().catch(() => {});
  });
});
