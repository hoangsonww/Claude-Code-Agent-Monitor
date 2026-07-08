/**
 * @file Tests for the Dashboard API endpoints, covering session and agent management, event recording, stats aggregation, and hook event processing. Uses Node's built-in test runner and assertions to validate API behavior and edge cases.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const pkg = require("../../package.json");

// Set up test database BEFORE requiring any server modules
const TEST_DB = path.join(os.tmpdir(), `dashboard-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
// Disable the watchdog's process-liveness reap: these suites exercise the
// idle-timeout / interrupt / error-recovery paths with synthetic sessions that
// have no real `claude` process, which the probe would otherwise (correctly)
// complete out from under the assertions. Liveness has its own test file.
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;
const EXPECTED_API_PATHS = [
  "/api/health",
  "/api/sessions",
  "/api/sessions/{id}",
  "/api/sessions/facets",
  "/api/sessions/{id}/stats",
  "/api/sessions/{id}/transcripts",
  "/api/sessions/{id}/transcript",
  "/api/agents",
  "/api/agents/{id}",
  "/api/events",
  "/api/events/facets",
  "/api/stats",
  "/api/analytics",
  "/api/hooks/event",
  "/api/pricing",
  "/api/pricing/{pattern}",
  "/api/pricing/cost",
  "/api/pricing/cost/{sessionId}",
  "/api/workflows",
  "/api/workflows/session/{id}",
  "/api/workflows/runs",
  "/api/workflows/runs/{runId}",
  "/api/settings/info",
  "/api/settings/clear-data",
  "/api/settings/reimport",
  "/api/settings/reinstall-hooks",
  "/api/settings/reset-pricing",
  "/api/settings/export",
  "/api/settings/cleanup",
  "/api/settings/claude-home",
  "/api/import/guide",
  "/api/import/rescan",
  "/api/import/scan-path",
  "/api/import/upload",
  "/api/updates/status",
  "/api/updates/check",
  "/api/alerts",
  "/api/alerts/rules",
  "/api/alerts/rules/{id}",
  "/api/alerts/{id}/ack",
  "/api/alerts/ack-all",
  "/api/push/vapid-public-key",
  "/api/push/subscribe",
  "/api/push/send",
  "/api/cc-config/overview",
  "/api/cc-config/skills",
  "/api/cc-config/agents",
  "/api/cc-config/commands",
  "/api/cc-config/output-styles",
  "/api/cc-config/plugins",
  "/api/cc-config/mcp",
  "/api/cc-config/hooks",
  "/api/cc-config/settings",
  "/api/cc-config/memory",
  "/api/cc-config/marketplaces",
  "/api/cc-config/keybindings",
  "/api/cc-config/statusline",
  "/api/cc-config/hook-scripts",
  "/api/cc-config/file",
  "/api/cc-config/backups",
  "/api/run",
  "/api/run/history",
  "/api/run/cwds",
  "/api/run/files",
  "/api/run/binary",
  "/api/run/{id}",
  "/api/run/{id}/message",
  "/api/webhooks",
  "/api/webhooks/providers",
  "/api/webhooks/{id}",
  "/api/webhooks/{id}/test",
  "/api/webhooks/{id}/deliveries",
  "/api/openapi.json",
  "/api/docs",
  "/api/redoc",
];

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };

    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function post(urlPath, body) {
  return fetch(urlPath, { method: "POST", body });
}

function patch(urlPath, body) {
  return fetch(urlPath, { method: "PATCH", body });
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0); // port 0 = random available port
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.unlinkSync(TEST_DB);
    fs.unlinkSync(TEST_DB + "-wal");
    fs.unlinkSync(TEST_DB + "-shm");
  } catch {
    // ignore cleanup errors
  }
});

// ============================================================
// Health
// ============================================================
describe("GET /api/health", () => {
  it("should return ok status", async () => {
    const res = await fetch("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(res.body.timestamp);
  });
});

describe("OpenAPI / Swagger", () => {
  it("should expose OpenAPI spec with complete endpoint coverage", async () => {
    const res = await fetch("/api/openapi.json");
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, "3.0.3");
    assert.equal(res.body.info.version, pkg.version);
    assert.equal(res.body.info.license.name, pkg.license);
    assert.equal(res.body["x-issues-url"], pkg.bugs.url);
    assert.match(res.body.info.contact.url, /github\.com\/hoangsonww\/Claude-Code-Agent-Monitor/);

    for (const pathName of EXPECTED_API_PATHS) {
      assert.ok(res.body.paths[pathName], `Expected path ${pathName} to be documented`);
    }
  });

  it("should serve Swagger UI", async () => {
    const res = await fetch("/api/docs/");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/html/);
    assert.match(res.body, /swagger/i);
  });

  it("should serve the ReDoc reference page", async () => {
    const res = await fetch("/api/redoc");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /text\/html/);
    // References the spec and the locally-served bundle (no CDN).
    assert.match(res.body, /spec-url="\/api\/openapi\.json"/);
    assert.match(res.body, /src="\/api\/redoc\/redoc\.standalone\.js"/);
  });

  it("should serve the self-hosted ReDoc bundle", async () => {
    const res = await fetch("/api/redoc/redoc.standalone.js");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /javascript/);
  });
});

// ============================================================
// Sessions CRUD
// ============================================================
describe("Sessions API", () => {
  it("should create a session", async () => {
    const res = await post("/api/sessions", {
      id: "sess-1",
      name: "Test Session",
      cwd: "/home/test",
      model: "claude-opus-4-6",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.session.id, "sess-1");
    assert.equal(res.body.session.name, "Test Session");
    assert.equal(res.body.session.status, "active");
    assert.equal(res.body.session.cwd, "/home/test");
    assert.equal(res.body.created, true);
  });

  it("should return existing session on duplicate create (idempotent)", async () => {
    const res = await post("/api/sessions", {
      id: "sess-1",
      name: "Different Name",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.session.name, "Test Session"); // original name preserved
    assert.equal(res.body.created, false);
  });

  it("should reject session without id", async () => {
    const res = await post("/api/sessions", { name: "No ID" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("should get a session by id", async () => {
    const res = await fetch("/api/sessions/sess-1");
    assert.equal(res.status, 200);
    assert.equal(res.body.session.id, "sess-1");
    assert.ok(Array.isArray(res.body.agents));
    assert.ok(Array.isArray(res.body.events));
  });

  it("should return 404 for nonexistent session", async () => {
    const res = await fetch("/api/sessions/nonexistent");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  it("should list sessions", async () => {
    await post("/api/sessions", { id: "sess-2", name: "Session Two" });
    const res = await fetch("/api/sessions");
    assert.equal(res.status, 200);
    assert.ok(res.body.sessions.length >= 2);
  });

  it("should filter sessions by status", async () => {
    const res = await fetch("/api/sessions?status=active");
    assert.equal(res.status, 200);
    res.body.sessions.forEach((s) => assert.equal(s.status, "active"));
  });

  it("should paginate sessions", async () => {
    const res = await fetch("/api/sessions?limit=1&offset=0");
    assert.equal(res.body.sessions.length, 1);
    assert.equal(res.body.limit, 1);
    assert.equal(res.body.offset, 0);
  });

  it("should update a session", async () => {
    const res = await patch("/api/sessions/sess-1", {
      status: "completed",
      ended_at: new Date().toISOString(),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.session.status, "completed");
    assert.ok(res.body.session.ended_at);
  });

  it("should return 404 when updating nonexistent session", async () => {
    const res = await patch("/api/sessions/nonexistent", { status: "error" });
    assert.equal(res.status, 404);
  });
});

// ============================================================
// Agents CRUD
// ============================================================
describe("Agents API", () => {
  it("should create an agent", async () => {
    const res = await post("/api/agents", {
      id: "agent-1",
      session_id: "sess-2",
      name: "Main Agent",
      type: "main",
      status: "working",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.agent.id, "agent-1");
    assert.equal(res.body.agent.name, "Main Agent");
    assert.equal(res.body.agent.type, "main");
    assert.equal(res.body.created, true);
  });

  it("should return existing agent on duplicate create (idempotent)", async () => {
    const res = await post("/api/agents", {
      id: "agent-1",
      session_id: "sess-2",
      name: "Different",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.name, "Main Agent");
    assert.equal(res.body.created, false);
  });

  it("should reject agent without required fields", async () => {
    const res = await post("/api/agents", { id: "x" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("should create a subagent with parent", async () => {
    const res = await post("/api/agents", {
      id: "agent-2",
      session_id: "sess-2",
      name: "Explorer",
      type: "subagent",
      subagent_type: "Explore",
      status: "working",
      task: "Searching for patterns",
      parent_agent_id: "agent-1",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.agent.type, "subagent");
    assert.equal(res.body.agent.subagent_type, "Explore");
    assert.equal(res.body.agent.parent_agent_id, "agent-1");
  });

  it("should get an agent by id", async () => {
    const res = await fetch("/api/agents/agent-1");
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.id, "agent-1");
  });

  it("should return 404 for nonexistent agent", async () => {
    const res = await fetch("/api/agents/nonexistent");
    assert.equal(res.status, 404);
  });

  it("should list all agents", async () => {
    const res = await fetch("/api/agents");
    assert.ok(res.body.agents.length >= 2);
  });

  it("should filter agents by status", async () => {
    const res = await fetch("/api/agents?status=working");
    assert.equal(res.status, 200);
    res.body.agents.forEach((a) => assert.equal(a.status, "working"));
  });

  it("should filter agents by session_id", async () => {
    const res = await fetch("/api/agents?session_id=sess-2");
    assert.equal(res.status, 200);
    res.body.agents.forEach((a) => assert.equal(a.session_id, "sess-2"));
  });

  it("should update an agent", async () => {
    const res = await patch("/api/agents/agent-1", {
      status: "working",
      current_tool: "Bash",
      task: "Running tests",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.status, "working");
    assert.equal(res.body.agent.current_tool, "Bash");
    assert.equal(res.body.agent.task, "Running tests");
  });

  it("should clear current_tool on update", async () => {
    const res = await patch("/api/agents/agent-1", {
      status: "working",
      current_tool: null,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.current_tool, null);
  });

  it("should return 404 when updating nonexistent agent", async () => {
    const res = await patch("/api/agents/nonexistent", { status: "error" });
    assert.equal(res.status, 404);
  });
});

// ============================================================
// Events
// ============================================================
describe("Events API", () => {
  it("should list events (empty initially)", async () => {
    const res = await fetch("/api/events");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.events));
  });

  it("should respect limit parameter", async () => {
    const res = await fetch("/api/events?limit=5");
    assert.equal(res.status, 200);
    assert.ok(res.body.events.length <= 5);
  });

  it("should return a total count matching the filter", async () => {
    const res = await fetch("/api/events?limit=1");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.total, "number");
  });

  it("should cap limit at 500", async () => {
    const res = await fetch("/api/events?limit=999999");
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 500);
  });
});

// ============================================================
// Events filtering
// ============================================================
describe("Events API — filters", () => {
  // Seed events across two sessions, two agents, two tools, two event types.
  const SESSION_A = "filter-sess-a";
  const SESSION_B = "filter-sess-b";
  const AGENT_A = `${SESSION_A}-main`;
  const AGENT_B = `${SESSION_B}-main`;

  before(async () => {
    // Bootstrap the sessions/agents via hook events so agent rows exist.
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: SESSION_A, cwd: "/a" },
    });
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: SESSION_B, cwd: "/b" },
    });

    const now = Date.now();
    const mk = (offsetSec, session, agent, type, tool, summary, data) => {
      stmts.insertEvent.run(
        session,
        agent,
        type,
        tool,
        summary,
        JSON.stringify(data || { session_id: session })
      );
      // Backdate created_at deterministically so date-range filters work.
      const ts = new Date(now - offsetSec * 1000).toISOString().replace("Z", "000Z");
      db.prepare(
        "UPDATE events SET created_at = ? WHERE id = (SELECT MAX(id) FROM events WHERE session_id = ?)"
      ).run(ts, session);
    };

    mk(100, SESSION_A, AGENT_A, "PreToolUse", "Bash", "run curl", { command: "curl https://x" });
    mk(80, SESSION_A, AGENT_A, "PostToolUse", "Bash", "ran curl", { stdout: "ok" });
    mk(60, SESSION_A, AGENT_A, "PreToolUse", "Edit", "edit file", { file_path: "/x.ts" });
    mk(40, SESSION_B, AGENT_B, "PreToolUse", "Read", "read file", { file_path: "/y.ts" });
    mk(20, SESSION_B, AGENT_B, "Stop", null, "session stopped", null);
  });

  it("filters by single event_type", async () => {
    const res = await fetch("/api/events?event_type=Stop&session_id=filter-sess-b");
    assert.equal(res.status, 200);
    assert.ok(res.body.events.every((e) => e.event_type === "Stop"));
    assert.ok(res.body.total >= 1);
  });

  it("filters by csv event_type (multi-select)", async () => {
    const res = await fetch(
      `/api/events?event_type=PreToolUse,PostToolUse&session_id=${SESSION_A}`
    );
    assert.equal(res.status, 200);
    assert.ok(
      res.body.events.every((e) => e.event_type === "PreToolUse" || e.event_type === "PostToolUse")
    );
  });

  it("filters by tool_name", async () => {
    const res = await fetch(`/api/events?tool_name=Bash&session_id=${SESSION_A}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.events.every((e) => e.tool_name === "Bash"));
  });

  it("filters by session_id csv", async () => {
    const res = await fetch(`/api/events?session_id=${SESSION_A},${SESSION_B}`);
    assert.equal(res.status, 200);
    assert.ok(
      res.body.events.every((e) => e.session_id === SESSION_A || e.session_id === SESSION_B)
    );
  });

  it("filters by agent_id", async () => {
    const res = await fetch(`/api/events?agent_id=${AGENT_A}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.events.every((e) => e.agent_id === AGENT_A));
  });

  it("filters by text search (q) across summary and data", async () => {
    const res = await fetch(`/api/events?q=curl&session_id=${SESSION_A}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.events.length >= 1);
    assert.ok(
      res.body.events.every(
        (e) =>
          (e.summary && e.summary.includes("curl")) ||
          (e.data && e.data.includes("curl")) ||
          (e.tool_name && e.tool_name.includes("curl"))
      )
    );
  });

  it("filters by date range (from / to)", async () => {
    const from = new Date(Date.now() - 50 * 1000).toISOString();
    const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&session_id=${SESSION_B}`);
    assert.equal(res.status, 200);
    for (const e of res.body.events) {
      assert.ok(e.created_at >= from, `event ${e.id} older than from bound`);
    }
  });

  it("combines multiple filters with AND semantics", async () => {
    const res = await fetch(
      `/api/events?event_type=PreToolUse&tool_name=Bash&session_id=${SESSION_A}`
    );
    assert.equal(res.status, 200);
    assert.ok(
      res.body.events.every((e) => e.event_type === "PreToolUse" && e.tool_name === "Bash")
    );
  });

  it("ignores malformed date values rather than rejecting the request", async () => {
    const res = await fetch("/api/events?from=not-a-date&limit=1");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.events));
  });

  it("returns distinct event_types and tool_names from /facets", async () => {
    const res = await fetch("/api/events/facets");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.event_types));
    assert.ok(Array.isArray(res.body.tool_names));
    assert.ok(res.body.event_types.includes("PreToolUse"));
    assert.ok(res.body.tool_names.includes("Bash"));
  });
});

// ============================================================
// Stats
// ============================================================
describe("Stats API", () => {
  it("should return aggregate statistics", async () => {
    const res = await fetch("/api/stats");
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.total_sessions, "number");
    assert.equal(typeof res.body.active_sessions, "number");
    assert.equal(typeof res.body.active_agents, "number");
    assert.equal(typeof res.body.total_agents, "number");
    assert.equal(typeof res.body.total_events, "number");
    assert.equal(typeof res.body.events_today, "number");
    assert.equal(typeof res.body.ws_connections, "number");
    assert.equal(typeof res.body.agents_by_status, "object");
    assert.equal(typeof res.body.sessions_by_status, "object");
  });

  it("should reflect created data in stats", async () => {
    const res = await fetch("/api/stats");
    assert.ok(res.body.total_sessions >= 2);
    assert.ok(res.body.total_agents >= 2);
  });
});

// ============================================================
// Hook Event Processing
// ============================================================
describe("Hook Event Processing", () => {
  it("should reject missing hook_type", async () => {
    const res = await post("/api/hooks/event", { data: { session_id: "x" } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_INPUT");
  });

  it("should reject missing data", async () => {
    const res = await post("/api/hooks/event", { hook_type: "PreToolUse" });
    assert.equal(res.status, 400);
  });

  it("should reject missing session_id in data", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { tool_name: "Bash" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "MISSING_SESSION");
  });

  it("should auto-create session and main agent on first PreToolUse", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: "hook-sess-1",
        tool_name: "Read",
        tool_input: { file_path: "/test.ts" },
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.event.event_type, "PreToolUse");
    assert.equal(res.body.event.tool_name, "Read");

    // Verify session was created
    const sessRes = await fetch("/api/sessions/hook-sess-1");
    assert.equal(sessRes.status, 200);
    assert.equal(sessRes.body.session.status, "active");

    // Verify main agent was created
    const agentRes = await fetch("/api/agents/hook-sess-1-main");
    assert.equal(agentRes.status, 200);
    assert.equal(agentRes.body.agent.type, "main");
    assert.equal(agentRes.body.agent.status, "working");
    assert.equal(agentRes.body.agent.current_tool, "Read");
  });

  it("should keep main agent working on PostToolUse and clear current_tool", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "PostToolUse",
      data: {
        session_id: "hook-sess-1",
        tool_name: "Read",
      },
    });
    assert.equal(res.status, 200);

    const agentRes = await fetch("/api/agents/hook-sess-1-main");
    // Status stays "working" — only Stop transitions it
    assert.equal(agentRes.body.agent.status, "working");
    assert.equal(agentRes.body.agent.current_tool, null);
  });

  it("should create subagent when Agent tool is used", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: "hook-sess-1",
        tool_name: "Agent",
        tool_input: {
          description: "Search codebase",
          subagent_type: "Explore",
          prompt: "Find all TypeScript files with error handling",
        },
      },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.event.summary.includes("Subagent spawned"));

    // Verify subagent exists
    const agentsRes = await fetch("/api/agents?session_id=hook-sess-1");
    const subagents = agentsRes.body.agents.filter((a) => a.type === "subagent");
    assert.ok(subagents.length >= 1);
    const sub = subagents[0];
    assert.equal(sub.name, "Search codebase");
    assert.equal(sub.subagent_type, "Explore");
    assert.equal(sub.status, "working");
    assert.ok(sub.task.includes("Find all TypeScript"));
    assert.equal(sub.parent_agent_id, "hook-sess-1-main");
  });

  it("should mark subagent completed on SubagentStop", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: "hook-sess-1" },
    });
    assert.equal(res.status, 200);

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-1");
    const subagents = agentsRes.body.agents.filter((a) => a.type === "subagent");
    const completed = subagents.filter((a) => a.status === "completed");
    assert.ok(completed.length >= 1);
    assert.ok(completed[0].ended_at);
  });

  it("SubagentStop attributes subagent tokens to their own model via the HTTP path (issue #185)", async () => {
    // End-to-end through the /event handler (the unit tests call the importer
    // directly, so this guards the handler wiring — e.g. parentModels scope).
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-sa-185-"));
    const sid = "hook-sess-185";
    const mainPath = path.join(baseDir, `${sid}.jsonl`);
    // Main transcript: orchestrator on Opus.
    fs.writeFileSync(
      mainPath,
      [
        {
          type: "assistant",
          timestamp: "2026-05-01T09:00:00.000Z",
          message: {
            model: "claude-opus-4-8",
            content: [{ type: "text", text: "orchestrating" }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
        },
      ]
        .map((o) => JSON.stringify(o))
        .join("\n")
    );
    // Subagent on Haiku, in <base>/<sid>/subagents/.
    const subDir = path.join(baseDir, sid, "subagents");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, "agent-h1.jsonl"),
      [
        {
          type: "user",
          timestamp: "2026-05-01T09:00:01.000Z",
          message: { content: [{ type: "text", text: "go" }] },
        },
        {
          type: "assistant",
          timestamp: "2026-05-01T09:00:02.000Z",
          message: {
            model: "claude-haiku-4-5-20251001",
            content: [{ type: "tool_use", id: "tu1", name: "Read", input: {} }],
            usage: {
              input_tokens: 700,
              output_tokens: 300,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
        },
        {
          type: "user",
          timestamp: "2026-05-01T09:00:03.000Z",
          message: { content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
        },
      ]
        .map((o) => JSON.stringify(o))
        .join("\n")
    );
    fs.writeFileSync(path.join(subDir, "agent-h1.meta.json"), JSON.stringify({ agentType: "qa" }));

    try {
      const res = await post("/api/hooks/event", {
        hook_type: "SubagentStop",
        data: { session_id: sid, transcript_path: mainPath },
      });
      assert.equal(res.status, 200); // must not 500 — guards the handler scope wiring

      // The subagent scan is fire-and-forget; poll for the Haiku bucket.
      let haiku = null;
      for (let i = 0; i < 100 && !haiku; i++) {
        haiku = db
          .prepare("SELECT * FROM token_usage WHERE session_id = ? AND model = ?")
          .get(sid, "claude-haiku-4-5-20251001");
        if (!haiku) await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(haiku, "subagent tokens must be attributed under the subagent's own model");
      assert.equal(haiku.input_tokens, 700);
      assert.equal(haiku.output_tokens, 300);

      // Orchestrator's Opus bucket comes from the main transcript (not the sub).
      const opus = db
        .prepare("SELECT * FROM token_usage WHERE session_id = ? AND model = ?")
        .get(sid, "claude-opus-4-8");
      assert.ok(opus, "orchestrator opus bucket from the main transcript");
      assert.equal(opus.input_tokens, 100);

      const sess = db.prepare("SELECT model FROM sessions WHERE id = ?").get(sid);
      assert.equal(sess.model, "claude-opus-4-8");
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it("should handle Notification events", async () => {
    const res = await post("/api/hooks/event", {
      hook_type: "Notification",
      data: {
        session_id: "hook-sess-1",
        message: "Task completed successfully",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.event.summary, "Task completed successfully");

    // A non-waiting Notification should NOT stamp awaiting_input_since.
    const sessRes = await fetch("/api/sessions/hook-sess-1");
    assert.equal(sessRes.body.session.awaiting_input_since, null);
  });

  it("should mark session and main agent as awaiting input on permission-prompt Notification", async () => {
    // Bootstrap a fresh session so prior tests don't taint the assertion.
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: "hook-sess-wait" },
    });

    const res = await post("/api/hooks/event", {
      hook_type: "Notification",
      data: {
        session_id: "hook-sess-wait",
        message: "Claude needs your permission to use Bash",
      },
    });
    assert.equal(res.status, 200);

    const sessRes = await fetch("/api/sessions/hook-sess-wait");
    assert.ok(
      sessRes.body.session.awaiting_input_since,
      "session should be flagged as awaiting input"
    );

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-wait");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.ok(main.awaiting_input_since, "main agent should be flagged as awaiting input");
  });

  it("should clear awaiting_input_since when the user resumes (next PreToolUse)", async () => {
    // Re-arm the waiting state — previous test may have left it set, but be
    // explicit so this test stands on its own.
    await post("/api/hooks/event", {
      hook_type: "Notification",
      data: {
        session_id: "hook-sess-wait",
        message: "Claude is waiting for your input",
      },
    });

    const before = await fetch("/api/sessions/hook-sess-wait");
    assert.ok(before.body.session.awaiting_input_since);

    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-wait", tool_name: "Bash" },
    });

    const after = await fetch("/api/sessions/hook-sess-wait");
    assert.equal(after.body.session.awaiting_input_since, null);

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-wait");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.awaiting_input_since, null);
  });

  it("should keep session active and set main agent waiting on Stop", async () => {
    // First make sure main agent is in a working state
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-1", tool_name: "Write" },
    });

    const res = await post("/api/hooks/event", {
      hook_type: "Stop",
      data: {
        session_id: "hook-sess-1",
        stop_reason: "end_turn",
      },
    });
    assert.equal(res.status, 200);

    // Session should stay active — Stop means Claude finished responding, not session closed
    const sessRes = await fetch("/api/sessions/hook-sess-1");
    assert.equal(sessRes.body.session.status, "active");

    // Main agent should be waiting (waiting for user input)
    const agentsRes = await fetch("/api/agents?session_id=hook-sess-1");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "waiting");

    // Non-error Stop also stamps awaiting_input_since so the dashboard
    // surfaces a Waiting badge — Claude finished its turn, ball is now in
    // the user's court. Cleared by the next PreToolUse/PostToolUse.
    assert.ok(
      sessRes.body.session.awaiting_input_since,
      "session should be flagged waiting after non-error Stop"
    );
    assert.ok(
      main.awaiting_input_since,
      "main agent should be flagged waiting after non-error Stop"
    );
  });

  it("should mark a brand-new SessionStart as Waiting (sitting at the prompt)", async () => {
    // A just-launched Claude Code session has nothing to do yet — it's
    // sitting at a prompt waiting for the user's first message. The
    // dashboard should reflect that immediately rather than parking it in
    // Active until Stop fires.
    const sid = "hook-sess-fresh-start";
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: sid, source: "startup" },
    });

    const sessRes = await fetch(`/api/sessions/${sid}`);
    assert.equal(sessRes.body.session.status, "active");
    assert.ok(
      sessRes.body.session.awaiting_input_since,
      "fresh session should be flagged Waiting at SessionStart"
    );

    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.ok(main.awaiting_input_since, "fresh main agent should be flagged Waiting");
  });

  it("should clear awaiting_input_since and promote main to working on UserPromptSubmit", async () => {
    // The bug this guards: text-only assistant turns emit no PreToolUse,
    // so without UserPromptSubmit the Waiting badge would persist for the
    // entire generation. This test simulates: Stop (waiting set) → user
    // types another message → UserPromptSubmit must clear waiting and
    // promote the main agent back to working immediately, before Claude
    // does anything.
    const sid = "hook-sess-userprompt";
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: sid },
    });
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: sid, tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, stop_reason: "end_turn" },
    });

    // Confirm waiting state exists before the user types again.
    const before = await fetch(`/api/sessions/${sid}`);
    assert.ok(before.body.session.awaiting_input_since, "session should be waiting after Stop");

    // User submits a new prompt — Claude hasn't done anything yet.
    await post("/api/hooks/event", {
      hook_type: "UserPromptSubmit",
      data: { session_id: sid, prompt: "follow-up question" },
    });

    const afterSess = await fetch(`/api/sessions/${sid}`);
    assert.equal(
      afterSess.body.session.awaiting_input_since,
      null,
      "session waiting flag should be cleared by UserPromptSubmit"
    );
    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.awaiting_input_since, null);
    assert.equal(main.status, "working", "main agent should be promoted to working");
  });

  it("should NOT clear awaiting_input_since when SubagentStop fires after Stop", async () => {
    // Regression: backgrounded subagents that finish *after* a non-error
    // Stop used to flip the session out of Waiting because the blanket
    // auto-clear ran on every non-Notification event. SubagentStop tells
    // us nothing about whether the human responded, so it must leave the
    // flag alone.
    const sid = "hook-sess-subagent-late";
    await post("/api/hooks/event", {
      hook_type: "SessionStart",
      data: { session_id: sid },
    });
    // Spawn a subagent so SubagentStop has something to match.
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "background-worker", subagent_type: "general-purpose" },
      },
    });
    // Main turn ends — session enters Waiting.
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, stop_reason: "end_turn" },
    });

    const beforeSess = await fetch(`/api/sessions/${sid}`);
    assert.ok(beforeSess.body.session.awaiting_input_since, "session should be Waiting after Stop");
    const beforeAgents = await fetch(`/api/agents?session_id=${sid}`);
    const beforeMain = beforeAgents.body.agents.find((a) => a.type === "main");
    assert.ok(beforeMain.awaiting_input_since, "main agent should be Waiting after Stop");

    // Backgrounded subagent finishes — must NOT flip session out of Waiting.
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: sid, agent_type: "general-purpose" },
    });

    const afterSess = await fetch(`/api/sessions/${sid}`);
    assert.ok(
      afterSess.body.session.awaiting_input_since,
      "session should STILL be Waiting after SubagentStop"
    );
    const afterAgents = await fetch(`/api/agents?session_id=${sid}`);
    const afterMain = afterAgents.body.agents.find((a) => a.type === "main");
    assert.ok(
      afterMain.awaiting_input_since,
      "main agent should STILL be Waiting after SubagentStop"
    );
  });

  it("should NOT stamp awaiting_input_since when Stop has stop_reason=error", async () => {
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-stop-err", tool_name: "Bash" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-stop-err", stop_reason: "error" },
    });
    const sessRes = await fetch("/api/sessions/hook-sess-stop-err");
    assert.equal(sessRes.body.session.status, "error");
    assert.equal(sessRes.body.session.awaiting_input_since, null);
  });

  it("should clear awaiting_input_since on the next PreToolUse after Stop", async () => {
    // Confirm the flag carried forward from the previous Stop test.
    const before = await fetch("/api/sessions/hook-sess-1");
    assert.ok(before.body.session.awaiting_input_since);

    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-1", tool_name: "Read" },
    });

    const after = await fetch("/api/sessions/hook-sess-1");
    assert.equal(after.body.session.awaiting_input_since, null);

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-1");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.awaiting_input_since, null);
  });

  it("should mark session as error when stop_reason is error", async () => {
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-err", tool_name: "Bash" },
    });

    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-err", stop_reason: "error" },
    });

    const sessRes = await fetch("/api/sessions/hook-sess-err");
    assert.equal(sessRes.body.session.status, "error");
  });

  it("should not create duplicate session on repeated events", async () => {
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-dup", tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "PostToolUse",
      data: { session_id: "hook-sess-dup", tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-dup", tool_name: "Write" },
    });

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-dup");
    const mainAgents = agentsRes.body.agents.filter((a) => a.type === "main");
    assert.equal(mainAgents.length, 1, "Should have exactly one main agent");
  });

  it("should keep background subagents working on Stop", async () => {
    // Spawn a subagent (may be running in background)
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: "hook-sess-bg",
        tool_name: "Agent",
        tool_input: { prompt: "Analyze code", description: "BG-analyzer" },
      },
    });

    // Stop fires — background subagents stay working, main goes idle, session stays active
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-bg", stop_reason: "end_turn" },
    });

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-bg");
    const subagent = agentsRes.body.agents.find((a) => a.type === "subagent");
    assert.equal(subagent.status, "working", "Background subagent should stay working on Stop");
    assert.equal(subagent.ended_at, null, "Subagent should not have ended_at");

    const mainAgent = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(mainAgent.status, "waiting", "Main agent should be waiting");

    const sessRes = await fetch("/api/sessions/hook-sess-bg");
    assert.equal(sessRes.body.session.status, "active", "Session should stay active");

    // SubagentStop completes the subagent individually
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: "hook-sess-bg", description: "BG-analyzer" },
    });

    const agentsRes2 = await fetch("/api/agents?session_id=hook-sess-bg");
    const subagent2 = agentsRes2.body.agents.find((a) => a.type === "subagent");
    assert.equal(subagent2.status, "completed", "Subagent should complete on SubagentStop");
    assert.ok(subagent2.ended_at, "Subagent should have ended_at after SubagentStop");
  });

  it("should NOT mark subagent completed on PostToolUse for Agent tool", async () => {
    // Fresh session: spawn a subagent, then PostToolUse fires immediately (backgrounded)
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: "hook-sess-bg2",
        tool_name: "Agent",
        tool_input: { prompt: "Analyze code", description: "BG-analyzer-2" },
      },
    });
    await post("/api/hooks/event", {
      hook_type: "PostToolUse",
      data: {
        session_id: "hook-sess-bg2",
        tool_name: "Agent",
        tool_input: { description: "BG-analyzer-2" },
      },
    });

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-bg2");
    const subagent = agentsRes.body.agents.find((a) => a.type === "subagent");
    assert.equal(subagent.status, "working", "Subagent should still be working after PostToolUse");
  });

  it("should complete subagent on SubagentStop before session Stop", async () => {
    // SubagentStop fires when the background agent actually finishes
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: "hook-sess-bg2", description: "BG-analyzer-2" },
    });

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-bg2");
    const subagent = agentsRes.body.agents.find((a) => a.type === "subagent");
    assert.equal(subagent.status, "completed", "Subagent should be completed after SubagentStop");
    assert.ok(subagent.ended_at, "Subagent should have ended_at timestamp");
  });

  it("should not flicker completed agent status on subsequent tool events", async () => {
    // Create session with active subagent
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: "hook-sess-flicker",
        tool_name: "Agent",
        tool_input: { prompt: "Do work", description: "Worker" },
      },
    });
    // Stop sets main to idle, background subagent stays working
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-flicker", stop_reason: "end_turn" },
    });

    const agents0 = await fetch("/api/agents?session_id=hook-sess-flicker");
    const main0 = agents0.body.agents.find((a) => a.type === "main");
    assert.equal(main0.status, "waiting", "Main should be waiting after Stop");

    const sub0 = agents0.body.agents.find((a) => a.type === "subagent");
    assert.equal(sub0.status, "working", "Background subagent should stay working after Stop");
  });

  it("should record events in the events table", async () => {
    const eventsRes = await fetch("/api/events?session_id=hook-sess-1");
    assert.ok(
      eventsRes.body.events.length >= 4,
      "Should have multiple events from hook processing"
    );

    const types = eventsRes.body.events.map((e) => e.event_type);
    assert.ok(types.includes("PreToolUse"));
    assert.ok(types.includes("PostToolUse"));
    assert.ok(types.includes("Stop"));
  });

  it("should reactivate error session on new work events (resume)", async () => {
    // Create session and trigger error
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-resume", tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-resume", stop_reason: "error" },
    });

    let sessRes = await fetch("/api/sessions/hook-sess-resume");
    assert.equal(sessRes.body.session.status, "error", "Session should be error after error Stop");

    // Resume: send a new PreToolUse for the same session
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-resume", tool_name: "Write" },
    });

    sessRes = await fetch("/api/sessions/hook-sess-resume");
    assert.equal(sessRes.body.session.status, "active", "Session should be reactivated");
    assert.equal(sessRes.body.session.ended_at, null, "ended_at should be cleared");

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-resume");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "working", "Main agent should be working after resume");
    assert.equal(main.ended_at, null, "Main agent ended_at should be cleared");
  });

  it("should reactivate imported completed session on Stop event", async () => {
    // Simulate a session that was imported as "completed" before the server started.
    // This happens when a session is active but was imported from JSONL during startup.
    const sessionId = "hook-sess-imported-reactivate";
    const mainAgentId = `${sessionId}-main`;

    // Manually insert a "completed" imported session + agent (mimics import-history.js)
    stmts.insertSession.run(
      sessionId,
      "Imported Session",
      "completed",
      "/tmp",
      "claude-sonnet-4-6",
      null
    );
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      "Main Agent",
      "main",
      null,
      "completed",
      null,
      null,
      null
    );

    // Verify it starts as completed
    let sessRes = await fetch(`/api/sessions/${sessionId}`);
    assert.equal(sessRes.body.session.status, "completed");
    let main = sessRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "completed");

    // A Stop event arrives — this proves the session is actually alive
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sessionId, stop_reason: "end_turn" },
    });

    // Session should be reactivated
    sessRes = await fetch(`/api/sessions/${sessionId}`);
    assert.equal(
      sessRes.body.session.status,
      "active",
      "Completed session should reactivate on Stop"
    );

    main = sessRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "waiting", "Main agent should be waiting after Stop reactivation");
  });

  it("should NOT reactivate error session on Stop event", async () => {
    // Error sessions should only reactivate on work events, not Stop
    const sessionId = "hook-sess-error-stop";
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: sessionId, tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sessionId, stop_reason: "error" },
    });

    let sessRes = await fetch(`/api/sessions/${sessionId}`);
    assert.equal(sessRes.body.session.status, "error");

    // Another Stop should NOT reactivate an error session
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sessionId, stop_reason: "end_turn" },
    });

    sessRes = await fetch(`/api/sessions/${sessionId}`);
    assert.equal(
      sessRes.body.session.status,
      "error",
      "Error session should NOT reactivate on Stop"
    );
  });

  it("should keep session active across multiple Stop events (multi-turn)", async () => {
    // Turn 1: user asks something, Claude responds
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-multiturn", tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-multiturn", stop_reason: "end_turn" },
    });

    let sessRes = await fetch("/api/sessions/hook-sess-multiturn");
    assert.equal(sessRes.body.session.status, "active", "Session should stay active after turn 1");

    let agentsRes = await fetch("/api/agents?session_id=hook-sess-multiturn");
    let main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "waiting", "Main agent should be waiting after turn 1 Stop");

    // Turn 2: user asks something else — PreToolUse should transition idle → working
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-multiturn", tool_name: "Write" },
    });

    agentsRes = await fetch("/api/agents?session_id=hook-sess-multiturn");
    main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "working", "Main agent should be working during turn 2");

    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-multiturn", stop_reason: "end_turn" },
    });

    sessRes = await fetch("/api/sessions/hook-sess-multiturn");
    assert.equal(sessRes.body.session.status, "active", "Session should stay active after turn 2");

    agentsRes = await fetch("/api/agents?session_id=hook-sess-multiturn");
    main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "waiting", "Main agent should be waiting after turn 2 Stop");
  });

  it("should mark session completed on SessionEnd", async () => {
    // Create session with some activity
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-end", tool_name: "Read" },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-end", stop_reason: "end_turn" },
    });

    // Session should still be active after Stop
    let sessRes = await fetch("/api/sessions/hook-sess-end");
    assert.equal(sessRes.body.session.status, "active");

    // SessionEnd fires when CLI exits
    await post("/api/hooks/event", {
      hook_type: "SessionEnd",
      data: { session_id: "hook-sess-end", reason: "prompt_input_exit" },
    });

    sessRes = await fetch("/api/sessions/hook-sess-end");
    assert.equal(
      sessRes.body.session.status,
      "completed",
      "Session should be completed after SessionEnd"
    );
    assert.ok(sessRes.body.session.ended_at, "Session should have ended_at");

    const agentsRes = await fetch("/api/agents?session_id=hook-sess-end");
    agentsRes.body.agents.forEach((a) => {
      assert.equal(a.status, "completed", `Agent ${a.name} should be completed`);
    });
  });

  it("should extract token usage from transcript_path on Stop", async () => {
    // Create a temporary JSONL transcript file
    const transcriptPath = path.join(os.tmpdir(), `transcript-test-${Date.now()}.jsonl`);
    // Real Claude Code transcript format: model/usage are nested inside entry.message
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello" } }),
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-sonnet-4-6",
          role: "assistant",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 200,
            cache_creation_input_tokens: 10,
          },
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-sonnet-4-6",
          role: "assistant",
          usage: {
            input_tokens: 150,
            output_tokens: 75,
            cache_read_input_tokens: 300,
            cache_creation_input_tokens: 0,
          },
        },
      }),
      JSON.stringify({ type: "progress" }), // Non-message entries should be skipped
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-opus-4-6",
          role: "assistant",
          usage: {
            input_tokens: 500,
            output_tokens: 200,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 50,
          },
        },
      }),
    ];
    fs.writeFileSync(transcriptPath, lines.join("\n") + "\n");

    // Send Stop event with transcript_path
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-transcript", tool_name: "Read" },
    });
    const res = await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "hook-sess-transcript", transcript_path: transcriptPath },
    });
    assert.equal(res.status, 200);

    // Check token_usage was written
    const costRes = await fetch("/api/pricing/cost/hook-sess-transcript");
    assert.equal(costRes.status, 200);
    assert.ok(Array.isArray(costRes.body.daily_costs));
    assert.equal(costRes.body.daily_costs.length, 1);
    assert.equal(costRes.body.daily_costs[0].cost, costRes.body.total_cost);

    const sonnet = costRes.body.breakdown.find((b) => b.model === "claude-sonnet-4-6");
    assert.ok(sonnet, "Should have sonnet token data");
    assert.equal(sonnet.input_tokens, 250);
    assert.equal(sonnet.output_tokens, 125);
    assert.equal(sonnet.cache_read_tokens, 500);
    assert.equal(sonnet.cache_write_tokens, 10);

    const opus = costRes.body.breakdown.find((b) => b.model === "claude-opus-4-6");
    assert.ok(opus, "Should have opus token data");
    assert.equal(opus.input_tokens, 500);
    assert.equal(opus.output_tokens, 200);

    // Clean up
    fs.unlinkSync(transcriptPath);
  });

  it("should update token usage on every event, not just Stop", async () => {
    // Create a transcript that grows over time (simulating mid-session reads)
    const transcriptPath = path.join(os.tmpdir(), `transcript-mid-${Date.now()}.jsonl`);
    const line1 = JSON.stringify({
      type: "assistant",
      message: {
        model: "claude-sonnet-4-6",
        role: "assistant",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    });
    fs.writeFileSync(transcriptPath, line1 + "\n");

    // PreToolUse event with transcript_path should trigger token extraction
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: { session_id: "hook-sess-mid", tool_name: "Read", transcript_path: transcriptPath },
    });

    const midRes = await fetch("/api/pricing/cost/hook-sess-mid");
    assert.equal(midRes.status, 200);
    assert.ok(Array.isArray(midRes.body.daily_costs));
    assert.equal(midRes.body.daily_costs.length, 1);
    const midSonnet = midRes.body.breakdown.find((b) => b.model === "claude-sonnet-4-6");
    assert.ok(midSonnet, "Should have token data after PreToolUse");
    assert.equal(midSonnet.input_tokens, 100);
    assert.equal(midSonnet.output_tokens, 50);

    // Transcript grows — second assistant response added
    const line2 = JSON.stringify({
      type: "assistant",
      message: {
        model: "claude-sonnet-4-6",
        role: "assistant",
        usage: {
          input_tokens: 200,
          output_tokens: 80,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    });
    fs.appendFileSync(transcriptPath, line2 + "\n");

    // PostToolUse event should pick up the updated transcript
    await post("/api/hooks/event", {
      hook_type: "PostToolUse",
      data: { session_id: "hook-sess-mid", tool_name: "Read", transcript_path: transcriptPath },
    });

    const updatedRes = await fetch("/api/pricing/cost/hook-sess-mid");
    assert.ok(Array.isArray(updatedRes.body.daily_costs));
    assert.equal(updatedRes.body.daily_costs.length, 1);
    assert.equal(updatedRes.body.daily_costs[0].cost, updatedRes.body.total_cost);
    const updatedSonnet = updatedRes.body.breakdown.find((b) => b.model === "claude-sonnet-4-6");
    assert.ok(updatedSonnet, "Should have updated token data after PostToolUse");
    // replaceTokenUsage overwrites with totals from full transcript (100+200=300, 50+80=130)
    assert.equal(updatedSonnet.input_tokens, 300);
    assert.equal(updatedSonnet.output_tokens, 130);

    fs.unlinkSync(transcriptPath);
  });
});

// ============================================================
// Database Integrity
// ============================================================
describe("Database Integrity", () => {
  it("should enforce session status CHECK constraint", () => {
    assert.throws(() => {
      stmts.insertSession.run("bad-status", "test", "invalid_status", null, null, null);
    });
  });

  it("should enforce agent status CHECK constraint", () => {
    assert.throws(() => {
      stmts.insertAgent.run(
        "bad-agent",
        "sess-2",
        "Test",
        "main",
        null,
        "invalid_status",
        null,
        null,
        null
      );
    });
  });

  it("should enforce agent type CHECK constraint", () => {
    assert.throws(() => {
      stmts.insertAgent.run(
        "bad-agent2",
        "sess-2",
        "Test",
        "invalid_type",
        null,
        "waiting",
        null,
        null,
        null
      );
    });
  });

  it("should cascade delete agents when session is deleted", () => {
    // Create a session with agents
    stmts.insertSession.run("cascade-test", "Cascade Test", "active", null, null, null);
    stmts.insertAgent.run(
      "cascade-agent",
      "cascade-test",
      "Agent",
      "main",
      null,
      "waiting",
      null,
      null,
      null
    );

    // Verify agent exists
    assert.ok(stmts.getAgent.get("cascade-agent"));

    // Delete session
    db.prepare("DELETE FROM sessions WHERE id = ?").run("cascade-test");

    // Agent should be gone
    assert.equal(stmts.getAgent.get("cascade-agent"), undefined);
  });

  it("should have all expected indexes", () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all()
      .map((r) => r.name);

    assert.ok(indexes.includes("idx_agents_session"));
    assert.ok(indexes.includes("idx_agents_status"));
    assert.ok(indexes.includes("idx_events_session"));
    assert.ok(indexes.includes("idx_events_type"));
    assert.ok(indexes.includes("idx_events_created"));
    assert.ok(indexes.includes("idx_sessions_status"));
    assert.ok(indexes.includes("idx_sessions_started"));
  });

  it("should use WAL journal mode", () => {
    const mode = db.pragma("journal_mode", { simple: true });
    assert.equal(mode, "wal");
  });

  it("should have foreign keys enabled", () => {
    const fk = db.pragma("foreign_keys", { simple: true });
    assert.equal(fk, 1);
  });
});

describe("Transcript cache integration", () => {
  it("should extract and cache tokens from transcript file via hook event", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `test-transcript-${Date.now()}.jsonl`);
    const entries = [
      JSON.stringify({
        message: {
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 10,
            cache_creation_input_tokens: 5,
          },
        },
      }),
      JSON.stringify({
        message: {
          model: "claude-sonnet-4-20250514",
          usage: {
            input_tokens: 200,
            output_tokens: 75,
            cache_read_input_tokens: 20,
            cache_creation_input_tokens: 10,
          },
        },
      }),
    ];
    fs.writeFileSync(tmpTranscript, entries.join("\n") + "\n");

    try {
      const sessionId = `cache-test-${Date.now()}`;

      // First event — cache miss, full read
      const r1 = await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });
      assert.strictEqual(r1.status, 200);

      // Verify token usage was stored
      const tokenRow = stmts.getTokensBySession.all(sessionId);
      assert.ok(tokenRow.length > 0, "token_usage row should exist");
      const sonnet = tokenRow.find((r) => r.model.includes("sonnet"));
      assert.ok(sonnet, "should have sonnet model entry");
      assert.strictEqual(sonnet.input_tokens, 300);
      assert.strictEqual(sonnet.output_tokens, 125);
      assert.strictEqual(sonnet.cache_read_tokens, 30);
      assert.strictEqual(sonnet.cache_write_tokens, 15);

      // Second event — same file, should be a cache hit (stat unchanged)
      const r2 = await post("/api/hooks/event", {
        hook_type: "PostToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });
      assert.strictEqual(r2.status, 200);

      // Tokens should still be the same (no double-counting)
      const tokenRow2 = stmts.getTokensBySession.all(sessionId);
      const sonnet2 = tokenRow2.find((r) => r.model.includes("sonnet"));
      assert.strictEqual(sonnet2.input_tokens, 300);

      // Append new data — simulates Claude writing more to transcript
      fs.appendFileSync(
        tmpTranscript,
        JSON.stringify({
          message: {
            model: "claude-sonnet-4-20250514",
            usage: {
              input_tokens: 400,
              output_tokens: 150,
              cache_read_input_tokens: 40,
              cache_creation_input_tokens: 20,
            },
          },
        }) + "\n"
      );

      // Third event — file grew, incremental read should pick up new data
      const r3 = await post("/api/hooks/event", {
        hook_type: "Stop",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      assert.strictEqual(r3.status, 200);

      const tokenRow3 = stmts.getTokensBySession.all(sessionId);
      const sonnet3 = tokenRow3.find((r) => r.model.includes("sonnet"));
      assert.strictEqual(sonnet3.input_tokens, 700);
      assert.strictEqual(sonnet3.output_tokens, 275);
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it("should include transcript_cache in settings info", async () => {
    const res = await fetch("/api/settings/info");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.transcript_cache, "response should include transcript_cache");
    assert.ok(typeof res.body.transcript_cache.size === "number", "should have size count");
    assert.ok(Array.isArray(res.body.transcript_cache.keys), "should have keys array");
  });

  it("should evict cache entry on SessionEnd", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `test-evict-${Date.now()}.jsonl`);
    fs.writeFileSync(
      tmpTranscript,
      JSON.stringify({ message: { model: "m1", usage: { input_tokens: 10, output_tokens: 5 } } }) +
        "\n"
    );

    try {
      const sessionId = `evict-test-${Date.now()}`;
      const { transcriptCache } = require("../routes/hooks");

      // Hook event populates cache
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });
      assert.ok(
        transcriptCache.stats().keys.includes(tmpTranscript),
        "cache should contain transcript path after event"
      );

      // SessionEnd should evict
      await post("/api/hooks/event", {
        hook_type: "SessionEnd",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      assert.ok(
        !transcriptCache.stats().keys.includes(tmpTranscript),
        "cache should NOT contain transcript path after SessionEnd"
      );
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });
});

// ============================================================
// Compaction ingestion (regression: issue #156)
// ============================================================
describe("Compaction agent ingestion", () => {
  it("should stamp started_at == ended_at == transcript timestamp (no negative duration)", async () => {
    const pastTs = new Date(Date.now() - 60_000).toISOString(); // 60s in past
    const compactUuid = `compact-uuid-${Date.now()}`;
    const tmpTranscript = path.join(os.tmpdir(), `compact-test-${Date.now()}.jsonl`);
    fs.writeFileSync(
      tmpTranscript,
      JSON.stringify({
        isCompactSummary: true,
        uuid: compactUuid,
        timestamp: pastTs,
        message: { model: "claude-sonnet-4-5", usage: { input_tokens: 100, output_tokens: 50 } },
      }) + "\n"
    );

    const sessionId = `compact-sess-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      hooks.transcriptCache.invalidate(tmpTranscript);
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });

      const compactId = `${sessionId}-compact-${compactUuid}`;
      const agent = stmts.getAgent.get(compactId);
      assert.ok(agent, "compaction agent should be created");
      assert.equal(agent.subagent_type, "compaction");
      assert.equal(
        agent.started_at,
        pastTs,
        "started_at must equal transcript timestamp, not ingestion wall clock"
      );
      assert.equal(agent.ended_at, pastTs, "ended_at must equal transcript timestamp");

      const durRow = db
        .prepare(
          `SELECT (julianday(ended_at) - julianday(started_at)) * 86400 AS dur
           FROM agents WHERE id = ?`
        )
        .get(compactId);
      assert.ok(durRow.dur >= 0, `compaction duration must be >= 0, got ${durRow.dur}`);
      assert.equal(durRow.dur, 0, "compaction is instantaneous → duration must be exactly 0");
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });

  it("workflows avgDuration for compaction must never be negative", async () => {
    // Seed a few broken-historical rows (simulating pre-fix corrupt data) and
    // a fresh-ingestion row, then assert the API never reports a negative avg.
    const sid = `compact-avg-sess-${Date.now()}`;
    stmts.insertSession.run(sid, "compact-avg", "completed", "/tmp", "test-model", null);
    stmts.insertAgent.run(`${sid}-main`, sid, "main", "main", null, "completed", null, null, null);

    // Insert a compaction row with the broken invariant explicitly, then run
    // the same repair the startup migration runs and assert it is healed.
    const brokenId = `${sid}-compact-broken`;
    stmts.insertAgent.run(
      brokenId,
      sid,
      "Context Compaction",
      "subagent",
      "compaction",
      "completed",
      null,
      `${sid}-main`,
      null
    );
    const pastTs = new Date(Date.now() - 30_000).toISOString();
    db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(pastTs, brokenId);
    const before = db.prepare("SELECT started_at, ended_at FROM agents WHERE id = ?").get(brokenId);
    assert.ok(
      before.ended_at < before.started_at,
      "precondition: row should have ended_at < started_at"
    );

    // Apply repair (mirrors startup migration in server/db.js)
    db.prepare(
      `UPDATE agents SET started_at = ended_at, updated_at = ended_at
       WHERE subagent_type = 'compaction' AND ended_at IS NOT NULL
         AND julianday(ended_at) < julianday(started_at)`
    ).run();

    const after = db.prepare("SELECT started_at, ended_at FROM agents WHERE id = ?").get(brokenId);
    assert.equal(after.started_at, pastTs, "repair should collapse started_at to ended_at");
    assert.equal(after.ended_at, pastTs);

    const res = await fetch("/api/workflows");
    assert.equal(res.status, 200);
    // Subagent effectiveness (incl. avgDuration per type) is at .effectiveness,
    // not .types — the prior key never matched, so this assertion was dead.
    const compactionType = (res.body.effectiveness || []).find(
      (t) => t.subagent_type === "compaction"
    );
    if (compactionType && compactionType.avgDuration !== null) {
      assert.ok(
        compactionType.avgDuration >= 0,
        `compaction avgDuration must be >= 0, got ${compactionType.avgDuration}`
      );
    }
  });

  it("workflows avgDuration for non-compaction subagents is clamped to >= 0", async () => {
    // The #156 startup repair only heals compaction rows. A non-compaction
    // subagent whose ended_at < started_at (clock skew, replayed/synced
    // transcripts, or fleet/Workflow-tool ingestion) is NOT repaired, so the
    // per-type avgDuration query must clamp negative durations itself.
    const sid = `noncompact-avg-sess-${Date.now()}`;
    stmts.insertSession.run(sid, "noncompact-avg", "completed", "/tmp", "test-model", null);
    stmts.insertAgent.run(`${sid}-main`, sid, "main", "main", null, "completed", null, null, null);

    // One valid Explore row (+10s) and one broken Explore row (ended 30s before
    // started). The broken row is deliberately left un-repaired.
    const goodId = `${sid}-explore-good`;
    stmts.insertAgent.run(
      goodId,
      sid,
      "Explore",
      "subagent",
      "Explore",
      "completed",
      null,
      `${sid}-main`,
      null
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ? WHERE id = ?").run(
      new Date(Date.now() - 10_000).toISOString(),
      new Date().toISOString(),
      goodId
    );

    const brokenId = `${sid}-explore-broken`;
    stmts.insertAgent.run(
      brokenId,
      sid,
      "Explore",
      "subagent",
      "Explore",
      "completed",
      null,
      `${sid}-main`,
      null
    );
    db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(
      new Date(Date.now() - 30_000).toISOString(),
      brokenId
    );
    const before = db.prepare("SELECT started_at, ended_at FROM agents WHERE id = ?").get(brokenId);
    assert.ok(
      before.ended_at < before.started_at,
      "precondition: broken row should have ended_at < started_at"
    );

    const res = await fetch("/api/workflows");
    assert.equal(res.status, 200);
    const exploreType = (res.body.effectiveness || []).find((t) => t.subagent_type === "Explore");
    assert.ok(exploreType, "Explore subagent type should appear in effectiveness");
    assert.ok(
      exploreType.avgDuration >= 0,
      `non-compaction avgDuration must be >= 0, got ${exploreType.avgDuration}`
    );
  });
});

// ============================================================
// Watchdog: stale-error idempotence
// ============================================================
describe("Watchdog API-error detection", () => {
  function writeTranscriptWithError(p) {
    fs.writeFileSync(
      p,
      JSON.stringify({
        isApiErrorMessage: true,
        error: "rate_limit_error",
        message: { content: [{ text: "Rate limit exceeded" }] },
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
  }

  it("should NOT re-flip a recovered session to error when only pre-existing transcript errors remain", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-stale-${Date.now()}.jsonl`);
    writeTranscriptWithError(tmpTranscript);

    const sessionId = `watchdog-stale-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      // Initial event creates the session and triggers error capture via processEvent.
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });

      // SessionEnd path is what reads errors out of the transcript inside processEvent;
      // simulate the watchdog instead by manually marking the session as error.
      stmts.updateSession.run(null, "error", null, null, sessionId);
      const errored = stmts.getSession.get(sessionId);
      assert.strictEqual(errored.status, "error", "precondition: session marked error");

      // User retries → reactivation logic flips back to active.
      await post("/api/hooks/event", {
        hook_type: "UserPromptSubmit",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      const recovered = stmts.getSession.get(sessionId);
      assert.strictEqual(recovered.status, "active", "UserPromptSubmit should reactivate");

      // Backdate updated_at so the watchdog considers the session stale.
      db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
        new Date(Date.now() - 60_000).toISOString(),
        sessionId
      );

      // Invalidate the cache so the watchdog actually re-reads the transcript on this tick.
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const after = stmts.getSession.get(sessionId);
      assert.strictEqual(
        after.status,
        "active",
        "watchdog must NOT revert recovered session to error when no new transcript errors arrived"
      );
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });

  it("should still mark session as error when a NEW transcript error appears", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-new-${Date.now()}.jsonl`);
    fs.writeFileSync(tmpTranscript, ""); // start empty

    const sessionId = `watchdog-new-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      // Establish an active session against a clean transcript.
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Read",
          cwd: "/tmp",
        },
      });
      assert.strictEqual(stmts.getSession.get(sessionId).status, "active");

      // A new API error appears in the transcript afterwards.
      writeTranscriptWithError(tmpTranscript);

      // Make session look stale to the watchdog.
      db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
        new Date(Date.now() - 60_000).toISOString(),
        sessionId
      );
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const after = stmts.getSession.get(sessionId);
      assert.strictEqual(
        after.status,
        "error",
        "watchdog must flip session to error when a new transcript error is detected"
      );
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });
});

// ============================================================
// Watchdog: user-interrupt (Esc) recovery
// ============================================================
describe("Watchdog user-interrupt recovery", () => {
  function interruptEntry(ts) {
    return JSON.stringify({
      type: "user",
      interruptedMessageId: "msg-int",
      message: { role: "user", content: [{ type: "text", text: "[Request interrupted by user]" }] },
      timestamp: ts,
    });
  }
  function promptEntry(ts, text = "do something") {
    return JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
      timestamp: ts,
    });
  }

  function getMain(sessionId) {
    return db
      .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'main' LIMIT 1")
      .get(sessionId);
  }

  function makeStale(sessionId) {
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
      new Date(Date.now() - 60_000).toISOString(),
      sessionId
    );
  }

  // The headline case: Esc pressed BEFORE any model output. Transcript order is
  // [prompt, interrupt] with the interrupt landing a hair after the prompt, and
  // the UserPromptSubmit hook event is stamped (server clock) AFTER the
  // transcript interrupt. A clock comparison would miss this; pendingInterrupt
  // (transcript-internal) must still flip the session.
  it("should recover a session interrupted BEFORE any output (pre-output Esc)", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-int-pre-${Date.now()}.jsonl`);
    const sessionId = `watchdog-int-pre-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      await post("/api/hooks/event", {
        hook_type: "UserPromptSubmit",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      assert.strictEqual(getMain(sessionId).status, "working", "precondition: main working");

      // Prompt then interrupt 1ms later, both BEFORE the now-stamped hook event.
      const base = new Date(Date.now() - 5_000);
      fs.writeFileSync(
        tmpTranscript,
        promptEntry(base.toISOString()) +
          "\n" +
          interruptEntry(new Date(base.getTime() + 1).toISOString()) +
          "\n"
      );
      makeStale(sessionId);
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const sess = stmts.getSession.get(sessionId);
      const main = getMain(sessionId);
      assert.strictEqual(sess.status, "active", "session stays active (not closed)");
      assert.ok(sess.awaiting_input_since, "session should now be awaiting input");
      assert.strictEqual(main.status, "waiting", "main agent should be waiting after interrupt");
      assert.ok(main.awaiting_input_since, "main agent should be flagged awaiting input");

      const evt = db
        .prepare("SELECT * FROM events WHERE session_id = ? AND event_type = 'Interrupted'")
        .get(sessionId);
      assert.ok(evt, "an Interrupted event should be recorded");
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });

  it("should NOT touch a session where the user resumed after the interrupt", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-int-resumed-${Date.now()}.jsonl`);
    const sessionId = `watchdog-int-resumed-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      await post("/api/hooks/event", {
        hook_type: "UserPromptSubmit",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      assert.strictEqual(getMain(sessionId).status, "working");

      // Transcript shows the interrupt was superseded by a fresh prompt: the
      // user came back. pendingInterrupt must be false → no flip.
      const base = new Date(Date.now() - 10_000);
      fs.writeFileSync(
        tmpTranscript,
        interruptEntry(base.toISOString()) +
          "\n" +
          promptEntry(new Date(base.getTime() + 2_000).toISOString(), "actually do this") +
          "\n"
      );
      makeStale(sessionId);
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const main = getMain(sessionId);
      assert.strictEqual(main.status, "working", "resumed session must stay working");
      assert.strictEqual(main.awaiting_input_since, null, "no awaiting flag for a resumed session");
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });

  // Age the session's hook events, updated_at, AND the transcript file mtime past
  // the idle-working timeout so the no-marker fallback considers it dead.
  function ageIdle(sessionId, transcriptPath, ms = 300_000) {
    const old = new Date(Date.now() - ms).toISOString();
    db.prepare("UPDATE events SET created_at = ? WHERE session_id = ?").run(old, sessionId);
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(old, sessionId);
    const oldSec = (Date.now() - ms) / 1000;
    fs.utimesSync(transcriptPath, oldSec, oldSec);
  }

  // The case that was actually stuck "working" forever: prompt submitted, Esc
  // pressed BEFORE any output. Claude Code writes NO interrupt marker and fires
  // NO hook, so pendingInterrupt is false — only the idle timeout can recover it.
  it("should recover a stuck 'working' session via the idle timeout when there is no marker", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-idle-${Date.now()}.jsonl`);
    const sessionId = `watchdog-idle-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      // Transcript holds only the user's prompt — no marker, no errors, no output.
      fs.writeFileSync(
        tmpTranscript,
        promptEntry(new Date(Date.now() - 300_000).toISOString(), "hi") + "\n"
      );

      await post("/api/hooks/event", {
        hook_type: "UserPromptSubmit",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      const before = getMain(sessionId);
      assert.strictEqual(before.status, "working");
      assert.ok(!before.current_tool, "no tool in flight");
      assert.strictEqual(
        hooks.transcriptCache.extract(tmpTranscript).pendingInterrupt,
        false,
        "no marker → pendingInterrupt false"
      );

      ageIdle(sessionId, tmpTranscript);
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const sess = stmts.getSession.get(sessionId);
      const main = getMain(sessionId);
      assert.ok(sess.awaiting_input_since, "session should be awaiting input after idle timeout");
      assert.strictEqual(main.status, "waiting", "main agent should be waiting after idle timeout");
      assert.ok(main.awaiting_input_since);
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });

  it("should NOT idle-timeout a session with a tool in flight", async () => {
    const tmpTranscript = path.join(os.tmpdir(), `watchdog-tool-${Date.now()}.jsonl`);
    const sessionId = `watchdog-tool-${Date.now()}`;
    const hooks = require("../routes/hooks");

    try {
      fs.writeFileSync(
        tmpTranscript,
        promptEntry(new Date(Date.now() - 300_000).toISOString(), "run it") + "\n"
      );

      // PreToolUse sets current_tool — a long-running tool, not an interrupt.
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          tool_name: "Bash",
          cwd: "/tmp",
        },
      });
      const before = getMain(sessionId);
      assert.strictEqual(before.status, "working");
      assert.ok(before.current_tool, "precondition: a tool is in flight");

      ageIdle(sessionId, tmpTranscript);
      hooks.transcriptCache.invalidate(tmpTranscript);
      hooks.watchdogCheck();

      const main = getMain(sessionId);
      assert.strictEqual(main.status, "working", "a session mid-tool must not be idle-timed-out");
      assert.strictEqual(main.awaiting_input_since, null);
    } finally {
      try {
        fs.unlinkSync(tmpTranscript);
      } catch {
        // ignore
      }
    }
  });
});

// ============================================================
// Nested Agent Spawning (agents spawning agents spawning agents)
// ============================================================
describe("Nested Agent Spawning", () => {
  const SID = "hook-sess-nested";

  it("should parent subagent to main when main is working (depth 0→1)", async () => {
    // Main agent is working (auto-created on first event) and spawns a subagent
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: SID,
        tool_name: "Agent",
        tool_input: {
          description: "Level-1 explorer",
          subagent_type: "Explore",
          prompt: "Explore the codebase",
        },
      },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${SID}`);
    const sub1 = agentsRes.body.agents.find((a) => a.name === "Level-1 explorer");
    assert.ok(sub1, "Level-1 subagent should exist");
    assert.equal(sub1.parent_agent_id, `${SID}-main`, "Level-1 parent should be main agent");
    assert.equal(sub1.status, "working");
  });

  it("should parent sub-subagent to working subagent when main is waiting (depth 1→2)", async () => {
    // Stop main agent so it goes idle — simulates main waiting for subagent results
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: SID, stop_reason: "end_turn" },
    });

    // Verify main is waiting
    const mainRes = await fetch(`/api/agents/${SID}-main`);
    assert.equal(mainRes.body.agent.status, "waiting", "Main should be waiting");

    // Now a new Agent tool call arrives — since main is waiting, this must be from the working subagent
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: SID,
        tool_name: "Agent",
        tool_input: {
          description: "Level-2 researcher",
          subagent_type: "general-purpose",
          prompt: "Research the topic",
        },
      },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${SID}`);
    const sub1 = agentsRes.body.agents.find((a) => a.name === "Level-1 explorer");
    const sub2 = agentsRes.body.agents.find((a) => a.name === "Level-2 researcher");
    assert.ok(sub2, "Level-2 subagent should exist");
    assert.equal(
      sub2.parent_agent_id,
      sub1.id,
      "Level-2 parent should be level-1 subagent, not main"
    );
    assert.equal(sub2.status, "working");
  });

  it("should parent sub-sub-subagent to deepest working agent (depth 2→3)", async () => {
    // Level-2 is working, level-1 is working, main is waiting → deepest working is level-2
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: SID,
        tool_name: "Agent",
        tool_input: {
          description: "Level-3 specialist",
          subagent_type: "test-engineer",
          prompt: "Write tests",
        },
      },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${SID}`);
    const sub2 = agentsRes.body.agents.find((a) => a.name === "Level-2 researcher");
    const sub3 = agentsRes.body.agents.find((a) => a.name === "Level-3 specialist");
    assert.ok(sub3, "Level-3 subagent should exist");
    assert.equal(sub3.parent_agent_id, sub2.id, "Level-3 parent should be level-2 subagent");
  });

  it("should complete deepest agent first and shift parenting on SubagentStop", async () => {
    // Complete level-3 first
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: SID, description: "Level-3 specialist" },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${SID}`);
    const sub3 = agentsRes.body.agents.find((a) => a.name === "Level-3 specialist");
    assert.equal(sub3.status, "completed", "Level-3 should be completed");

    // Now spawn another agent — with level-3 completed, deepest working is level-2
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: SID,
        tool_name: "Agent",
        tool_input: {
          description: "Level-3b sibling",
          subagent_type: "Explore",
          prompt: "Another task",
        },
      },
    });

    const agentsRes2 = await fetch(`/api/agents?session_id=${SID}`);
    const sub2 = agentsRes2.body.agents.find((a) => a.name === "Level-2 researcher");
    const sub3b = agentsRes2.body.agents.find((a) => a.name === "Level-3b sibling");
    assert.ok(sub3b, "Level-3b sibling should exist");
    assert.equal(sub3b.parent_agent_id, sub2.id, "Level-3b should be parented to level-2");
  });

  it("should return correct tree structure from workflows endpoint", async () => {
    // Complete remaining agents so tree is stable
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: SID, description: "Level-3b sibling" },
    });
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: SID, description: "Level-2 researcher" },
    });
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: SID, description: "Level-1 explorer" },
    });

    const res = await fetch(`/api/workflows/session/${SID}`);
    assert.equal(res.status, 200);
    const { tree } = res.body;
    assert.ok(tree.length >= 1, "Tree should have root nodes");

    // Find main agent in tree
    const mainNode = tree.find((n) => n.type === "main");
    assert.ok(mainNode, "Main agent should be a root node");
    assert.ok(mainNode.children.length >= 1, "Main should have children");

    // Find level-1 in main's children
    const l1 = mainNode.children.find((c) => c.name === "Level-1 explorer");
    assert.ok(l1, "Level-1 should be child of main");
    assert.ok(l1.children.length >= 1, "Level-1 should have children");

    // Find level-2 in level-1's children
    const l2 = l1.children.find((c) => c.name === "Level-2 researcher");
    assert.ok(l2, "Level-2 should be child of level-1");
    assert.ok(l2.children.length >= 1, "Level-2 should have children");

    // Level-3 and level-3b should be children of level-2
    const l3names = l2.children.map((c) => c.name);
    assert.ok(l3names.includes("Level-3 specialist"), "Level-3 should be child of level-2");
    assert.ok(l3names.includes("Level-3b sibling"), "Level-3b should be child of level-2");
  });

  it("should complete all nested agents on SessionEnd", async () => {
    // Create a fresh session with deep nesting, then SessionEnd
    const sid = "hook-sess-nested-end";
    // Main spawns level-1
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "End-L1", prompt: "task" },
      },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, stop_reason: "end_turn" },
    });
    // Level-1 spawns level-2
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "End-L2", prompt: "subtask" },
      },
    });

    // SessionEnd should complete everything
    await post("/api/hooks/event", {
      hook_type: "SessionEnd",
      data: { session_id: sid },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    for (const agent of agentsRes.body.agents) {
      assert.equal(
        agent.status,
        "completed",
        `Agent ${agent.name} should be completed after SessionEnd`
      );
      assert.ok(agent.ended_at, `Agent ${agent.name} should have ended_at`);
    }
  });

  it("should handle orphaned subagents when parent is missing", async () => {
    // Create session with main, a legitimate subagent, then delete the parent to orphan it
    stmts.insertSession.run("orphan-sess", "Orphan Test", "active", null, null, null);
    stmts.insertAgent.run(
      "orphan-main",
      "orphan-sess",
      "Main",
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    // Create a subagent parented to main, then we'll check tree structure
    stmts.insertAgent.run(
      "orphan-real-parent",
      "orphan-sess",
      "Real Parent",
      "subagent",
      "Explore",
      "completed",
      null,
      "orphan-main",
      null
    );
    // Create a child of the real parent — this will become orphaned when we NULL its parent
    stmts.insertAgent.run(
      "orphan-sub",
      "orphan-sess",
      "Orphan Sub",
      "subagent",
      "Explore",
      "working",
      null,
      "orphan-real-parent",
      null
    );
    // Delete the real parent — FK ON DELETE SET NULL means orphan-sub.parent_agent_id becomes NULL
    db.prepare("DELETE FROM agents WHERE id = 'orphan-real-parent'").run();

    const res = await fetch("/api/workflows/session/orphan-sess");
    assert.equal(res.status, 200);
    // The orphan should appear as a root (parent was deleted, FK set to NULL)
    const { tree } = res.body;
    const orphanNode = tree.find((n) => n.name === "Orphan Sub");
    assert.ok(orphanNode, "Orphaned subagent should appear as a root node in tree");
  });

  it("should parent to main when main is working and subagents also working (parallel)", async () => {
    const sid = "hook-sess-parallel";
    // Main spawns first subagent
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "Parallel-A", prompt: "task A" },
      },
    });
    // Main is still working — spawns another subagent
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "Parallel-B", prompt: "task B" },
      },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    const subA = agentsRes.body.agents.find((a) => a.name === "Parallel-A");
    const subB = agentsRes.body.agents.find((a) => a.name === "Parallel-B");
    assert.equal(subA.parent_agent_id, `${sid}-main`, "Parallel-A should be parented to main");
    assert.equal(
      subB.parent_agent_id,
      `${sid}-main`,
      "Parallel-B should be parented to main (main was working)"
    );
  });

  it("should verify depth calculation in workflows stats", async () => {
    const res = await fetch("/api/workflows");
    assert.equal(res.status, 200);
    // Our nested session (hook-sess-nested) has depth 3, so avg should be > 0
    assert.ok(typeof res.body.stats.avgDepth === "number", "avgDepth should be a number");
    assert.ok(res.body.stats.avgDepth > 0, "avgDepth should be > 0 with nested agents");
  });

  it("should support arbitrary depth (depth 7 chain)", async () => {
    const sid = "hook-sess-deep7";
    const DEPTH = 7;

    // Spawn level-1 from main (main is working on first event)
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "Deep-L1", prompt: "task" },
      },
    });
    // Stop main so subagent events get parented correctly
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, stop_reason: "end_turn" },
    });

    // Spawn levels 2 through DEPTH — each parented to the previous
    for (let i = 2; i <= DEPTH; i++) {
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sid,
          tool_name: "Agent",
          tool_input: { description: `Deep-L${i}`, prompt: `task at depth ${i}` },
        },
      });
    }

    // Verify the chain: each level should be parented to the previous
    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    const agents = agentsRes.body.agents;
    const byName = {};
    for (const a of agents) byName[a.name] = a;

    assert.equal(byName["Deep-L1"].parent_agent_id, `${sid}-main`, "L1 parent = main");
    for (let i = 2; i <= DEPTH; i++) {
      const child = byName[`Deep-L${i}`];
      const parent = byName[`Deep-L${i - 1}`];
      assert.ok(child, `Deep-L${i} should exist`);
      assert.ok(parent, `Deep-L${i - 1} should exist`);
      assert.equal(
        child.parent_agent_id,
        parent.id,
        `Deep-L${i} should be parented to Deep-L${i - 1}`
      );
    }

    // Verify tree structure from workflows endpoint
    const treeRes = await fetch(`/api/workflows/session/${sid}`);
    assert.equal(treeRes.status, 200);
    let node = treeRes.body.tree.find((n) => n.type === "main");
    assert.ok(node, "Main should be root");
    for (let i = 1; i <= DEPTH; i++) {
      assert.ok(node.children.length >= 1, `Node at depth ${i - 1} should have children`);
      node = node.children.find((c) => c.name === `Deep-L${i}`);
      assert.ok(node, `Deep-L${i} should be in tree at depth ${i}`);
    }
    assert.equal(node.children.length, 0, "Deepest node should be a leaf");
  });

  it("should unwind correctly when inner agents stop (depth 5, then spawn sibling)", async () => {
    const sid = "hook-sess-unwind";

    // Build chain: main → L1 → L2 → L3 → L4 → L5
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "UW-L1", prompt: "t" },
      },
    });
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: sid, stop_reason: "end_turn" },
    });
    for (let i = 2; i <= 5; i++) {
      await post("/api/hooks/event", {
        hook_type: "PreToolUse",
        data: {
          session_id: sid,
          tool_name: "Agent",
          tool_input: { description: `UW-L${i}`, prompt: "t" },
        },
      });
    }

    // Now complete L5 and L4
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: sid, description: "UW-L5" },
    });
    await post("/api/hooks/event", {
      hook_type: "SubagentStop",
      data: { session_id: sid, description: "UW-L4" },
    });

    // Deepest working should now be L3. Spawn a new agent — should parent to L3.
    await post("/api/hooks/event", {
      hook_type: "PreToolUse",
      data: {
        session_id: sid,
        tool_name: "Agent",
        tool_input: { description: "UW-L4b", prompt: "t" },
      },
    });

    const agentsRes = await fetch(`/api/agents?session_id=${sid}`);
    const agents = agentsRes.body.agents;
    const byName = {};
    for (const a of agents) byName[a.name] = a;

    assert.equal(byName["UW-L5"].status, "completed");
    assert.equal(byName["UW-L4"].status, "completed");
    assert.equal(byName["UW-L3"].status, "working");
    assert.equal(
      byName["UW-L4b"].parent_agent_id,
      byName["UW-L3"].id,
      "After unwinding to L3, new spawn should parent to L3"
    );
  });
});
