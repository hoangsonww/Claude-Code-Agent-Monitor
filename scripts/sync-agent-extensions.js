/**
 * @file Synchronizes cross-agent plugin and skill metadata from the bundled
 * Claude plugin source of truth. It adds missing canonical skill names,
 * generates OpenAI skill UI metadata and Codex plugin manifests, and rebuilds
 * the Claude and Codex marketplace catalogs deterministically.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PLUGINS_DIR = path.join(ROOT, "plugins");
const CLAUDE_MARKETPLACE = path.join(ROOT, ".claude-plugin", "marketplace.json");
const CODEX_MARKETPLACE = path.join(ROOT, ".agents", "plugins", "marketplace.json");
const REPOSITORY = "https://github.com/hoangsonww/Claude-Code-Agent-Monitor";
const PLUGIN_VERSION = readJson(path.join(ROOT, "package.json")).version;
const AUTHOR = {
  name: "Son Nguyen",
  email: "hoangson091104@gmail.com",
  url: "https://github.com/hoangsonww",
};

const CATEGORY_BY_PLUGIN = {
  "ccam-analytics": "Productivity",
  "ccam-config": "Developer Tools",
  "ccam-cost-guard": "Productivity",
  "ccam-dashboard": "Developer Tools",
  "ccam-devtools": "Developer Tools",
  "ccam-insights": "Productivity",
  "ccam-integrations": "Developer Tools",
  "ccam-platform": "Developer Tools",
  "ccam-productivity": "Productivity",
  "ccam-quality": "Developer Tools",
  "ccam-reports": "Productivity",
  "ccam-runner": "Productivity",
  "ccam-sessions": "Developer Tools",
  "ccam-workflows": "Productivity",
};

const WRITE_CAPABLE = new Set([
  "ccam-config",
  "ccam-cost-guard",
  "ccam-integrations",
  "ccam-platform",
  "ccam-runner",
  "ccam-sessions",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isUnder(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeWritePath(file) {
  const target = path.resolve(file);
  if (!isUnder(ROOT, target)) throw new Error(`Refusing to write outside repository root: ${file}`);
  const relative = path.relative(ROOT, target);
  let current = ROOT;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing to write through symbolic link: ${current}`);
    }
  }
  let ancestor = path.dirname(target);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!isUnder(fs.realpathSync(ROOT), fs.realpathSync(ancestor))) {
    throw new Error(`Refusing to write through a path outside repository root: ${file}`);
  }
}

function safeWriteFile(file, contents) {
  assertSafeWritePath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertSafeWritePath(file);
  fs.writeFileSync(file, contents);
}

function truncateWords(value, maxLength) {
  if (value.length <= maxLength) return value;
  const contentLimit = Math.max(1, maxLength - 3);
  const candidate = value.slice(0, contentLimit + 1);
  const boundary = candidate
    .slice(0, contentLimit)
    .replace(/\s+\S*$/, "")
    .trimEnd();
  const prefix = boundary || value.slice(0, contentLimit).trimEnd();
  return `${prefix}...`;
}

async function writeJson(file, value) {
  const prettier = require("prettier");
  const prettierConfig = (await prettier.resolveConfig(file)) || {};
  safeWriteFile(
    file,
    await prettier.format(JSON.stringify(value), {
      ...prettierConfig,
      parser: "json",
      filepath: file,
    })
  );
}

function listDirs(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function titleCase(value) {
  return value
    .replace(/^ccam-/, "CCAM ")
    .split(/[-_ ]+/)
    .map((word) => (word === "ccam" ? "CCAM" : `${word[0]?.toUpperCase() || ""}${word.slice(1)}`))
    .join(" ");
}

function parseFrontmatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`${file} has no YAML frontmatter`);
  return match[1];
}

function descriptionFromFrontmatter(frontmatter, file) {
  const folded = frontmatter.match(/^description:\s*[>|]-?\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (folded) {
    return folded[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  const inline = frontmatter.match(/^description:\s*(.+)$/m);
  if (inline) return inline[1].trim().replace(/^["']|["']$/g, "");
  throw new Error(`${file} has no description`);
}

function ensureSkillName(file, expectedName) {
  const text = fs.readFileSync(file, "utf8");
  const frontmatter = parseFrontmatter(text, file);
  const found = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (found && found !== expectedName) {
    throw new Error(`${file} declares name ${found}, expected ${expectedName}`);
  }
  if (found) return text;
  const next = text.replace(/^---\r?\n/, `---\nname: ${expectedName}\n`);
  safeWriteFile(file, next);
  return next;
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function writeSkillMetadata(skillDir, name, description) {
  const summary = truncateWords(description, 64);
  const pluginName = path.relative(PLUGINS_DIR, skillDir).split(path.sep)[0];
  const allowImplicitInvocation = !WRITE_CAPABLE.has(pluginName);
  const metadata = [
    "interface:",
    `  display_name: ${yamlQuote(titleCase(name))}`,
    `  short_description: ${yamlQuote(summary)}`,
    `  default_prompt: ${yamlQuote(`Use $${name} to inspect CCAM data and complete this workflow safely.`)}`,
    "policy:",
    `  allow_implicit_invocation: ${allowImplicitInvocation}`,
    "",
  ].join("\n");
  const target = path.join(skillDir, "agents", "openai.yaml");
  safeWriteFile(target, metadata);
}

function countPluginComponents(pluginRoot) {
  const countFiles = (directory, suffix) => {
    if (!fs.existsSync(directory)) return 0;
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix)).length;
  };
  const skillsDir = path.join(pluginRoot, "skills");
  return {
    skills: fs.existsSync(skillsDir) ? listDirs(skillsDir).length : 0,
    agents: countFiles(path.join(pluginRoot, "agents"), ".md"),
    commands: countFiles(path.join(pluginRoot, "commands"), ".md"),
    cliTools: countFiles(path.join(pluginRoot, "bin"), ""),
    hooks: fs.existsSync(path.join(pluginRoot, "hooks", "hooks.json")) ? 1 : 0,
    mcp: fs.existsSync(path.join(pluginRoot, ".mcp.json")) ? 1 : 0,
  };
}

function codexManifest(name, claudeManifest, pluginRoot) {
  const category = CATEGORY_BY_PLUGIN[name] || "Developer Tools";
  const manifest = {
    name,
    version: claudeManifest.version || "1.0.0",
    description: claudeManifest.description,
    author: AUTHOR,
    homepage: claudeManifest.homepage || REPOSITORY,
    repository: REPOSITORY,
    license: claudeManifest.license || "MIT",
    keywords: claudeManifest.keywords || [],
    skills: "./skills/",
  };
  if (fs.existsSync(path.join(pluginRoot, ".mcp.json"))) {
    manifest.mcpServers = "./.mcp.json";
  }
  manifest.interface = {
    displayName: titleCase(name),
    shortDescription: truncateWords(claudeManifest.description, 96),
    longDescription: claudeManifest.description,
    developerName: AUTHOR.name,
    category,
    capabilities:
      WRITE_CAPABLE.has(name) || name === "ccam-dashboard" ? ["Read", "Write"] : ["Read"],
    websiteURL: REPOSITORY,
    defaultPrompt: [
      `Use ${titleCase(name)} to inspect the local CCAM dashboard.`,
      `Use ${titleCase(name)} to analyze recent agent activity.`,
    ],
    brandColor: "#6366F1",
  };
  return manifest;
}

async function sync() {
  const originalMarketplace = readJson(CLAUDE_MARKETPLACE);
  const originalEntries = new Map(originalMarketplace.plugins.map((entry) => [entry.name, entry]));
  const pluginNames = listDirs(PLUGINS_DIR);
  const claudeEntries = [];
  const codexEntries = [];
  const totals = { plugins: 0, skills: 0, agents: 0, commands: 0, cliTools: 0, hooks: 0, mcp: 0 };

  for (const name of pluginNames) {
    const pluginRoot = path.join(PLUGINS_DIR, name);
    const claudeManifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
    if (!fs.existsSync(claudeManifestPath)) {
      throw new Error(`${name} is missing .claude-plugin/plugin.json`);
    }
    const claudeManifest = readJson(claudeManifestPath);
    if (claudeManifest.name !== name) {
      throw new Error(`${claudeManifestPath} name must equal ${name}`);
    }
    claudeManifest.version = PLUGIN_VERSION;
    claudeManifest.repository =
      typeof claudeManifest.repository === "string"
        ? claudeManifest.repository.replace(/\.git$/, "")
        : REPOSITORY;
    delete claudeManifest.categories;
    claudeManifest.skills = "./skills/";
    if (fs.existsSync(path.join(pluginRoot, ".mcp.json"))) {
      claudeManifest.mcpServers = "./.mcp.json";
    }
    if (fs.existsSync(path.join(pluginRoot, "hooks", "hooks.json"))) {
      claudeManifest.hooks = "./hooks/hooks.json";
    }
    await writeJson(claudeManifestPath, claudeManifest);

    const skillsDir = path.join(pluginRoot, "skills");
    if (fs.existsSync(skillsDir)) {
      for (const skillName of listDirs(skillsDir)) {
        const skillDir = path.join(skillsDir, skillName);
        const skillFile = path.join(skillDir, "SKILL.md");
        if (!fs.existsSync(skillFile)) throw new Error(`${skillDir} is missing SKILL.md`);
        const text = ensureSkillName(skillFile, skillName);
        writeSkillMetadata(
          skillDir,
          skillName,
          descriptionFromFrontmatter(parseFrontmatter(text, skillFile), skillFile)
        );
      }
    }

    await writeJson(
      path.join(pluginRoot, ".codex-plugin", "plugin.json"),
      codexManifest(name, claudeManifest, pluginRoot)
    );

    const counts = countPluginComponents(pluginRoot);
    totals.plugins += 1;
    for (const key of ["skills", "agents", "commands", "cliTools", "hooks", "mcp"]) {
      totals[key] += counts[key];
    }

    const original = originalEntries.get(name);
    claudeEntries.push({
      name,
      source: `./plugins/${name}`,
      description: claudeManifest.description,
      tags: original?.tags || claudeManifest.keywords?.slice(0, 6) || ["ccam"],
    });
    codexEntries.push({
      name,
      source: { source: "local", path: `./plugins/${name}` },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: CATEGORY_BY_PLUGIN[name] || "Developer Tools",
    });
  }

  await writeJson(CLAUDE_MARKETPLACE, {
    name: originalMarketplace.name,
    description: `Official Claude Code plugin marketplace for CCAM with ${totals.plugins} plugins, ${totals.skills} skills, ${totals.agents} agents, ${totals.commands} commands, and comprehensive local dashboard operations.`,
    owner: originalMarketplace.owner,
    plugins: claudeEntries,
  });
  await writeJson(CODEX_MARKETPLACE, {
    name: "claude-code-agent-monitor-plugins",
    interface: { displayName: "Claude Code Agent Monitor" },
    plugins: codexEntries,
  });

  process.stdout.write(`${JSON.stringify(totals, null, 2)}\n`);
}

sync().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
