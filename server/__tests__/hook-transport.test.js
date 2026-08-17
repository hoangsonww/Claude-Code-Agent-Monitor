/**
 * @file Verifies the shared hook transport's cloud boundary: local HTTP stays
 * supported, remote destinations require HTTPS, and token files are trimmed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const transport = require("../../scripts/hook-transport");

const ENV_KEYS = ["CCAM_DASHBOARD_URL", "CCAM_HOOK_TOKEN", "CCAM_HOOK_TOKEN_FILE"];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("hook transport target validation", () => {
  it("preserves the local loopback target by default", () => {
    const targets = transport.buildTargets(() => [4820], "/api/hooks/event");
    assert.deepEqual(targets.map(String), ["http://127.0.0.1:4820/api/hooks/event"]);
  });

  it("requires HTTPS for non-loopback remote dashboards", () => {
    process.env.CCAM_DASHBOARD_URL = "http://dashboard.example.com";
    assert.throws(() => transport.remoteDashboardUrl(), /must use HTTPS/);
    process.env.CCAM_DASHBOARD_URL = "https://dashboard.example.com";
    assert.equal(transport.remoteDashboardUrl().hostname, "dashboard.example.com");
    assert.throws(
      () => transport.buildTargets(() => [4820], "/api/hooks/event"),
      /require CCAM_HOOK_TOKEN/
    );
    process.env.CCAM_HOOK_TOKEN = "hook-secret";
    assert.equal(
      String(transport.buildTargets(() => [4820], "/api/hooks/event")[0]),
      "https://dashboard.example.com/api/hooks/event"
    );
  });

  it("loads a hook token from a mounted secret file", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-hook-token-"));
    try {
      const tokenPath = path.join(directory, "token");
      fs.writeFileSync(tokenPath, "hook-file-secret\n");
      process.env.CCAM_HOOK_TOKEN_FILE = tokenPath;
      assert.equal(transport.readHookToken(), "hook-file-secret");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
