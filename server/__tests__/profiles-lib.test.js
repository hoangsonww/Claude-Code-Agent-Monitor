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
