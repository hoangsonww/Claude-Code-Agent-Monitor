// server/__tests__/slash-commands-lib.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("slash-commands lib", () => {
  it("buildCatalog returns built-in section with required commands", () => {
    delete require.cache[require.resolve("../lib/slash-commands")];
    const { buildCatalog } = require("../lib/slash-commands");
    const r = buildCatalog({ cwd: os.tmpdir() });
    const names = r.builtin.map((c) => c.name);
    for (const expected of ["help", "clear", "agents", "compact", "cost", "resume", "login"]) {
      assert.ok(names.includes(expected), `built-in missing /${expected}`);
    }
  });

  it("buildCatalog discovers per-cwd .claude/commands/*.md", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sc-cwd-"));
    fs.mkdirSync(path.join(cwd, ".claude", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, ".claude", "commands", "deploy.md"),
      "---\ndescription: Deploy via plugin\n---\n\nbody",
    );
    fs.writeFileSync(
      path.join(cwd, ".claude", "commands", "rollback.md"),
      "no frontmatter — body only",
    );
    delete require.cache[require.resolve("../lib/slash-commands")];
    const { buildCatalog } = require("../lib/slash-commands");
    const r = buildCatalog({ cwd });
    const names = r.project.map((c) => c.name).sort();
    assert.deepEqual(names, ["deploy", "rollback"]);
    const deploy = r.project.find((c) => c.name === "deploy");
    assert.equal(deploy.description, "Deploy via plugin");
    const rollback = r.project.find((c) => c.name === "rollback");
    assert.equal(rollback.description, "");
    fs.rmSync(cwd, { recursive: true });
  });

  it("buildCatalog returns empty project list when .claude/commands/ missing", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sc-empty-"));
    delete require.cache[require.resolve("../lib/slash-commands")];
    const { buildCatalog } = require("../lib/slash-commands");
    const r = buildCatalog({ cwd });
    assert.deepEqual(r.project, []);
    fs.rmSync(cwd, { recursive: true });
  });

  it("buildCatalog reads skills + plugins via getSkillsCatalog", () => {
    delete require.cache[require.resolve("../lib/slash-commands")];
    const { buildCatalog } = require("../lib/slash-commands");
    const r = buildCatalog({
      cwd: os.tmpdir(),
      skillsCatalog: {
        skills: [{ name: "code-review", description: "Reviews diff" }],
        plugins: [{ name: "ccam-deploy", description: "Deploy via plugin" }],
      },
    });
    assert.equal(r.skills.length, 1);
    assert.equal(r.skills[0].name, "code-review");
    assert.equal(r.plugins.length, 1);
    assert.equal(r.plugins[0].name, "ccam-deploy");
  });
});
