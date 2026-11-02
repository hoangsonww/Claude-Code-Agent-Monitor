/**
 * @file banner.test.ts
 * @description Unit tests for the banner module, which includes functions for printing the ASCII art banner, server information, ready message, and shutdown message to the console. The tests verify that the banner is printed correctly, that server information includes all expected fields, and that the ready and shutdown messages are displayed as intended. The tests use Node's built-in test framework and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/banner.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the banner module, which includes functions for printing the ASCII art banner,
 * server information, ready message, and shutdown message to the console. The tests verify that the
 * banner is printed correctly, that server information includes all expected fields, and that the
 * ready and shutdown messages are displayed as intended. The tests use Node's built-in test
 * framework and assert module for assertions.
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
 * - `../src/ui/banner.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../src/ui/colors.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `captureStdout` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `banner` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `displays all provided info fields` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `omits port when not provided` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `outputs ASCII art banner` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `outputs multiple lines` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `outputs ready message with transport` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `outputs shutdown message` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `printBanner()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `printReady()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `printServerInfo()` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `printShutdown()` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `shows dashboard prerequisite hint` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/banner.test.ts` .
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
 * Path: `mcp/__tests__/banner.test.ts`
 *
 * Scope
 * Unit tests for the banner module, which includes functions for printing the ASCII art banner,
 * server information, ready message, and shutdown message to the console. The tests verify that the
 * banner is printed correctly, that server information includes all expected fields, and that the
 * ready and shutdown messages are displayed as intended. The tests use Node's built-in test
 * framework and assert module for assertions.
 *
 * Subjects and collaborators
 * - `../src/ui/colors.js` — local module imported by this suite.
 * - `../src/ui/banner.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `banner`
 * - `printBanner()`
 * - `printServerInfo()`
 * - `printReady()`
 * - `printShutdown()`
 *
 * Protected behavior
 * - outputs ASCII art banner
 * - outputs multiple lines
 * - displays all provided info fields
 * - omits port when not provided
 * - shows dashboard prerequisite hint
 * - outputs ready message with transport
 * - outputs shutdown message
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
import { stripAnsi } from "../src/ui/colors.js";
import { printBanner, printServerInfo, printReady, printShutdown } from "../src/ui/banner.js";

function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const origWrite = process.stdout.write;
  process.stdout.write = ((data: string) => {
    chunks.push(data);
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = origWrite;
  }
  return chunks.join("");
}

describe("banner", () => {
  describe("printBanner()", () => {
    it("outputs ASCII art banner", () => {
      const output = captureStdout(() => printBanner());
      const text = stripAnsi(output);
      assert.ok(text.includes("$$"), "Banner should contain $$ font characters");
      // The banner spells "MCP Tools" in dollar-sign FIGlet font
      assert.ok(output.length > 200, "Banner should be substantial");
    });

    it("outputs multiple lines", () => {
      const output = captureStdout(() => printBanner());
      const lines = output.split("\n").filter((l) => l.trim().length > 0);
      assert.ok(lines.length >= 6, `Expected at least 6 lines, got ${lines.length}`);
    });
  });

  describe("printServerInfo()", () => {
    it("displays all provided info fields", () => {
      const output = captureStdout(() =>
        printServerInfo({
          transport: "http",
          version: "2.0.0",
          dashboard: "http://localhost:4820/",
          port: 8819,
          mutations: true,
          destructive: false,
          tools: 25,
        })
      );
      const text = stripAnsi(output);
      assert.ok(text.includes("Agent Dashboard MCP Server"));
      assert.ok(text.includes("2.0.0"));
      assert.ok(text.includes("HTTP"));
      assert.ok(text.includes("localhost:4820"));
      assert.ok(text.includes("8819"));
      assert.ok(text.includes("25"));
      assert.ok(text.includes("ENABLED")); // mutations
      assert.ok(text.includes("disabled")); // destructive
    });

    it("omits port when not provided", () => {
      const output = captureStdout(() =>
        printServerInfo({
          transport: "stdio",
          version: "1.0.0",
          dashboard: "http://127.0.0.1:4820/",
          mutations: false,
          destructive: false,
          tools: 25,
        })
      );
      const text = stripAnsi(output);
      assert.ok(!text.includes("HTTP Port"));
    });

    it("shows dashboard prerequisite hint", () => {
      const output = captureStdout(() =>
        printServerInfo({
          transport: "repl",
          version: "1.0.0",
          dashboard: "http://127.0.0.1:4820/",
          mutations: false,
          destructive: false,
          tools: 25,
        })
      );
      const text = stripAnsi(output);
      assert.ok(text.includes("Dashboard must be running"));
      assert.ok(text.includes("npm run dev"));
    });
  });

  describe("printReady()", () => {
    it("outputs ready message with transport", () => {
      const output = captureStdout(() => printReady("http"));
      const text = stripAnsi(output);
      assert.ok(text.includes("✔"));
      assert.ok(text.includes("Server ready"));
      assert.ok(text.includes("http"));
    });
  });

  describe("printShutdown()", () => {
    it("outputs shutdown message", () => {
      const output = captureStdout(() => printShutdown());
      const text = stripAnsi(output);
      assert.ok(text.includes("Shutting down"));
    });
  });
});
