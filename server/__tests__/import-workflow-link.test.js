/**
 * @file Regression: the offline CLI import path must link Workflow-tool inner
 * agents to their run.
 *
 * A Claude Code Workflow-tool run (dynamic workflow / fleet of sub-agents)
 * emits NO hooks, so in a headless `claude -p` run, a CI job, or an HPC/cluster
 * compute node its per-run journal is never ingested live. Before this fix the
 * CLI import path (`ccam import rescan` → importAllSessions, `ccam import path`
 * → importFromDirectory) never called the workflow-journal ingest, so the
 * nested inner-agent transcripts under
 * `<sid>/subagents/workflows/<runId>/agent-*.jsonl` were imported with
 * `workflow_run_id = NULL` — orphaned from their run — leaving the workflow
 * stuck showing 1 agent instead of N.
 *
 * These tests build a fixture session tree with a streaming
 * `subagents/workflows/<runId>/journal.jsonl` plus a few `agent-*.jsonl`, run
 * the CLI import path (never the server), and assert every inner agent ends up
 * with `workflow_run_id = <runId>` and the workflows row reports the full fleet.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Scope the importer at a throwaway CLAUDE_HOME and DB before any server module
// loads — import-history captures PROJECTS_DIR from CLAUDE_HOME at require time.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `ccam-wf-link-${process.pid}-`));
process.env.CLAUDE_HOME = TMP_ROOT;
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");

const dbModule = require("../db");
const { importAllSessions, importFromDirectory } = require("../../scripts/import-history");

const PROJECTS_DIR = path.join(TMP_ROOT, "projects");

/** A minimal session transcript with one timestamped assistant turn. */
function sessionJsonl(cwd) {
  return [
    {
      type: "user",
      timestamp: "2026-05-01T00:00:00.000Z",
      cwd,
      message: { content: "run the workflow" },
    },
    {
      type: "assistant",
      timestamp: "2026-05-01T00:00:01.000Z",
      cwd,
      message: {
        model: "claude-opus-4-8",
        content: [{ type: "text", text: "starting" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
  ]
    .map((l) => JSON.stringify(l))
    .join("\n");
}

/** A parseable inner-agent transcript with token usage + one tool call. */
function agentJsonl(agentId) {
  return [
    {
      type: "user",
      timestamp: "2026-05-01T00:00:02.000Z",
      message: { content: `task for ${agentId}` },
    },
    {
      type: "assistant",
      timestamp: "2026-05-01T00:00:03.000Z",
      message: {
        model: "claude-opus-4-8",
        content: [{ type: "tool_use", id: `${agentId}-t1`, name: "Read", input: {} }],
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
  ]
    .map((l) => JSON.stringify(l))
    .join("\n");
}

/**
 * Write a session tree with a Workflow-tool run to disk under PROJECTS_DIR:
 *   <projName>/<sid>.jsonl
 *   <projName>/<sid>/subagents/workflows/<runId>/journal.jsonl   (streaming)
 *   <projName>/<sid>/subagents/workflows/<runId>/agent-<id>.jsonl (one per agent)
 * Returns the project dir path.
 */
function writeFixture(projName, sid, runId, agentIds) {
  const projDir = path.join(PROJECTS_DIR, projName);
  const cwd = `/tmp/${projName}`;
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, `${sid}.jsonl`), sessionJsonl(cwd));

  const runDir = path.join(projDir, sid, "subagents", "workflows", runId);
  fs.mkdirSync(runDir, { recursive: true });

  const journalLines = [];
  for (const id of agentIds) {
    fs.writeFileSync(path.join(runDir, `agent-${id}.jsonl`), agentJsonl(id));
    journalLines.push(JSON.stringify({ type: "started", agentId: id }));
    journalLines.push(JSON.stringify({ type: "result", agentId: id, result: "ok" }));
  }
  fs.writeFileSync(path.join(runDir, "journal.jsonl"), journalLines.join("\n"));
  return projDir;
}

const linkedCount = (runId) =>
  dbModule.db.prepare("SELECT COUNT(*) AS c FROM agents WHERE workflow_run_id = ?").get(runId).c;
const workflowRow = (runId) =>
  dbModule.db.prepare("SELECT agent_count FROM workflows WHERE run_id = ?").get(runId);
const linkedIds = (runId) =>
  dbModule.db
    .prepare("SELECT id FROM agents WHERE workflow_run_id = ? ORDER BY id")
    .all(runId)
    .map((r) => r.id);

before(() => {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
});

after(() => {
  try {
    dbModule.db.close();
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("offline CLI import links Workflow-tool inner agents", () => {
  it("importFromDirectory (ccam import path) links every inner agent to its run", async () => {
    const SID = "aaaa1111-0000-4000-8000-000000000001";
    const RUN = "wf_dirimport01";
    const AGENTS = ["d1", "d2", "d3"];
    const projDir = writeFixture("-tmp-projA", SID, RUN, AGENTS);

    assert.equal(linkedCount(RUN), 0, "no inner agents linked before import");

    await importFromDirectory(dbModule, projDir);

    assert.equal(linkedCount(RUN), AGENTS.length, "all inner agents linked to the run");
    assert.equal(
      workflowRow(RUN)?.agent_count,
      AGENTS.length,
      "workflows.agent_count reflects fleet"
    );
    assert.deepEqual(
      linkedIds(RUN),
      AGENTS.map((a) => `${SID}-jsonl-${a}`).sort(),
      "each inner agent linked under its <sid>-jsonl-<agentId> id"
    );
  });

  it("importAllSessions (ccam import rescan) links every inner agent to its run", async () => {
    const SID = "bbbb2222-0000-4000-8000-000000000002";
    const RUN = "wf_rescan02";
    const AGENTS = ["r1", "r2", "r3", "r4"];
    writeFixture("-tmp-projB", SID, RUN, AGENTS);

    assert.equal(linkedCount(RUN), 0, "no inner agents linked before rescan");

    await importAllSessions(dbModule);

    assert.equal(linkedCount(RUN), AGENTS.length, "all inner agents linked to the run");
    assert.equal(
      workflowRow(RUN)?.agent_count,
      AGENTS.length,
      "workflows.agent_count reflects fleet"
    );
  });

  it("re-running the import is idempotent — no duplicate links or rows", async () => {
    const SID = "cccc3333-0000-4000-8000-000000000003";
    const RUN = "wf_idem03";
    const AGENTS = ["i1", "i2"];
    const projDir = writeFixture("-tmp-projC", SID, RUN, AGENTS);

    await importFromDirectory(dbModule, projDir);
    await importFromDirectory(dbModule, projDir);

    assert.equal(linkedCount(RUN), AGENTS.length, "still exactly N links after a second import");
    // N inner agents + the one main agent for the session, nothing duplicated.
    const total = dbModule.db
      .prepare("SELECT COUNT(*) AS c FROM agents WHERE session_id = ?")
      .get(SID).c;
    assert.equal(total, AGENTS.length + 1, "no duplicate agent rows on re-import");
  });
});
