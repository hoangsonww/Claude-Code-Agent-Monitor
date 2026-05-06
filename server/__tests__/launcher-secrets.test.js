const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-secrets-"));
  process.env.HOME = tmp;
  fs.mkdirSync(path.join(tmp, ".claude", "launcher"), { recursive: true });
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("launcher-secrets", () => {
  it("returns empty object when secrets.env does not exist", () => {
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { readSecretsEnv } = require("../lib/launcher-secrets");
    assert.deepEqual(readSecretsEnv(), {});
  });

  it("parses KEY=VALUE pairs and ignores comments and blanks", () => {
    fs.writeFileSync(
      path.join(tmp, ".claude", "launcher", "secrets.env"),
      "# header\nFOO=bar\n\nBAZ=quux\n",
    );
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { readSecretsEnv } = require("../lib/launcher-secrets");
    assert.deepEqual(readSecretsEnv(), { FOO: "bar", BAZ: "quux" });
  });

  it("resolveEnvForNames pulls from process.env and secrets, with secrets winning", () => {
    process.env.BOTH = "from-process";
    process.env.ONLY_PROC = "ok";
    fs.writeFileSync(
      path.join(tmp, ".claude", "launcher", "secrets.env"),
      "BOTH=from-secrets\nONLY_SECRETS=secret-only\n",
    );
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { resolveEnvForNames } = require("../lib/launcher-secrets");
    assert.deepEqual(resolveEnvForNames(["BOTH", "ONLY_PROC", "ONLY_SECRETS", "MISSING"]), {
      BOTH: "from-secrets",
      ONLY_PROC: "ok",
      ONLY_SECRETS: "secret-only",
    });
  });

  it("rethrows non-ENOENT errors from secrets.env", () => {
    const file = path.join(tmp, ".claude", "launcher", "secrets.env");
    fs.writeFileSync(file, "FOO=bar\n");
    fs.chmodSync(file, 0);
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { readSecretsEnv } = require("../lib/launcher-secrets");
    try {
      assert.throws(() => readSecretsEnv(), /EACCES|EPERM/);
    } finally {
      fs.chmodSync(file, 0o600);
    }
  });
});
