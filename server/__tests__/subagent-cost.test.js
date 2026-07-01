/**
 * @file Tests that a subagent's OWN cost is derived and surfaced per-agent.
 *
 * Subagent cards used to show the whole session's cost, which reads as if that
 * one subagent cost the entire session's spend. The importer now stamps each
 * subagent's own token buckets into its metadata, and the agent-list endpoints
 * compute a per-agent `cost` from them (priced at current rates, like session
 * cost). This suite verifies:
 *
 *   1. importSubagentFromJsonl stores the subagent's own token buckets in
 *      agent.metadata.tokens.
 *   2. attachAgentCosts computes that subagent's cost from those buckets and the
 *      current pricing rules — independent of the session total.
 *   3. A main agent (no per-agent tokens) gets cost 0 (its cost is the session
 *      total, shown separately).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-subagent-cost-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const importHistory = require("../../scripts/import-history");
const { attachAgentCosts, calculateCost } = require("../routes/pricing");

const SESSION = "cccccccc-3333-4333-8333-cccccccccccc";
const MAIN = `${SESSION}-main`;
const SUB_AGENT_ID = "11112222-3333-4444-5555-666677778888";
const SUB_MODEL = "claude-haiku-4-5-20251001";

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

function writeJsonl(filePath, lines) {
  fs.writeFileSync(filePath, lines.map((o) => JSON.stringify(o)).join("\n"));
}

/** A subagent transcript with one assistant turn carrying known Haiku usage. */
function subagentLines() {
  const base = "2026-04-18T12:00:00.000Z";
  return [
    { type: "user", sessionId: SESSION, timestamp: base, message: { content: "do the thing" } },
    {
      type: "assistant",
      sessionId: SESSION,
      timestamp: "2026-04-18T12:00:05.000Z",
      message: {
        model: SUB_MODEL,
        content: [{ type: "text", text: "done" }],
        usage: {
          input_tokens: 1_000_000,
          output_tokens: 500_000,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
  ];
}

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subcost-"));
  // Session + main agent so the subagent FK holds.
  stmts.insertSession.run(
    SESSION,
    "Cost test session",
    "completed",
    "/tmp/x",
    "claude-opus-4-8",
    null
  );
  stmts.insertAgent.run(MAIN, SESSION, "Main Agent", "main", null, "completed", null, null, null);
  // Deterministic Haiku pricing: $1 in / $5 out per MTok.
  stmts.upsertPricing.run("claude-haiku%", "Claude Haiku 4.5", 1, 5, 0.1, 1.25, 2, 0, 0);
});

describe("per-subagent cost", () => {
  it("stamps the subagent's own token buckets into its metadata on import", async () => {
    const file = path.join(tmpDir, `agent-${SUB_AGENT_ID}.jsonl`);
    writeJsonl(file, subagentLines());
    const subData = await importHistory.parseSubagentFile(file);
    assert.ok(subData, "subData parsed");
    importHistory.importSubagentFromJsonl(dbModule, SESSION, MAIN, subData);

    const row = stmts.getAgent.get(`${SESSION}-jsonl-${SUB_AGENT_ID}`);
    assert.ok(row, "jsonl subagent row created");
    const meta = JSON.parse(row.metadata);
    assert.ok(Array.isArray(meta.tokens) && meta.tokens.length === 1, "one token bucket stored");
    assert.equal(meta.tokens[0].model, SUB_MODEL);
    assert.equal(meta.tokens[0].input_tokens, 1_000_000);
    assert.equal(meta.tokens[0].output_tokens, 500_000);
  });

  it("computes the subagent's own cost from its buckets, not the session total", () => {
    const agents = stmts.listAgentsBySession.all(SESSION);
    const withCosts = attachAgentCosts(agents);

    const sub = withCosts.find((a) => a.id === `${SESSION}-jsonl-${SUB_AGENT_ID}`);
    const main = withCosts.find((a) => a.id === MAIN);

    // 1M input @ $1 + 0.5M output @ $5 = $1 + $2.50 = $3.50.
    assert.equal(sub.cost, 3.5);
    // Cross-check against calculateCost directly.
    const rules = stmts.listPricing.all();
    assert.equal(
      calculateCost(JSON.parse(sub.metadata).tokens, rules, "2026-04-18").total_cost,
      3.5
    );

    // Main agent carries no per-agent tokens → 0 (its cost is the session total).
    assert.equal(main.cost, 0);
  });
});
