/**
 * @file tool-guards.test.ts
 * @description Unit tests for the tool guard functions, which are responsible for enforcing configuration policies related to mutating and destructive tools. The tests cover scenarios where mutations and destructive actions are enabled or disabled in the configuration, as well as validating the confirmation token for destructive actions. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/tool-guards.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the tool guard functions, which are responsible for enforcing configuration
 * policies related to mutating and destructive tools. The tests cover scenarios where mutations and
 * destructive actions are enabled or disabled in the configuration, as well as validating the
 * confirmation token for destructive actions. The tests use Node's built-in test runner and assert
 * module for assertions.
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
 * - `../src/policy/tool-guards.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `fakeConfig` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `assertDestructiveEnabled` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `assertMutationsEnabled` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `does not throw when mutations enabled` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `passes with correct config and token` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `throws on wrong confirmation token` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `throws when destructive disabled` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `throws when mutations disabled` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `throws when mutations disabled (even if destructive enabled)` — executable behavior named by
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/tool-guards.test.ts` .
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
