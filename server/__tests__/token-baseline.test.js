/**
 * @file Tests for replaceTokenUsage's compaction baseline semantics.
 *
 * The effective total for a bucket is `live + baseline`. It must behave as a
 * monotonic HIGH-WATER MARK: never decrease (so a compaction that shrinks the
 * transcript doesn't lose usage), but never inflate past the largest value ever
 * seen (so two writers hitting the same bucket with different scopes — the live
 * hook writer stores main-only tokens, importSession stores main+subagents —
 * can't ratchet the baseline upward on every downward fluctuation).
 *
 * Regression guard for the runaway that inflated one 26-day session's baseline
 * to ~11× its real usage (dashboard total $22.5k vs true ~$15.2k).
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-token-baseline-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;

after(() => {
  if (db) db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB + suffix);
    } catch {
      /* ignore */
    }
  }
});

// Write a cache_read value for a fixed bucket; return effective (live+baseline).
function writeCacheRead(sessionId, cacheRead) {
  stmts.replaceTokenUsage.run(
    sessionId,
    "claude-opus-4-8",
    "standard",
    "global",
    "standard",
    0, // input
    0, // output
    cacheRead,
    0, // cache_write
    0, // cache_write_1h
    0, // web_search
    0, // web_fetch
    0 // code_execution
  );
}
function effectiveCacheRead(sessionId) {
  const r = stmts.getTokensBySession.all(sessionId).find((x) => x.model === "claude-opus-4-8");
  return r ? r.cache_read_tokens : 0;
}
function rawRow(sessionId) {
  return db
    .prepare(
      "SELECT cache_read_tokens, baseline_cache_read FROM token_usage WHERE session_id = ? AND model = 'claude-opus-4-8'"
    )
    .get(sessionId);
}

describe("replaceTokenUsage — high-water-mark baseline", () => {
  before(() => {
    for (const id of ["hw-grow", "hw-idem", "hw-shrink", "hw-altern", "hw-recover"]) {
      try {
        stmts.insertSession.run(id, "t", "active", "/tmp", null, null);
      } catch {
        /* exists */
      }
    }
  });

  it("monotonic growth: effective follows the latest, no baseline", () => {
    writeCacheRead("hw-grow", 100);
    assert.equal(effectiveCacheRead("hw-grow"), 100);
    writeCacheRead("hw-grow", 300);
    assert.equal(effectiveCacheRead("hw-grow"), 300);
    assert.equal(rawRow("hw-grow").baseline_cache_read, 0);
  });

  it("idempotent: rewriting the same value never changes effective", () => {
    writeCacheRead("hw-idem", 500);
    writeCacheRead("hw-idem", 500);
    writeCacheRead("hw-idem", 500);
    assert.equal(effectiveCacheRead("hw-idem"), 500);
    assert.equal(rawRow("hw-idem").baseline_cache_read, 0);
  });

  it("decrease preserves the max (compaction never loses usage)", () => {
    writeCacheRead("hw-shrink", 300);
    writeCacheRead("hw-shrink", 100); // transcript shrank
    assert.equal(effectiveCacheRead("hw-shrink"), 300, "effective must not drop below the peak");
    const row = rawRow("hw-shrink");
    assert.equal(row.cache_read_tokens, 100);
    assert.equal(row.baseline_cache_read, 200); // 100 live + 200 baseline = 300
  });

  it("writer alternation does NOT run away (the bug)", () => {
    // Two writers: 'big' (main+subagents) and 'small' (main-only) on one bucket.
    for (let i = 0; i < 20; i++) {
      writeCacheRead("hw-altern", 800); // big writer
      writeCacheRead("hw-altern", 700); // small writer
    }
    // Effective must stay pinned at the true max (800), NOT accumulate.
    assert.equal(effectiveCacheRead("hw-altern"), 800, "effective must stay at the peak, not grow");
    assert.equal(rawRow("hw-altern").baseline_cache_read, 100); // 700 + 100 = 800
  });

  it("recovers upward: a new higher value zeroes stale baseline", () => {
    writeCacheRead("hw-recover", 300);
    writeCacheRead("hw-recover", 100); // baseline=200, eff=300
    writeCacheRead("hw-recover", 500); // new peak
    assert.equal(effectiveCacheRead("hw-recover"), 500);
    assert.equal(rawRow("hw-recover").baseline_cache_read, 0);
  });
});
