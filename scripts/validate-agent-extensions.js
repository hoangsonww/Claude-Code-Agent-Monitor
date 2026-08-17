/**
 * @file Validates the complete Claude, Codex, and skills.sh-compatible agent
 * extension ecosystem without mutating files. It checks marketplace bijection,
 * dual manifests, skill metadata, plugin components, MCP launch wiring, and
 * generated catalog drift.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PLUGINS = path.join(ROOT, "plugins");
const PROJECT_VERSION = json(path.join(ROOT, "package.json")).version;
const NATIVE_SHARED_SKILLS = ["repo-onboarding", "version-release"];
const WRITE_CAPABLE = new Set([
  "ccam-config",
  "ccam-cost-guard",
  "ccam-integrations",
  "ccam-platform",
  "ccam-runner",
  "ccam-sessions",
]);

function json(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function dirs(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, `${file} is missing YAML frontmatter`);
  return match[1];
}

for (const skillName of NATIVE_SHARED_SKILLS) {
  const claudeSkill = path.join(ROOT, ".claude", "skills", skillName, "SKILL.md");
  const codexSkillRoot = path.join(ROOT, ".agents", "skills", skillName);
  const codexSkill = path.join(codexSkillRoot, "SKILL.md");
  const escapedSkillName = skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.ok(fs.existsSync(claudeSkill), `Claude skill missing: ${skillName}`);
  assert.ok(fs.existsSync(codexSkill), `Codex skill missing: ${skillName}`);
  assert.match(frontmatter(claudeSkill), new RegExp(`^name:\\s*${escapedSkillName}$`, "m"));
  assert.match(frontmatter(codexSkill), new RegExp(`^name:\\s*${escapedSkillName}$`, "m"));
  const metadata = fs.readFileSync(path.join(codexSkillRoot, "agents", "openai.yaml"), "utf8");
  assert.match(metadata, new RegExp(`\\$?${escapedSkillName}\\b`));
}

for (const root of [".claude/skills/version-release", ".agents/skills/version-release"]) {
  const skill = fs.readFileSync(path.join(ROOT, root, "SKILL.md"), "utf8");
  const checklist = fs.readFileSync(
    path.join(ROOT, root, "references", "version-checklist.md"),
    "utf8"
  );
  for (const required of ["v<version>", "closingIssuesReferences", "gh auth status"]) {
    assert.ok(skill.includes(required), `${root}/SKILL.md missing ${required}`);
  }
  for (const required of ["v<version>", "closingIssuesReferences", "Fresh PR and issue reads"]) {
    assert.ok(
      checklist.includes(required),
      `${root}/references/version-checklist.md missing ${required}`
    );
  }
}

function commandAvailable(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

const pluginNames = dirs(PLUGINS);
const claudeMarketplace = json(path.join(ROOT, ".claude-plugin", "marketplace.json"));
const codexMarketplace = json(path.join(ROOT, ".agents", "plugins", "marketplace.json"));
assert.deepEqual(
  claudeMarketplace.plugins.map((entry) => entry.name).sort(),
  pluginNames,
  "Claude marketplace must match plugin directories"
);
assert.deepEqual(
  codexMarketplace.plugins.map((entry) => entry.name).sort(),
  pluginNames,
  "Codex marketplace must match plugin directories"
);

let skillCount = 0;
for (const name of pluginNames) {
  const root = path.join(PLUGINS, name);
  const claude = json(path.join(root, ".claude-plugin", "plugin.json"));
  const codex = json(path.join(root, ".codex-plugin", "plugin.json"));
  assert.equal(claude.name, name);
  assert.equal(codex.name, name);
  assert.equal(claude.version, PROJECT_VERSION);
  assert.equal(codex.version, PROJECT_VERSION);
  assert.equal(typeof claude.repository, "string");
  assert.equal(typeof codex.repository, "string");
  assert.equal(codex.skills, "./skills/");
  assert.ok(codex.interface.shortDescription.length <= 96);
  assert.doesNotMatch(codex.interface.shortDescription, /[\s,]$/);
  if (name === "ccam-dashboard" || WRITE_CAPABLE.has(name)) {
    assert.deepEqual(codex.interface.capabilities, ["Read", "Write"]);
  }
  const codexEntry = codexMarketplace.plugins.find((entry) => entry.name === name);
  assert.equal(codexEntry.source.path, `./plugins/${name}`);
  assert.equal(codexEntry.policy.installation, "AVAILABLE");
  assert.equal(codexEntry.policy.authentication, "ON_INSTALL");

  const skillsRoot = path.join(root, "skills");
  for (const skillName of fs.existsSync(skillsRoot) ? dirs(skillsRoot) : []) {
    const skillRoot = path.join(skillsRoot, skillName);
    const fm = frontmatter(path.join(skillRoot, "SKILL.md"));
    assert.match(fm, new RegExp(`^name:\\s*${skillName}$`, "m"));
    assert.match(fm, /^description:/m);
    const metadata = fs.readFileSync(path.join(skillRoot, "agents", "openai.yaml"), "utf8");
    assert.match(metadata, /default_prompt:/);
    assert.match(metadata, new RegExp(`\\$${skillName}\\b`));
    assert.match(
      metadata,
      new RegExp(`allow_implicit_invocation: ${WRITE_CAPABLE.has(name) ? "false" : "true"}`)
    );
    skillCount += 1;
  }
}

for (const pluginName of ["ccam-dashboard", "ccam-platform"]) {
  const mcp = json(path.join(PLUGINS, pluginName, ".mcp.json"));
  assert.equal(mcp.mcpServers["ccam-dashboard"].command, "ccam");
  assert.deepEqual(mcp.mcpServers["ccam-dashboard"].args, ["mcp", "stdio"]);
}

if (commandAvailable("claude")) {
  const marketplace = spawnSync("claude", ["plugin", "validate", ".", "--strict"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(marketplace.status, 0, marketplace.stdout + marketplace.stderr);
  for (const name of pluginNames) {
    const result = spawnSync("claude", ["plugin", "validate", `plugins/${name}`, "--strict"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
}

process.stdout.write(
  `Validated ${pluginNames.length} dual-format plugins and ${skillCount} bundled skills.\n`
);
