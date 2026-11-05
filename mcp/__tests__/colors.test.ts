/**
 * @file colors.test.ts
 * @description Unit tests for the colors module, which provides functions for styling console output with ANSI escape codes. The tests cover the stripAnsi function for removing ANSI codes from strings, the existence and functionality of various style functions (e.g., bold, red, bgBlue), and the composable styles like success, error, warn, info, muted, highlight, label, and accent. The tests also verify that the fg256 and bg256 functions return functions that correctly wrap text with the specified 256-color codes. The tests use Node's built-in test framework and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/colors.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the colors module, which provides functions for styling console output with ANSI
 * escape codes. The tests cover the stripAnsi function for removing ANSI codes from strings, the
 * existence and functionality of various style functions (e.g., bold, red, bgBlue), and the
 * composable styles like success, error, warn, info, muted, highlight, label, and accent. The tests
 * also verify that the fg256 and bg256 functions return functions that correctly wrap text with the
 * specified 256-color codes. The tests use Node's built-in test framework and assert module for
 * assertions.
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
 * - `../src/ui/colors.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `accent() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `bg256 returns a function that wraps text` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `colors` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `composable styles` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `error() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `fg256 and bg256` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `fg256 returns a function that wraps text` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `handles empty string` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles multiple escape sequences` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `highlight() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `info() wraps text` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `label() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `muted() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `removes ANSI escape codes` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `returns plain text unchanged` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `stripAnsi` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `style functions exist and are callable` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `success() wraps text` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `warn() wraps text` — executable behavior named by this suite; preserve the observable contract
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/colors.test.ts` .
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
 * Path: `mcp/__tests__/colors.test.ts`
 *
 * Scope
 * Unit tests for the colors module, which provides functions for styling console output with ANSI
 * escape codes. The tests cover the stripAnsi function for removing ANSI codes from strings, the
 * existence and functionality of various style functions (e.g., bold, red, bgBlue), and the
 * composable styles like success, error, warn, info, muted, highlight, label, and accent. The tests
 * also verify that the fg256 and bg256 functions return functions that correctly wrap text with the
 * specified 256-color codes. The tests use Node's built-in test framework and assert module for
 * assertions.
 *
 * Subjects and collaborators
 * - `../src/ui/colors.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `colors`
 * - `stripAnsi`
 * - `style functions exist and are callable`
 * - `composable styles`
 * - `fg256 and bg256`
 *
 * Protected behavior
 * - removes ANSI escape codes
 * - returns plain text unchanged
 * - handles empty string
 * - handles multiple escape sequences
 * - ${name}() returns a string
 * - success() wraps text
 * - error() wraps text
 * - warn() wraps text
 * - info() wraps text
 * - muted() wraps text
 * - highlight() wraps text
 * - label() wraps text
 * - accent() wraps text
 * - fg256 returns a function that wraps text
 * - bg256 returns a function that wraps text
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
import * as c from "../src/ui/colors.js";

describe("colors", () => {
  describe("stripAnsi", () => {
    it("removes ANSI escape codes", () => {
      const colored = "\x1b[1m\x1b[32mHello\x1b[39m\x1b[22m";
      assert.equal(c.stripAnsi(colored), "Hello");
    });

    it("returns plain text unchanged", () => {
      assert.equal(c.stripAnsi("plain text"), "plain text");
    });

    it("handles empty string", () => {
      assert.equal(c.stripAnsi(""), "");
    });

    it("handles multiple escape sequences", () => {
      const text = "\x1b[31mred\x1b[39m \x1b[34mblue\x1b[39m";
      assert.equal(c.stripAnsi(text), "red blue");
    });
  });

  describe("style functions exist and are callable", () => {
    const styleFns = [
      "bold",
      "dim",
      "italic",
      "underline",
      "strikethrough",
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "gray",
      "brightRed",
      "brightGreen",
      "brightYellow",
      "brightBlue",
      "brightMagenta",
      "brightCyan",
      "brightWhite",
      "bgRed",
      "bgGreen",
      "bgYellow",
      "bgBlue",
      "bgMagenta",
      "bgCyan",
      "bgWhite",
      "bgGray",
    ] as const;

    for (const name of styleFns) {
      it(`${name}() returns a string`, () => {
        const fn = c[name] as (t: string) => string;
        assert.equal(typeof fn, "function");
        const result = fn("test");
        assert.equal(typeof result, "string");
        assert.ok(c.stripAnsi(result).includes("test"));
      });
    }
  });

  describe("composable styles", () => {
    it("success() wraps text", () => {
      const r = c.success("OK");
      assert.equal(c.stripAnsi(r), "OK");
    });

    it("error() wraps text", () => {
      const r = c.error("FAIL");
      assert.equal(c.stripAnsi(r), "FAIL");
    });

    it("warn() wraps text", () => {
      const r = c.warn("CAUTION");
      assert.equal(c.stripAnsi(r), "CAUTION");
    });

    it("info() wraps text", () => {
      const r = c.info("INFO");
      assert.equal(c.stripAnsi(r), "INFO");
    });

    it("muted() wraps text", () => {
      const r = c.muted("dim");
      assert.equal(c.stripAnsi(r), "dim");
    });

    it("highlight() wraps text", () => {
      const r = c.highlight("HL");
      assert.equal(c.stripAnsi(r), "HL");
    });

    it("label() wraps text", () => {
      const r = c.label("LBL");
      assert.equal(c.stripAnsi(r), "LBL");
    });

    it("accent() wraps text", () => {
      const r = c.accent("ACC");
      assert.equal(c.stripAnsi(r), "ACC");
    });
  });

  describe("fg256 and bg256", () => {
    it("fg256 returns a function that wraps text", () => {
      const fn = c.fg256(196);
      assert.equal(typeof fn, "function");
      const result = fn("red");
      assert.equal(c.stripAnsi(result), "red");
    });

    it("bg256 returns a function that wraps text", () => {
      const fn = c.bg256(46);
      assert.equal(typeof fn, "function");
      const result = fn("bg");
      assert.equal(c.stripAnsi(result), "bg");
    });
  });
});
