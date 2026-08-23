/**
 * @file Tests the one-time startup repair of token totals inflated before
 * usage was reconciled per `message.id` (issue #293).
 *
 * The parser fix alone cannot heal historical rows: `replaceTokenUsage` is a
 * monotonic high-water mark, so a corrected (lower) re-read migrates the
 * over-count into `baseline_*` and the effective number never drops. Without
 * this startup pass every session that predates the upgrade keeps its inflated
 * cost forever while new sessions price correctly — so the repair has to run
 * for the user rather than waiting for them to find a CLI flag.
 *
 * Covers the guards that keep an automatic, row-rewriting migration safe:
 * marker gating (runs once, retries after a crash), the `DASHBOARD_TOKEN_REPAIR=0`
 * opt-out, the shared-database peer check, and the pre-repair snapshot table.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `token-repair-${process.pid}-`));
const CLAUDE_HOME = path.join(TMP_ROOT, "claude");
const PROJECT_DIR = path.join(CLAUDE_HOME, "projects", "-tmp-proj");
fs.mkdirSync(PROJECT_DIR, { recursive: true });
process.env.CLAUDE_HOME = CLAUDE_HOME;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
fs.mkdirSync(process.env.DASHBOARD_DATA_DIR, { recursive: true });
process.env.DASHBOARD_DB_PATH = path.join(process.env.DASHBOARD_DATA_DIR, "dashboard.db");

const dbModule = require("../db");
const { db, stmts } = dbModule;
const { repairInflatedTokenTotals } = require("../index");

const MARKER = path.join(path.dirname(dbModule.DB_PATH), ".token-repair-v1.done");
const MODEL = "claude-opus-4-8";

after(() => {
  if (db) db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

const FINAL = {
  input_tokens: 11,
  output_tokens: 742,
  cache_read_input_tokens: 9000,
  cache_creation_input_tokens: 400,
};
const PARTIAL = { ...FINAL, output_tokens: 5 };
const CORRECT = {
  input: FINAL.input_tokens,
  output: FINAL.output_tokens,
  cacheRead: FINAL.cache_read_input_tokens,
};

function assistantLine(msgId, usage) {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-15T10:00:00.000Z",
    cwd: "/tmp/proj",
    message: { id: msgId, model: MODEL, usage, content: [{ type: "text", text: "x" }] },
  });
}

/** One message across three records — the shape that produced the inflation. */
function seedSession(sessionId) {
  try {
    stmts.insertSession.run(sessionId, "t", "active", "/tmp/proj", null, null);
  } catch {
    /* already present */
  }
  fs.writeFileSync(
    path.join(PROJECT_DIR, `${sessionId}.jsonl`),
    [
      assistantLine("msg_a", PARTIAL),
      assistantLine("msg_a", PARTIAL),
      assistantLine("msg_a", FINAL),
    ].join("\n") + "\n"
  );
  // Write what the OLD per-record accumulator produced.
  stmts.replaceTokenUsage.run(
    sessionId,
    MODEL,
    "standard",
    "global",
    "standard",
    CORRECT.input * 3,
    PARTIAL.output_tokens * 2 + FINAL.output_tokens,
    CORRECT.cacheRead * 3,
    FINAL.cache_creation_input_tokens * 3,
    0,
    0,
    0,
    0
  );
}

function effective(sessionId) {
  const row = stmts.getTokensBySession.all(sessionId).find((r) => r.model === MODEL);
  return row ? row.cache_read_tokens : 0;
}

function clearMarker() {
  try {
    fs.unlinkSync(MARKER);
  } catch {
    /* absent */
  }
}

/** The repair is deferred ~8s; drive its timer without waiting in real time. */
async function runRepairNow() {
  const realSetTimeout = global.setTimeout;
  const pending = [];
  global.setTimeout = (fn) => {
    pending.push(fn);
    return { unref() {} };
  };
  try {
    repairInflatedTokenTotals();
  } finally {
    global.setTimeout = realSetTimeout;
  }
  for (const fn of pending) fn();
  // Let the async body inside the timer settle.
  await new Promise((resolve) => realSetTimeout(resolve, 250));
}

describe("startup token repair", () => {
  beforeEach(() => {
    clearMarker();
    try {
      db.exec("DROP TABLE IF EXISTS token_usage_pre_repair");
    } catch {
      /* absent */
    }
  });

  it("heals an inflated session without the user running anything", async () => {
    const SID = "repair-auto-1";
    seedSession(SID);
    assert.equal(effective(SID), CORRECT.cacheRead * 3, "precondition: totals start inflated");

    await runRepairNow();

    assert.equal(effective(SID), CORRECT.cacheRead, "totals must be re-derived per message.id");
    const row = db
      .prepare("SELECT baseline_cache_read FROM token_usage WHERE session_id = ? AND model = ?")
      .get(SID, MODEL);
    assert.equal(row.baseline_cache_read, 0, "baselines must be zeroed, not folded");
  });

  it("snapshots the pre-repair rows so the old numbers stay recoverable", async () => {
    const SID = "repair-auto-2";
    seedSession(SID);
    await runRepairNow();

    const snapshot = db
      .prepare("SELECT cache_read_tokens FROM token_usage_pre_repair WHERE session_id = ?")
      .get(SID);
    assert.ok(snapshot, "a pre-repair snapshot row must exist");
    assert.equal(snapshot.cache_read_tokens, CORRECT.cacheRead * 3, "snapshot keeps the old value");
  });

  it("writes a marker and does not run again", async () => {
    const SID = "repair-auto-3";
    seedSession(SID);
    await runRepairNow();
    assert.ok(fs.existsSync(MARKER), "a completed pass must write its marker");

    // Re-inflate, then re-run: the marker must make it a no-op.
    stmts.replaceTokenUsage.run(
      SID,
      MODEL,
      "standard",
      "global",
      "standard",
      0,
      0,
      CORRECT.cacheRead * 5,
      0,
      0,
      0,
      0,
      0
    );
    const inflated = effective(SID);
    await runRepairNow();
    assert.equal(effective(SID), inflated, "a marked database must not be repaired twice");
  });

  it("re-runs when the marker is absent, so a crashed pass retries", async () => {
    const SID = "repair-auto-4";
    seedSession(SID);
    await runRepairNow();
    clearMarker();

    stmts.replaceTokenUsage.run(
      SID,
      MODEL,
      "standard",
      "global",
      "standard",
      0,
      0,
      CORRECT.cacheRead * 4,
      0,
      0,
      0,
      0,
      0
    );
    await runRepairNow();
    assert.equal(effective(SID), CORRECT.cacheRead, "an unmarked database repairs again");
  });

  it("honours the DASHBOARD_TOKEN_REPAIR=0 opt-out", async () => {
    const SID = "repair-auto-5";
    seedSession(SID);
    const prior = process.env.DASHBOARD_TOKEN_REPAIR;
    process.env.DASHBOARD_TOKEN_REPAIR = "0";
    try {
      await runRepairNow();
    } finally {
      if (prior === undefined) delete process.env.DASHBOARD_TOKEN_REPAIR;
      else process.env.DASHBOARD_TOKEN_REPAIR = prior;
    }

    assert.equal(effective(SID), CORRECT.cacheRead * 3, "opt-out must leave totals untouched");
    assert.equal(fs.existsSync(MARKER), false, "opt-out must not consume the one-time marker");
  });
});
