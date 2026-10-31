/**
 * @file tool-guards.test.ts
 * @description Unit tests for the tool guard functions, which are responsible for enforcing configuration policies related to mutating and destructive tools. The tests cover scenarios where mutations and destructive actions are enabled or disabled in the configuration, as well as validating the confirmation token for destructive actions. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `mcp/__tests__/tool-guards.test.ts`
 *
 * Scope
 * Unit tests for the tool guard functions, which are responsible for enforcing configuration
 * policies related to mutating and destructive tools. The tests cover scenarios where mutations and
 * destructive actions are enabled or disabled in the configuration, as well as validating the
 * confirmation token for destructive actions. The tests use Node's built-in test runner and assert
 * module for assertions.
 *
 * Subjects and collaborators
 * - `../src/policy/tool-guards.js` — local module imported by this suite.
 * - `../src/config/app-config.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `assertMutationsEnabled`
 * - `assertDestructiveEnabled`
 *
 * Protected behavior
 * - throws when mutations disabled
 * - does not throw when mutations enabled
 * - throws when mutations disabled (even if destructive enabled)
 * - throws when destructive disabled
 * - throws on wrong confirmation token
 * - passes with correct config and token
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
import { assertMutationsEnabled, assertDestructiveEnabled } from "../src/policy/tool-guards.js";
import type { AppConfig } from "../src/config/app-config.js";

function fakeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    serverName: "test",
    serverVersion: "1.0.0",
    dashboardBaseUrl: new URL("http://127.0.0.1:4820"),
    requestTimeoutMs: 10_000,
    retryCount: 2,
    retryBackoffMs: 250,
    allowMutations: false,
    allowDestructive: false,
    logLevel: "error",
    transport: "stdio",
    httpPort: 8819,
    httpHost: "127.0.0.1",
    ...overrides,
  };
}

describe("assertMutationsEnabled", () => {
  it("throws when mutations disabled", () => {
    assert.throws(
      () => assertMutationsEnabled(fakeConfig({ allowMutations: false })),
      /Mutating tools are disabled/
    );
  });

  it("does not throw when mutations enabled", () => {
    assert.doesNotThrow(() => assertMutationsEnabled(fakeConfig({ allowMutations: true })));
  });
});

describe("assertDestructiveEnabled", () => {
  it("throws when mutations disabled (even if destructive enabled)", () => {
    assert.throws(
      () =>
        assertDestructiveEnabled(
          fakeConfig({ allowMutations: false, allowDestructive: true }),
          "CLEAR_ALL_DATA"
        ),
      /Mutating tools are disabled/
    );
  });

  it("throws when destructive disabled", () => {
    assert.throws(
      () =>
        assertDestructiveEnabled(
          fakeConfig({ allowMutations: true, allowDestructive: false }),
          "CLEAR_ALL_DATA"
        ),
      /Destructive tools are disabled/
    );
  });

  it("throws on wrong confirmation token", () => {
    assert.throws(
      () =>
        assertDestructiveEnabled(
          fakeConfig({ allowMutations: true, allowDestructive: true }),
          "WRONG_TOKEN"
        ),
      /Invalid confirmation_token/
    );
  });

  it("passes with correct config and token", () => {
    assert.doesNotThrow(() =>
      assertDestructiveEnabled(
        fakeConfig({ allowMutations: true, allowDestructive: true }),
        "CLEAR_ALL_DATA"
      )
    );
  });
});
