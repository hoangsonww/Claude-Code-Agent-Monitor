#!/usr/bin/env node

/**
 * Seeds the database with sample data for development and demo purposes.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { v4: uuidv4 } = require("uuid");
const { db, stmts } = require("../server/db");

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

const AGENT_NAMES = [
  "Main Agent",
  "Code Explorer",
  "Test Runner",
  "Code Reviewer",
  "Security Auditor",
  "Doc Writer",
  "Debugger",
  "Knowledge Base",
  "TDD Assistant",
  "UI Engineer",
];

const SUBAGENT_TYPES = [
  "Explore",
  "general-purpose",
  "Plan",
  "code-reviewer",
  "tdd-assistant",
  "debugger",
  "security-auditor",
  "doc-writer",
  "knowledge-base",
  "ui-engineer",
];

const TOOL_NAMES = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Grep",
  "Glob",
  "Agent",
  "WebSearch",
  "WebFetch",
];

const TASKS = [
  "Searching for authentication middleware patterns",
  "Running test suite for user service",
  "Reviewing PR #42 for security vulnerabilities",
  "Analyzing database schema for optimization",
  "Exploring component structure in src/components",
  "Writing unit tests for payment processor",
  "Debugging failing integration test",
  "Documenting API endpoints",
  "Scanning for OWASP Top 10 vulnerabilities",
  "Refactoring utility functions",
];

function seed() {
  console.log("Seeding database with sample data...\n");

  const insertAll = db.transaction(() => {
    // Create sessions
    const sessions = [];

    // Active session
    const activeSessionId = uuidv4();
    stmts.insertSession.run(
      activeSessionId,
      "Feature: User Authentication",
      "active",
      "/home/dev/my-app",
      "claude-opus-4-6",
      null
    );
    sessions.push(activeSessionId);

    // Another active session
    const activeSessionId2 = uuidv4();
    stmts.insertSession.run(
      activeSessionId2,
      "Bug Fix: Payment Processing",
      "active",
      "/home/dev/payment-service",
      "claude-sonnet-4-6",
      null
    );
    sessions.push(activeSessionId2);

    // Completed sessions
    for (let i = 0; i < 5; i++) {
      const id = uuidv4();
      stmts.insertSession.run(
        id,
        randomItem([
          "Refactor: Database Layer",
          "Feature: Email Notifications",
          "Fix: Memory Leak in Worker",
          "Test: API Integration Suite",
          "Docs: README Update",
        ]),
        "completed",
        randomItem(["/home/dev/api", "/home/dev/frontend", "/home/dev/worker"]),
        randomItem(["claude-opus-4-6", "claude-sonnet-4-6"]),
        null
      );
      // Set ended_at
      db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(
        minutesAgo(Math.floor(Math.random() * 120)),
        id
      );
      sessions.push(id);
    }

    // Error session
    const errSessionId = uuidv4();
    stmts.insertSession.run(
      errSessionId,
      "Deploy: Production Release",
      "error",
      "/home/dev/infra",
      "claude-opus-4-6",
      null
    );
    db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(minutesAgo(45), errSessionId);
    sessions.push(errSessionId);

    // Create agents for active session 1
    const mainAgent1 = `${activeSessionId}-main`;
    stmts.insertAgent.run(
      mainAgent1,
      activeSessionId,
      "Main Agent",
      "main",
      null,
      "working",
      "Implementing JWT authentication middleware",
      null,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Edit", mainAgent1);

    // Subagents for active session 1
    for (let i = 0; i < 3; i++) {
      const subId = uuidv4();
      const status = randomItem(["working", "working", "connected"]);
      stmts.insertAgent.run(
        subId,
        activeSessionId,
        AGENT_NAMES[i + 1],
        "subagent",
        SUBAGENT_TYPES[i + 1],
        status,
        TASKS[i],
        mainAgent1,
        null
      );
      if (status === "working") {
        db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run(
          randomItem(TOOL_NAMES),
          subId
        );
      }
    }

    // Main agent for active session 2
    const mainAgent2 = `${activeSessionId2}-main`;
    stmts.insertAgent.run(
      mainAgent2,
      activeSessionId2,
      "Main Agent",
      "main",
      null,
      "connected",
      "Investigating payment webhook failures",
      null,
      null
    );

    // A working subagent for session 2
    const sub2 = uuidv4();
    stmts.insertAgent.run(
      sub2,
      activeSessionId2,
      "Debugger",
      "subagent",
      "debugger",
      "working",
      "Tracing webhook request flow",
      mainAgent2,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Grep", sub2);

    // Completed agents for other sessions
    for (const sid of sessions.slice(2)) {
      const mainId = `${sid}-main`;
      stmts.insertAgent.run(mainId, sid, "Main Agent", "main", null, "completed", null, null, null);
      db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(
        minutesAgo(Math.floor(Math.random() * 60)),
        mainId
      );

      // Random subagents
      const subCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < subCount; i++) {
        const subId = uuidv4();
        const name = randomItem(AGENT_NAMES.slice(1));
        stmts.insertAgent.run(
          subId,
          sid,
          name,
          "subagent",
          randomItem(SUBAGENT_TYPES.slice(1)),
          sid === sessions[sessions.length - 1] ? "error" : "completed",
          randomItem(TASKS),
          mainId,
          null
        );
        db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(
          minutesAgo(Math.floor(Math.random() * 60)),
          subId
        );
      }
    }

    // ── Deeply nested agents session (agents spawning agents) ──────────────
    const nestedSessionId = uuidv4();
    stmts.insertSession.run(
      nestedSessionId,
      "Deep Nesting: Multi-Agent Research Pipeline",
      "active",
      "/home/dev/research-pipeline",
      "claude-opus-4-6",
      null
    );
    sessions.push(nestedSessionId);

    const nestedMain = `${nestedSessionId}-main`;
    stmts.insertAgent.run(
      nestedMain,
      nestedSessionId,
      "Main Agent",
      "main",
      null,
      "idle",
      "Orchestrating multi-agent research pipeline",
      null,
      null
    );

    // Depth 1: Main → L1-Explorer (working)
    const l1Explorer = uuidv4();
    stmts.insertAgent.run(
      l1Explorer,
      nestedSessionId,
      "Codebase Explorer",
      "subagent",
      "Explore",
      "working",
      "Mapping authentication module dependencies",
      nestedMain,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Glob", l1Explorer);

    // Depth 2: L1-Explorer → L2-Researcher (working)
    const l2Researcher = uuidv4();
    stmts.insertAgent.run(
      l2Researcher,
      nestedSessionId,
      "Security Researcher",
      "subagent",
      "general-purpose",
      "working",
      "Analyzing OAuth2 token validation patterns",
      l1Explorer,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("WebSearch", l2Researcher);

    // Depth 3: L2-Researcher → L3-TestWriter (working)
    const l3TestWriter = uuidv4();
    stmts.insertAgent.run(
      l3TestWriter,
      nestedSessionId,
      "Test Engineer",
      "subagent",
      "test-engineer",
      "working",
      "Writing integration tests for token refresh flow",
      l2Researcher,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Write", l3TestWriter);

    // Depth 4: L3-TestWriter → L4-Debugger (working — deepest)
    const l4Debugger = uuidv4();
    stmts.insertAgent.run(
      l4Debugger,
      nestedSessionId,
      "Test Debugger",
      "subagent",
      "debugger",
      "working",
      "Investigating flaky assertion in token expiry test",
      l3TestWriter,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Bash", l4Debugger);

    // Depth 2 (branch): L1-Explorer → L2-CodeReviewer (completed — sibling of L2-Researcher)
    const l2Reviewer = uuidv4();
    stmts.insertAgent.run(
      l2Reviewer,
      nestedSessionId,
      "Code Reviewer",
      "subagent",
      "code-reviewer",
      "completed",
      "Reviewed middleware chain for injection risks",
      l1Explorer,
      null
    );
    db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(minutesAgo(5), l2Reviewer);

    // Depth 1 (sibling): Main → L1-Architect (completed)
    const l1Architect = uuidv4();
    stmts.insertAgent.run(
      l1Architect,
      nestedSessionId,
      "Architecture Planner",
      "subagent",
      "Plan",
      "completed",
      "Designed auth service boundary and API contracts",
      nestedMain,
      null
    );
    db.prepare("UPDATE agents SET ended_at = ? WHERE id = ?").run(minutesAgo(12), l1Architect);

    // Depth 1 (sibling): Main → L1-DocWriter (working)
    const l1DocWriter = uuidv4();
    stmts.insertAgent.run(
      l1DocWriter,
      nestedSessionId,
      "Documentation Writer",
      "subagent",
      "doc-writer",
      "working",
      "Writing API docs for /auth/* endpoints",
      nestedMain,
      null
    );
    db.prepare("UPDATE agents SET current_tool = ? WHERE id = ?").run("Edit", l1DocWriter);

    // Depth 2: L1-DocWriter → L2-ExampleGen (connected)
    const l2ExampleGen = uuidv4();
    stmts.insertAgent.run(
      l2ExampleGen,
      nestedSessionId,
      "Example Generator",
      "subagent",
      "general-purpose",
      "connected",
      "Generating cURL examples for auth endpoints",
      l1DocWriter,
      null
    );

    console.log(`  → Nested session: ${nestedSessionId} (depth 4, 9 agents, 2 branches)`);

    // Create events
    for (const sid of sessions) {
      const eventCount = Math.floor(Math.random() * 15) + 5;
      const agents = stmts.listAgentsBySession.all(sid);
      for (let i = 0; i < eventCount; i++) {
        const agent = randomItem(agents);
        const eventType = randomItem([
          "PreToolUse",
          "PostToolUse",
          "PreToolUse",
          "PostToolUse",
          "Notification",
        ]);
        const tool = randomItem(TOOL_NAMES);
        const summary =
          eventType === "PreToolUse"
            ? `Using tool: ${tool}`
            : eventType === "PostToolUse"
              ? `Tool completed: ${tool}`
              : `Agent ${agent?.name || "unknown"} notification`;

        stmts.insertEvent.run(
          sid,
          agent?.id ?? null,
          eventType,
          eventType.includes("Tool") ? tool : null,
          summary,
          JSON.stringify({ tool_name: tool })
        );
      }

      // Add Stop event for completed/error sessions
      const session = stmts.getSession.get(sid);
      if (session && session.status !== "active") {
        stmts.insertEvent.run(
          sid,
          null,
          "Stop",
          null,
          `Session ended: ${session.status}`,
          JSON.stringify({ stop_reason: session.status })
        );
      }
    }
  });

  insertAll();

  const stats = stmts.stats.get();
  console.log(`Created ${stats.total_sessions} sessions`);
  console.log(`Created ${stats.total_agents} agents`);
  console.log(`Created ${stats.total_events} events`);
  console.log("\nDatabase seeded successfully.");
}

seed();
