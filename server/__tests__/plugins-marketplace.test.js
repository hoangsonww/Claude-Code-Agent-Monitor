/**
 * @file plugins-marketplace.test.js
 * @description Structural validation for the bundled Claude Code plugin
 * marketplace (.claude-plugin/marketplace.json + plugins/*). Guards that
 * every marketplace entry resolves to a real plugin dir with a valid
 * plugin.json, that names line up, and that every agent / skill / command
 * file carries the frontmatter Claude Code requires. Pure file reads.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseFrontmatter } = require("../lib/cc-discovery");

const REPO_ROOT = path.join(__dirname, "..", "..");
const PLUGINS_DIR = path.join(REPO_ROOT, "plugins");
const MARKETPLACE = path.join(REPO_ROOT, ".claude-plugin", "marketplace.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listDirs(p) {
  return fs
    .readdirSync(p, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function listMd(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

describe("plugin marketplace", () => {
  const marketplace = readJson(MARKETPLACE);
  const pluginDirs = listDirs(PLUGINS_DIR).sort();
  const entryNames = marketplace.plugins.map((p) => p.name).sort();

  it("marketplace.json has the required top-level shape", () => {
    assert.equal(typeof marketplace.name, "string");
    assert.ok(marketplace.name.length > 0);
    assert.equal(typeof marketplace.description, "string");
    assert.ok(marketplace.owner && typeof marketplace.owner.name === "string");
    assert.ok(Array.isArray(marketplace.plugins));
  });

  it("ships at least 10 plugins", () => {
    assert.ok(
      marketplace.plugins.length >= 10,
      `expected >=10 marketplace entries, got ${marketplace.plugins.length}`
    );
    assert.ok(pluginDirs.length >= 10, `expected >=10 plugin dirs, got ${pluginDirs.length}`);
  });

  it("marketplace entries and plugin dirs are a bijection", () => {
    assert.deepEqual(
      entryNames,
      pluginDirs,
      `marketplace entries (${entryNames}) must match plugin dirs (${pluginDirs})`
    );
  });

  for (const entry of marketplace.plugins) {
    describe(`entry: ${entry.name}`, () => {
      it("has name, path, description, tags", () => {
        assert.equal(typeof entry.name, "string");
        assert.equal(entry.path, `plugins/${entry.name}`);
        assert.equal(typeof entry.description, "string");
        assert.ok(entry.description.length > 20);
        assert.ok(Array.isArray(entry.tags) && entry.tags.length > 0);
      });

      it("path exists on disk", () => {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.path)));
      });
    });
  }

  for (const dir of pluginDirs) {
    describe(`plugin: ${dir}`, () => {
      const root = path.join(PLUGINS_DIR, dir);
      const manifestPath = path.join(root, ".claude-plugin", "plugin.json");

      it("has a valid plugin.json whose name matches the dir", () => {
        assert.ok(fs.existsSync(manifestPath), `${dir} is missing .claude-plugin/plugin.json`);
        const m = readJson(manifestPath);
        assert.equal(m.name, dir, `${dir}/plugin.json name must equal the dir name`);
        assert.equal(typeof m.description, "string");
        assert.ok(m.description.length > 20);
        assert.equal(typeof m.version, "string");
        assert.ok(m.author && typeof m.author.name === "string");
        assert.equal(typeof m.license, "string");
        assert.ok(Array.isArray(m.keywords) && m.keywords.length > 0);
      });

      it("agents carry valid frontmatter (name === filename, description)", () => {
        const agentsDir = path.join(root, "agents");
        for (const f of listMd(agentsDir)) {
          const { frontmatter } = parseFrontmatter(
            fs.readFileSync(path.join(agentsDir, f), "utf8")
          );
          assert.ok(frontmatter, `${dir}/agents/${f} has no frontmatter`);
          assert.equal(
            frontmatter.name,
            f.replace(/\.md$/, ""),
            `${dir}/agents/${f} frontmatter name must equal the filename`
          );
          assert.ok(frontmatter.description, `${dir}/agents/${f} missing description`);
        }
      });

      it("skills carry a description in SKILL.md frontmatter", () => {
        const skillsDir = path.join(root, "skills");
        let skillDirs = [];
        try {
          skillDirs = listDirs(skillsDir);
        } catch {
          skillDirs = [];
        }
        for (const s of skillDirs) {
          const file = path.join(skillsDir, s, "SKILL.md");
          assert.ok(fs.existsSync(file), `${dir}/skills/${s} is missing SKILL.md`);
          const { frontmatter } = parseFrontmatter(fs.readFileSync(file, "utf8"));
          assert.ok(frontmatter, `${dir}/skills/${s}/SKILL.md has no frontmatter`);
          assert.ok(frontmatter.description, `${dir}/skills/${s}/SKILL.md missing description`);
        }
      });

      it("commands carry a description in frontmatter", () => {
        const cmdDir = path.join(root, "commands");
        for (const f of listMd(cmdDir)) {
          const { frontmatter } = parseFrontmatter(fs.readFileSync(path.join(cmdDir, f), "utf8"));
          assert.ok(frontmatter, `${dir}/commands/${f} has no frontmatter`);
          assert.ok(frontmatter.description, `${dir}/commands/${f} missing description`);
        }
      });

      it("hooks.json (if present) is valid JSON with a hooks object", () => {
        const hooksFile = path.join(root, "hooks", "hooks.json");
        if (!fs.existsSync(hooksFile)) return;
        const h = readJson(hooksFile);
        assert.ok(
          h.hooks && typeof h.hooks === "object",
          `${dir}/hooks/hooks.json needs a hooks object`
        );
      });

      it("contributes at least one skill or agent", () => {
        const skills = (() => {
          try {
            return listDirs(path.join(root, "skills")).length;
          } catch {
            return 0;
          }
        })();
        const agents = listMd(path.join(root, "agents")).length;
        assert.ok(skills + agents > 0, `${dir} contributes no skills or agents`);
      });
    });
  }
});
