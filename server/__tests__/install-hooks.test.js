/**
 * @file Tests the host-only guard in scripts/install-hooks.js (issue #193):
 * the installer must refuse to write a container-internal handler path into a
 * (possibly bind-mounted) host ~/.claude/settings.json. Container detection is
 * driven deterministically via CCAM_FORCE_CONTAINER / CCAM_FORCE_HOST so these
 * tests pass whether or not the CI runner itself is containerized.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Point the installer at a throwaway CLAUDE_HOME BEFORE requiring it — the
// settings path is resolved at module load. (`node --test` isolates each test
// file in its own process, so this does not leak into other suites.)
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-hooks-"));
process.env.CLAUDE_HOME = TMP_HOME;
const SETTINGS = path.join(TMP_HOME, "settings.json");

const { installHooks, isInsideContainer } = require("../../scripts/install-hooks");

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
}

function rmSettings() {
  try {
    fs.unlinkSync(SETTINGS);
  } catch {
    /* not present */
  }
}

describe("install-hooks host-only guard (#193)", () => {
  beforeEach(() => {
    clearEnv();
    rmSettings();
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
    assert.equal(
      fs.existsSync(SETTINGS),
      false,
      "settings.json must not be created in a container"
    );
  });

  it("writes when the explicit container override is set", () => {
    process.env.CCAM_FORCE_CONTAINER = "1";
    process.env.CCAM_ALLOW_CONTAINER_HOOKS = "1";
    const ok = installHooks(true);
    assert.equal(ok, true);
    assert.ok(fs.existsSync(SETTINGS));
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

  it("isInsideContainer honors the force flags", () => {
    process.env.CCAM_FORCE_CONTAINER = "1";
    assert.equal(isInsideContainer(), true);
    delete process.env.CCAM_FORCE_CONTAINER;
    process.env.CCAM_FORCE_HOST = "1";
    assert.equal(isInsideContainer(), false);
  });
});
