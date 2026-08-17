/**
 * @file Verifies that dashboard-owned settings persist to DASHBOARD_ENV_PATH,
 * which lets non-root container deployments use a dedicated writable volume.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-env-path-"));
const envPath = path.join(directory, "config", ".env");
process.env.DASHBOARD_ENV_PATH = envPath;

const { writeEnvFile } = require("../lib/claude-home");

after(() => {
  delete process.env.DASHBOARD_ENV_PATH;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("DASHBOARD_ENV_PATH", () => {
  it("creates parent directories and updates values atomically", () => {
    writeEnvFile("CLAUDE_HOME", "/first");
    writeEnvFile("CLAUDE_HOME", "/second");
    writeEnvFile("DASHBOARD_CODEX_HOME", "/codex");
    const content = fs.readFileSync(envPath, "utf8");
    assert.match(content, /^CLAUDE_HOME=\/second$/m);
    assert.match(content, /^DASHBOARD_CODEX_HOME=\/codex$/m);
    assert.doesNotMatch(content, /CLAUDE_HOME=\/first/);
  });
});
