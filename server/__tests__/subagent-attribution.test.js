/**
 * @file Tests for subagent tool-event attribution.
 *
 * Subagent tool calls (Read, Bash, Edit, etc.) never fire hooks on the
 * parent session — they only show up in the subagent's own JSONL file.
 * Without dedicated extraction, every subagent ends up with at most a
 * single spawn event, leaving 561/561 historical subagents with 0–5
 * events instead of the dozens-to-hundreds they actually performed.
 *
 * This suite verifies that:
 *   1. parseSubagentFile pairs tool_use blocks with their tool_result
 *      counterparts and surfaces them as `toolEvents`.
 *   2. importSubagentFromJsonl emits PreToolUse + PostToolUse events
 *      under the subagent's own `agent_id`, so the UI attributes them
 *      to the subagent rather than the main agent.
 *   3. Re-running the import is idempotent — no duplicate event rows.
 *   4. When a live subagent (created via PreToolUse "Agent" hook) matches
 *      the JSONL by type + start time, events attach to the live row
 *      instead of creating a duplicate JSONL-keyed row.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_DB = path.join(os.tmpdir(), `dashboard-subagent-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const importHistory = require("../../scripts/import-history");
const { calculateCost } = require("../routes/pricing");

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

// ── Fixture helpers ──────────────────────────────────────────────────

function writeSubagentJsonl(filePath, lines) {
  fs.writeFileSync(filePath, lines.map((o) => JSON.stringify(o)).join("\n"));
}

/**
 * Builds a minimal subagent JSONL with two tool calls — one Read with a
 * paired tool_result, and one Bash with a paired error tool_result.
 */
function buildSubagentLines(agentType = "coder") {
  return [
    {
      type: "user",
      timestamp: "2026-04-28T10:00:00.000Z",
      message: { content: [{ type: "text", text: "Investigate the bug" }] },
    },
    {
      type: "assistant",
      timestamp: "2026-04-28T10:00:01.000Z",
      message: {
        model: "claude-opus-4-7",
        content: [
          {
            type: "tool_use",
            id: "toolu_read_001",
            name: "Read",
            input: { file_path: "/tmp/foo.py" },
          },
        ],
        usage: {
          input_tokens: 50,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    },
    {
      type: "user",
      timestamp: "2026-04-28T10:00:02.000Z",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_read_001",
            content: "def main():\n    pass\n",
          },
        ],
      },
    },
    {
      type: "assistant",
      timestamp: "2026-04-28T10:00:03.000Z",
      message: {
        model: "claude-opus-4-7",
        content: [
          {
            type: "tool_use",
            id: "toolu_bash_002",
            name: "Bash",
            input: { command: "ls /tmp" },
          },
        ],
      },
    },
    {
      type: "user",
      timestamp: "2026-04-28T10:00:04.000Z",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_bash_002",
            content: "ls: cannot access /tmp: not allowed",
            is_error: true,
          },
        ],
      },
    },
    {
      // Meta: keeps file timestamps coherent
      type: "user",
      timestamp: "2026-04-28T10:00:05.000Z",
      message: { content: [{ type: "text", text: "done" }] },
    },
  ].map((line, i) => {
    // Inject agentType into one entry as a hint, mirroring real CC output
    if (i === 0) line.agentType = agentType;
    return line;
  });
}

function writeMetaJson(filePath, agentType) {
  fs.writeFileSync(filePath, JSON.stringify({ agentType }));
}

/**
 * Minimal subagent JSONL on a specific model carrying one usage record, so
 * parseSubagentFile yields a single token bucket keyed by that model.
 */
function buildModelSubLines(agentType, model, usage, startedAt = "2026-05-01T10:00:00.000Z") {
  const t0 = startedAt;
  return [
    {
      type: "user",
      timestamp: t0,
      agentType,
      message: { content: [{ type: "text", text: "go" }] },
    },
    {
      type: "assistant",
      timestamp: "2026-05-01T10:00:01.000Z",
      message: {
        model,
        content: [{ type: "tool_use", id: `toolu_${agentType}_1`, name: "Read", input: {} }],
        usage: {
          input_tokens: usage.input || 0,
          output_tokens: usage.output || 0,
          cache_read_input_tokens: usage.cacheRead || 0,
          cache_creation_input_tokens: usage.cacheWrite || 0,
        },
      },
    },
    {
      type: "user",
      timestamp: "2026-05-01T10:00:02.000Z",
      message: {
        content: [{ type: "tool_result", tool_use_id: `toolu_${agentType}_1`, content: "ok" }],
      },
    },
  ];
}

// Lay out <base>/<sessionId>/subagents/agent-*.jsonl and return the matching
// transcriptPath (<base>/<sessionId>.jsonl) that scanAndImportSubagents expects.
function buildSubagentDir(sessionId, files) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `sa-scan-${process.pid}-`));
  const subDir = path.join(base, sessionId, "subagents");
  fs.mkdirSync(subDir, { recursive: true });
  for (const f of files) {
    writeSubagentJsonl(path.join(subDir, `agent-${f.id}.jsonl`), f.lines);
    // Companion meta.json so parseSubagentFile resolves agentType (the live-match key).
    if (f.agentType) {
      fs.writeFileSync(
        path.join(subDir, `agent-${f.id}.meta.json`),
        JSON.stringify({ agentType: f.agentType })
      );
    }
  }
  return { transcriptPath: path.join(base, `${sessionId}.jsonl`), base };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("parseSubagentFile — tool event extraction", () => {
  it("pairs tool_use with tool_result and returns ordered toolEvents", async () => {
    const tmpFile = path.join(os.tmpdir(), `agent-${Date.now()}-${process.pid}.jsonl`);
    writeSubagentJsonl(tmpFile, buildSubagentLines("coder"));
    writeMetaJson(tmpFile.replace(/\.jsonl$/, ".meta.json"), "coder");

    try {
      const data = await importHistory.parseSubagentFile(tmpFile);
      assert.ok(data, "subagent data should parse");
      assert.equal(data.agentType, "coder");
      assert.ok(Array.isArray(data.toolEvents));
      assert.equal(data.toolEvents.length, 2);

      const [readEv, bashEv] = data.toolEvents;
      assert.equal(readEv.tool_use_id, "toolu_read_001");
      assert.equal(readEv.tool_name, "Read");
      assert.deepEqual(readEv.tool_input, { file_path: "/tmp/foo.py" });
      assert.equal(readEv.is_error, false);
      assert.equal(typeof readEv.pre_timestamp, "string");
      assert.equal(typeof readEv.post_timestamp, "string");
      assert.ok(readEv.tool_response);

      assert.equal(bashEv.tool_use_id, "toolu_bash_002");
      assert.equal(bashEv.is_error, true);
    } finally {
      fs.unlinkSync(tmpFile);
      try {
        fs.unlinkSync(tmpFile.replace(/\.jsonl$/, ".meta.json"));
      } catch {
        /* ignore */
      }
    }
  });

  it("emits a tool_use even when no matching tool_result exists yet (live tail)", async () => {
    const tmpFile = path.join(os.tmpdir(), `agent-tail-${Date.now()}-${process.pid}.jsonl`);
    writeSubagentJsonl(tmpFile, [
      {
        type: "assistant",
        timestamp: "2026-04-28T10:00:01.000Z",
        message: {
          model: "claude-opus-4-7",
          content: [{ type: "tool_use", id: "toolu_pending", name: "Read", input: {} }],
        },
      },
    ]);

    try {
      const data = await importHistory.parseSubagentFile(tmpFile);
      assert.equal(data.toolEvents.length, 1);
      const ev = data.toolEvents[0];
      assert.equal(ev.tool_use_id, "toolu_pending");
      assert.equal(ev.post_timestamp, null);
      assert.equal(ev.tool_response, null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe("importSubagentFromJsonl — event attribution", () => {
  const sessionId = "test-sess-attribution";
  const mainAgentId = `${sessionId}-main`;

  before(() => {
    // Seed session + main agent so importSubagentFromJsonl has parents to point at.
    stmts.insertSession.run(sessionId, "Test Session", "active", "/tmp", null, null);
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      "Main Agent",
      "main",
      null,
      "waiting",
      null,
      null,
      null
    );
  });

  it("creates one subagent row and per-call PreToolUse + PostToolUse events", async () => {
    const tmpFile = path.join(os.tmpdir(), `agent-attr-${Date.now()}-${process.pid}.jsonl`);
    writeSubagentJsonl(tmpFile, buildSubagentLines("coder"));
    writeMetaJson(tmpFile.replace(/\.jsonl$/, ".meta.json"), "coder");

    try {
      const data = await importHistory.parseSubagentFile(tmpFile);
      const created = importHistory.importSubagentFromJsonl(dbModule, sessionId, mainAgentId, data);
      assert.ok(created > 0, "should create at least the agent + spawn + 4 events");

      const subId = `${sessionId}-jsonl-${data.agentId}`;
      const subAgent = stmts.getAgent.get(subId);
      assert.ok(subAgent, "JSONL-keyed subagent row should exist");
      assert.equal(subAgent.parent_agent_id, mainAgentId);

      const toolEvents = db
        .prepare(
          "SELECT event_type, tool_name FROM events WHERE agent_id = ? AND event_type IN ('PreToolUse', 'PostToolUse') ORDER BY id ASC"
        )
        .all(subId);
      assert.equal(toolEvents.length, 4, "expected 2 Pre + 2 Post events under subagent's id");
      assert.deepEqual(
        toolEvents.map((e) => `${e.event_type}:${e.tool_name}`),
        ["PreToolUse:Read", "PostToolUse:Read", "PreToolUse:Bash", "PostToolUse:Bash"]
      );

      // Spawn marker lives under the main agent so the parent chain shows
      // "Subagent spawned: coder" alongside main's other actions.
      const spawnEvents = db
        .prepare(
          "SELECT 1 FROM events WHERE agent_id = ? AND event_type = 'PreToolUse' AND tool_name = 'Agent'"
        )
        .all(mainAgentId);
      assert.equal(spawnEvents.length, 1);
    } finally {
      fs.unlinkSync(tmpFile);
      try {
        fs.unlinkSync(tmpFile.replace(/\.jsonl$/, ".meta.json"));
      } catch {
        /* ignore */
      }
    }
  });

  it("is idempotent — re-running does not duplicate events", async () => {
    const tmpFile = path.join(os.tmpdir(), `agent-idem-${Date.now()}-${process.pid}.jsonl`);
    writeSubagentJsonl(tmpFile, buildSubagentLines("reviewer"));
    writeMetaJson(tmpFile.replace(/\.jsonl$/, ".meta.json"), "reviewer");

    try {
      const data = await importHistory.parseSubagentFile(tmpFile);
      importHistory.importSubagentFromJsonl(dbModule, sessionId, mainAgentId, data);
      const subId = `${sessionId}-jsonl-${data.agentId}`;
      const before = db.prepare("SELECT COUNT(*) AS c FROM events WHERE agent_id = ?").get(subId).c;

      // Second run — should be a no-op.
      importHistory.importSubagentFromJsonl(dbModule, sessionId, mainAgentId, data);
      const after = db.prepare("SELECT COUNT(*) AS c FROM events WHERE agent_id = ?").get(subId).c;

      assert.equal(after, before, "idempotent re-import — no new rows");
    } finally {
      fs.unlinkSync(tmpFile);
      try {
        fs.unlinkSync(tmpFile.replace(/\.jsonl$/, ".meta.json"));
      } catch {
        /* ignore */
      }
    }
  });

  it("merges into a live subagent when one matches — no JSONL-keyed duplicate row", async () => {
    // Simulate a live PreToolUse Agent hook having pre-created a subagent row.
    const liveSubId = "live-uuid-xyz";
    const startedAt = "2026-04-28T10:00:00.000Z";
    stmts.insertAgent.run(
      liveSubId,
      sessionId,
      "Live Coder",
      "subagent",
      "live-coder",
      "completed",
      "task",
      mainAgentId,
      null
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
      startedAt,
      startedAt,
      startedAt,
      liveSubId
    );

    const tmpFile = path.join(os.tmpdir(), `agent-live-${Date.now()}-${process.pid}.jsonl`);
    const lines = buildSubagentLines("live-coder");
    writeSubagentJsonl(tmpFile, lines);
    writeMetaJson(tmpFile.replace(/\.jsonl$/, ".meta.json"), "live-coder");

    try {
      const data = await importHistory.parseSubagentFile(tmpFile);
      importHistory.importSubagentFromJsonl(dbModule, sessionId, mainAgentId, data);

      const jsonlSubId = `${sessionId}-jsonl-${data.agentId}`;
      assert.equal(
        stmts.getAgent.get(jsonlSubId),
        undefined,
        "no JSONL-keyed row when a live subagent absorbed the events"
      );

      const eventsUnderLive = db
        .prepare(
          "SELECT 1 FROM events WHERE agent_id = ? AND event_type IN ('PreToolUse', 'PostToolUse')"
        )
        .all(liveSubId);
      assert.ok(eventsUnderLive.length >= 4, "events should attach to the live subagent's id");
    } finally {
      fs.unlinkSync(tmpFile);
      try {
        fs.unlinkSync(tmpFile.replace(/\.jsonl$/, ".meta.json"));
      } catch {
        /* ignore */
      }
    }
  });
});

// ── Per-subagent model token attribution (issue #185) ──────────────────
describe("scanAndImportSubagents — per-subagent model token attribution", () => {
  it("buckets each subagent's tokens under its OWN model, skipping the parent model", async () => {
    const sessionId = "sess-185-tiered";
    // Orchestrator on Opus; subagents tiered to Sonnet + Haiku, plus one on the
    // SAME model as the parent (Opus) to verify that bucket is intentionally skipped.
    stmts.insertSession.run(sessionId, "Tiered", "active", "/tmp", "claude-opus-4-8", null);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );

    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      {
        id: "hq",
        lines: buildModelSubLines("qa", "claude-haiku-4-5-20251001", { input: 1000, output: 500 }),
      },
      {
        id: "se",
        lines: buildModelSubLines("engineer", "claude-sonnet-4-6", { input: 2000, output: 800 }),
      },
      {
        id: "op",
        lines: buildModelSubLines("planner", "claude-opus-4-8", { input: 9999, output: 9999 }),
      },
    ]);

    try {
      await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);

      const rows = stmts.getTokensBySession.all(sessionId);
      const byModel = Object.fromEntries(rows.map((r) => [r.model, r]));
      const models = Object.keys(byModel).sort();

      // Haiku + Sonnet buckets are written under their own models.
      assert.deepEqual(models, ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]);
      assert.equal(byModel["claude-haiku-4-5-20251001"].input_tokens, 1000);
      assert.equal(byModel["claude-haiku-4-5-20251001"].output_tokens, 500);
      assert.equal(byModel["claude-sonnet-4-6"].input_tokens, 2000);
      assert.equal(byModel["claude-sonnet-4-6"].output_tokens, 800);

      // The Opus subagent's tokens are NOT written here — that bucket belongs to
      // the main-transcript writer; double-writing it would inflate via baseline.
      assert.equal(byModel["claude-opus-4-8"], undefined, "parent-model bucket must be skipped");

      // Cost is priced at the real (cheaper) per-subagent models, never Opus.
      const cost = calculateCost(rows, stmts.listPricing.all());
      const costModels = cost.breakdown.map((b) => b.model).sort();
      assert.deepEqual(costModels, ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]);
      assert.ok(cost.total_cost > 0);

      // Each subagent row records its real model in metadata.
      const hq = stmts.getAgent.get(`${sessionId}-jsonl-hq`);
      assert.equal(JSON.parse(hq.metadata).model, "claude-haiku-4-5-20251001");
      const se = stmts.getAgent.get(`${sessionId}-jsonl-se`);
      assert.equal(JSON.parse(se.metadata).model, "claude-sonnet-4-6");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it("re-running does not inflate token buckets (idempotent per-model write)", async () => {
    const sessionId = "sess-185-idem";
    stmts.insertSession.run(sessionId, "Idem", "active", "/tmp", "claude-opus-4-8", null);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      {
        id: "hq",
        lines: buildModelSubLines("qa", "claude-haiku-4-5-20251001", { input: 1000, output: 500 }),
      },
    ]);
    try {
      await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);
      await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);
      const rows = stmts.getTokensBySession.all(sessionId);
      const haiku = rows.find((r) => r.model === "claude-haiku-4-5-20251001");
      // getTokensBySession already returns effective totals (current + baseline).
      // Re-running must not double them — append-only subagent JSONLs never drop.
      assert.equal(haiku.input_tokens, 1000);
      assert.equal(haiku.output_tokens, 500);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it("skips every model the MAIN transcript used, not just the latest (mid-session /model switch)", async () => {
    const sessionId = "sess-185-switch";
    // Orchestrator switched Opus → Sonnet mid-session; session.model holds the
    // latest (Sonnet), but the main transcript wrote BOTH. A subagent on the
    // earlier Opus must still be skipped to avoid colliding with the main writer.
    stmts.insertSession.run(sessionId, "Switch", "active", "/tmp", "claude-sonnet-4-6", null);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      {
        id: "op",
        lines: buildModelSubLines("planner", "claude-opus-4-8", { input: 5000, output: 5000 }),
      },
      {
        id: "hq",
        lines: buildModelSubLines("qa", "claude-haiku-4-5-20251001", { input: 100, output: 50 }),
      },
    ]);
    try {
      // parentModels carries BOTH orchestrator models (as hooks.js would pass).
      await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath, {
        parentModels: ["claude-sonnet-4-6", "claude-opus-4-8"],
      });
      const models = stmts.getTokensBySession
        .all(sessionId)
        .map((r) => r.model)
        .sort();
      // Only Haiku is written; both orchestrator models (Sonnet + the earlier
      // Opus) are skipped even though Opus != session.model.
      assert.deepEqual(models, ["claude-haiku-4-5-20251001"]);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it("backfills a live subagent row's model from its own transcript", async () => {
    const sessionId = "sess-185-live";
    const startedAt = "2026-05-01T10:00:00.000Z";
    stmts.insertSession.run(sessionId, "Live", "active", "/tmp", "claude-opus-4-8", null);
    stmts.insertAgent.run(
      `${sessionId}-main`,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    // Live subagent created by the PreToolUse "Agent" hook — no model recorded.
    const liveId = "live-185-qa";
    stmts.insertAgent.run(
      liveId,
      sessionId,
      "QA",
      "subagent",
      "qa",
      "working",
      "task",
      `${sessionId}-main`,
      null
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
      startedAt,
      startedAt,
      startedAt,
      liveId
    );

    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      {
        id: "qa1",
        agentType: "qa",
        lines: buildModelSubLines(
          "qa",
          "claude-haiku-4-5-20251001",
          { input: 10, output: 5 },
          startedAt
        ),
      },
    ]);
    try {
      assert.equal(stmts.getAgent.get(liveId).metadata, null, "live row starts with no model");
      await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);
      const meta = JSON.parse(stmts.getAgent.get(liveId).metadata || "{}");
      assert.equal(meta.model, "claude-haiku-4-5-20251001", "live row backfilled with real model");
      // No JSONL-keyed duplicate row was created (events merged into the live row).
      assert.equal(stmts.getAgent.get(`${sessionId}-jsonl-qa1`), undefined);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("scanAndImportSubagents — nested subagent hierarchy", () => {
  // A subagent's own transcript records each child it spawned via the Task tool
  // as `toolUseResult.agentId`. Build a spawner file that claims `childIds`.
  function buildSpawnerLines(childIds, startedAt = "2026-06-01T10:00:00.000Z") {
    const lines = [
      { type: "user", timestamp: startedAt, message: { content: [{ type: "text", text: "go" }] } },
    ];
    childIds.forEach((cid, i) => {
      const ts = `2026-06-01T10:00:0${i + 1}.000Z`;
      lines.push({
        type: "assistant",
        timestamp: ts,
        message: {
          model: "claude-opus-4-8",
          content: [{ type: "tool_use", id: `toolu_task_${cid}`, name: "Task", input: {} }],
        },
      });
      lines.push({
        type: "user",
        timestamp: ts,
        toolUseResult: { agentId: cid, status: "completed" },
        message: {
          content: [{ type: "tool_result", tool_use_id: `toolu_task_${cid}`, content: "spawned" }],
        },
      });
    });
    return lines;
  }

  function buildLeafLines(startedAt = "2026-06-01T10:01:00.000Z") {
    return [
      {
        type: "user",
        timestamp: startedAt,
        message: { content: [{ type: "text", text: "work" }] },
      },
      {
        type: "assistant",
        timestamp: startedAt,
        message: {
          model: "claude-haiku-4-5-20251001",
          content: [{ type: "tool_use", id: "toolu_leaf", name: "Read", input: {} }],
        },
      },
    ];
  }

  it("nests subagents under their true spawner instead of flattening to main", async () => {
    const sessionId = "sess-nested-tree";
    const mainAgentId = `${sessionId}-main`;
    stmts.insertSession.run(sessionId, "Nested", "active", "/tmp", "claude-opus-4-8", null);
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );

    // main → orch; orch → leafA, leafB; main → solo
    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      { id: "orch", lines: buildSpawnerLines(["leafA", "leafB"]) },
      { id: "leafA", lines: buildLeafLines() },
      { id: "leafB", lines: buildLeafLines() },
      { id: "solo", lines: buildLeafLines() },
    ]);

    try {
      const res = await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);
      assert.equal(res.reparented, 2, "leafA + leafB repointed under orch");

      const parentOf = (id) => stmts.getAgent.get(`${sessionId}-jsonl-${id}`).parent_agent_id;
      assert.equal(parentOf("orch"), mainAgentId, "orch is a direct child of main");
      assert.equal(parentOf("solo"), mainAgentId, "solo stays under main");
      assert.equal(parentOf("leafA"), `${sessionId}-jsonl-orch`, "leafA nests under orch");
      assert.equal(parentOf("leafB"), `${sessionId}-jsonl-orch`, "leafB nests under orch");
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it("is idempotent — a second scan repoints nothing", async () => {
    const sessionId = "sess-nested-idem";
    const mainAgentId = `${sessionId}-main`;
    stmts.insertSession.run(sessionId, "NestedIdem", "active", "/tmp", "claude-opus-4-8", null);
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );

    const { transcriptPath, base } = buildSubagentDir(sessionId, [
      { id: "orch2", lines: buildSpawnerLines(["leafC"]) },
      { id: "leafC", lines: buildLeafLines() },
    ]);

    try {
      const first = await importHistory.scanAndImportSubagents(dbModule, sessionId, transcriptPath);
      assert.equal(first.reparented, 1);
      const second = await importHistory.scanAndImportSubagents(
        dbModule,
        sessionId,
        transcriptPath
      );
      assert.equal(second.reparented, 0, "no re-parenting on the second pass");
      assert.equal(
        stmts.getAgent.get(`${sessionId}-jsonl-leafC`).parent_agent_id,
        `${sessionId}-jsonl-orch2`
      );
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("events dedup index", () => {
  it("has a (agent_id, event_type) index so per-tool-event dedup is not a full scan", () => {
    // importSubagentFromJsonl dedups every tool event with
    // "WHERE agent_id = ? AND event_type = ? AND data LIKE '%tool_use_id%'".
    // Without this index each dedup full-scans the events table; on a large DB a
    // single re-import (e.g. the startup sweep touching a subagent-heavy session)
    // takes tens of seconds and blocks the event loop. Guard it from regressing.
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_events_agent_type'"
      )
      .get();
    assert.ok(row, "idx_events_agent_type must exist to keep subagent dedup indexed");
  });
});
