// server/__tests__/orchestrator-respawn.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server, port, cwd;
before(async () => {
  process.env.ORCHESTRATOR_ENABLED = "1";
  process.env.DASHBOARD_DB_PATH = ":memory:";

  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = {
    id: wsPath, filename: wsPath, loaded: true,
    exports: { broadcast: () => {}, initWebSocket: () => {}, getConnectionCount: () => 0 },
  };

  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../lib/spawner")];
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "or-resp-"));
  require("../lib/cwds").add(cwd, "manual");

  const sp = require("../lib/spawner");
  let nextId = 0;
  const stubAgents = new Map();
  sp.spawnAgent = ({ profile, perLaunch }) => {
    const id = `stub-${++nextId}`;
    const handle = { id, pid: 100, status: "running", startedAt: Date.now(), cwd: perLaunch.cwd, profile, perLaunch, argv: [] };
    stubAgents.set(id, handle);
    return handle;
  };
  sp.killAgent = (id) => { stubAgents.delete(id); return true; };
  sp.getAgent = (id) => stubAgents.get(id);
  sp.listAgents = () => Array.from(stubAgents.values());
  sp.respawnAgent = async ({ id, profile, perLaunch }) => {
    if (!stubAgents.has(id)) throw Object.assign(new Error("agent not found"), { code: "ENotFound" });
    stubAgents.delete(id);
    const newId = `stub-${++nextId}`;
    const newHandle = { id: newId, pid: 200, status: "running", startedAt: Date.now(), cwd: perLaunch.cwd, profile, perLaunch, argv: [] };
    stubAgents.set(newId, newHandle);
    return newHandle;
  };

  delete require.cache[require.resolve("../routes/orchestrator")];
  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator", require("../routes/orchestrator"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("POST /api/orchestrator/agents/:id/respawn", () => {
  it("respawns and returns the new handle", async () => {
    const spawn = await fetch(`http://127.0.0.1:${port}/api/orchestrator/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi", cwd }),
    });
    const old = await spawn.json();
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/${old.id}/respawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { model: "opus" }, prompt: "next" }),
    });
    assert.equal(res.status, 200);
    const next = await res.json();
    assert.notEqual(next.id, old.id);
  });

  it("404s on unknown agent id", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/agents/nope/respawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: {}, prompt: "x" }),
    });
    assert.equal(res.status, 404);
  });
});
