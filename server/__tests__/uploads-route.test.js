// server/__tests__/uploads-route.test.js
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
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../routes/uploads")];
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "up-route-"));
  const cwds = require("../lib/cwds");
  cwds.add(cwd, "manual");
  const app = express();
  app.use("/api/orchestrator/uploads", require("../routes/uploads"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(cwd, { recursive: true, force: true });
});

async function postFile({ port, cwd, name, content }) {
  const form = new FormData();
  form.set("cwd", cwd);
  form.set("file", new Blob([content], { type: "text/plain" }), name);
  const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/uploads`, {
    method: "POST",
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("uploads route", () => {
  it("404s when feature flag is off", async () => {
    const off = require("express")();
    delete process.env.ORCHESTRATOR_ENABLED;
    delete require.cache[require.resolve("../routes/uploads")];
    off.use("/api/orchestrator/uploads", require("../routes/uploads"));
    const s = http.createServer(off);
    await new Promise((r) => s.listen(0, r));
    const p = s.address().port;
    const res = await fetch(`http://127.0.0.1:${p}/api/orchestrator/uploads`, { method: "POST" });
    assert.equal(res.status, 404);
    s.close();
    process.env.ORCHESTRATOR_ENABLED = "1";
    delete require.cache[require.resolve("../routes/uploads")];
  });

  it("POST round-trips an uploaded file", async () => {
    const r = await postFile({ port, cwd, name: "a.txt", content: "hello" });
    assert.equal(r.status, 201);
    assert.equal(r.body.name, "a.txt");
    assert.equal(r.body.size, 5);
    assert.equal(r.body.kind, "text");
    assert.match(r.body.path, /^\.\/\.launcher-uploads\/[a-f0-9-]{36}\/a\.txt$/);
  });

  it("POST 400s on unknown cwd", async () => {
    const form = new FormData();
    form.set("cwd", "/nope/here");
    form.set("file", new Blob(["x"]), "x.txt");
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/uploads`, {
      method: "POST",
      body: form,
    });
    assert.equal(res.status, 400);
  });

  it("DELETE removes by id under the named cwd", async () => {
    const r = await postFile({ port, cwd, name: "del.txt", content: "x" });
    const del = await fetch(`http://127.0.0.1:${port}/api/orchestrator/uploads/${r.body.id}?cwd=${encodeURIComponent(cwd)}`, {
      method: "DELETE",
    });
    assert.equal(del.status, 204);
  });
});
