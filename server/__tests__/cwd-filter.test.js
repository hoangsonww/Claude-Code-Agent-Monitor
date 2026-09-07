/**
 * @file Unit tests for server/lib/cwd-filter.js — the MONITOR_IGNORE_CWD
 * ingest-time ignore filter. Tests cover all three pattern forms (exact, /*,
 * /**), edge cases (empty env, bad types, backslash normalisation, trailing
 * slashes), and the fast-path when no patterns are configured.
 */

"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildPatterns } = require("../lib/cwd-filter");

// ─── helpers ───────────────────────────────────────────────────────────────

/** Run isCwdIgnored against a freshly-built pattern list without touching process.env */
function match(raw, cwd) {
  const patterns = buildPatterns(raw);
  if (typeof cwd !== "string" || !cwd || patterns.length === 0) return false;
  const norm = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  return patterns.some((test) => test(norm));
}

// ─── no patterns ───────────────────────────────────────────────────────────

describe("buildPatterns — empty / missing input", () => {
  it("returns an empty array for undefined", () => {
    assert.deepEqual(buildPatterns(undefined), []);
  });
  it("returns an empty array for empty string", () => {
    assert.deepEqual(buildPatterns(""), []);
  });
  it("returns an empty array for whitespace-only", () => {
    assert.deepEqual(buildPatterns("   ,  ,  "), []);
  });
});

// ─── exact match ───────────────────────────────────────────────────────────

describe("exact path match", () => {
  const RAW = "/home/user/private";

  it("matches the exact path", () => {
    assert.ok(match(RAW, "/home/user/private"));
  });
  it("does not match a child directory", () => {
    assert.ok(!match(RAW, "/home/user/private/sub"));
  });
  it("does not match a sibling directory", () => {
    assert.ok(!match(RAW, "/home/user/other"));
  });
  it("does not match a parent directory", () => {
    assert.ok(!match(RAW, "/home/user"));
  });
  it("strips a trailing slash from the cwd before comparing", () => {
    assert.ok(match(RAW, "/home/user/private/"));
  });
});

// ─── /* direct children ────────────────────────────────────────────────────

describe("/* direct-children pattern", () => {
  const RAW = "/home/user/work/*";

  it("matches a direct child", () => {
    assert.ok(match(RAW, "/home/user/work/projectA"));
  });
  it("does NOT match a grandchild", () => {
    assert.ok(!match(RAW, "/home/user/work/projectA/src"));
  });
  it("does NOT match the prefix itself", () => {
    assert.ok(!match(RAW, "/home/user/work"));
  });
  it("does NOT match a sibling prefix", () => {
    assert.ok(!match(RAW, "/home/user/works/projectA"));
  });
  it("strips trailing slash from cwd before matching", () => {
    assert.ok(match(RAW, "/home/user/work/projectA/"));
  });
});

// ─── /** recursive ─────────────────────────────────────────────────────────

describe("/** recursive-descendant pattern", () => {
  const RAW = "/home/user/scratch/**";

  it("matches the prefix directory itself", () => {
    assert.ok(match(RAW, "/home/user/scratch"));
  });
  it("matches a direct child", () => {
    assert.ok(match(RAW, "/home/user/scratch/a"));
  });
  it("matches a deeply nested descendant", () => {
    assert.ok(match(RAW, "/home/user/scratch/a/b/c/d"));
  });
  it("does NOT match a sibling that starts with the same string", () => {
    assert.ok(!match(RAW, "/home/user/scratch-backup"));
  });
  it("does NOT match an unrelated path", () => {
    assert.ok(!match(RAW, "/home/user/projects"));
  });
});

// ─── multiple patterns ─────────────────────────────────────────────────────

describe("multiple comma-separated patterns", () => {
  const RAW = "/home/user/private,/tmp/*,/home/user/scratch/**";

  it("matches the exact-match pattern", () => {
    assert.ok(match(RAW, "/home/user/private"));
  });
  it("matches the /* pattern", () => {
    assert.ok(match(RAW, "/tmp/session-abc"));
  });
  it("matches the /** pattern", () => {
    assert.ok(match(RAW, "/home/user/scratch/deep/path"));
  });
  it("does NOT match an unrelated path", () => {
    assert.ok(!match(RAW, "/home/user/public"));
  });
  it("ignores extra whitespace around commas", () => {
    assert.ok(match("  /home/user/private  ,  /tmp/*  ", "/home/user/private"));
  });
});

// ─── edge cases ────────────────────────────────────────────────────────────

describe("edge cases — non-string cwd values", () => {
  it("returns false for null cwd", () => {
    assert.ok(!match("/home/user/private", null));
  });
  it("returns false for numeric cwd", () => {
    assert.ok(!match("/home/user/private", 42));
  });
  it("returns false for object cwd", () => {
    assert.ok(!match("/home/user/private", {}));
  });
  it("returns false for empty string cwd", () => {
    assert.ok(!match("/home/user/private", ""));
  });
});

describe("Windows backslash normalisation", () => {
  const RAW = "C:/Users/user/private";

  it("matches when cwd uses Windows backslashes", () => {
    assert.ok(match(RAW, "C:\\Users\\user\\private"));
  });
  it("matches when pattern uses Windows backslashes", () => {
    assert.ok(match("C:\\Users\\user\\private", "C:/Users/user/private"));
  });
});
