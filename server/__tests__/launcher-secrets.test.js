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
    process.env.FOO = "from-process";
    fs.writeFileSync(
      path.join(tmp, ".claude", "launcher", "secrets.env"),
      "FOO=from-secrets\nONLY_PROC=ok\n",
    );
    process.env.ONLY_PROC = "ok";
    delete require.cache[require.resolve("../lib/launcher-secrets")];
    const { resolveEnvForNames } = require("../lib/launcher-secrets");
    assert.deepEqual(resolveEnvForNames(["FOO", "ONLY_PROC", "MISSING"]), {
      FOO: "from-secrets",
      ONLY_PROC: "ok",
    });
  });
});
