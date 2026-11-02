/**
 * @file formatter.test.ts
 * @description Unit tests for the formatter module, which provides functions to format various UI components such as boxes, dividers, tables, badges, tool results, key-value pairs, section headers, and progress bars. The tests cover rendering of these components with different inputs and verify that the output contains the expected text and formatting. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/formatter.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the formatter module, which provides functions to format various UI components
 * such as boxes, dividers, tables, badges, tool results, key-value pairs, section headers, and
 * progress bars. The tests cover rendering of these components with different inputs and verify
 * that the output contains the expected text and formatting. The tests use Node's built-in test
 * runner and assert module for assertions.
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
 * - `../src/ui/formatter.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `plain` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `applies column color functions` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `auto-sizes columns when width not specified` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `badge()` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `box()` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `clamps negative to 0%` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `clamps over 100%` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `divider()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `formats error with name, message, and duration` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `formats successful result with name and duration` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `formatter` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `formatToolError()` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `formatToolResult()` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles empty rows` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles multi-line content` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `handles null data` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `handles string data` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `keyValue()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `progressBar()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `renders 0%` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `renders 100%` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `renders 50%` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `renders a box with title and content` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `renders a horizontal line` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders header and rows` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders known statuses` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders label-value pairs` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders section title with diamond icon` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `renders unknown status with muted style` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `respects custom width` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `sectionHeader()` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `table()` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `truncates very long JSON output` — executable behavior named by this suite; preserve the
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/formatter.test.ts` .
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
 * Path: `mcp/__tests__/formatter.test.ts`
 *
 * Scope
 * Unit tests for the formatter module, which provides functions to format various UI components such
 * as boxes, dividers, tables, badges, tool results, key-value pairs, section headers, and progress
 * bars. The tests cover rendering of these components with different inputs and verify that the
 * output contains the expected text and formatting. The tests use Node's built-in test runner and
 * assert module for assertions.
 *
 * Subjects and collaborators
 * - `../src/ui/colors.js` — local module imported by this suite.
 * - `../src/ui/formatter.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `formatter`
 * - `box()`
 * - `divider()`
 * - `table()`
 * - `badge()`
 * - `formatToolResult()`
 * - `formatToolError()`
 * - `keyValue()`
 * - `sectionHeader()`
 * - `progressBar()`
 *
 * Protected behavior
 * - renders a box with title and content
 * - handles multi-line content
 * - respects custom width
 * - renders a horizontal line
 * - renders header and rows
 * - handles empty rows
 * - auto-sizes columns when width not specified
 * - applies column color functions
 * - renders known statuses
 * - renders unknown status with muted style
 * - formats successful result with name and duration
 * - handles null data
 * - handles string data
 * - truncates very long JSON output
 * - formats error with name, message, and duration
 * - renders label-value pairs
 * - renders section title with diamond icon
 * - renders 0%
 * - renders 100%
 * - renders 50%
 * - clamps over 100%
 * - clamps negative to 0%
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
import {
  box,
  divider,
  table,
  badge,
  formatToolResult,
  formatToolError,
  keyValue,
  sectionHeader,
  progressBar,
  type Column,
} from "../src/ui/formatter.js";

function plain(s: string): string {
  return stripAnsi(s);
}

describe("formatter", () => {
  describe("box()", () => {
    it("renders a box with title and content", () => {
      const result = box("Title", "Hello world");
      const text = plain(result);
      assert.ok(text.includes("Title"));
      assert.ok(text.includes("Hello world"));
      assert.ok(text.includes("╭"));
      assert.ok(text.includes("╰"));
    });

    it("handles multi-line content", () => {
      const result = box("Multi", "line one\nline two\nline three");
      const text = plain(result);
      assert.ok(text.includes("line one"));
      assert.ok(text.includes("line two"));
      assert.ok(text.includes("line three"));
    });

    it("respects custom width", () => {
      const result = box("W", "test", 40);
      const lines = result.split("\n");
      // Bottom border should be exactly width chars (visible)
      const bottomVisible = plain(lines[lines.length - 1]);
      assert.equal(bottomVisible.length, 40);
    });
  });

  describe("divider()", () => {
    it("renders a horizontal line", () => {
      const result = divider(30);
      const text = plain(result);
      assert.equal(text.length, 30);
      assert.ok(text.includes("─"));
    });
  });

  describe("table()", () => {
    const cols: Column[] = [
      { key: "name", label: "Name", width: 12 },
      { key: "status", label: "Status", width: 10 },
    ];

    it("renders header and rows", () => {
      const rows = [
        { name: "Alice", status: "active" },
        { name: "Bob", status: "idle" },
      ];
      const result = table(cols, rows);
      const text = plain(result);
      assert.ok(text.includes("Name"));
      assert.ok(text.includes("Status"));
      assert.ok(text.includes("Alice"));
      assert.ok(text.includes("Bob"));
      assert.ok(text.includes("active"));
      assert.ok(text.includes("idle"));
    });

    it("handles empty rows", () => {
      const result = table(cols, []);
      const text = plain(result);
      assert.ok(text.includes("Name"));
      assert.ok(text.includes("Status"));
    });

    it("auto-sizes columns when width not specified", () => {
      const autoCols: Column[] = [
        { key: "x", label: "X" },
        { key: "y", label: "LongerLabel" },
      ];
      const rows = [{ x: "short", y: "val" }];
      const result = table(autoCols, rows);
      assert.ok(plain(result).includes("X"));
      assert.ok(plain(result).includes("LongerLabel"));
    });

    it("applies column color functions", () => {
      const colorCols: Column[] = [
        { key: "name", label: "Name", width: 10, color: (t: string) => `[${t}]` },
      ];
      const rows = [{ name: "test" }];
      const result = table(colorCols, rows);
      assert.ok(result.includes("[test]"));
    });
  });

  describe("badge()", () => {
    it("renders known statuses", () => {
      for (const status of ["active", "completed", "error", "abandoned", "idle", "ok", "healthy"]) {
        const result = badge(status);
        assert.ok(plain(result).includes(status.toUpperCase()));
      }
    });

    it("renders unknown status with muted style", () => {
      const result = badge("custom");
      assert.ok(plain(result).includes("CUSTOM"));
    });
  });

  describe("formatToolResult()", () => {
    it("formats successful result with name and duration", () => {
      const result = formatToolResult("my_tool", { ok: true }, 42);
      const text = plain(result);
      assert.ok(text.includes("✔"));
      assert.ok(text.includes("my_tool"));
      assert.ok(text.includes("42ms"));
    });

    it("handles null data", () => {
      const result = formatToolResult("null_tool", null, 10);
      const text = plain(result);
      assert.ok(text.includes("(no data)"));
    });

    it("handles string data", () => {
      const result = formatToolResult("str_tool", "just a string", 5);
      const text = plain(result);
      assert.ok(text.includes("just a string"));
    });

    it("truncates very long JSON output", () => {
      const bigObj: Record<string, number> = {};
      for (let i = 0; i < 100; i++) bigObj[`key_${i}`] = i;
      const result = formatToolResult("big_tool", bigObj, 100);
      const text = plain(result);
      assert.ok(text.includes("more lines"));
    });
  });

  describe("formatToolError()", () => {
    it("formats error with name, message, and duration", () => {
      const result = formatToolError("bad_tool", "Connection refused", 150);
      const text = plain(result);
      assert.ok(text.includes("✘"));
      assert.ok(text.includes("bad_tool"));
      assert.ok(text.includes("150ms"));
      assert.ok(text.includes("Connection refused"));
    });
  });

  describe("keyValue()", () => {
    it("renders label-value pairs", () => {
      const result = keyValue([
        ["Transport", "HTTP"],
        ["Port", "8819"],
      ]);
      const text = plain(result);
      assert.ok(text.includes("Transport"));
      assert.ok(text.includes("HTTP"));
      assert.ok(text.includes("Port"));
      assert.ok(text.includes("8819"));
    });
  });

  describe("sectionHeader()", () => {
    it("renders section title with diamond icon", () => {
      const result = sectionHeader("Sessions");
      const text = plain(result);
      assert.ok(text.includes("◆"));
      assert.ok(text.includes("Sessions"));
    });
  });

  describe("progressBar()", () => {
    it("renders 0%", () => {
      const result = progressBar(0, 100);
      const text = plain(result);
      assert.ok(text.includes("0%"));
    });

    it("renders 100%", () => {
      const result = progressBar(100, 100);
      const text = plain(result);
      assert.ok(text.includes("100%"));
    });

    it("renders 50%", () => {
      const result = progressBar(50, 100);
      const text = plain(result);
      assert.ok(text.includes("50%"));
    });

    it("clamps over 100%", () => {
      const result = progressBar(200, 100);
      const text = plain(result);
      assert.ok(text.includes("100%"));
    });

    it("clamps negative to 0%", () => {
      const result = progressBar(-5, 100);
      const text = plain(result);
      assert.ok(text.includes("0%"));
    });
  });
});
