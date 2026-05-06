// server/__tests__/slash-commands-route.test.js
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
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sc-route-"));
  fs.mkdirSync(path.join(cwd, ".claude", "commands"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".claude", "commands", "deploy.md"),
    "---\ndescription: Deploy\n---",
  );
  delete require.cache[require.resolve("../routes/slash-commands")];
  const app = express();
  app.use("/api/orchestrator/slash-commands", require("../routes/slash-commands"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("slash-commands route", () => {
  it("GET returns grouped catalog", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/slash-commands?cwd=${encodeURIComponent(cwd)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.builtin));
    assert.ok(Array.isArray(body.skills));
    assert.ok(Array.isArray(body.plugins));
    assert.ok(Array.isArray(body.project));
    assert.ok(body.builtin.some((c) => c.name === "help"));
    assert.ok(body.project.some((c) => c.name === "deploy"));
  });

  it("400 when cwd is missing", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/slash-commands`);
    assert.equal(res.status, 400);
  });
});
