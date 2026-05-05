/**
 * @file Read-only viewer routes for Claude Code's installed skills, subagents,
 * plugins, and registered marketplaces. Disabled by default — gated behind
 * ORCHESTRATOR_ENABLED=1 (same flag as the orchestrator surface) so this
 * filesystem-reading endpoint isn't exposed unless the operator opts in.
 *
 * Endpoints are strictly read-only; install/uninstall belongs to a later phase.
 *
 * Layout we read from:
 *   ~/.claude/skills/<name>/SKILL.md         -- user-scoped skills
 *   <project>/.claude/skills/<name>/SKILL.md -- project-scoped skills
 *   ~/.claude/plugins/<plugin>/skills/...    -- plugin-bundled skills
 *   ~/.claude/agents/*.md                    -- user-scoped subagents
 *   <project>/.claude/agents/*.md            -- project-scoped subagents
 *   ~/.claude/plugins/installed_plugins.json -- installed plugin registry
 *   ~/.claude/plugins/known_marketplaces.json -- registered marketplaces
 */

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
const CLAUDE_HOME = process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
const PLUGINS_DIR = path.join(CLAUDE_HOME, "plugins");

// Strict allow-lists to prevent path traversal. `scope` may also include the
// "plugin:<name>" form which we validate separately below.
const SCOPE_RE = /^[A-Za-z0-9_:.-]+$/;
const NAME_RE = /^[A-Za-z0-9_.-]+$/;

// Cap individual SKILL.md reads so a runaway file does not OOM the server.
const MAX_BYTES = 1024 * 1024; // 1 MB

router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "skills routes disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 to enable read-only skills/plugins browse.",
    });
  }
  next();
});

/**
 * Minimal YAML frontmatter parser. Claude Code's SKILL.md / agent .md
 * frontmatter is shallow (string values, no nested objects) so a regex pass is
 * sufficient — we explicitly do not pull in a full YAML dependency for this.
 */
function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return { fm: {}, body: content };
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  const body = content.slice(match[0].length).replace(/^\r?\n/, "");
  return { fm, body };
}

function safeReadFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_BYTES) return null;
    return { content: fs.readFileSync(filePath, "utf8"), size: stat.size, mtime: stat.mtimeMs };
  } catch {
    return null;
  }
}

function listSkillsInDir(dir, scope) {
  if (!fs.existsSync(dir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!NAME_RE.test(entry.name)) continue;
    const skillMd = path.join(dir, entry.name, "SKILL.md");
    const file = safeReadFile(skillMd);
    if (!file) continue;
    const { fm } = parseFrontmatter(file.content);
    skills.push({
      scope,
      id: entry.name,
      name: fm.name || entry.name,
      description: fm.description || "",
      allowedTools: fm["allowed-tools"] || fm.tools || "",
      license: fm.license || "",
      path: skillMd,
      size: file.size,
      mtime: file.mtime,
    });
  }
  return skills;
}

/**
 * Resolve the SKILL.md path for a given (scope, name) pair, validating both.
 */
function resolveSkillPath(scope, name) {
  if (!NAME_RE.test(name)) return { error: "invalid name" };
  let skillsDir;
  if (scope === "user") {
    skillsDir = path.join(CLAUDE_HOME, "skills");
  } else if (scope === "project") {
    skillsDir = path.join(process.cwd(), ".claude", "skills");
  } else if (scope.startsWith("plugin:")) {
    const pluginName = scope.slice("plugin:".length);
    if (!NAME_RE.test(pluginName)) return { error: "invalid plugin name" };
    skillsDir = path.join(PLUGINS_DIR, pluginName, "skills");
  } else {
    return { error: "unknown scope" };
  }
  const skillMd = path.join(skillsDir, name, "SKILL.md");

  // Defense in depth: confirm resolved path is still inside the expected dir.
  const resolved = path.resolve(skillMd);
  const expectedRoot = path.resolve(skillsDir) + path.sep;
  if (!resolved.startsWith(expectedRoot)) return { error: "path traversal blocked" };
  return { path: resolved };
}

// GET /api/skills
router.get("/", (_req, res) => {
  const skills = [];
  skills.push(...listSkillsInDir(path.join(CLAUDE_HOME, "skills"), "user"));
  skills.push(...listSkillsInDir(path.join(process.cwd(), ".claude", "skills"), "project"));

  // Plugin-bundled skills: scan ~/.claude/plugins/<plugin>/skills/.
  if (fs.existsSync(PLUGINS_DIR)) {
    let entries = [];
    try {
      entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!NAME_RE.test(entry.name)) continue;
      const pluginSkillsDir = path.join(PLUGINS_DIR, entry.name, "skills");
      if (!fs.existsSync(pluginSkillsDir)) continue;
      skills.push(...listSkillsInDir(pluginSkillsDir, `plugin:${entry.name}`));
    }
  }

  // Stable order: scope first (user, project, plugin:*), then by id.
  skills.sort((a, b) => {
    if (a.scope === b.scope) return a.id.localeCompare(b.id);
    return a.scope.localeCompare(b.scope);
  });

  res.json({ skills, count: skills.length });
});

// GET /api/skills/agents — listed before parametric route so it does not get shadowed.
router.get("/agents", (_req, res) => {
  const agents = [];
  const sources = [
    ["user", path.join(CLAUDE_HOME, "agents")],
    ["project", path.join(process.cwd(), ".claude", "agents")],
  ];
  for (const [scope, dir] of sources) {
    if (!fs.existsSync(dir)) continue;
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const id = path.basename(file, ".md");
      if (!NAME_RE.test(id)) continue;
      const filePath = path.join(dir, file);
      const data = safeReadFile(filePath);
      if (!data) continue;
      const { fm } = parseFrontmatter(data.content);
      agents.push({
        scope,
        id,
        name: fm.name || id,
        description: fm.description || "",
        tools: fm.tools || "",
        model: fm.model || "",
        color: fm.color || "",
        path: filePath,
        size: data.size,
        mtime: data.mtime,
      });
    }
  }
  agents.sort((a, b) => {
    if (a.scope === b.scope) return a.id.localeCompare(b.id);
    return a.scope.localeCompare(b.scope);
  });
  res.json({ agents, count: agents.length });
});

// GET /api/skills/plugins
router.get("/plugins", (_req, res) => {
  const installedPath = path.join(PLUGINS_DIR, "installed_plugins.json");
  if (!fs.existsSync(installedPath)) {
    return res.json({ plugins: {}, count: 0, path: installedPath });
  }
  let raw;
  try {
    raw = fs.readFileSync(installedPath, "utf8");
  } catch (e) {
    return res.status(500).json({ error: `cannot read installed_plugins.json: ${e.message}` });
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return res
      .status(500)
      .json({ error: "failed to parse installed_plugins.json", detail: e.message });
  }
  // Claude Code uses { version, plugins: { <id>: [...] } } at present, but
  // older versions just stored the registry at the top level. Surface both.
  const registry =
    data && typeof data === "object" && data.plugins && typeof data.plugins === "object"
      ? data.plugins
      : data && typeof data === "object"
        ? data
        : {};
  const count = Object.keys(registry).length;
  res.json({
    plugins: registry,
    count,
    version: data && typeof data === "object" ? data.version : undefined,
    path: installedPath,
  });
});

// GET /api/skills/marketplaces
router.get("/marketplaces", (_req, res) => {
  const mpPath = path.join(PLUGINS_DIR, "known_marketplaces.json");
  if (!fs.existsSync(mpPath)) {
    return res.json({ marketplaces: {}, count: 0, path: mpPath });
  }
  let raw;
  try {
    raw = fs.readFileSync(mpPath, "utf8");
  } catch (e) {
    return res.status(500).json({ error: `cannot read known_marketplaces.json: ${e.message}` });
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return res
      .status(500)
      .json({ error: "failed to parse known_marketplaces.json", detail: e.message });
  }
  const count = data && typeof data === "object" ? Object.keys(data).length : 0;
  res.json({ marketplaces: data || {}, count, path: mpPath });
});

// GET /api/skills/:scope/:name/file
router.get("/:scope/:name/file", (req, res) => {
  const { scope, name } = req.params;
  if (!SCOPE_RE.test(scope)) {
    return res.status(400).json({ error: "invalid scope" });
  }
  const resolved = resolveSkillPath(scope, name);
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  if (!fs.existsSync(resolved.path)) {
    return res.status(404).json({ error: "skill not found" });
  }
  const data = safeReadFile(resolved.path);
  if (!data) return res.status(500).json({ error: "cannot read skill file" });
  const { fm, body } = parseFrontmatter(data.content);
  res.json({
    scope,
    name,
    frontmatter: fm,
    body,
    raw: data.content,
    size: data.size,
    mtime: data.mtime,
    path: resolved.path,
  });
});

module.exports = router;
