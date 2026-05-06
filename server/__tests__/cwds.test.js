const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function freshLib() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/cwds")];
  return require("../lib/cwds");
}

describe("cwds lib", () => {
  it("add() records a path that exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    cwds.add(tmp, "manual");
    assert.deepEqual(
      cwds.list().map((r) => r.path),
      [tmp],
    );
    fs.rmSync(tmp, { recursive: true });
  });

  it("add() rejects nonexistent paths", () => {
    const cwds = freshLib();
    assert.throws(() => cwds.add("/this/does/not/exist", "manual"), /does not exist/);
  });

  it("add() rejects relative paths", () => {
    const cwds = freshLib();
    assert.throws(() => cwds.add("./relative", "manual"), /absolute/);
  });

  it("isAllowed(path) returns true only after add()", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    assert.equal(cwds.isAllowed(tmp), false);
    cwds.add(tmp, "manual");
    assert.equal(cwds.isAllowed(tmp), true);
    fs.rmSync(tmp, { recursive: true });
  });

  it("remove() deletes by path", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cwds-"));
    const cwds = freshLib();
    cwds.add(tmp, "manual");
    cwds.remove(tmp);
    assert.equal(cwds.list().length, 0);
    fs.rmSync(tmp, { recursive: true });
  });
});
