/**
 * @file cc-config.test.js
 * @description Tests for /api/cc-config — Claude Code configuration explorer.
 * Builds a fake CLAUDE_HOME and project .claude/ in tmpdir, points the
 * server at it, and exercises every surface plus path-containment guards,
 * write/delete with backup, plugin contributions, marketplaces, keybindings,
 * statusline, and hook scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");

// Build the fixture FIRST, set CLAUDE_HOME, then require the server. Order
// matters: claude-home.js caches the env var on first require.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cc-config-test-"));
const FAKE_HOME = path.join(TMP, "home", ".claude");
const FAKE_PROJECT = path.join(TMP, "project");
const FAKE_PROJECT_CLAUDE = path.join(FAKE_PROJECT, ".claude");

fs.mkdirSync(path.join(FAKE_HOME, "skills", "demo-skill"), { recursive: true });
fs.mkdirSync(path.join(FAKE_HOME, "agents"), { recursive: true });
fs.mkdirSync(path.join(FAKE_HOME, "commands"), { recursive: true });
fs.mkdirSync(path.join(FAKE_HOME, "plugins"), { recursive: true });
fs.mkdirSync(path.join(FAKE_PROJECT_CLAUDE, "skills", "proj-skill"), { recursive: true });
fs.mkdirSync(path.join(FAKE_PROJECT_CLAUDE, "agents"), { recursive: true });

fs.writeFileSync(
  path.join(FAKE_HOME, "skills", "demo-skill", "SKILL.md"),
  `---\nname: demo-skill\ndescription: A demo skill for tests\n---\n\nBody text here.`
);
fs.writeFileSync(
  path.join(FAKE_HOME, "agents", "demo-agent.md"),
  `---\nname: demo-agent\ntools: Read, Bash\nmodel: sonnet\n---\n\nAgent body.`
);
fs.writeFileSync(
  path.join(FAKE_HOME, "commands", "deploy.md"),
  `---\ndescription: ship it\n---\n\nDeploy command body.`
);
fs.writeFileSync(
  path.join(FAKE_PROJECT_CLAUDE, "skills", "proj-skill", "SKILL.md"),
  `---\nname: proj-skill\n---\n\nProject skill.`
);
fs.writeFileSync(
  path.join(FAKE_PROJECT_CLAUDE, "agents", "proj-agent.md"),
  `---\nname: proj-agent\n---\n\nProject agent.`
);
fs.writeFileSync(
  path.join(FAKE_PROJECT_CLAUDE, "settings.local.json"),
  JSON.stringify({
    permissions: { allow: ["Bash(npm:*)"] },
    hooks: {
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: "echo hi" }] }],
    },
  })
);
fs.writeFileSync(
  path.join(FAKE_HOME, "settings.json"),
  JSON.stringify({
    model: "opus",
    apiKeyHelper: "should-be-redacted",
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "node x.js" }] }],
    },
  })
);
// Build a minimal plugin install tree so contributions counter has something to count
const PLUGIN_INSTALL = path.join(FAKE_HOME, "plugins", "cache", "market", "demo-plugin", "1.0.0");
fs.mkdirSync(path.join(PLUGIN_INSTALL, ".claude-plugin"), { recursive: true });
fs.mkdirSync(path.join(PLUGIN_INSTALL, "skills", "plugin-skill"), { recursive: true });
fs.writeFileSync(
  path.join(PLUGIN_INSTALL, "skills", "plugin-skill", "SKILL.md"),
  "---\nname: x\n---\nbody"
);
fs.mkdirSync(path.join(PLUGIN_INSTALL, "agents"), { recursive: true });
fs.writeFileSync(path.join(PLUGIN_INSTALL, "agents", "plug-agent.md"), "---\nname: pa\n---\n");
fs.writeFileSync(
  path.join(PLUGIN_INSTALL, ".claude-plugin", "plugin.json"),
  JSON.stringify({ name: "demo-plugin", description: "Demo", version: "1.0.0" })
);

fs.writeFileSync(
  path.join(FAKE_HOME, "plugins", "installed_plugins.json"),
  JSON.stringify({
    version: 2,
    plugins: {
      "demo-plugin@market": [
        {
          scope: "user",
          installPath: PLUGIN_INSTALL,
          version: "1.0.0",
          installedAt: "2026-01-01T00:00:00Z",
        },
      ],
    },
  })
);

// Marketplace fixture
const MARKETPLACE_DIR = path.join(FAKE_HOME, "plugins", "marketplaces", "demo-mp");
fs.mkdirSync(path.join(MARKETPLACE_DIR, ".claude-plugin"), { recursive: true });
fs.writeFileSync(
  path.join(MARKETPLACE_DIR, ".claude-plugin", "marketplace.json"),
  JSON.stringify({
    name: "demo-mp",
    description: "Demo marketplace",
    owner: { name: "demo" },
    plugins: [{ name: "p1" }, { name: "p2" }, { name: "p3" }],
  })
);
fs.writeFileSync(
  path.join(FAKE_HOME, "plugins", "known_marketplaces.json"),
  JSON.stringify({
    "demo-mp": {
      source: { source: "github", repo: "demo/demo" },
      installLocation: MARKETPLACE_DIR,
      lastUpdated: "2026-01-15T00:00:00Z",
    },
  })
);

// Keybindings fixture
fs.writeFileSync(
  path.join(FAKE_HOME, "keybindings.json"),
  JSON.stringify({
    $schema: "https://www.schemastore.org/x.json",
    bindings: [
      { context: "Global", bindings: { "ctrl+t": "toggleTodos" } },
      { context: "Chat", bindings: { escape: "cancel", "ctrl+f": "killAgents" } },
    ],
  })
);

// Statusline scripts
fs.writeFileSync(path.join(FAKE_HOME, "statusline.py"), "# fake statusline\nprint('ok')\n");
fs.writeFileSync(path.join(FAKE_HOME, "statusline-command.sh"), "#!/bin/sh\necho ok\n");

// Hook scripts dir
fs.mkdirSync(path.join(FAKE_HOME, "hooks"), { recursive: true });
fs.writeFileSync(path.join(FAKE_HOME, "hooks", "logger.py"), "# fake logger\n");
fs.writeFileSync(path.join(FAKE_HOME, "hooks", "scanner.py"), "# fake scanner\n");

// Mark a plugin as enabled in user settings
fs.writeFileSync(
  path.join(FAKE_HOME, "settings.json"),
  JSON.stringify({
    model: "opus",
    apiKeyHelper: "should-be-redacted",
    statusLine: { type: "command", command: "sh /tmp/fake-status.sh" },
    enabledPlugins: { "demo-plugin@market": true },
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "node x.js" }] }],
    },
  })
);

fs.writeFileSync(path.join(FAKE_PROJECT, "CLAUDE.md"), "# Project memory\nHello.");

process.env.CLAUDE_HOME = FAKE_HOME;
const TEST_DB = path.join(TMP, "dashboard-test.db");
process.env.DASHBOARD_DB_PATH = TEST_DB;

const { createApp } = require("../index");

let server;
let BASE;

function fetchJson(p, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, BASE);
    const headers = { ...(opts.headers || {}) };
    let bodyBuf;
    if (opts.body !== undefined) {
      bodyBuf = Buffer.from(JSON.stringify(opts.body));
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = bodyBuf.length;
    }
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: opts.method || "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = JSON.parse(body);
          } catch {
            json = body;
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

describe("/api/cc-config", () => {
  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    BASE = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    // On Windows rmSync can hit EPERM when a handle under TMP (fixture files /
    // the OS releasing directory handles) is still held. maxRetries covers
    // transient locks; the try/catch makes the rest best-effort — a leftover
    // temp dir must not fail the suite (the OS reclaims os.tmpdir()).
    try {
      fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      /* best-effort temp cleanup */
    }
  });

  it("overview reports counts and roots", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/overview?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    assert.equal(status, 200);
    assert.equal(body.roots.claudeHome, FAKE_HOME);
    assert.equal(body.roots.projectClaudeDir, FAKE_PROJECT_CLAUDE);
    assert.equal(body.counts.skills.user, 1);
    assert.equal(body.counts.skills.project, 1);
    assert.equal(body.counts.agents.user, 1);
    assert.equal(body.counts.commands.user, 1);
    assert.equal(body.counts.plugins, 1);
    assert.equal(body.counts.memory, 1);
  });

  it("skills returns user + project items with parsed frontmatter", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/skills?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
    const demo = body.items.find((s) => s.name === "demo-skill");
    assert.equal(demo.scope, "user");
    assert.equal(demo.frontmatter.name, "demo-skill");
    assert.match(demo.preview, /Body text here/);
    const proj = body.items.find((s) => s.name === "proj-skill");
    assert.equal(proj.scope, "project");
  });

  it("scope=user filters out project items", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/skills?scope=user&cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    assert.ok(body.items.every((s) => s.scope === "user"));
  });

  it("agents parses tools/model frontmatter", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/agents?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    const a = body.items.find((x) => x.name === "demo-agent");
    assert.equal(a.frontmatter.model, "sonnet");
    assert.match(a.frontmatter.tools, /Read/);
  });

  it("plugins returns installed manifest with contributions and enabled state", async () => {
    const { body } = await fetchJson("/api/cc-config/plugins");
    assert.equal(body.manifestExists, true);
    assert.equal(body.plugins.length, 1);
    const p = body.plugins[0];
    assert.equal(p.name, "demo-plugin");
    assert.equal(p.marketplace, "market");
    assert.equal(p.version, "1.0.0");
    assert.equal(p.enabled, true);
    assert.ok(p.contributes, "contributions surfaced");
    assert.equal(p.contributes.skills, 1);
    assert.equal(p.contributes.agents, 1);
    assert.equal(p.contributes.commands, 0);
    assert.equal(p.contributes.pluginJson.name, "demo-plugin");
  });

  it("marketplaces returns known marketplaces with plugin counts", async () => {
    const { status, body } = await fetchJson("/api/cc-config/marketplaces");
    assert.equal(status, 200);
    assert.equal(body.knownExists, true);
    assert.equal(body.items.length, 1);
    const m = body.items[0];
    assert.equal(m.name, "demo-mp");
    assert.equal(m.pluginCount, 3);
    assert.equal(m.marketplaceName, "demo-mp");
    assert.equal(m.marketplaceOwner.name, "demo");
  });

  it("keybindings returns parsed groups", async () => {
    const { body } = await fetchJson("/api/cc-config/keybindings");
    assert.equal(body.exists, true);
    assert.equal(body.groups.length, 2);
    const chat = body.groups.find((g) => g.context === "Chat");
    assert.ok(chat);
    assert.equal(chat.bindings.length, 2);
    const escapeBinding = chat.bindings.find((b) => b.key === "escape");
    assert.equal(escapeBinding.action, "cancel");
  });

  it("statusline returns config + script content", async () => {
    const { body } = await fetchJson("/api/cc-config/statusline");
    assert.ok(body.config);
    assert.equal(body.config.type, "command");
    assert.equal(body.scripts.length, 2);
    assert.match(body.scripts[0].preview, /fake statusline|fake/);
  });

  it("hook-scripts lists files inside ~/.claude/hooks/", async () => {
    const { body } = await fetchJson("/api/cc-config/hook-scripts");
    const names = body.items.map((i) => i.name).sort();
    assert.deepEqual(names, ["logger.py", "scanner.py"]);
  });

  it("overview includes the new counters", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/overview?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    assert.equal(body.counts.marketplaces, 1);
    assert.equal(body.counts.keybindings, 3);
    assert.equal(body.counts.pluginsEnabled, 1);
    assert.equal(body.counts.pluginsDisabled, 0);
  });

  it("hooks aggregates across user + project + project-local", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/hooks?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    const userSrc = body.items.find((x) => x.scope === "user");
    assert.equal(userSrc.exists, true);
    assert.equal(userSrc.hooks.PreToolUse.length, 1);
    const local = body.items.find((x) => x.scope === "project-local");
    assert.equal(local.exists, true);
    assert.equal(local.hooks.Stop.length, 1);
  });

  it("settings redacts secret-like keys", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/settings?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    const userSettings = body.items.find((x) => x.scope === "user");
    assert.equal(userSettings.exists, true);
    assert.equal(userSettings.data.apiKeyHelper, "<redacted>");
    assert.equal(userSettings.data.model, "opus");
  });

  it("memory returns project CLAUDE.md", async () => {
    const { body } = await fetchJson(
      `/api/cc-config/memory?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    const proj = body.items.find((x) => x.scope === "project");
    assert.ok(proj);
    assert.match(proj.preview, /Project memory/);
  });

  it("file endpoint reads inside CLAUDE_HOME", async () => {
    const target = path.join(FAKE_HOME, "agents", "demo-agent.md");
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}&path=${encodeURIComponent(target)}`
    );
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.match(body.text, /Agent body/);
  });

  it("file endpoint blocks paths outside allowed roots", async () => {
    const outside = path.join(TMP, "evil.md");
    fs.writeFileSync(outside, "secret");
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}&path=${encodeURIComponent(outside)}`
    );
    assert.equal(status, 400);
    assert.equal(body.error.code, "READ_DENIED");
  });

  it("file endpoint blocks .. traversal", async () => {
    const tricky = path.join(FAKE_HOME, "..", "..", "etc", "passwd");
    const { status } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}&path=${encodeURIComponent(tricky)}`
    );
    assert.equal(status, 400);
  });

  it("file endpoint requires a path", async () => {
    const { status, body } = await fetchJson("/api/cc-config/file");
    assert.equal(status, 400);
    assert.equal(body.error.code, "BAD_PATH");
  });

  // ── Phase 2: write/delete ─────────────────────────────────────────

  it("PUT /file creates a new agent (no backup, file did not exist)", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: {
          scope: "user",
          type: "agents",
          name: "fresh-agent",
          content: `---\nname: fresh-agent\n---\n\nFresh body.`,
        },
      }
    );
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.created, true);
    assert.equal(body.backupPath, null);
    assert.equal(fs.readFileSync(body.file, "utf8").includes("Fresh body"), true);
  });

  it("PUT /file overwrites an existing agent and creates a backup", async () => {
    const before = fs.readFileSync(path.join(FAKE_HOME, "agents", "demo-agent.md"), "utf8");
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: {
          scope: "user",
          type: "agents",
          name: "demo-agent",
          content: `---\nname: demo-agent\n---\n\nUpdated body.`,
        },
      }
    );
    assert.equal(status, 200);
    assert.equal(body.created, false);
    assert.ok(body.backupPath, "backup path returned");
    assert.equal(fs.readFileSync(body.backupPath, "utf8"), before);
    assert.match(fs.readFileSync(body.file, "utf8"), /Updated body/);
  });

  it("PUT /file creates a new skill dir with SKILL.md", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: {
          scope: "user",
          type: "skills",
          name: "brand-new-skill",
          content: `---\nname: brand-new-skill\n---\n\nHello.`,
        },
      }
    );
    assert.equal(status, 200);
    assert.equal(body.created, true);
    assert.ok(fs.existsSync(body.file));
    assert.equal(path.basename(body.file), "SKILL.md");
  });

  it("PUT /file rejects malicious names (traversal)", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: {
          scope: "user",
          type: "agents",
          name: "../../etc/passwd",
          content: "evil",
        },
      }
    );
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADNAME");
  });

  it("PUT /file rejects unknown type", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: { scope: "user", type: "plugins", name: "x", content: "y" },
      }
    );
    assert.equal(status, 400);
    assert.equal(body.error.code, "EBADTYPE");
  });

  it("PUT /file rejects oversize content", async () => {
    const huge = "x".repeat(256 * 1024 + 1);
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: { scope: "user", type: "agents", name: "huge", content: huge },
      }
    );
    assert.equal(status, 413);
    assert.equal(body.error.code, "ETOOLARGE");
  });

  it("PUT /file edits memory CLAUDE.md without a name", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "PUT",
        body: { scope: "project", type: "memory", content: "# new project memory" },
      }
    );
    assert.equal(status, 200);
    assert.ok(body.backupPath, "previous CLAUDE.md should be backed up");
    assert.equal(fs.readFileSync(body.file, "utf8"), "# new project memory");
  });

  it("DELETE /file backs up and removes a single-file agent", async () => {
    fs.writeFileSync(path.join(FAKE_HOME, "agents", "to-delete.md"), "bye");
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "DELETE",
        body: { scope: "user", type: "agents", name: "to-delete" },
      }
    );
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.backupPath);
    assert.equal(fs.existsSync(path.join(FAKE_HOME, "agents", "to-delete.md")), false);
    assert.equal(fs.readFileSync(body.backupPath, "utf8"), "bye");
  });

  it("DELETE /file backs up and removes a skill dir (preserves bundled assets in backup)", async () => {
    const skillDir = path.join(FAKE_HOME, "skills", "with-assets");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: with-assets\n---\nbody");
    fs.writeFileSync(path.join(skillDir, "asset.txt"), "important payload");
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "DELETE",
        body: { scope: "user", type: "skills", name: "with-assets" },
      }
    );
    assert.equal(status, 200);
    assert.ok(body.backupPath);
    assert.equal(fs.existsSync(skillDir), false);
    assert.equal(
      fs.readFileSync(path.join(body.backupPath, "asset.txt"), "utf8"),
      "important payload"
    );
  });

  it("DELETE /file 404s on a missing item", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`,
      {
        method: "DELETE",
        body: { scope: "user", type: "agents", name: "never-existed" },
      }
    );
    assert.equal(status, 404);
    assert.equal(body.error.code, "ENOTFOUND");
  });

  it("backups endpoint lists everything we just created", async () => {
    const { status, body } = await fetchJson(
      `/api/cc-config/backups?cwd=${encodeURIComponent(FAKE_PROJECT)}`
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
    // We should have at least: demo-agent overwrite + memory overwrite +
    // to-delete + with-assets dir.
    assert.ok(body.items.length >= 4, `expected ≥4 backups, got ${body.items.length}`);
    assert.ok(body.items.every((b) => typeof b.backupPath === "string"));
  });

  it("write is atomic: tmp file is gone after success", async () => {
    await fetchJson(`/api/cc-config/file?cwd=${encodeURIComponent(FAKE_PROJECT)}`, {
      method: "PUT",
      body: {
        scope: "user",
        type: "commands",
        name: "atomic-test",
        content: "---\ndescription: atomic\n---\nbody",
      },
    });
    const cmdsDir = path.join(FAKE_HOME, "commands");
    const stragglers = fs
      .readdirSync(cmdsDir)
      .filter((n) => n.startsWith(".atomic-test.md.") && n.endsWith(".tmp"));
    assert.deepEqual(stragglers, []);
  });
});
