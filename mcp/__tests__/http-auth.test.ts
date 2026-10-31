/**
 * @file http-auth.test.ts
 * @description Verifies MCP HTTP transport bearer-token matching without
 * starting a network listener.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `mcp/__tests__/http-auth.test.ts`
 *
 * Scope
 * Verifies MCP HTTP transport bearer-token matching without starting a network listener.
 *
 * Subjects and collaborators
 * - `../src/transports/http-server.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `MCP HTTP authentication`
 *
 * Protected behavior
 * - is disabled when no token is configured
 * - accepts bearer and x-mcp-token credentials
 * - rejects missing or invalid credentials
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
import { isHttpRequestAuthorized } from "../src/transports/http-server.js";

describe("MCP HTTP authentication", () => {
  it("is disabled when no token is configured", () => {
    assert.equal(isHttpRequestAuthorized({}, undefined), true);
  });

  it("accepts bearer and x-mcp-token credentials", () => {
    assert.equal(
      isHttpRequestAuthorized({ authorization: "Bearer mcp-secret" }, "mcp-secret"),
      true
    );
    assert.equal(isHttpRequestAuthorized({ "x-mcp-token": "mcp-secret" }, "mcp-secret"), true);
  });

  it("rejects missing or invalid credentials", () => {
    assert.equal(isHttpRequestAuthorized({}, "mcp-secret"), false);
    assert.equal(isHttpRequestAuthorized({ authorization: "Bearer wrong" }, "mcp-secret"), false);
  });
});
