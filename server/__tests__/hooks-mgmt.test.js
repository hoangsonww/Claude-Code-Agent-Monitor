/**
 * @file Tests for the read-only hooks-management viewer (`routes/hooks-mgmt.js`).
 * Covers the disabled-by-default gate, merged listing across user/project/local
 * scopes, scope-specific reads, the documented event taxonomy endpoint, missing
 * file handling, and graceful behavior on corrupt JSON.
 *
 * We point CLAUDE_HOME at a tmp dir we populate ourselves so the tests do not
 * depend on the developer's actual ~/.claude state. Project/local files are
 * read from process.cwd(); we override cwd via process.chdir() inside the
 * test fixtures to keep those paths under tmp as well.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const express = require("express");

// User-scoped fixture.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-home-"));
fs.writeFileSync(
  path.join(TMP_HOME, "settings.json"),
  JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: "echo pre" }],
        },
      ],
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [
            { type: "command", command: "echo post-bash" },
            { type: "command", command: "echo also-post-bash" },
          ],
        },
      ],
      SessionStart: [
        {
          hooks: [{ type: "command", command: "echo session-start" }],
        },
      ],
    },
  })
);

// Project-scoped fixture (lives under TMP_CWD/.claude/settings.json).
const TMP_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-cwd-"));
fs.mkdirSync(path.join(TMP_CWD, ".claude"), { recursive: true });
fs.writeFileSync(
  path.join(TMP_CWD, ".claude", "settings.json"),
  JSON.stringify({
    hooks: {
      Stop: [
        {
          matcher: "*",
          hooks: [{ type: "command", command: "echo project-stop" }],
        },
      ],
    },
  })
);
fs.writeFileSync(
  path.join(TMP_CWD, ".claude", "settings.local.json"),
  JSON.stringify({
    hooks: {
      Notification: [
        {
          hooks: [{ type: "command", command: "echo local-notify" }],
        },
      ],
      // A custom/unknown event so we exercise the unknown-event branch.
      CustomThing: [
        {
          hooks: [{ type: "command", command: "echo custom" }],
        },
      ],
    },
  })
);

async function withApp(envOverrides, fn, opts = {}) {
  const prev = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const prevCwd = process.cwd();
  if (opts.cwd) process.chdir(opts.cwd);
  // Reload the module so the gate observes ORCHESTRATOR_ENABLED's new value.
  delete require.cache[require.resolve("../routes/hooks-mgmt")];
  const router = require("../routes/hooks-mgmt");
  const app = express();
  app.use("/api/hooks-mgmt", router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    process.chdir(prevCwd);
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("hooks-mgmt routes", () => {
  describe("when ORCHESTRATOR_ENABLED is unset", () => {
    it("returns 404 for every endpoint with a stable error string", async () => {
      await withApp({ ORCHESTRATOR_ENABLED: undefined, CLAUDE_HOME: TMP_HOME }, async (base) => {
        for (const p of [
          "/api/hooks-mgmt/",
          "/api/hooks-mgmt/events",
          "/api/hooks-mgmt/scope/user",
        ]) {
          const res = await fetch(base + p);
          assert.strictEqual(res.status, 404, `expected 404 for ${p}`);
          const body = await res.json();
          assert.strictEqual(body.error, "hooks-mgmt routes disabled");
        }
      });
    });
  });

  describe("when enabled", () => {
    it("merges hooks across user/project/local scopes", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();

          // PreToolUse comes from user; UI should see it under .user.
          assert.ok(body.events.PreToolUse, "PreToolUse missing");
          assert.strictEqual(body.events.PreToolUse.user.length, 1);
          assert.strictEqual(body.events.PreToolUse.project.length, 0);
          assert.strictEqual(body.events.PreToolUse.local.length, 0);
          assert.strictEqual(body.events.PreToolUse.hasAny, true);
          assert.match(body.events.PreToolUse.doc.description, /tool invocation/i);

          // PostToolUse has 2 commands under one matcher entry.
          assert.strictEqual(body.events.PostToolUse.user[0].hooks.length, 2);

          // Stop is project-scoped only.
          assert.strictEqual(body.events.Stop.user.length, 0);
          assert.strictEqual(body.events.Stop.project.length, 1);
          assert.strictEqual(body.events.Stop.local.length, 0);

          // Notification is local-scoped only.
          assert.strictEqual(body.events.Notification.local.length, 1);

          // Custom event is surfaced with the unknown-event doc placeholder.
          assert.ok(body.events.CustomThing, "CustomThing missing");
          assert.strictEqual(body.events.CustomThing.doc.since, "?");

          // Documented events with no hooks are still listed (PreCompact etc).
          assert.ok(body.events.PreCompact, "PreCompact doc missing");
          assert.strictEqual(body.events.PreCompact.hasAny, false);

          // Summary counts.
          assert.strictEqual(typeof body.summary.totalCommands, "number");
          // Sanity: 1 (Pre) + 2 (Post) + 1 (SessionStart) + 1 (Stop) + 1 (Notif) + 1 (Custom) = 7
          assert.strictEqual(body.summary.totalCommands, 7);
          assert.strictEqual(body.summary.totalEventTypesWithHooks, 6);
          assert.strictEqual(body.summary.bySource.user, true);
          assert.strictEqual(body.summary.bySource.project, true);
          assert.strictEqual(body.summary.bySource.local, true);

          // Errors block: all null.
          assert.strictEqual(body.errors.user, null);
          assert.strictEqual(body.errors.project, null);
          assert.strictEqual(body.errors.local, null);
        },
        { cwd: TMP_CWD }
      );
    });

    it("returns empty merged view but full doc taxonomy when nothing configured", async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-empty-"));
      const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-empty-cwd-"));
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: empty },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.summary.totalCommands, 0);
          assert.strictEqual(body.summary.totalEventTypesWithHooks, 0);
          assert.strictEqual(body.summary.bySource.user, false);
          assert.strictEqual(body.summary.bySource.project, false);
          assert.strictEqual(body.summary.bySource.local, false);
          // Documented events should still appear with empty arrays.
          assert.ok(body.events.PreToolUse);
          assert.strictEqual(body.events.PreToolUse.hasAny, false);
        },
        { cwd: emptyCwd }
      );
    });

    it("returns a single scope's hooks via GET /scope/:scope", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/scope/user`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.scope, "user");
          assert.strictEqual(body.exists, true);
          assert.strictEqual(body.error, null);
          assert.ok(body.hooks.PreToolUse);
          assert.ok(body.hooks.PostToolUse);
        },
        { cwd: TMP_CWD }
      );
    });

    it("returns exists:false when a scope's settings file is missing", async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-noscope-"));
      const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-noscope-cwd-"));
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: empty },
        async (base) => {
          for (const scope of ["user", "project", "local"]) {
            const res = await fetch(`${base}/api/hooks-mgmt/scope/${scope}`);
            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.strictEqual(body.exists, false);
            assert.strictEqual(body.hooks, null);
          }
        },
        { cwd: emptyCwd }
      );
    });

    it("rejects unknown scope with 400", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/scope/bogus`);
          assert.strictEqual(res.status, 400);
          const body = await res.json();
          assert.match(body.error, /scope must be/);
        },
        { cwd: TMP_CWD }
      );
    });

    it("returns the documented event taxonomy via GET /events", async () => {
      await withApp({ ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME }, async (base) => {
        const res = await fetch(`${base}/api/hooks-mgmt/events`);
        assert.strictEqual(res.status, 200);
        const body = await res.json();
        assert.ok(body.events.PreToolUse);
        assert.ok(body.events.PostCompact);
        assert.ok(body.events.SessionStart);
        assert.match(body.events.PreToolUse.description, /tool invocation/i);
      });
    });

    it("surfaces parse error in errors block when settings file is corrupt", async () => {
      const bad = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-bad-"));
      const badCwd = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-bad-cwd-"));
      fs.writeFileSync(path.join(bad, "settings.json"), "{not json");
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: bad },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.ok(body.errors.user, "expected user error to be set");
          // bySource.user is false because the file is unparseable.
          assert.strictEqual(body.summary.bySource.user, false);
        },
        { cwd: badCwd }
      );
    });

    it("tolerates a settings file with no hooks block at all", async () => {
      const cleanHome = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-clean-"));
      const cleanCwd = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-mgmt-clean-cwd-"));
      // Settings exists, has other config, no hooks key.
      fs.writeFileSync(
        path.join(cleanHome, "settings.json"),
        JSON.stringify({ permissions: { allow: ["Bash(ls)"] } })
      );
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: cleanHome },
        async (base) => {
          const res = await fetch(`${base}/api/hooks-mgmt/`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.summary.totalCommands, 0);
          assert.strictEqual(body.summary.bySource.user, true); // file exists & parses
        },
        { cwd: cleanCwd }
      );
    });
  });
});

// Cleanup tmp dirs at the end of the file.
process.on("exit", () => {
  try {
    fs.rmSync(TMP_HOME, { recursive: true, force: true });
    fs.rmSync(TMP_CWD, { recursive: true, force: true });
  } catch {
    // best effort
  }
});
