/**
 * @file colors.test.ts
 * @description Unit tests for the colors module, which provides functions for styling console output with ANSI escape codes. The tests cover the stripAnsi function for removing ANSI codes from strings, the existence and functionality of various style functions (e.g., bold, red, bgBlue), and the composable styles like success, error, warn, info, muted, highlight, label, and accent. The tests also verify that the fg256 and bg256 functions return functions that correctly wrap text with the specified 256-color codes. The tests use Node's built-in test framework and assert module for assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
