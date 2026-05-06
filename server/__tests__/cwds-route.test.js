// server/__tests__/cwds-route.test.js
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
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  delete require.cache[require.resolve("../routes/cwds")];
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-route-"));
  const app = express();
  app.use(express.json());
  app.use("/api/orchestrator/cwds", require("../routes/cwds"));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("cwds route", () => {
  it("add + list + delete", async () => {
    let res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: tmp }),
    });
    assert.equal(res.status, 201);

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`);
    const list = await res.json();
    assert.ok(list.find((c) => c.path === tmp));

    res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: tmp }),
    });
    assert.equal(res.status, 204);
  });

  it("400s on a path that does not exist", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/orchestrator/cwds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/no/such/dir/here" }),
    });
    assert.equal(res.status, 400);
  });
});
