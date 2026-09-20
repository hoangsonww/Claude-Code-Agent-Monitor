/**
 * @file Guards the Codex sweep's bounded ingest retry. The sweep re-queues a
 * rollout it could not ingest so transient failures recover on the next pass;
 * without an upper bound a permanent failure is retried for the life of the
 * process — at the 4s sync default roughly 21,600 attempts per file per day,
 * each writing a log line. These tests pin the three properties that make the
 * bound safe: transient failures still retry, a permanent one stops, and new
 * bytes restore the full budget.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), `codex-retry-budget-${process.pid}-`));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");

const { createIngestRetryBudget } = require("../index");

const KEY = "ingest:/rollouts/one.jsonl";
const FP = "1024:1757370000000";

describe("Codex ingest retry budget", () => {
  it("spends exactly `limit` attempts at one fingerprint, then stops", () => {
    const budget = createIngestRetryBudget(3);

    assert.equal(budget.exhausted(KEY, FP), false);
    assert.deepEqual(budget.fail(KEY, FP), { count: 1, final: false });
    assert.equal(budget.exhausted(KEY, FP), false);
    assert.deepEqual(budget.fail(KEY, FP), { count: 2, final: false });
    assert.equal(budget.exhausted(KEY, FP), false);

    // The attempt that spends the budget is the only one flagged `final`, so
    // the caller logs once instead of on every sweep.
    assert.deepEqual(budget.fail(KEY, FP), { count: 3, final: true });
    assert.equal(budget.exhausted(KEY, FP), true);
    assert.equal(budget.fail(KEY, FP).final, false, "only one attempt is final");
  });

  it("restores the full budget when the file changes", () => {
    const budget = createIngestRetryBudget(2);
    budget.fail(KEY, FP);
    budget.fail(KEY, FP);
    assert.equal(budget.exhausted(KEY, FP), true);

    // A rollout that grows earns a fresh set of attempts: whatever broke may
    // have been a half-written record.
    const grown = "2048:1757370999000";
    assert.equal(budget.exhausted(KEY, grown), false);
    assert.deepEqual(budget.fail(KEY, grown), { count: 1, final: false });
  });

  it("clears the streak on success so later transients get the full budget", () => {
    const budget = createIngestRetryBudget(2);
    budget.fail(KEY, FP);
    budget.succeed(KEY);
    assert.equal(budget.exhausted(KEY, FP), false);
    assert.deepEqual(budget.fail(KEY, FP), { count: 1, final: false });
  });

  it("keys are independent, so one bad rollout cannot starve another", () => {
    const budget = createIngestRetryBudget(1);
    budget.fail("ingest:/rollouts/bad.jsonl", FP);
    assert.equal(budget.exhausted("ingest:/rollouts/bad.jsonl", FP), true);
    assert.equal(budget.exhausted("tools:/rollouts/bad.jsonl", FP), false);
    assert.equal(budget.exhausted("ingest:/rollouts/other.jsonl", FP), false);
  });

  it("defaults to 5 attempts and ignores nonsense limits", () => {
    for (const bad of [undefined, NaN, 0, -3, "many"]) {
      assert.equal(createIngestRetryBudget(bad).limit, 5);
    }
    assert.equal(createIngestRetryBudget(9).limit, 9);
  });
});
