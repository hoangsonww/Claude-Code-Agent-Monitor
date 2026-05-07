/**
 * @file Routes-level tests for /api/routines. Covers the ORCHESTRATOR_ENABLED
 * gate (404) and constant-time webhook token compare.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("routines route gating", () => {
  it("returns 404 when ORCHESTRATOR_ENABLED is unset", async () => {
    delete process.env.ORCHESTRATOR_ENABLED;
    delete require.cache[require.resolve("../routes/routines")];
    const router = require("../routes/routines");

    const express = require("express");
    const http = require("node:http");
    const app = express();
    app.use("/api/routines", router);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/routines`);
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.error, "routines disabled");
    } finally {
      server.close();
    }
  });

  it("webhook returns 401 with wrong token (constant-time compare)", async () => {
    process.env.ORCHESTRATOR_ENABLED = "1";
    process.env.DASHBOARD_DB_PATH = ":memory:";
    // Wipe all the modules that interact with the routes so our stubs win the
    // require race. We need to invalidate spawner + websocket BEFORE inserting
    // our stubs, then invalidate everything that closed over them.
    for (const rel of [
      "../db",
      "../lib/routines",
      "../lib/cwds",
      "../lib/spawner",
      "../lib/routine-scheduler",
      "../websocket",
      "../routes/routines",
    ]) {
      try {
        delete require.cache[require.resolve(rel)];
      } catch {
        /* not yet loaded */
      }
    }
    // Stub the spawner so we don't actually exec `claude`. We mimic the slice
    // of the handle that routine-scheduler reads from (id, child, stdoutBuffer).
    const spawnerPath = require.resolve("../lib/spawner");
    require.cache[spawnerPath] = {
      id: spawnerPath,
      filename: spawnerPath,
      loaded: true,
      exports: {
        spawnAgent: () => ({ id: "stub-handle", child: { on: () => {} }, stdoutBuffer: "" }),
      },
    };
    const websocketPath = require.resolve("../websocket");
    require.cache[websocketPath] = {
      id: websocketPath,
      filename: websocketPath,
      loaded: true,
      exports: { broadcast: () => {} },
    };

    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "routines-route-"));

    const cwds = require("../lib/cwds");
    cwds.add(tmp, "manual");

    const routines = require("../lib/routines");
    const r = routines.create({
      name: "n",
      description: "d",
      instructions: "x",
      cwd: tmp,
      schedule: { type: "manual" },
    });

    const router = require("../routes/routines");
    const express = require("express");
    const http = require("node:http");
    const app = express();
    app.use(express.json());
    app.use("/api/routines", router);
    const server = http.createServer(app);
    await new Promise((res) => server.listen(0, res));
    const port = server.address().port;
    try {
      // Wrong token of equal length must 401 (constant-time path).
      const wrong = "0".repeat(r.webhookToken.length);
      const res1 = await fetch(`http://127.0.0.1:${port}/api/routines/${r.id}/webhook?token=${wrong}`, {
        method: "POST",
      });
      assert.strictEqual(res1.status, 401);
      // Correct token must succeed.
      const res2 = await fetch(`http://127.0.0.1:${port}/api/routines/${r.id}/webhook?token=${r.webhookToken}`, {
        method: "POST",
      });
      assert.strictEqual(res2.status, 200);
      const body = await res2.json();
      assert.ok(body.runId);
    } finally {
      server.close();
      fs.rmSync(tmp, { recursive: true, force: true });
      delete process.env.ORCHESTRATOR_ENABLED;
    }
  });
});
