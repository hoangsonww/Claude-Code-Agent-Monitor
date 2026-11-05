/**
 * @file logger.test.ts
 * @description Unit tests for the Logger class, which is responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The tests cover writing logs to stderr, respecting minimum log levels, omitting meta when empty, and ensuring that each log line is valid JSON. The tests use Node's built-in test runner and assert module for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/logger.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the Logger class, which is responsible for logging messages in JSON format to
 * stderr with different log levels (debug, info, warn, error). The tests cover writing logs to
 * stderr, respecting minimum log levels, omitting meta when empty, and ensuring that each log line
 * is valid JSON. The tests use Node's built-in test runner and assert module for assertions and
 * mocking.
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
 * - `../src/core/logger.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `Logger` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `omits meta when empty` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `outputs valid JSON on each line` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `respects minimum log level` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `writes to stderr` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/logger.test.ts` .
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
 * Path: `mcp/__tests__/logger.test.ts`
 *
 * Scope
 * Unit tests for the Logger class, which is responsible for logging messages in JSON format to
 * stderr with different log levels (debug, info, warn, error). The tests cover writing logs to
 * stderr, respecting minimum log levels, omitting meta when empty, and ensuring that each log line
 * is valid JSON. The tests use Node's built-in test runner and assert module for assertions and
 * mocking.
 *
 * Subjects and collaborators
 * - `../src/core/logger.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `Logger`
 *
 * Protected behavior
 * - writes to stderr
 * - respects minimum log level
 * - omits meta when empty
 * - outputs valid JSON on each line
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
import { Logger } from "../src/core/logger.js";

describe("Logger", () => {
  it("writes to stderr", () => {
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((data: string) => {
      chunks.push(data);
      return true;
    }) as typeof process.stderr.write;

    try {
      const logger = new Logger("debug");
      logger.info("test message", { key: "value" });

      assert.equal(chunks.length, 1);
      const parsed = JSON.parse(chunks[0]);
      assert.equal(parsed.level, "info");
      assert.equal(parsed.message, "test message");
      assert.equal(parsed.meta.key, "value");
      assert.ok(parsed.timestamp);
    } finally {
      process.stderr.write = origWrite;
    }
  });

  it("respects minimum log level", () => {
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((data: string) => {
      chunks.push(data);
      return true;
    }) as typeof process.stderr.write;

    try {
      const logger = new Logger("warn");
      logger.debug("should be suppressed");
      logger.info("should be suppressed too");
      logger.warn("should appear");
      logger.error("should also appear");

      assert.equal(chunks.length, 2);
      assert.ok(JSON.parse(chunks[0]).level === "warn");
      assert.ok(JSON.parse(chunks[1]).level === "error");
    } finally {
      process.stderr.write = origWrite;
    }
  });

  it("omits meta when empty", () => {
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((data: string) => {
      chunks.push(data);
      return true;
    }) as typeof process.stderr.write;

    try {
      const logger = new Logger("info");
      logger.info("no meta");

      const parsed = JSON.parse(chunks[0]);
      assert.equal(parsed.meta, undefined);
    } finally {
      process.stderr.write = origWrite;
    }
  });

  it("outputs valid JSON on each line", () => {
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((data: string) => {
      chunks.push(data);
      return true;
    }) as typeof process.stderr.write;

    try {
      const logger = new Logger("debug");
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      for (const chunk of chunks) {
        assert.doesNotThrow(() => JSON.parse(chunk), "Each log line must be valid JSON");
      }
    } finally {
      process.stderr.write = origWrite;
    }
  });
});
