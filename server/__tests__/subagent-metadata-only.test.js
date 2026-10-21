/**
 * @file Ensures boot cost repair enriches existing native local subagents
 * without replaying events, creating agents, or crossing ownership boundaries.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-metadata-only-"));
process.env.DASHBOARD_DB_PATH = path.join(root, "app.db");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.CLAUDE_HOME = path.join(root, "claude");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const history = require("../../scripts/import-history");
const { emptyBucket } = require("../lib/token-usage");
let sequence = 0;
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
function fixture({ live = false, missing = false, tokens = false } = {}) {
  const id = `metadata-only-${++sequence}`;
  const main = `${id}-main`;
  const agent = live ? `${id}-hook` : `${id}-jsonl-child`;
  const start = "2026-10-09T12:00:00.000Z";
  stmts.insertSession.run(id, "History", "completed", "/test", "claude-haiku-4-5", null);
  stmts.insertAgent.run(main, id, "Main", "main", null, "completed", null, null, null);
  if (!missing) {
    stmts.insertAgent.run(
      agent,
      id,
      "Child",
      "subagent",
      "general-purpose",
      "completed",
      "task",
      main,
      JSON.stringify({ keep: "manual field", ...(tokens ? { tokens: [] } : {}) })
    );
    db.prepare("UPDATE agents SET started_at = ? WHERE id = ?").run(start, agent);
  }
  db.prepare("INSERT INTO events(session_id,agent_id,event_type,data) VALUES(?,?,?,?)").run(
    id,
    main,
    "Stop",
    "sentinel"
  );
  db.prepare("INSERT INTO token_usage(session_id,model,input_tokens) VALUES(?,?,?)").run(
    id,
    "claude-haiku-4-5",
    77
  );
  const bucket = emptyBucket("claude-haiku-4-5", "standard", "global", "standard");
  bucket.input = 100;
  bucket.output = 20;
  const sub = {
    agentId: "child",
    agentType: "general-purpose",
    model: bucket.model,
    startedAt: start,
    endedAt: start,
    task: "task",
    tokensByModel: { bucket },
    toolNames: ["Read"],
    userMessages: 1,
    assistantMessages: 1,
    thinkingBlockCount: 0,
    toolEvents: Array.from({ length: 25 }, (_, n) => ({
      tool_use_id: `tool-${n}`,
      tool_name: "Read",
      pre_timestamp: start,
      post_timestamp: start,
      tool_input: {},
      tool_response: "ok",
    })),
  };
  return { id, main, agent, sub };
}
function state(f) {
  return {
    session: stmts.getSession.get(f.id),
    agents: db.prepare("SELECT * FROM agents WHERE session_id=? ORDER BY id").all(f.id),
    events: db.prepare("SELECT * FROM events WHERE session_id=? ORDER BY id").all(f.id),
    tokens: db
      .prepare(
        "SELECT * FROM token_usage WHERE session_id=? ORDER BY model,speed,inference_geo,service_tier,context_size"
      )
      .all(f.id),
  };
}
for (const live of [false, true]) {
  it(`${live ? "hook" : "JSONL"} target receives only missing metadata`, () => {
    const f = fixture({ live });
    const before = state(f);
    assert.equal(
      history.importSubagentFromJsonl(dbModule, f.id, f.main, f.sub, { metadataOnly: true }),
      1
    );
    const after = state(f);
    const target = after.agents.find((a) => a.id === f.agent);
    const metadata = JSON.parse(target.metadata);
    assert.equal(metadata.keep, "manual field");
    assert.equal(metadata.tokens[0].input_tokens, 100);
    assert.equal(metadata.tokens[0].output_tokens, 20);
    target.metadata = before.agents.find((a) => a.id === f.agent).metadata;
    assert.deepEqual(after, before, "all rows/columns except target metadata remain unchanged");
    assert.equal(
      history.importSubagentFromJsonl(dbModule, f.id, f.main, f.sub, { metadataOnly: true }),
      0
    );
  });
}
it("missing targets and existing tokens are untouched", () => {
  for (const options of [{ missing: true }, { tokens: true }]) {
    const f = fixture(options);
    const before = state(f);
    assert.equal(
      history.importSubagentFromJsonl(dbModule, f.id, f.main, f.sub, { metadataOnly: true }),
      0
    );
    assert.deepEqual(state(f), before);
  }
});
it("foreign, other-provider, archived remote and invalid provenance rows are untouched", () => {
  for (const owner of [
    { source: "src_foreign", provider: "claude", metadata: null },
    { source: "local", provider: "codex", metadata: null },
    {
      source: "local",
      provider: "claude",
      metadata: JSON.stringify({ origin_host: "archived-box" }),
    },
    { source: "local", provider: "claude", metadata: "invalid-json" },
  ]) {
    const f = fixture();
    db.prepare("UPDATE sessions SET source=?,provider=?,metadata=? WHERE id=?").run(
      owner.source,
      owner.provider,
      owner.metadata,
      f.id
    );
    const before = state(f);
    assert.equal(
      history.importSubagentFromJsonl(dbModule, f.id, f.main, f.sub, { metadataOnly: true }),
      0
    );
    assert.deepEqual(state(f), before);
  }
});
it("ordinary import still repairs missing spawn and tool events", () => {
  const f = fixture();
  assert.ok(history.importSubagentFromJsonl(dbModule, f.id, f.main, f.sub) > 0);
  assert.equal(state(f).events.length, 52);
  assert.equal(state(f).tokens.length, 1);
  assert.equal(state(f).tokens[0].input_tokens, 77);
});
it("boot repair rechecks ownership/provider after asynchronous transcript reads", async () => {
  for (const mutation of [
    "source='src_foreign'",
    "provider='codex'",
    'metadata=\'{"origin_host":"archived-box"}\'',
  ]) {
    const f = fixture();
    const transcript = path.join(root, `${f.id}.jsonl`);
    const directory = path.join(root, f.id, "subagents");
    fs.writeFileSync(transcript, "");
    fs.mkdirSync(directory, { recursive: true });
    const child = path.join(directory, "agent-child.jsonl");
    fs.writeFileSync(
      child,
      JSON.stringify({
        type: "assistant",
        timestamp: f.sub.startedAt,
        message: {
          id: "message",
          model: f.sub.model,
          content: [],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
      }) + "\n"
    );
    db.prepare("UPDATE sessions SET transcript_path=? WHERE id=?").run(transcript, f.id);
    const original = fs.createReadStream;
    let expected;
    fs.createReadStream = function (file, ...args) {
      const stream = original.call(this, file, ...args);
      if (file === child)
        stream.once("data", () => {
          db.prepare(`UPDATE sessions SET ${mutation} WHERE id=?`).run(f.id);
          expected = state(f);
        });
      return stream;
    };
    try {
      await history.backfillSubagentTokenMetadata(dbModule);
    } finally {
      fs.createReadStream = original;
    }
    assert.ok(
      expected,
      "ownership changes after candidate selection, during actual stream parsing"
    );
    assert.deepEqual(state(f), expected);
  }
});
