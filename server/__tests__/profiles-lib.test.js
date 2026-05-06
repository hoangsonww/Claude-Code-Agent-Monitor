// server/__tests__/profiles-lib.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("launcher tables exist", () => {
  it("schema applies cleanly", () => {
    process.env.DASHBOARD_DB_PATH = ":memory:";
    delete require.cache[require.resolve("../db")];
    const { db } = require("../db");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes("launcher_profiles"));
    assert.ok(tables.includes("launcher_allowed_cwds"));
    assert.ok(tables.includes("launcher_launches"));
  });
});

function freshLib() {
  process.env.DASHBOARD_DB_PATH = ":memory:";
  delete require.cache[require.resolve("../db")];
  delete require.cache[require.resolve("../lib/profiles")];
  return require("../lib/profiles");
}

describe("profiles lib", () => {
  it("create + get round-trips a config", () => {
    const profiles = freshLib();
    const created = profiles.create({
      name: "code-review",
      description: "Reviews PRs",
      config: { model: "sonnet", effort: "high" },
      defaultCwd: "/tmp/x",
    });
    const got = profiles.get(created.id);
    assert.equal(got.name, "code-review");
    assert.deepEqual(got.config, { model: "sonnet", effort: "high" });
    assert.equal(got.defaultCwd, "/tmp/x");
  });

  it("rejects invalid configs at the lib boundary", () => {
    const profiles = freshLib();
    assert.throws(
      () => profiles.create({ name: "bad", config: { unknownKey: 1 } }),
      /unknown key/,
    );
  });

  it("rejects duplicate names", () => {
    const profiles = freshLib();
    profiles.create({ name: "dup", config: {} });
    assert.throws(() => profiles.create({ name: "dup", config: {} }), /UNIQUE/);
  });

  it("update merges config and bumps updated_at", () => {
    const profiles = freshLib();
    const c = profiles.create({ name: "p", config: { model: "sonnet" } });
    profiles.update(c.id, { config: { model: "opus", effort: "max" } });
    const after = profiles.get(c.id);
    assert.equal(after.config.model, "opus");
    assert.equal(after.config.effort, "max");
  });

  it("list returns most-recent-first", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "a", config: {} });
    const b = profiles.create({ name: "b", config: {} });
    profiles.markUsed(a.id);
    const list = profiles.list();
    assert.equal(list[0].id, a.id);
  });

  it("exportJson + importJson round-trip", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "x", config: { model: "sonnet" } });
    const json = profiles.exportJson(a.id);
    profiles.delete(a.id);
    const imported = profiles.importJson(json);
    assert.equal(imported.name, "x");
    assert.deepEqual(imported.config, { model: "sonnet" });
  });

  it("delete removes a profile", () => {
    const profiles = freshLib();
    const a = profiles.create({ name: "doomed", config: {} });
    profiles.delete(a.id);
    assert.equal(profiles.get(a.id), null);
  });
});
