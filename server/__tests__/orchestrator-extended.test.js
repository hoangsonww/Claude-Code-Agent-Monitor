// server/__tests__/orchestrator-extended.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server, port, tmp;
before(async () => {
  process.env.ORCHESTRATOR_ENABLED = "1";
  process.env.DASHBOARD_DB_PATH = ":memory:";
  process.env.ORCHESTRATOR_MAX_CONCURRENT = "5";

  // Stub websocket
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: { broadcast: () => {}, initWebSocket: () => {}, getConnectionCount: () => 0 },
  };

  // Stub spawnAgent so the test does not invoke `claude`
  const spawnerPath = require.resolve("../lib/spawner");
  delete require.cache[spawnerPath];
  const realSpawner = require("../lib/spawner");
  let nextId = 0;
  const stubAgents = new Map();
  realSpawner.spawnAgent = ({ profile, perLaunch }) => {
    const id = `stub-${++nextId}`;
    const handle = { id, pid: 100, status: "running", startedAt: Date.now(), cwd: perLaunch.cwd, profile, perLaunch, argv: ["-p", perLaunch.prompt] };
    stubAgents.set(id, handle);
    return handle;
  };
  realSpawner.sendMessage = (id, text) => {
    if (!stubAgents.has(id)) throw new Error("agent not found");
    return { messageId: `m-${id}-${text.length}` };
  };
  realSpawner.killAgent = (id) => stubAgents.delete(id);
  realSpawner.getAgent = (id) => stubAgents.get(id);
  realSpawner.listAgents = () => Array.from(stubAgents.values());

  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../routes/profiles")];
  delete require.cache[require.resolve("../routes/cwds")];
  delete require.cache[require.resolve("../routes/orchestrator")];

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "orc-route-"));
  const cwds = require("../lib/cwds");
  cwds.add(tmp, "manual");

  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator", require("../routes/orchestrator"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("POST /api/orchestrator/spawn (extended)", () => {
  it("rejects cwd not in allowlist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: "/etc" }),
    });
    assert.equal(res.status, 400);
  });

  it("accepts profileId + cwd in allowlist + prompt", async () => {
    const profileRes = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "p1", config: { model: "sonnet" } }),
    });
    const p = await profileRes.json();
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp, profileId: p.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.id, /^stub-/);
  });

  it("merges configOverride on top of profile config", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp, configOverride: { effort: "max" } }),
    });
    assert.equal(res.status, 200);
  });
});

describe("POST /agents/:id/message", () => {
  it("writes a message and returns messageId", async () => {
    const spawn = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd: tmp }),
    });
    const handle = await spawn.json();
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/${handle.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "follow-up" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.messageId);
  });

  it("404s on unknown agent id", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/nope/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi" }),
    });
    assert.equal(res.status, 404);
  });
});
