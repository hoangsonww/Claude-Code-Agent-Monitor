const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");

let server, port;
before(async () => {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  process.env.ORCHESTRATOR_ENABLED = "1";
  const wsPath = require.resolve("../websocket");
  delete require.cache[wsPath];
  require.cache[wsPath] = { id: wsPath, filename: wsPath, loaded: true, exports: { broadcast: () => {}, initWebSocket: () => {}, getConnectionCount: () => 0 } };

  const spawnerPath = require.resolve("../lib/spawner");
  delete require.cache[spawnerPath];
  const sp = require("../lib/spawner");
  sp.listAgents = () => [
    { id: "h1", pid: 1, status: "running", startedAt: Date.now(), cwd: "/", profile: null, perLaunch: { resumeSessionId: "s-historical" } },
  ];

  delete require.cache[require.resolve("../db")];
  const { db } = require("../db");
  // Use the columns the test verifies. The sessions table created by db.js has more,
  // but only id and status are required for this minimal fixture.
  db.prepare("INSERT INTO sessions (id, status) VALUES (?, ?)").run("s-historical", "completed");

  delete require.cache[require.resolve("../routes/sessions")];
  const app = express();
  app.use(express.json());
  app.use("/api/sessions", require("../routes/sessions"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => server.close());

describe("session detail surfaces liveHandle", () => {
  it("returns liveHandle when an orchestrator agent is attached", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/sessions/s-historical`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.liveHandle, JSON.stringify(body));
    assert.equal(body.liveHandle.id, "h1");
    assert.equal(body.liveHandle.status, "running");
  });
});
