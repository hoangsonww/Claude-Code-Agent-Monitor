/**
 * @file Verifies that relocated Claude Code configuration drives transcript,
 * hook, discovery, and Config Explorer paths without writing to ~/.claude.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-config-dir-"));
const configDir = path.join(root, "relocated");
const overrideDir = path.join(root, "override");
const oldClaudeHome = process.env.CLAUDE_HOME;
const oldConfigDir = process.env.CLAUDE_CONFIG_DIR;
const oldDataDir = process.env.DASHBOARD_DATA_DIR;

fs.mkdirSync(path.join(configDir, "projects"), { recursive: true });
fs.mkdirSync(overrideDir);
fs.writeFileSync(
  path.join(configDir, ".claude.json"),
  JSON.stringify({ mcpServers: { relocated: { command: "example-mcp" } } })
);

const {
  getClaudeHome,
  getClaudeJsonPath,
  getProjectsDir,
  getSettingsPath,
  getDataDir,
} = require("../lib/claude-home");
const { getServerInfoPath } = require("../lib/server-info");
const { readOverview, readMcpServers } = require("../lib/cc-discovery");
const { installHooks, getClaudeHookStatus } = require("../../scripts/install-hooks");

after(() => {
  if (oldClaudeHome === undefined) delete process.env.CLAUDE_HOME;
  else process.env.CLAUDE_HOME = oldClaudeHome;
  if (oldConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = oldConfigDir;
  if (oldDataDir === undefined) delete process.env.DASHBOARD_DATA_DIR;
  else process.env.DASHBOARD_DATA_DIR = oldDataDir;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("CLAUDE_CONFIG_DIR path resolution (#393)", () => {
  it("uses Claude Code's relocated directory for all home-backed paths", () => {
    delete process.env.CLAUDE_HOME;
    delete process.env.DASHBOARD_DATA_DIR;
    process.env.CLAUDE_CONFIG_DIR = configDir;

    assert.equal(getClaudeHome(), configDir);
    assert.equal(getProjectsDir(), path.join(configDir, "projects"));
    assert.equal(getSettingsPath(), path.join(configDir, "settings.json"));
    assert.equal(getServerInfoPath(), path.join(configDir, ".agent-dashboard.json"));
    assert.equal(getDataDir(), path.join(configDir, "agent-dashboard"));
    assert.equal(getClaudeJsonPath(), path.join(configDir, ".claude.json"));
    assert.equal(readOverview({ cwd: root }).roots.claudeJson, getClaudeJsonPath());
    assert.ok(readMcpServers({ cwd: root }).user.some((server) => server.name === "relocated"));
    process.env.CCAM_FORCE_HOST = "1";
    try {
      assert.equal(installHooks(true), true);
      assert.equal(getClaudeHookStatus().path, getSettingsPath());
      assert.ok(fs.existsSync(getSettingsPath()));
    } finally {
      delete process.env.CCAM_FORCE_HOST;
    }
  });

  it("lets CLAUDE_HOME override the home while CLAUDE_CONFIG_DIR still locates Claude's state file", () => {
    process.env.CLAUDE_HOME = overrideDir;
    process.env.CLAUDE_CONFIG_DIR = configDir;
    assert.equal(getClaudeHome(), overrideDir);
    assert.equal(getClaudeJsonPath(), path.join(configDir, ".claude.json"));
  });

  it("preserves the default paths when neither variable is set", () => {
    delete process.env.CLAUDE_HOME;
    delete process.env.CLAUDE_CONFIG_DIR;
    assert.equal(getClaudeHome(), path.join(os.homedir(), ".claude"));
    assert.equal(getClaudeJsonPath(), path.join(os.homedir(), ".claude.json"));
  });
});
