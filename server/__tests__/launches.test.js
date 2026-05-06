// server/__tests__/launches.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

function fresh() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/launches")];
  return require("../lib/launches");
}

describe("launches lib", () => {
  it("record() persists a launch with redacted env", () => {
    const launches = fresh();
    launches.record({
      id: "abc",
      profileId: null,
      cwd: "/tmp",
      argv: ["-p", "hi", "--betas", "test"],
      injectedEnvNames: ["GITHUB_TOKEN"],
    });
    const r = launches.get("abc");
    assert.equal(r.id, "abc");
    assert.deepEqual(JSON.parse(r.argv_json).argv, ["-p", "hi", "--betas", "test"]);
    assert.deepEqual(JSON.parse(r.argv_json).envNames, ["GITHUB_TOKEN"]);
  });

  it("complete() updates exit_code + status + ended_at", () => {
    const launches = fresh();
    launches.record({ id: "a", cwd: "/tmp", argv: [] });
    launches.complete("a", { exitCode: 0, status: "completed" });
    const r = launches.get("a");
    assert.equal(r.exit_code, 0);
    assert.equal(r.status, "completed");
    assert.ok(r.ended_at);
  });
});
