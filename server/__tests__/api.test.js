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

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let BASE;
const EXPECTED_API_PATHS = [
  "/api/health",
  "/api/sessions",
  "/api/sessions/{id}",
  "/api/agents",
  "/api/agents/{id}",
  "/api/events",
  "/api/stats",
  "/api/analytics",
  "/api/hooks/event",
  "/api/pricing",
  "/api/pricing/{pattern}",
  "/api/pricing/cost",
  "/api/pricing/cost/{sessionId}",
  "/api/workflows",
  "/api/workflows/session/{id}",
  "/api/settings/info",
  "/api/settings/clear-data",
  "/api/settings/reimport",
  "/api/settings/reinstall-hooks",
  "/api/settings/reset-pricing",
  "/api/settings/export",
  "/api/settings/cleanup",
  "/api/openapi.json",
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
  // Force exit since WS heartbeat interval keeps process alive
  setTimeout(() => process.exit(0), 100);
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
      status: "connected",
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
      status: "connected",
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
  });

  it("should keep session active and set main agent idle on Stop", async () => {
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

    // Main agent should be idle (waiting for user input)
    const agentsRes = await fetch("/api/agents?session_id=hook-sess-1");
    const main = agentsRes.body.agents.find((a) => a.type === "main");
    assert.equal(main.status, "idle");
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
    assert.equal(mainAgent.status, "idle", "Main agent should be idle");

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
    assert.equal(main0.status, "idle", "Main should be idle after Stop");

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
    assert.equal(main.status, "idle", "Main agent should be idle after Stop reactivation");
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
    assert.equal(main.status, "idle", "Main agent should be idle after turn 1 Stop");

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
    assert.equal(main.status, "idle", "Main agent should be idle after turn 2 Stop");
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
        "idle",
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
      "idle",
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
    assert.ok(typeof res.body.transcript_cache.entries === "number", "should have entries count");
    assert.ok(Array.isArray(res.body.transcript_cache.paths), "should have paths array");
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
        transcriptCache.stats().paths.includes(tmpTranscript),
        "cache should contain transcript path after event"
      );

      // SessionEnd should evict
      await post("/api/hooks/event", {
        hook_type: "SessionEnd",
        data: { session_id: sessionId, transcript_path: tmpTranscript, cwd: "/tmp" },
      });
      assert.ok(
        !transcriptCache.stats().paths.includes(tmpTranscript),
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

  it("should parent sub-subagent to working subagent when main is idle (depth 1→2)", async () => {
    // Stop main agent so it goes idle — simulates main waiting for subagent results
    await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: SID, stop_reason: "end_turn" },
    });

    // Verify main is idle
    const mainRes = await fetch(`/api/agents/${SID}-main`);
    assert.equal(mainRes.body.agent.status, "idle", "Main should be idle");

    // Now a new Agent tool call arrives — since main is idle, this must be from the working subagent
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
    // Level-2 is working, level-1 is working, main is idle → deepest working is level-2
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
