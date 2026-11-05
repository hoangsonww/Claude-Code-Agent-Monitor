/**
 * @file Tests hook installation safety and targeting: the host-only guard must
 * reject container-internal handler paths, provider entries remain idempotent,
 * and an explicit Compose port is embedded for both Claude and Codex. Container
 * detection uses deterministic force flags so the suite is environment-neutral.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("node:child_process");

// Point the installer at a throwaway CLAUDE_HOME. (`node --test` isolates each
// test file in its own process, so this does not leak into other suites.)
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-hooks-"));
const ALT_HOME = path.join(TMP_HOME, "alternate-home");
process.env.CLAUDE_HOME = TMP_HOME;
const SETTINGS = path.join(TMP_HOME, "settings.json");
const CODEX_HOME = path.join(TMP_HOME, "codex");
const CODEX_HOOKS = path.join(CODEX_HOME, "hooks.json");
process.env.DASHBOARD_CODEX_HOME = CODEX_HOME;

const {
  installHooks,
  isInsideContainer,
  getClaudeHookStatus,
} = require("../../scripts/install-hooks");
const {
  HOOK_TYPES: CODEX_HOOK_TYPES,
  getCodexHookStatus,
  installCodexHooks,
} = require("../../scripts/install-codex-hooks");

const HOOK_TYPES = [
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "Notification",
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
];

function clearEnv() {
  delete process.env.CCAM_FORCE_CONTAINER;
  delete process.env.CCAM_FORCE_HOST;
  delete process.env.CCAM_ALLOW_CONTAINER_HOOKS;
  delete process.env.CCAM_NO_AUTO_HOOKS;
}

function rmSettings() {
  try {
    fs.unlinkSync(SETTINGS);
  } catch {
    /* not present */
  }
}

function rmCodexHooks() {
  try {
    fs.unlinkSync(CODEX_HOOKS);
  } catch {
    /* not present */
  }
}

describe("install-hooks host-only guard (#193)", () => {
  beforeEach(() => {
    process.env.CLAUDE_HOME = TMP_HOME;
    clearEnv();
    rmSettings();
    rmCodexHooks();
  });

  after(() => {
    clearEnv();
    try {
      fs.rmSync(TMP_HOME, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  it("refuses inside a container and writes no settings file", () => {
    process.env.CCAM_FORCE_CONTAINER = "1";
    const ok = installHooks(true);
    assert.equal(ok, false);
    assert.equal(installCodexHooks({ silent: true }).ok, false);
    assert.equal(
      fs.existsSync(SETTINGS),
      false,
      "settings.json must not be created in a container"
    );
    assert.equal(
      fs.existsSync(CODEX_HOOKS),
      false,
      "hooks.json must not be created in a container"
    );
  });

  it("writes when the explicit container override is set", () => {
    process.env.CCAM_FORCE_CONTAINER = "1";
    process.env.CCAM_ALLOW_CONTAINER_HOOKS = "1";
    const ok = installHooks(true);
    assert.equal(ok, true);
    assert.equal(installCodexHooks({ silent: true }).ok, true);
    assert.ok(fs.existsSync(SETTINGS));
    assert.ok(fs.existsSync(CODEX_HOOKS));
    const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    for (const type of HOOK_TYPES) {
      assert.ok(Array.isArray(settings.hooks[type]), `missing hook list for ${type}`);
      assert.match(JSON.stringify(settings.hooks[type]), /hook-handler\.js/, `${type} not wired`);
    }
  });

  it("writes on a host (not a container)", () => {
    process.env.CCAM_FORCE_HOST = "1";
    const ok = installHooks(true);
    assert.equal(ok, true);
    assert.ok(fs.existsSync(SETTINGS));
  });

  it("skips only automatic installation when opted out", () => {
    process.env.CCAM_FORCE_HOST = "1";
    process.env.CCAM_NO_AUTO_HOOKS = "1";
    assert.equal(installHooks(true, { automatic: true }), false);
    assert.equal(fs.existsSync(SETTINGS), false);
    assert.equal(installHooks(true), true);
    assert.equal(fs.existsSync(SETTINGS), true);
  });

  it("returns silently when a synced hook points at a missing portable handler", () => {
    process.env.CCAM_FORCE_HOST = "1";
    installHooks(true);
    const command = JSON.parse(fs.readFileSync(SETTINGS, "utf8")).hooks.SessionStart[0].hooks[0]
      .command;
    const missing = path.join(TMP_HOME, "removed", "hook-handler.js").replace(/\\/g, "/");
    const match = command.match(/-e "([^"]+)" "([^"]+)" (\w+)$/);
    assert.ok(match, "installed hook must pass its handler as an argument");
    assert.equal(
      execFileSync(process.execPath, ["-e", match[1], missing, match[3]], {
        input: "{}",
        encoding: "utf8",
      }),
      ""
    );
    const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    settings.hooks.SessionStart[0].hooks[0].command = command.replace(match[2], missing);
    fs.writeFileSync(SETTINGS, JSON.stringify(settings));
    assert.equal(getClaudeHookStatus().hooks.SessionStart, false);
    assert.equal(getClaudeHookStatus().has_dashboard_hooks, true);
    installHooks(true);
    assert.equal(getClaudeHookStatus().hooks.SessionStart, true);
  });

  it("keeps missing Codex handlers fail-safe with and without an explicit port", () => {
    process.env.CCAM_FORCE_HOST = "1";
    const missing = path.join(TMP_HOME, "removed", "codex-hook-handler.js").replace(/\\/g, "/");

    for (const dashboardPort of [null, 4820]) {
      assert.equal(installCodexHooks({ silent: true, dashboardPort }).ok, true);
      const command = JSON.parse(fs.readFileSync(CODEX_HOOKS, "utf8")).hooks.SessionStart[0]
        .hooks[0].command;
      const match = command.match(/-e "([^"]+)" "([^"]+)" (\w+)$/);
      assert.ok(match, "installed Codex hook must pass its handler as an argument");
      assert.equal(
        execFileSync(process.execPath, ["-e", match[1], missing, match[3]], {
          input: "{}",
          encoding: "utf8",
        }),
        ""
      );
    }

    const config = JSON.parse(fs.readFileSync(CODEX_HOOKS, "utf8"));
    const command = config.hooks.SessionStart[0].hooks[0].command;
    const installedHandler = command.match(/"([^"]*codex-hook-handler\.js)"/)?.[1];
    assert.ok(installedHandler);
    config.hooks.SessionStart[0].hooks[0].command = command.replace(installedHandler, missing);
    fs.writeFileSync(CODEX_HOOKS, JSON.stringify(config));
    assert.equal(getCodexHookStatus().hooks.SessionStart, false);
    assert.equal(getCodexHookStatus().installed, false);
    assert.equal(getCodexHookStatus().has_dashboard_hooks, true);
    assert.equal(installCodexHooks({ silent: true }).ok, true);
    assert.equal(getCodexHookStatus().hooks.SessionStart, true);
  });

  it("is idempotent — re-running updates in place with no duplicate entries", () => {
    process.env.CCAM_FORCE_HOST = "1";
    installHooks(true);
    installHooks(true);
    const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    const ours = settings.hooks.PreToolUse.filter((e) =>
      JSON.stringify(e).includes("hook-handler.js")
    );
    assert.equal(ours.length, 1, "must not duplicate our hook entry on re-run");
  });

  it("reports partial dashboard hooks and unrelated hook configuration before installing", () => {
    fs.writeFileSync(
      SETTINGS,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "keep-me" }] }],
          SessionStart: [
            { hooks: [{ type: "command", command: "node /tmp/hook-handler.js SessionStart" }] },
          ],
        },
      })
    );
    const status = getClaudeHookStatus();
    assert.equal(status.installed, false);
    assert.equal(status.has_dashboard_hooks, true);
    assert.equal(status.has_existing_hooks, true);

    fs.mkdirSync(CODEX_HOME, { recursive: true });
    fs.writeFileSync(
      CODEX_HOOKS,
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "keep-me" }] }] } })
    );
    const codexStatus = getCodexHookStatus();
    assert.equal(codexStatus.installed, false);
    assert.equal(codexStatus.has_dashboard_hooks, false);
    assert.equal(codexStatus.has_existing_hooks, true);
  });

  it("follows a CLAUDE_HOME change without reloading the installer module", () => {
    process.env.CLAUDE_HOME = ALT_HOME;
    process.env.CCAM_FORCE_HOST = "1";
    const alternateSettings = path.join(ALT_HOME, "settings.json");

    assert.equal(getClaudeHookStatus().path, alternateSettings);
    assert.equal(installHooks(true), true);
    assert.equal(fs.existsSync(alternateSettings), true);
    assert.equal(getClaudeHookStatus().installed, true);
    assert.equal(fs.existsSync(SETTINGS), false);
  });

  it("isInsideContainer honors the force flags", () => {
    process.env.CCAM_FORCE_CONTAINER = "1";
    assert.equal(isInsideContainer(), true);
    delete process.env.CCAM_FORCE_CONTAINER;
    process.env.CCAM_FORCE_HOST = "1";
    assert.equal(isInsideContainer(), false);
  });

  it("installs and updates Codex entries without disturbing unrelated hooks", () => {
    fs.mkdirSync(CODEX_HOME, { recursive: true });
    fs.writeFileSync(
      CODEX_HOOKS,
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "keep-me" }] }] } })
    );
    const first = installCodexHooks({ silent: true });
    const second = installCodexHooks({ silent: true });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.replaced, true);
    assert.equal(getCodexHookStatus().installed, true);
    const config = JSON.parse(fs.readFileSync(CODEX_HOOKS, "utf8"));
    assert.ok(config.hooks.Stop.some((entry) => JSON.stringify(entry).includes("keep-me")));
    for (const type of CODEX_HOOK_TYPES) {
      const ours = config.hooks[type].filter((entry) =>
        JSON.stringify(entry).includes("codex-hook-handler.js")
      );
      assert.equal(ours.length, 1, `${type} should contain one dashboard hook`);
    }
  });

  it("embeds an explicit dashboard port for host hooks targeting a container", () => {
    process.env.CCAM_FORCE_HOST = "1";
    assert.equal(installHooks(true, { dashboardPort: 4820 }), true);
    assert.equal(installCodexHooks({ silent: true, dashboardPort: 4820 }).ok, true);

    const claude = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    const codex = JSON.parse(fs.readFileSync(CODEX_HOOKS, "utf8"));
    const expected = "process.env.CLAUDE_DASHBOARD_PORT='4820'";
    assert.match(claude.hooks.SessionStart[0].hooks[0].command, new RegExp(expected));
    assert.match(codex.hooks.SessionStart[0].hooks[0].command, new RegExp(expected));
  });

  it("rejects invalid embedded ports before writing either provider config", () => {
    process.env.CCAM_FORCE_HOST = "1";
    assert.throws(
      () => installHooks(true, { dashboardPort: "4820;touch /tmp/unsafe" }),
      /integer between 1 and 65535/
    );
    assert.throws(
      () => installCodexHooks({ silent: true, dashboardPort: 65536 }),
      /integer between 1 and 65535/
    );
    assert.equal(fs.existsSync(SETTINGS), false);
    assert.equal(fs.existsSync(CODEX_HOOKS), false);
  });

  it("rejects explicitly empty dashboard-port CLI values before writing", () => {
    const script = path.resolve(__dirname, "../../scripts/install-hooks.js");
    const env = {
      ...process.env,
      CCAM_FORCE_HOST: "1",
      CLAUDE_HOME: TMP_HOME,
      DASHBOARD_CODEX_HOME: CODEX_HOME,
    };

    for (const args of [
      ["--both", "--dashboard-port="],
      ["--both", "--dashboard-port", ""],
    ]) {
      const result = spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /integer between 1 and 65535/);
      assert.equal(fs.existsSync(SETTINGS), false);
      assert.equal(fs.existsSync(CODEX_HOOKS), false);
    }
  });
});
