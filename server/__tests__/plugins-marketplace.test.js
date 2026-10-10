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
const CODEX_MARKETPLACE = path.join(REPO_ROOT, ".agents", "plugins", "marketplace.json");
const PROJECT_VERSION = readJson(path.join(REPO_ROOT, "package.json")).version;
const COUNTED_DOCS = [
  {
    file: path.join(REPO_ROOT, "README.md"),
    plugin: /\b14 plugins\b/,
    pluginSkills: /\b66 plugin skills\b/,
    repositorySkills: /\b77 total repository skills\b/,
  },
  {
    file: path.join(REPO_ROOT, "README-CN.md"),
    plugin: /14 个共享插件/,
    pluginSkills: /66 个插件技能/,
    repositorySkills: /77 个仓库技能/,
  },
  {
    file: path.join(REPO_ROOT, "README-ES.md"),
    plugin: /14 plugins compartidos/,
    pluginSkills: /66 habilidades empaquetadas/,
    repositorySkills: /77 habilidades/,
  },
  {
    file: path.join(REPO_ROOT, "README-KO.md"),
    plugin: /14개 플러그인/,
    pluginSkills: /66개 번들 스킬/,
    repositorySkills: /77개 스킬/,
  },
  {
    file: path.join(REPO_ROOT, "README-VN.md"),
    plugin: /14 plugin/,
    pluginSkills: /66 skill/,
    repositorySkills: /77 skill/,
  },
  {
    file: path.join(REPO_ROOT, "docs", "PLUGINS.md"),
    plugin: /\b14 plugins\b/,
    pluginSkills: /\b66 bundled plugin skills\b/,
    repositorySkills: /\b77 total repository skills\b/,
  },
  {
    file: path.join(REPO_ROOT, ".codex", "README.md"),
    plugin: /\b14 shared plugins\b/,
    pluginSkills: /\b66 bundled skills\b/,
    repositorySkills: /\b77 repository skills\b/,
  },
];
const WRITE_CAPABLE = new Set([
  "ccam-config",
  "ccam-cost-guard",
  "ccam-integrations",
  "ccam-platform",
  "ccam-runner",
  "ccam-sessions",
]);

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

function addSkillNamesFromDirectory(names, dir) {
  for (const skillDir of listDirs(dir)) {
    const file = path.join(dir, skillDir, "SKILL.md");
    assert.ok(fs.existsSync(file), `${path.relative(REPO_ROOT, file)} must exist`);
    const { frontmatter } = parseFrontmatter(fs.readFileSync(file, "utf8"));
    assert.ok(frontmatter?.name, `${path.relative(REPO_ROOT, file)} must declare a skill name`);
    names.add(frontmatter.name);
  }
}

describe("plugin marketplace", () => {
  const marketplace = readJson(MARKETPLACE);
  const codexMarketplace = readJson(CODEX_MARKETPLACE);
  const pluginDirs = listDirs(PLUGINS_DIR).sort();
  const entryNames = marketplace.plugins.map((p) => p.name).sort();
  const codexEntryNames = codexMarketplace.plugins.map((p) => p.name).sort();

  it("marketplace.json has the required top-level shape", () => {
    assert.equal(typeof marketplace.name, "string");
    assert.ok(marketplace.name.length > 0);
    assert.equal(typeof marketplace.description, "string");
    assert.ok(marketplace.owner && typeof marketplace.owner.name === "string");
    assert.ok(Array.isArray(marketplace.plugins));
  });

  it("ships the complete 14-plugin catalog", () => {
    assert.equal(marketplace.plugins.length, 14);
    assert.equal(pluginDirs.length, 14);
  });

  it("keeps documented marketplace totals in sync with the source tree", () => {
    const pluginSkillCount = pluginDirs.reduce((total, dir) => {
      const skillsDir = path.join(PLUGINS_DIR, dir, "skills");
      return total + (fs.existsSync(skillsDir) ? listDirs(skillsDir).length : 0);
    }, 0);
    const uniqueSkillNames = new Set();
    for (const dir of pluginDirs) {
      addSkillNamesFromDirectory(uniqueSkillNames, path.join(PLUGINS_DIR, dir, "skills"));
    }
    for (const root of [".agents/skills", ".claude/skills", ".codex/skills"]) {
      addSkillNamesFromDirectory(uniqueSkillNames, path.join(REPO_ROOT, root));
    }
    const repositorySkillCount = uniqueSkillNames.size;
    const expected = {
      pluginText: `${pluginDirs.length} plugins`,
      pluginSkillText: `${pluginSkillCount} bundled`,
      repositorySkillText: `${repositorySkillCount} repository skills`,
    };

    assert.equal(pluginSkillCount, 66);
    assert.equal(repositorySkillCount, 77);
    for (const { file, plugin, pluginSkills, repositorySkills } of COUNTED_DOCS) {
      const text = fs.readFileSync(file, "utf8");
      assert.ok(
        plugin.test(text),
        `${path.relative(REPO_ROOT, file)} must mention ${expected.pluginText}`
      );
      assert.ok(
        pluginSkills.test(text),
        `${path.relative(REPO_ROOT, file)} must mention ${expected.pluginSkillText}`
      );
      assert.ok(
        repositorySkills.test(text),
        `${path.relative(REPO_ROOT, file)} must mention ${expected.repositorySkillText}`
      );
    }
  });

  it("marketplace entries and plugin dirs are a bijection", () => {
    assert.deepEqual(
      entryNames,
      pluginDirs,
      `marketplace entries (${entryNames}) must match plugin dirs (${pluginDirs})`
    );
  });

  it("Codex marketplace entries and plugin dirs are a bijection", () => {
    assert.equal(typeof codexMarketplace.name, "string");
    assert.ok(codexMarketplace.interface?.displayName);
    assert.deepEqual(codexEntryNames, pluginDirs);
    for (const entry of codexMarketplace.plugins) {
      assert.equal(entry.source.source, "local");
      assert.equal(entry.source.path, `./plugins/${entry.name}`);
      assert.equal(entry.policy.installation, "AVAILABLE");
      assert.equal(entry.policy.authentication, "ON_INSTALL");
      assert.equal(typeof entry.category, "string");
    }
  });

  for (const entry of marketplace.plugins) {
    describe(`entry: ${entry.name}`, () => {
      it("has name, source, description, tags", () => {
        assert.equal(typeof entry.name, "string");
        assert.equal(entry.source, `./plugins/${entry.name}`);
        assert.equal(typeof entry.description, "string");
        assert.ok(entry.description.length > 20);
        assert.ok(Array.isArray(entry.tags) && entry.tags.length > 0);
      });

      it("path exists on disk", () => {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.source)));
      });
    });
  }

  for (const dir of pluginDirs) {
    describe(`plugin: ${dir}`, () => {
      const root = path.join(PLUGINS_DIR, dir);
      const manifestPath = path.join(root, ".claude-plugin", "plugin.json");
      const codexManifestPath = path.join(root, ".codex-plugin", "plugin.json");

      it("has a valid plugin.json whose name matches the dir", () => {
        assert.ok(fs.existsSync(manifestPath), `${dir} is missing .claude-plugin/plugin.json`);
        const m = readJson(manifestPath);
        assert.equal(m.name, dir, `${dir}/plugin.json name must equal the dir name`);
        assert.equal(typeof m.description, "string");
        assert.ok(m.description.length > 20);
        assert.equal(m.version, PROJECT_VERSION);
        assert.ok(m.author && typeof m.author.name === "string");
        assert.equal(typeof m.repository, "string");
        assert.equal(typeof m.license, "string");
        assert.ok(Array.isArray(m.keywords) && m.keywords.length > 0);
      });

      it("has a valid Codex plugin.json whose name matches the dir", () => {
        assert.ok(fs.existsSync(codexManifestPath), `${dir} is missing .codex-plugin/plugin.json`);
        const manifest = readJson(codexManifestPath);
        assert.equal(manifest.name, dir);
        assert.equal(typeof manifest.description, "string");
        assert.equal(manifest.version, PROJECT_VERSION);
        assert.equal(typeof manifest.repository, "string");
        assert.equal(manifest.skills, "./skills/");
        assert.ok(manifest.interface?.displayName);
        assert.ok(Array.isArray(manifest.interface?.capabilities));
        assert.ok(manifest.interface.shortDescription.length <= 96);
        assert.doesNotMatch(manifest.interface.shortDescription, /[\s,]$/);
        if (manifest.interface.shortDescription.endsWith("...")) {
          assert.match(manifest.interface.shortDescription, /\S\.\.\.$/);
        }
        if (dir === "ccam-dashboard" || WRITE_CAPABLE.has(dir)) {
          assert.deepEqual(manifest.interface.capabilities, ["Read", "Write"]);
        }
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
          assert.equal(frontmatter.name, s, `${dir}/skills/${s} name must match directory`);
          assert.ok(frontmatter.description, `${dir}/skills/${s}/SKILL.md missing description`);
          const openAi = path.join(skillsDir, s, "agents", "openai.yaml");
          assert.ok(fs.existsSync(openAi), `${dir}/skills/${s} missing agents/openai.yaml`);
          const metadata = fs.readFileSync(openAi, "utf8");
          assert.match(metadata, new RegExp(`\\$${s}\\b`));
          assert.match(
            metadata,
            new RegExp(`allow_implicit_invocation: ${WRITE_CAPABLE.has(dir) ? "false" : "true"}`)
          );
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
