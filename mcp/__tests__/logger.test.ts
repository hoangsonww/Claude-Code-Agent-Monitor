/**
 * @file logger.test.ts
 * @description Unit tests for the Logger class, which is responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The tests cover writing logs to stderr, respecting minimum log levels, omitting meta when empty, and ensuring that each log line is valid JSON. The tests use Node's built-in test runner and assert module for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
