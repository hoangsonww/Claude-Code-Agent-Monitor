// server/__tests__/profiles-route.test.js
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");

let server, port;
function startApp(env = {}) {
  Object.assign(process.env, env);
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  delete require.cache[require.resolve("../routes/profiles")];
  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator/profiles", require("../routes/profiles"));
  return app;
}

describe("profiles route", () => {
  before(async () => {
    process.env.ORCHESTRATOR_ENABLED = "1";
    server = http.createServer(startApp());
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;
  });
  after(() => server.close());

  it("404s when feature flag is off", async () => {
    const off = http.createServer(startApp({ ORCHESTRATOR_ENABLED: "" }));
    await new Promise((r) => off.listen(0, r));
    const p = off.address().port;
    const res = await fetch(`http://127.0.0.1:${p}/api/orchestrator/profiles`);
    assert.equal(res.status, 404);
    off.close();
  });

  it("create + list + get + update + delete round-trip", async () => {
    let res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "p1", config: { model: "sonnet" } }),
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, "p1");

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`);
    assert.equal((await res.json()).length, 1);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`);
    assert.equal((await res.json()).id, created.id);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { effort: "high" } }),
    });
    const updated = await res.json();
    assert.equal(updated.config.effort, "high");

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles/${created.id}`, { method: "DELETE" });
    assert.equal(res.status, 204);
  });

  it("400s on invalid config", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bad", config: { unknownKey: 1 } }),
    });
    assert.equal(res.status, 400);
  });
});
