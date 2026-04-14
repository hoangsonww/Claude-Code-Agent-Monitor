/**
 * @file formatter.test.ts
 * @description Unit tests for the formatter module, which provides functions to format various UI components such as boxes, dividers, tables, badges, tool results, key-value pairs, section headers, and progress bars. The tests cover rendering of these components with different inputs and verify that the output contains the expected text and formatting. The tests use Node's built-in test runner and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
