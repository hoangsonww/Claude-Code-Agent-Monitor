/**
 * @file Tests for the read-only skills/plugins/agents/marketplaces viewer.
 * Covers the disabled-by-default gate, listing skills across scopes,
 * SKILL.md content read with frontmatter parsing, agents listing, plugins/
 * marketplaces JSON pass-through, and validation/missing-file handling.
 *
 * We point CLAUDE_HOME at a tmp dir we populate ourselves so the tests do not
 * depend on the developer's actual ~/.claude state. Project-scoped skills are
 * read from process.cwd(); we override cwd via process.chdir() inside the
 * test fixtures to keep the project-scoped path under tmp as well.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const express = require("express");

// Test fixtures.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "skills-home-"));
const TMP_CWD = fs.mkdtempSync(path.join(os.tmpdir(), "skills-cwd-"));

// User-scoped skill.
fs.mkdirSync(path.join(TMP_HOME, "skills", "user-skill"), { recursive: true });
fs.writeFileSync(
  path.join(TMP_HOME, "skills", "user-skill", "SKILL.md"),
  "---\nname: user-skill\ndescription: A user-scoped skill\nallowed-tools: Read, Edit\n---\n\n# Body\n\nbody text",
);

// User-scoped skill with no frontmatter — should still list (graceful default).
fs.mkdirSync(path.join(TMP_HOME, "skills", "no-fm"), { recursive: true });
fs.writeFileSync(path.join(TMP_HOME, "skills", "no-fm", "SKILL.md"), "# Just a body\n\nno frontmatter");

// Project-scoped skill.
fs.mkdirSync(path.join(TMP_CWD, ".claude", "skills", "proj-skill"), { recursive: true });
fs.writeFileSync(
  path.join(TMP_CWD, ".claude", "skills", "proj-skill", "SKILL.md"),
  '---\nname: proj-skill\ndescription: "A project-scoped skill"\n---\n\nbody',
);

// Plugin-bundled skill.
fs.mkdirSync(path.join(TMP_HOME, "plugins", "myplugin", "skills", "plug-skill"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(TMP_HOME, "plugins", "myplugin", "skills", "plug-skill", "SKILL.md"),
  "---\nname: plug-skill\ndescription: bundled by plugin\n---\n\nplugin body",
);

// User-scoped agent.
fs.mkdirSync(path.join(TMP_HOME, "agents"), { recursive: true });
fs.writeFileSync(
  path.join(TMP_HOME, "agents", "code-reviewer.md"),
  "---\nname: code-reviewer\ndescription: Reviews code\ntools: Read, Grep\nmodel: opus\n---\n\nbody",
);

// Project-scoped agent.
fs.mkdirSync(path.join(TMP_CWD, ".claude", "agents"), { recursive: true });
fs.writeFileSync(
  path.join(TMP_CWD, ".claude", "agents", "qa.md"),
  "---\nname: qa\ndescription: QA reviewer\n---\n\nbody",
);

// installed_plugins.json (mirrors real Claude Code shape).
fs.writeFileSync(
  path.join(TMP_HOME, "plugins", "installed_plugins.json"),
  JSON.stringify({
    version: 2,
    plugins: {
      "p1@m1": [{ scope: "user", version: "1.0.0" }],
      "p2@m1": [{ scope: "user", version: "0.9.0" }],
    },
  }),
);

// known_marketplaces.json.
fs.writeFileSync(
  path.join(TMP_HOME, "plugins", "known_marketplaces.json"),
  JSON.stringify({
    "m1": { source: { source: "github", repo: "anthropics/x" } },
  }),
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
  // Reload route module so it observes the new env.
  delete require.cache[require.resolve("../routes/skills")];
  const router = require("../routes/skills");
  const app = express();
  app.use("/api/skills", router);
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

describe("skills routes", () => {
  describe("when ORCHESTRATOR_ENABLED is unset", () => {
    it("returns 404 for every endpoint", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: undefined, CLAUDE_HOME: TMP_HOME },
        async (base) => {
          for (const p of [
            "/api/skills",
            "/api/skills/agents",
            "/api/skills/plugins",
            "/api/skills/marketplaces",
            "/api/skills/user/user-skill/file",
          ]) {
            const res = await fetch(base + p);
            assert.strictEqual(res.status, 404, `expected 404 for ${p}`);
            const body = await res.json();
            assert.strictEqual(body.error, "skills routes disabled");
          }
        },
      );
    });
  });

  describe("when enabled", () => {
    it("lists skills across user / project / plugin scopes", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.ok(Array.isArray(body.skills));
          assert.strictEqual(body.count, body.skills.length);
          const ids = body.skills.map((s) => `${s.scope}:${s.id}`).sort();
          assert.ok(ids.includes("user:user-skill"));
          assert.ok(ids.includes("user:no-fm"));
          assert.ok(ids.includes("project:proj-skill"));
          assert.ok(ids.includes("plugin:myplugin:plug-skill"));
          const us = body.skills.find((s) => s.id === "user-skill");
          assert.strictEqual(us.description, "A user-scoped skill");
          assert.strictEqual(us.allowedTools, "Read, Edit");
          // Falls back to dir name when frontmatter is missing.
          const noFm = body.skills.find((s) => s.id === "no-fm");
          assert.strictEqual(noFm.name, "no-fm");
          assert.strictEqual(noFm.description, "");
        },
        { cwd: TMP_CWD },
      );
    });

    it("returns empty list when no scopes have skills", async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "skills-empty-"));
      const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "skills-empty-cwd-"));
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: empty },
        async (base) => {
          const res = await fetch(`${base}/api/skills`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.deepStrictEqual(body.skills, []);
          assert.strictEqual(body.count, 0);
        },
        { cwd: emptyCwd },
      );
    });

    it("reads SKILL.md content with parsed frontmatter", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/user/user-skill/file`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.scope, "user");
          assert.strictEqual(body.name, "user-skill");
          assert.strictEqual(body.frontmatter.name, "user-skill");
          assert.strictEqual(body.frontmatter.description, "A user-scoped skill");
          assert.strictEqual(body.frontmatter["allowed-tools"], "Read, Edit");
          assert.match(body.body, /Body/);
          assert.match(body.raw, /^---/);
        },
      );
    });

    it("reads a plugin-bundled skill via plugin: scope", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/plugin:myplugin/plug-skill/file`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.scope, "plugin:myplugin");
          assert.match(body.raw, /plugin body/);
        },
      );
    });

    it("returns 404 for missing skill", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/user/does-not-exist/file`);
          assert.strictEqual(res.status, 404);
          const body = await res.json();
          assert.strictEqual(body.error, "skill not found");
        },
      );
    });

    it("rejects invalid scope or name", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const r1 = await fetch(`${base}/api/skills/${encodeURIComponent("bad$")}/x/file`);
          assert.strictEqual(r1.status, 400);
          const r2 = await fetch(
            `${base}/api/skills/user/${encodeURIComponent("../../etc/passwd")}/file`,
          );
          // path-to-regexp normalizes the URL — express may surface this as
          // either a 400 (invalid name) or 404 (route mismatch). Either is
          // acceptable; what matters is we never serve outside the skills dir.
          assert.ok(r2.status === 400 || r2.status === 404, `got ${r2.status}`);
        },
      );
    });

    it("rejects unknown scope on file route", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/random/foo/file`);
          assert.strictEqual(res.status, 400);
          const body = await res.json();
          assert.strictEqual(body.error, "unknown scope");
        },
      );
    });

    it("lists agents from user + project scopes", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/agents`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.ok(Array.isArray(body.agents));
          const ids = body.agents.map((a) => `${a.scope}:${a.id}`).sort();
          assert.ok(ids.includes("user:code-reviewer"));
          assert.ok(ids.includes("project:qa"));
          const cr = body.agents.find((a) => a.id === "code-reviewer");
          assert.strictEqual(cr.tools, "Read, Grep");
          assert.strictEqual(cr.model, "opus");
        },
        { cwd: TMP_CWD },
      );
    });

    it("returns plugins registry from installed_plugins.json", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/plugins`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.count, 2);
          assert.strictEqual(body.version, 2);
          assert.ok(body.plugins["p1@m1"]);
          assert.ok(body.plugins["p2@m1"]);
        },
      );
    });

    it("returns empty plugins when installed_plugins.json missing", async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "skills-noplug-"));
      fs.mkdirSync(path.join(empty, "plugins"), { recursive: true });
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: empty },
        async (base) => {
          const res = await fetch(`${base}/api/skills/plugins`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.count, 0);
          assert.deepStrictEqual(body.plugins, {});
        },
      );
    });

    it("returns marketplaces from known_marketplaces.json", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/skills/marketplaces`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.count, 1);
          assert.ok(body.marketplaces["m1"]);
        },
      );
    });

    it("surfaces parse error when installed_plugins.json is corrupt", async () => {
      const corrupt = fs.mkdtempSync(path.join(os.tmpdir(), "skills-bad-"));
      fs.mkdirSync(path.join(corrupt, "plugins"), { recursive: true });
      fs.writeFileSync(path.join(corrupt, "plugins", "installed_plugins.json"), "{not json");
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: corrupt },
        async (base) => {
          const res = await fetch(`${base}/api/skills/plugins`);
          assert.strictEqual(res.status, 500);
          const body = await res.json();
          assert.match(body.error, /failed to parse/);
        },
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
