/**
 * @file logger.test.ts
 * @description Unit tests for the Logger class, which is responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The tests cover writing logs to stderr, respecting minimum log levels, omitting meta when empty, and ensuring that each log line is valid JSON. The tests use Node's built-in test runner and assert module for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
