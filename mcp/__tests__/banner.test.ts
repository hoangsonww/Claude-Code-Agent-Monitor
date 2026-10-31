/**
 * @file banner.test.ts
 * @description Unit tests for the banner module, which includes functions for printing the ASCII art banner, server information, ready message, and shutdown message to the console. The tests verify that the banner is printed correctly, that server information includes all expected fields, and that the ready and shutdown messages are displayed as intended. The tests use Node's built-in test framework and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
