/**
 * @file Tests for the read-only channels viewer routes. Covers the
 * disabled-by-default gate, normalization of array vs object channel blobs,
 * empty/missing config files, and graceful handling of malformed JSON.
 *
 * We point CLAUDE_HOME and CLAUDE_JSON at tmp paths we populate ourselves so
 * the tests don't depend on the developer's actual ~/.claude state.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const express = require("express");

async function withApp(envOverrides, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Reload route module so it observes the new env (the ENABLED flag is
  // captured at require-time).
  delete require.cache[require.resolve("../routes/channels")];
  const router = require("../routes/channels");
  const app = express();
  app.use("/api/channels", router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function makeFixtureHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "channels-test-"));
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  return home;
}

describe("channels routes", () => {
  describe("when ORCHESTRATOR_ENABLED is unset", () => {
    it("returns 404 for every endpoint", async () => {
      const home = makeFixtureHome();
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: undefined,
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            for (const p of ["/api/channels", "/api/channels/raw"]) {
              const res = await fetch(base + p);
              assert.strictEqual(res.status, 404, `expected 404 for ${p}`);
              const body = await res.json();
              assert.strictEqual(body.error, "channels routes disabled");
            }
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe("when enabled with no config files present", () => {
    it("returns an empty channels array on /", async () => {
      const home = makeFixtureHome();
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.deepStrictEqual(body.channels, []);
            assert.strictEqual(body.summary.total, 0);
            assert.deepStrictEqual(body.summary.byScope, { user: 0, project: 0 });
            assert.deepStrictEqual(body.summary.byType, {});
            assert.deepStrictEqual(body.errors, []);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });

    it("returns nulls on /raw when nothing is configured", async () => {
      const home = makeFixtureHome();
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels/raw`);
            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.strictEqual(body.settingsChannels, null);
            assert.strictEqual(body.projectChannels, null);
            assert.ok(typeof body.cwd === "string");
            assert.deepStrictEqual(body.errors, []);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe("when settings.json has channels (object map form)", () => {
    it("normalizes to array entries scoped 'user'", async () => {
      const home = makeFixtureHome();
      const settings = {
        channels: {
          mySlack: { type: "slack", webhook: "https://hooks.slack.com/x" },
          phone: { type: "imessage", to: "+15551234567" },
        },
      };
      fs.writeFileSync(
        path.join(home, ".claude", "settings.json"),
        JSON.stringify(settings)
      );
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            const body = await res.json();
            assert.strictEqual(body.summary.total, 2);
            assert.strictEqual(body.summary.byScope.user, 2);
            assert.strictEqual(body.summary.byScope.project, 0);
            assert.strictEqual(body.summary.byType.slack, 1);
            assert.strictEqual(body.summary.byType.imessage, 1);
            const names = body.channels.map((c) => c.name).sort();
            assert.deepStrictEqual(names, ["mySlack", "phone"]);
            for (const c of body.channels) {
              assert.strictEqual(c.scope, "user");
            }
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe("when settings.json has channels (array form)", () => {
    it("normalizes to array entries scoped 'user'", async () => {
      const home = makeFixtureHome();
      const settings = {
        channels: [
          { name: "discord-1", type: "discord", webhook: "https://discord/x" },
          { name: "tg", type: "telegram", chatId: "-100123" },
        ],
      };
      fs.writeFileSync(
        path.join(home, ".claude", "settings.json"),
        JSON.stringify(settings)
      );
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            const body = await res.json();
            assert.strictEqual(body.summary.total, 2);
            assert.strictEqual(body.summary.byScope.user, 2);
            assert.strictEqual(body.summary.byType.discord, 1);
            assert.strictEqual(body.summary.byType.telegram, 1);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe("when ~/.claude.json projects map has channels for cwd", () => {
    it("merges project-scoped channels with user-scoped", async () => {
      const home = makeFixtureHome();
      const cwd = process.cwd();
      fs.writeFileSync(
        path.join(home, ".claude", "settings.json"),
        JSON.stringify({ channels: { ops: { type: "slack" } } })
      );
      fs.writeFileSync(
        path.join(home, ".claude.json"),
        JSON.stringify({
          projects: {
            [cwd]: {
              channels: { teamWebhook: { type: "webhook", url: "https://x" } },
            },
            "/some/other/path": {
              channels: { irrelevant: { type: "slack" } },
            },
          },
        })
      );
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            const body = await res.json();
            assert.strictEqual(body.summary.total, 2);
            assert.strictEqual(body.summary.byScope.user, 1);
            assert.strictEqual(body.summary.byScope.project, 1);
            const teamEntry = body.channels.find((c) => c.name === "teamWebhook");
            assert.ok(teamEntry);
            assert.strictEqual(teamEntry.scope, "project");
            assert.strictEqual(teamEntry.type, "webhook");

            // /raw should expose the same shape
            const rawRes = await fetch(`${base}/api/channels/raw`);
            const raw = await rawRes.json();
            assert.ok(raw.settingsChannels);
            assert.ok(raw.projectChannels);
            assert.strictEqual(raw.cwd, cwd);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe("error handling", () => {
    it("reports parse errors without crashing", async () => {
      const home = makeFixtureHome();
      fs.writeFileSync(
        path.join(home, ".claude", "settings.json"),
        "{not valid json"
      );
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.deepStrictEqual(body.channels, []);
            assert.ok(Array.isArray(body.errors));
            assert.strictEqual(body.errors.length, 1);
            assert.strictEqual(body.errors[0].source, "settings.json");
            assert.ok(body.errors[0].error);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });

    it("ignores non-object channel entries in arrays", async () => {
      const home = makeFixtureHome();
      fs.writeFileSync(
        path.join(home, ".claude", "settings.json"),
        JSON.stringify({
          channels: [{ type: "slack" }, "garbage", 42, null],
        })
      );
      try {
        await withApp(
          {
            ORCHESTRATOR_ENABLED: "1",
            CLAUDE_HOME: path.join(home, ".claude"),
            CLAUDE_JSON: path.join(home, ".claude.json"),
          },
          async (base) => {
            const res = await fetch(`${base}/api/channels`);
            const body = await res.json();
            assert.strictEqual(body.summary.total, 1);
          }
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });
});
