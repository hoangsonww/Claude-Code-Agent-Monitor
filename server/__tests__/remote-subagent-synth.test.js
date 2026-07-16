/**
 * @file Tests for the remote/transcript-less subagent synth on SubagentStop.
 * Household/remote sessions run Claude on another machine, so their subagent
 * sidechains never reach this host: neither PreToolUse (subagent creation) nor
 * the post-commit transcript scan creates a subagent row, and the SubagentStop
 * would otherwise leave the session showing only its main agent. The ingestor
 * synthesizes a completed subagent row for these — gated on the SubagentStop's
 * transcript_path NOT being readable on this host (origin/host-agnostic, and a
 * strict no-op for local sessions whose JSONL is on disk), idempotent by
 * agent_id. Uses Node's built-in test runner with temp CLAUDE_HOME / DATA_DIR.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const STAMP = `remote-subagent-synth-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
fs.mkdirSync(TMP, { recursive: true });

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;

let server;
let BASE;

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(b || "{}");
          } catch {
            parsed = b;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

/** Count subagent rows for a session. */
function subagentCount(sid) {
  return db
    .prepare("SELECT COUNT(*) AS c FROM agents WHERE session_id = ? AND type = 'subagent'")
    .get(sid).c;
}

// A path guaranteed not to exist on this host — stands in for a remote machine's
// transcript that the monitor cannot read.
const UNREADABLE = "C:\\Users\\matsp\\.claude\\projects\\enc\\does-not-exist.jsonl";

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("SubagentStop — remote synth", () => {
  const WIN_CWD = "C:\\Users\\matsp\\chats\\mcp-csr-ipsec-big-session";

  it("synthesizes a completed subagent row when the transcript is unreadable on this host", async () => {
    const sid = "20000000-0000-0000-0000-000000000001";
    const res = await req("POST", "/api/hooks/event", {
      hook_type: "SubagentStop",
      data: {
        session_id: sid,
        cwd: WIN_CWD,
        transcript_path: UNREADABLE,
        agent_id: "sub-abc123",
        last_assistant_message: "Verified the IPsec CSR chain end to end.",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(subagentCount(sid), 1);
    const sub = stmts.getAgent.get(`${sid}-sub-sub-abc123`);
    assert.ok(sub, "synth subagent row should exist");
    assert.equal(sub.type, "subagent");
    assert.equal(sub.status, "completed");
    assert.equal(sub.parent_agent_id, `${sid}-main`);
    assert.ok(sub.ended_at, "completed subagent should have ended_at set");
    // No agent_type/description on the event → label falls back to the inline msg.
    assert.equal(sub.name, "Verified the IPsec CSR chain end to end.");
  });

  it("is idempotent — a redelivered SubagentStop does not create a second row", async () => {
    const sid = "20000000-0000-0000-0000-000000000002";
    const data = {
      session_id: sid,
      cwd: WIN_CWD,
      transcript_path: UNREADABLE,
      agent_id: "sub-dup",
      last_assistant_message: "done",
    };
    await req("POST", "/api/hooks/event", { hook_type: "SubagentStop", data });
    await req("POST", "/api/hooks/event", { hook_type: "SubagentStop", data });
    assert.equal(subagentCount(sid), 1);
  });

  it("prefers agent_type/description over the inline message for the label + type", async () => {
    const sid = "20000000-0000-0000-0000-000000000003";
    await req("POST", "/api/hooks/event", {
      hook_type: "SubagentStop",
      data: {
        session_id: sid,
        cwd: WIN_CWD,
        transcript_path: UNREADABLE,
        agent_id: "sub-typed",
        agent_type: "frontend-security-accessibility-reviewer",
        last_assistant_message: "should not be used as the label",
      },
    });
    const sub = stmts.getAgent.get(`${sid}-sub-sub-typed`);
    assert.equal(sub.name, "frontend-security-accessibility-reviewer");
    assert.equal(sub.subagent_type, "frontend-security-accessibility-reviewer");
  });

  it("fires for a remote POSIX-origin session too (origin-agnostic, not Windows-only)", async () => {
    // A remote Linux laptop reporting to this monitor: POSIX-absolute cwd, but the
    // transcript still lives on that machine so its path is unreadable here.
    const sid = "20000000-0000-0000-0000-000000000005";
    await req("POST", "/api/hooks/event", {
      hook_type: "SubagentStop",
      data: {
        session_id: sid,
        cwd: "/home/mats/work/project",
        transcript_path: "/home/mats/.claude/projects/enc/nope.jsonl",
        agent_id: "sub-posix",
        last_assistant_message: "remote posix subagent",
      },
    });
    assert.equal(subagentCount(sid), 1);
  });

  it("does NOT synth when the transcript IS readable on this host (local pipeline owns it)", async () => {
    const sid = "20000000-0000-0000-0000-000000000004";
    const tpath = path.join(TMP, `${sid}.jsonl`);
    fs.writeFileSync(tpath, "{}\n");
    await req("POST", "/api/hooks/event", {
      hook_type: "SubagentStop",
      data: {
        session_id: sid,
        cwd: "/home/claude/projects/ai-deck",
        transcript_path: tpath,
        agent_id: "sub-local",
        last_assistant_message: "local subagent",
      },
    });
    assert.equal(subagentCount(sid), 0);
  });

  it("does NOT synth when the SubagentStop carries no transcript_path", async () => {
    const sid = "20000000-0000-0000-0000-000000000006";
    await req("POST", "/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: sid, cwd: WIN_CWD, agent_id: "sub-notp", last_assistant_message: "x" },
    });
    assert.equal(subagentCount(sid), 0);
  });
});
