/**
 * @file Import-pipeline correctness regressions.
 *
 * Covers three defects found in an import audit:
 *   1. Duplicate subagent rows — importSession must NOT create `-subagent-N`
 *      rows from the main transcript's Agent blocks when subagent TRANSCRIPTS
 *      (parsedSubagents) exist, since those `-jsonl-` rows are authoritative.
 *      The fallback (no transcripts) must still create `-subagent-N` rows.
 *   2. transcript_path must be persisted on import (was NULL for every imported
 *      session, breaking the abandon sweep / compaction scan / cost backfill).
 *   3. classifyJsonl must treat the dynamic-workflow tree
 *      (subagents/workflows/<run>/agent-*.jsonl) as a subagent, not a top-level
 *      session.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-import-correct-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const importHistory = require("../../scripts/import-history");

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

// A parsed subagent as parseSubagentFile would return it.
function makeSubData(agentId, agentType) {
  return {
    agentId,
    agentType,
    task: "recon",
    model: "claude-haiku-4-5-20251001",
    startedAt: "2026-04-18T12:00:10.000Z",
    endedAt: "2026-04-18T12:01:00.000Z",
    userMessages: 1,
    assistantMessages: 2,
    tokensByModel: {},
    toolNames: ["Bash", "Read"],
    thinkingBlockCount: 0,
    toolEvents: [],
    spawnedChildren: [],
  };
}

// A parsed session as parseSessionFile would return it, with one Agent tool_use
// block. `parsedSubagents` is attached by the caller (importFromDirectory), so
// we set it explicitly here.
function makeSession(sessionId, { withTranscripts, transcriptPath }) {
  const agentTs = "2026-04-18T11:59:00.000Z"; // >tolerance before the sub's start
  return {
    sessionId,
    name: "T",
    customTitle: null,
    aiTitle: null,
    cwd: "/tmp/proj",
    model: "claude-opus-4-8",
    version: null,
    slug: "slug",
    gitBranch: null,
    transcriptPath,
    startedAt: "2026-04-18T11:58:00.000Z",
    endedAt: "2026-04-18T12:01:00.000Z",
    teams: [],
    userMessages: 1,
    assistantMessages: 1,
    tokensByModel: {},
    messageTimestamps: ["2026-04-18T12:01:00.000Z"],
    toolUses: [
      {
        id: "toolu_agent1",
        name: "Agent",
        input: { subagent_type: "Explore", description: "do x", prompt: "p" },
        timestamp: agentTs,
      },
    ],
    compactions: [],
    apiErrors: [],
    fileModifiedAt: 0,
    turnDurations: [],
    entrypoint: null,
    permissionMode: null,
    thinkingBlockCount: 0,
    toolResultErrors: [],
    usageExtras: { service_tiers: [], speeds: [], inference_geos: [] },
    parsedSubagents: withTranscripts ? [makeSubData("aaaa0001", "Explore")] : [],
  };
}

describe("import correctness", () => {
  it("does NOT create duplicate -subagent-N rows when subagent transcripts exist", () => {
    const SID = "11110000-0000-4000-8000-000000000001";
    importHistory.importSession(
      dbModule,
      makeSession(SID, { withTranscripts: true, transcriptPath: `/tmp/proj/${SID}.jsonl` })
    );
    const subs = stmts.listAgentsBySession.all(SID).filter((a) => a.type === "subagent");
    const nSubagentN = subs.filter((a) => a.id.includes("-subagent-")).length;
    const nJsonl = subs.filter((a) => a.id.includes("-jsonl-")).length;
    assert.equal(nJsonl, 1, "one authoritative -jsonl- row");
    assert.equal(nSubagentN, 0, "no duplicate -subagent-N row from the Agent block");
  });

  it("still creates -subagent-N rows when there are NO subagent transcripts", () => {
    const SID = "11110000-0000-4000-8000-000000000002";
    importHistory.importSession(
      dbModule,
      makeSession(SID, { withTranscripts: false, transcriptPath: `/tmp/proj/${SID}.jsonl` })
    );
    const subs = stmts.listAgentsBySession.all(SID).filter((a) => a.type === "subagent");
    assert.equal(subs.filter((a) => a.id.includes("-subagent-")).length, 1, "fallback row created");
  });

  it("persists transcript_path on import", () => {
    const SID = "11110000-0000-4000-8000-000000000003";
    const tp = `/tmp/proj/${SID}.jsonl`;
    importHistory.importSession(
      dbModule,
      makeSession(SID, { withTranscripts: false, transcriptPath: tp })
    );
    assert.equal(stmts.getSession.get(SID).transcript_path, tp);
  });

  it("classifyJsonl treats the workflow subagent tree as a subagent, not a session", () => {
    const base = "/x/.claude/projects/-Users-x/sid";
    assert.equal(importHistory.classifyJsonl(`${base}/subagents/agent-1.jsonl`), "subagent");
    assert.equal(
      importHistory.classifyJsonl(`${base}/subagents/workflows/wf_abc/agent-2.jsonl`),
      "subagent"
    );
    assert.equal(importHistory.classifyJsonl(`/x/.claude/projects/-Users-x/sid.jsonl`), "session");
  });
});
