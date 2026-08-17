/**
 * @file Tests for Codex configuration discovery and its narrow, backup-backed
 * editor allowlist. Fixtures prove that oversized model catalogs are reduced
 * safely, profiles follow Codex's overlay rules, plugins are resolved as real
 * manifests, previews redact secrets, and only intended local text files are
 * mutable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "codex-config-discovery-"));
const previousHome = process.env.DASHBOARD_CODEX_HOME;
const previousDisablePluginCli = process.env.DASHBOARD_DISABLE_CODEX_PLUGIN_CLI;
process.env.DASHBOARD_CODEX_HOME = HOME;
process.env.DASHBOARD_DISABLE_CODEX_PLUGIN_CLI = "1";

fs.writeFileSync(
  path.join(HOME, "config.toml"),
  [
    'model = "gpt-5.6-terra"',
    'model_reasoning_effort = "high"',
    "[mcp_servers.example]",
    'command = "npx"',
    'api_key = "super-secret"',
    '[projects."/tmp/project"]',
    'trust_level = "trusted"',
    '[plugins."demo-plugin@demo-market"]',
    "enabled = true",
  ].join("\n")
);
fs.writeFileSync(
  path.join(HOME, "models_cache.json"),
  JSON.stringify({
    fetched_at: "2026-08-01T00:00:00.000Z",
    models: [
      {
        slug: "gpt-5.6-terra",
        display_name: "GPT-5.6 Terra",
        supported_reasoning_levels: [{ effort: "high" }],
      },
    ],
  })
);
fs.writeFileSync(path.join(HOME, "hooks.json"), JSON.stringify({ hooks: { SessionStart: [{}] } }));
fs.mkdirSync(path.join(HOME, "skills", "demo"), { recursive: true });
fs.writeFileSync(path.join(HOME, "skills", "demo", "SKILL.md"), "# Demo\n");
fs.mkdirSync(path.join(HOME, "rules"), { recursive: true });
fs.writeFileSync(path.join(HOME, "rules", "review.rules"), "Review every change.\n");
fs.mkdirSync(
  path.join(HOME, "plugins", "cache", "demo-market", "demo-plugin", "1.0.0", ".codex-plugin"),
  {
    recursive: true,
  }
);
fs.writeFileSync(
  path.join(
    HOME,
    "plugins",
    "cache",
    "demo-market",
    "demo-plugin",
    "1.0.0",
    ".codex-plugin",
    "plugin.json"
  ),
  JSON.stringify({
    name: "demo-plugin",
    version: "1.0.0",
    description: "A test plugin",
    interface: { displayName: "Demo Plugin", shortDescription: "The real installed plugin" },
  })
);

const discovery = require("../lib/codex-config-discovery");
const mutate = require("../lib/codex-config-mutate");

describe("codex config discovery", () => {
  after(() => {
    if (previousHome === undefined) delete process.env.DASHBOARD_CODEX_HOME;
    else process.env.DASHBOARD_CODEX_HOME = previousHome;
    if (previousDisablePluginCli === undefined)
      delete process.env.DASHBOARD_DISABLE_CODEX_PLUGIN_CLI;
    else process.env.DASHBOARD_DISABLE_CODEX_PLUGIN_CLI = previousDisablePluginCli;
    fs.rmSync(HOME, { recursive: true, force: true });
  });

  it("enumerates safe metadata without exposing config secrets", () => {
    const overview = discovery.readOverview();
    assert.equal(overview.home, HOME);
    assert.equal(overview.defaults.model, "gpt-5.6-terra");
    assert.equal(overview.counts.models, 1);
    assert.equal(overview.counts.mcp, 1);
    assert.equal(overview.counts.skills, 1);
    assert.equal(overview.counts.plugins, 1);
    assert.deepEqual(overview.plugins[0], {
      id: "demo-plugin@demo-market",
      name: "demo-plugin",
      displayName: "Demo Plugin",
      description: "The real installed plugin",
      marketplace: "demo-market",
      marketplaceLabel: "Demo Market",
      version: "1.0.0",
      enabled: true,
    });
    assert.match(overview.config.text, /\[redacted\]/);
    assert.doesNotMatch(overview.config.text, /super-secret/);
  });

  it("redacts safe file reads and rejects paths outside Codex home", () => {
    const allowed = discovery.readFileSafe(path.join(HOME, "config.toml"));
    assert.ok(!allowed.error);
    assert.match(allowed.text, /\[redacted\]/);
    assert.doesNotMatch(allowed.text, /super-secret/);

    const blocked = discovery.readFileSafe(path.join(os.tmpdir(), "not-codex-config.toml"));
    assert.match(blocked.error, /inside Codex home/);
  });

  it("edits only allowlisted files and creates a timestamped backup", () => {
    const config = path.join(HOME, "config.toml");
    const raw = mutate.readEditableFile(config);
    assert.match(raw.text, /super-secret/);

    const result = mutate.writeEditableFile({
      file: config,
      content: 'model = "gpt-5.6-sol"\n',
    });
    assert.equal(result.ok, true);
    assert.equal(result.created, false);
    assert.ok(result.backupPath);
    assert.match(fs.readFileSync(result.backupPath, "utf8"), /super-secret/);
    assert.equal(fs.readFileSync(config, "utf8"), 'model = "gpt-5.6-sol"\n');

    assert.throws(
      () => mutate.writeEditableFile({ file: path.join(HOME, "models_cache.json"), content: "{}" }),
      /not editable/
    );
  });

  it("reads an oversized Codex model cache without applying the editor cap", () => {
    fs.writeFileSync(
      path.join(HOME, "models_cache.json"),
      JSON.stringify({
        fetched_at: "2026-08-02T00:00:00.000Z",
        models: [
          {
            slug: "gpt-5.6-sol",
            display_name: "GPT-5.6 Sol",
            default_reasoning_level: "medium",
            supported_reasoning_levels: [{ effort: "medium" }, { effort: "xhigh" }],
            context_window: 272000,
            // The real cache includes model instructions, making it larger than
            // the 256 KiB configuration editor limit.
            base_instructions: "x".repeat(300 * 1024),
          },
        ],
      })
    );
    const overview = discovery.readOverview();
    assert.equal(overview.counts.models, 1);
    assert.equal(overview.models.fetchedAt, "2026-08-02T00:00:00.000Z");
    assert.deepEqual(overview.models.items[0], {
      id: "gpt-5.6-sol",
      name: "GPT-5.6 Sol",
      description: null,
      defaultEffort: "medium",
      efforts: ["medium", "xhigh"],
      contextWindow: 272000,
      visible: true,
      sources: ["account", "configured"],
      baseDefault: true,
      profiles: [],
      providers: [],
    });
  });

  it("creates, discovers, and edits top-level Codex profile overlays", () => {
    const created = mutate.createProfile({ name: "deep-review" });
    assert.equal(created.exists, true);
    assert.match(created.path, /deep-review\.config\.toml$/);
    assert.match(created.text, /codex --profile deep-review/);
    assert.throws(() => mutate.createProfile({ name: "deep-review" }), /already exists/);
    assert.throws(() => mutate.createProfile({ name: "not allowed" }), /letters, numbers/);

    const initial = discovery.readOverview().profiles.find((item) => item.name === "deep-review");
    assert.ok(initial);
    assert.equal(initial.model, null);
    assert.equal(initial.approvalPolicy, null);

    mutate.writeEditableFile({
      file: created.path,
      content: ['model = "gpt-5.6-sol"', 'approval_policy = "on-request"'].join("\n"),
    });
    const configured = discovery
      .readOverview()
      .profiles.find((item) => item.name === "deep-review");
    assert.equal(configured.model, "gpt-5.6-sol");
    assert.equal(configured.approvalPolicy, "on-request");
    assert.ok(discovery.readOverview().models.items[0].profiles.includes("deep-review"));
  });

  it("backs up and deletes only user-maintained artifacts, never config.toml", () => {
    const profile = path.join(HOME, "deep-review.config.toml");
    const deletedProfile = mutate.deleteEditableFile({ file: profile });
    assert.equal(deletedProfile.ok, true);
    assert.equal(deletedProfile.deletedDirectory, false);
    assert.ok(fs.existsSync(deletedProfile.backupPath));
    assert.equal(fs.existsSync(profile), false);

    const skill = path.join(HOME, "skills", "demo", "SKILL.md");
    fs.writeFileSync(path.join(HOME, "skills", "demo", "notes.md"), "skill asset\n");
    const deletedSkill = mutate.deleteEditableFile({ file: skill });
    assert.equal(deletedSkill.deletedDirectory, true);
    assert.equal(fs.existsSync(path.join(HOME, "skills", "demo")), false);
    assert.match(fs.readFileSync(path.join(deletedSkill.backupPath, "SKILL.md"), "utf8"), /Demo/);
    assert.match(fs.readFileSync(path.join(deletedSkill.backupPath, "notes.md"), "utf8"), /asset/);

    assert.throws(
      () => mutate.deleteEditableFile({ file: path.join(HOME, "config.toml") }),
      /cannot be deleted/
    );
    assert.throws(
      () => mutate.deleteEditableFile({ file: path.join(HOME, "models_cache.json") }),
      /cannot be deleted/
    );
  });

  it("does not follow an allowlisted configuration symlink", () => {
    const hooked = path.join(HOME, "hooks.json");
    const outside = path.join(os.tmpdir(), `codex-config-outside-${process.pid}.json`);
    fs.writeFileSync(outside, "{}\n");
    fs.unlinkSync(hooked);
    fs.symlinkSync(outside, hooked);
    assert.throws(() => mutate.readEditableFile(hooked), /symbolic link/);
    fs.unlinkSync(hooked);
    fs.writeFileSync(hooked, JSON.stringify({ hooks: { SessionStart: [{}] } }));
    fs.rmSync(outside, { force: true });
  });

  it("rejects a symlinked parent that escapes the Codex skills root", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-config-parent-"));
    const linkedSkill = path.join(HOME, "skills", "linked");
    fs.symlinkSync(outside, linkedSkill, "dir");
    const target = path.join(linkedSkill, "SKILL.md");
    fs.writeFileSync(path.join(outside, "SKILL.md"), "# outside\n");

    const read = discovery.readFileSafe(target);
    assert.match(read.error, /inside Codex home|not readable/);
    assert.throws(() => mutate.readEditableFile(target), /symbolic link/);
    assert.throws(
      () => mutate.writeEditableFile({ file: target, content: "# replaced\n" }),
      /symbolic link/
    );
    assert.equal(fs.readFileSync(path.join(outside, "SKILL.md"), "utf8"), "# outside\n");

    fs.unlinkSync(linkedSkill);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it("refuses to save redacted preview content", () => {
    assert.throws(
      () =>
        mutate.writeEditableFile({
          file: path.join(HOME, "config.toml"),
          content: 'api_key = "[redacted]"\n',
        }),
      /Refusing to save redacted preview/
    );
  });
});
