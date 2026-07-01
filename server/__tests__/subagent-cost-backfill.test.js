/**
 * @file Tests the one-time backfill that stamps metadata.tokens onto subagent
 * rows predating per-agent cost tracking.
 *
 * A historical session whose transcript never changes again is mtime-skipped by
 * the continuous sync, so its subagents (imported before per-agent cost existed)
 * would never gain a tokens bucket and their cards would show no cost. The
 * startup backfill re-parses those transcripts and stamps the metadata — WITHOUT
 * touching session token_usage. This suite verifies:
 *
 *   1. A pre-feature subagent row (no tokens key) gets its metadata.tokens
 *      stamped from its transcript, so attachAgentCosts can price it.
 *   2. The backfill is metadata-only: it does not create/alter token_usage rows.
 *   3. It is self-limiting — a second run stamps nothing new.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-subcost-bf-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const importHistory = require("../../scripts/import-history");
const { attachAgentCosts } = require("../routes/pricing");

const SESSION = "dddddddd-4444-4444-8444-dddddddddddd";
const MAIN = `${SESSION}-main`;
const SUB_ID = "aaaa1111-bbbb-2222-cccc-333344445555";
const SUB_MODEL = "claude-haiku-4-5-20251001";

let tmpDir;
let transcriptPath;

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

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subcost-bf-"));
  // Lay out the on-disk transcript tree the backfill walks:
  //   <proj>/<session>.jsonl                 (main transcript path)
  //   <proj>/<session>/subagents/agent-<id>.jsonl
  transcriptPath = path.join(tmpDir, `${SESSION}.jsonl`);
  fs.writeFileSync(transcriptPath, "");
  const subDir = path.join(tmpDir, SESSION, "subagents");
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(
    path.join(subDir, `agent-${SUB_ID}.jsonl`),
    [
      {
        type: "user",
        sessionId: SESSION,
        timestamp: "2026-04-18T12:00:00.000Z",
        message: { content: "go" },
      },
      {
        type: "assistant",
        sessionId: SESSION,
        timestamp: "2026-04-18T12:00:05.000Z",
        message: {
          model: SUB_MODEL,
          content: [{ type: "text", text: "ok" }],
          usage: { input_tokens: 2_000_000, output_tokens: 1_000_000 },
        },
      },
    ]
      .map((o) => JSON.stringify(o))
      .join("\n")
  );

  // Session with transcript_path set, and a PRE-FEATURE subagent row: metadata
  // has a model but NO tokens key (exactly what old imports produced).
  stmts.insertSession.run(
    SESSION,
    "Backfill session",
    "completed",
    "/tmp/x",
    "claude-opus-4-8",
    null
  );
  db.prepare("UPDATE sessions SET transcript_path = ? WHERE id = ?").run(transcriptPath, SESSION);
  stmts.insertAgent.run(MAIN, SESSION, "Main Agent", "main", null, "completed", null, null, null);
  stmts.insertAgent.run(
    `${SESSION}-jsonl-${SUB_ID}`,
    SESSION,
    "general-purpose",
    "subagent",
    "general-purpose",
    "completed",
    "recon",
    MAIN,
    JSON.stringify({ imported: true, source: "jsonl", model: SUB_MODEL })
  );

  // Deterministic Haiku pricing: $1 in / $5 out per MTok.
  stmts.upsertPricing.run("claude-haiku%", "Claude Haiku 4.5", 1, 5, 0.1, 1.25, 2, 0, 0);
});

describe("subagent token backfill", () => {
  it("stamps metadata.tokens on a pre-feature subagent row from its transcript", async () => {
    const before = stmts.getAgent.get(`${SESSION}-jsonl-${SUB_ID}`);
    assert.ok(!/"tokens":/.test(before.metadata), "row starts without a tokens key");

    const res = await importHistory.backfillSubagentTokenMetadata(dbModule);
    assert.ok(res.stamped >= 1, "at least one subagent re-parsed");

    const row = stmts.getAgent.get(`${SESSION}-jsonl-${SUB_ID}`);
    const meta = JSON.parse(row.metadata);
    assert.ok(Array.isArray(meta.tokens) && meta.tokens.length === 1, "tokens stamped");
    assert.equal(meta.tokens[0].input_tokens, 2_000_000);
    assert.equal(meta.tokens[0].output_tokens, 1_000_000);

    // Now priceable: 2M in @ $1 + 1M out @ $5 = $2 + $5 = $7.
    const withCosts = attachAgentCosts(stmts.listAgentsBySession.all(SESSION));
    const sub = withCosts.find((a) => a.id === `${SESSION}-jsonl-${SUB_ID}`);
    assert.equal(sub.cost, 7);
  });

  it("is metadata-only — it creates no token_usage rows", () => {
    const rows = db
      .prepare("SELECT COUNT(*) AS n FROM token_usage WHERE session_id = ?")
      .get(SESSION);
    assert.equal(rows.n, 0, "session token_usage untouched by the backfill");
  });

  it("is self-limiting — a second run stamps nothing new", async () => {
    const res = await importHistory.backfillSubagentTokenMetadata(dbModule);
    // The one session no longer matches the driving query (its subagent now has
    // a tokens key), so no session is re-scanned.
    assert.equal(res.sessions, 0);
  });
});
