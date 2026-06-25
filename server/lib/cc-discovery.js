/**
 * @file cc-discovery.js
 * @description Read-only discovery of Claude Code configuration surfaces
 * (skills, subagents, slash commands, output styles, plugins, marketplaces,
 * MCP servers, hooks, settings, memory, keybindings, statusline, hook
 * scripts). Powers the Claude Config Explorer page. All operations are pure
 * file reads — never writes.
 *
 * Path containment: every read resolves under getClaudeHome(),
 * getProjectClaudeDir(), or getProjectRoot() (for CLAUDE.md). Reads outside
 * those roots return null. Settings are redacted of secret-like keys before
 * returning.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { getClaudeHome } = require("./claude-home");

const MAX_FILE_BYTES = 256 * 1024; // skip reads above this; truncate body in details
const REDACT_KEY_RE = /token|secret|password|api[_-]?key|auth/i;

function getProjectRoot(cwd) {
  return path.resolve(cwd || process.cwd());
}

function getProjectClaudeDir(cwd) {
  return path.join(getProjectRoot(cwd), ".claude");
}

function getClaudeJsonPath() {
  // ~/.claude.json sits beside ~/.claude/, NOT inside it. Resolve from $HOME
  // so a CLAUDE_HOME override doesn't accidentally relocate it.
  return path.join(os.homedir(), ".claude.json");
}

/**
 * True if `target` is contained within `root` (after symlink-aware resolve).
 * Defends the /file endpoint against `..` traversal and absolute-path tricks.
 */
function isUnder(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  if (t === r) return true;
  return t.startsWith(r + path.sep);
}

function readJson(absPath) {
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    return { ok: true, data: JSON.parse(raw), raw };
  } catch (err) {
    if (err && err.code === "ENOENT") return { ok: false, missing: true };
    return { ok: false, error: err.message };
  }
}

function redactSettings(value) {
  if (Array.isArray(value)) return value.map(redactSettings);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && REDACT_KEY_RE.test(k)) {
        out[k] = "<redacted>";
      } else {
        out[k] = redactSettings(v);
      }
    }
    return out;
  }
  return value;
}

/**
 * Minimal YAML-frontmatter parser. Handles `---\n<key>: <value>\n---\n<body>`.
 * Quoted strings (single + double) are stripped; multi-line values are
 * preserved as raw strings. Anything we can't parse is returned as null
 * frontmatter — the body is still readable.
 */
function parseFrontmatter(text) {
  if (typeof text !== "string") return { frontmatter: null, body: "" };
  if (!text.startsWith("---")) return { frontmatter: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: null, body: text };
  const head = text.slice(3, end).replace(/^\s*\n/, "");
  const body = text.slice(end + 4).replace(/^\s*\n/, "");
  const fm = {};
  let currentKey = null;
  for (const rawLine of head.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    // continuation of a multiline value
    if (currentKey && /^\s/.test(rawLine)) {
      fm[currentKey] += "\n" + rawLine.trim();
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) {
      currentKey = null;
      continue;
    }
    currentKey = m[1];
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    fm[currentKey] = v;
  }
  return { frontmatter: fm, body };
}

function safeReadText(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_FILE_BYTES) {
      return {
        truncated: true,
        size: stat.size,
        text: fs.readFileSync(absPath, "utf8").slice(0, MAX_FILE_BYTES),
        mtime: stat.mtimeMs,
      };
    }
    return {
      truncated: false,
      size: stat.size,
      text: fs.readFileSync(absPath, "utf8"),
      mtime: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function listDir(absPath) {
  try {
    return fs.readdirSync(absPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

// ── Skills ──────────────────────────────────────────────────────────────

function readSkillsAt(scope, claudeDir) {
  const dir = path.join(claudeDir, "skills");
  const entries = listDir(dir);
  const skills = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillDir = path.join(dir, ent.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    const read = safeReadText(skillFile);
    if (!read) continue;
    const { frontmatter, body } = parseFrontmatter(read.text);
    skills.push({
      scope,
      name: ent.name,
      path: skillDir,
      file: skillFile,
      size: read.size,
      mtime: read.mtime,
      truncated: read.truncated,
      frontmatter: frontmatter || {},
      preview: body.slice(0, 320),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function readSkills(opts = {}) {
  const out = [];
  if (opts.scope !== "project") {
    out.push(...readSkillsAt("user", getClaudeHome()));
  }
  if (opts.scope !== "user") {
    out.push(...readSkillsAt("project", getProjectClaudeDir(opts.cwd)));
  }
  return out;
}

// ── Single-file MD surfaces (agents, commands, output styles) ──────────

function readMdFilesAt(scope, claudeDir, subdir) {
  const dir = path.join(claudeDir, subdir);
  const entries = listDir(dir);
  const out = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
    const file = path.join(dir, ent.name);
    const read = safeReadText(file);
    if (!read) continue;
    const { frontmatter, body } = parseFrontmatter(read.text);
    out.push({
      scope,
      name: ent.name.replace(/\.md$/, ""),
      file,
      size: read.size,
      mtime: read.mtime,
      truncated: read.truncated,
      frontmatter: frontmatter || {},
      preview: body.slice(0, 320),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function readSimpleMdSurface(subdir) {
  return (opts = {}) => {
    const out = [];
    if (opts.scope !== "project") {
      out.push(...readMdFilesAt("user", getClaudeHome(), subdir));
    }
    if (opts.scope !== "user") {
      out.push(...readMdFilesAt("project", getProjectClaudeDir(opts.cwd), subdir));
    }
    return out;
  };
}

const readAgents = readSimpleMdSurface("agents");
const readCommands = readSimpleMdSurface("commands");
const readOutputStyles = readSimpleMdSurface("output-styles");

// ── Plugins ─────────────────────────────────────────────────────────────

function countMdIn(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function countSkillDirsIn(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => {
      if (!e.isDirectory()) return false;
      try {
        return fs.statSync(path.join(dir, e.name, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}

function readPluginContributions(installPath) {
  if (!installPath) return null;
  let pluginJson = null;
  try {
    const raw = fs.readFileSync(path.join(installPath, ".claude-plugin", "plugin.json"), "utf8");
    pluginJson = JSON.parse(raw);
  } catch {
    pluginJson = null;
  }
  return {
    skills: countSkillDirsIn(path.join(installPath, "skills")),
    agents: countMdIn(path.join(installPath, "agents")),
    commands: countMdIn(path.join(installPath, "commands")),
    outputStyles: countMdIn(path.join(installPath, "output-styles")),
    hooks: (() => {
      try {
        return fs
          .readdirSync(path.join(installPath, "hooks"), { withFileTypes: true })
          .filter((e) => e.isFile()).length;
      } catch {
        return 0;
      }
    })(),
    pluginJson,
  };
}

function readEnabledPluginsMap() {
  const userSettings = readJson(path.join(getClaudeHome(), "settings.json"));
  if (!userSettings.ok || !userSettings.data) return {};
  const ep = userSettings.data.enabledPlugins;
  return ep && typeof ep === "object" ? ep : {};
}

function readPlugins() {
  const home = getClaudeHome();
  const manifestPath = path.join(home, "plugins", "installed_plugins.json");
  const manifest = readJson(manifestPath);
  const enabledMap = readEnabledPluginsMap();
  const plugins = [];
  if (manifest.ok && manifest.data && manifest.data.plugins) {
    for (const [pluginKey, instances] of Object.entries(manifest.data.plugins)) {
      const arr = Array.isArray(instances) ? instances : [instances];
      for (const inst of arr) {
        const installPath = inst.installPath;
        let exists = false;
        try {
          exists = installPath ? fs.statSync(installPath).isDirectory() : false;
        } catch {
          exists = false;
        }
        const contributes = exists ? readPluginContributions(installPath) : null;
        // enabledPlugins map keys can be just the plugin name OR "<name>@<marketplace>"
        const enabledByKey = enabledMap[pluginKey];
        const enabledByName = enabledMap[pluginKey.split("@")[0]];
        const enabled =
          enabledByKey === true || enabledByName === true
            ? true
            : enabledByKey === false || enabledByName === false
              ? false
              : null;
        plugins.push({
          key: pluginKey,
          name: pluginKey.split("@")[0],
          marketplace: pluginKey.includes("@") ? pluginKey.split("@")[1] : null,
          scope: inst.scope || "user",
          version: inst.version || null,
          installPath: installPath || null,
          installedAt: inst.installedAt || null,
          lastUpdated: inst.lastUpdated || null,
          gitCommitSha: inst.gitCommitSha || null,
          installPathExists: exists,
          enabled,
          contributes,
        });
      }
    }
  }
  return {
    manifestPath,
    manifestExists: manifest.ok,
    plugins: plugins.sort((a, b) => a.key.localeCompare(b.key)),
  };
}

// ── MCP servers ────────────────────────────────────────────────────────

function readMcpServers(opts = {}) {
  const out = { user: [], projectScoped: [] };
  // ~/.claude.json is the primary CLI state file; mcpServers can live at the
  // top level (legacy) or inside projects[<cwd>].mcpServers (per-project).
  const claudeJson = readJson(getClaudeJsonPath());
  if (claudeJson.ok && claudeJson.data) {
    const top = claudeJson.data.mcpServers;
    if (top && typeof top === "object") {
      for (const [name, def] of Object.entries(top)) {
        out.user.push({
          name,
          source: "~/.claude.json (top-level)",
          ...summarizeMcpDef(def),
        });
      }
    }
    const projects = claudeJson.data.projects;
    if (projects && typeof projects === "object") {
      const projectRoot = getProjectRoot(opts.cwd);
      const projectEntry = projects[projectRoot];
      if (projectEntry && projectEntry.mcpServers) {
        for (const [name, def] of Object.entries(projectEntry.mcpServers)) {
          out.projectScoped.push({
            name,
            source: `~/.claude.json (projects[${projectRoot}])`,
            ...summarizeMcpDef(def),
          });
        }
      }
    }
  }
  // Also sniff settings.json for an mcpServers key (rare but supported).
  const userSettings = readJson(path.join(getClaudeHome(), "settings.json"));
  if (userSettings.ok && userSettings.data && userSettings.data.mcpServers) {
    for (const [name, def] of Object.entries(userSettings.data.mcpServers)) {
      out.user.push({
        name,
        source: "~/.claude/settings.json",
        ...summarizeMcpDef(def),
      });
    }
  }
  return out;
}

function summarizeMcpDef(def) {
  if (!def || typeof def !== "object") return { kind: "unknown" };
  if (def.url)
    return { kind: "http", url: def.url, headers: def.headers ? Object.keys(def.headers) : [] };
  if (def.command) {
    return {
      kind: "stdio",
      command: def.command,
      args: Array.isArray(def.args) ? def.args : [],
      envNames: def.env && typeof def.env === "object" ? Object.keys(def.env) : [],
    };
  }
  return { kind: "unknown" };
}

// ── Hooks (read across user + project + project-local) ─────────────────

const HOOK_EVENT_TYPES = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "Notification",
  "PreCompact",
];

function readHooks(opts = {}) {
  const sources = [
    { scope: "user", file: path.join(getClaudeHome(), "settings.json") },
    {
      scope: "project",
      file: path.join(getProjectClaudeDir(opts.cwd), "settings.json"),
    },
    {
      scope: "project-local",
      file: path.join(getProjectClaudeDir(opts.cwd), "settings.local.json"),
    },
  ];
  const result = [];
  for (const { scope, file } of sources) {
    const j = readJson(file);
    const entry = { scope, file, exists: j.ok, hooks: {} };
    if (j.ok && j.data && j.data.hooks && typeof j.data.hooks === "object") {
      for (const event of HOOK_EVENT_TYPES) {
        const matchers = j.data.hooks[event];
        if (!Array.isArray(matchers)) continue;
        const flat = [];
        for (const m of matchers) {
          const matcher = m.matcher || "*";
          const list = Array.isArray(m.hooks) ? m.hooks : [];
          for (const h of list) {
            flat.push({
              matcher,
              type: h.type || "command",
              command: h.command || null,
              timeout: h.timeout || null,
            });
          }
        }
        if (flat.length) entry.hooks[event] = flat;
      }
      // Also surface unknown events the user wrote
      for (const [event, matchers] of Object.entries(j.data.hooks)) {
        if (HOOK_EVENT_TYPES.includes(event)) continue;
        if (!Array.isArray(matchers)) continue;
        entry.hooks[event] = matchers;
      }
    }
    result.push(entry);
  }
  return result;
}

// ── Settings ───────────────────────────────────────────────────────────

function readSettings(opts = {}) {
  const sources = [
    { scope: "user", file: path.join(getClaudeHome(), "settings.json") },
    {
      scope: "project",
      file: path.join(getProjectClaudeDir(opts.cwd), "settings.json"),
    },
    {
      scope: "project-local",
      file: path.join(getProjectClaudeDir(opts.cwd), "settings.local.json"),
    },
  ];
  return sources.map(({ scope, file }) => {
    const j = readJson(file);
    if (!j.ok) return { scope, file, exists: false };
    return {
      scope,
      file,
      exists: true,
      data: redactSettings(j.data),
      raw_size: j.raw.length,
    };
  });
}

// ── Marketplaces ───────────────────────────────────────────────────────

function readMarketplaces() {
  const home = getClaudeHome();
  const knownPath = path.join(home, "plugins", "known_marketplaces.json");
  const known = readJson(knownPath);
  const out = [];
  if (known.ok && known.data && typeof known.data === "object") {
    for (const [name, def] of Object.entries(known.data)) {
      const installLocation = def && def.installLocation;
      const sourceDef = def && def.source;
      let pluginCount = null;
      let marketplaceJson = null;
      if (installLocation) {
        try {
          const mfPath = path.join(installLocation, ".claude-plugin", "marketplace.json");
          const raw = fs.readFileSync(mfPath, "utf8");
          marketplaceJson = JSON.parse(raw);
          pluginCount = Array.isArray(marketplaceJson.plugins)
            ? marketplaceJson.plugins.length
            : null;
        } catch {
          /* not all marketplaces have a manifest */
        }
      }
      out.push({
        name,
        source: sourceDef && typeof sourceDef === "object" ? sourceDef : null,
        installLocation: installLocation || null,
        lastUpdated: def && def.lastUpdated ? def.lastUpdated : null,
        pluginCount,
        marketplaceName: marketplaceJson?.name || null,
        marketplaceDescription: marketplaceJson?.description || null,
        marketplaceOwner: marketplaceJson?.owner || null,
      });
    }
  }
  return {
    knownPath,
    knownExists: known.ok,
    items: out.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Keybindings ────────────────────────────────────────────────────────

function readKeybindings() {
  const file = path.join(getClaudeHome(), "keybindings.json");
  const j = readJson(file);
  if (!j.ok) return { file, exists: false };
  const data = j.data && typeof j.data === "object" ? j.data : {};
  const groups = Array.isArray(data.bindings) ? data.bindings : [];
  return {
    file,
    exists: true,
    schema: data.$schema || null,
    docs: data.$docs || null,
    groups: groups.map((g) => ({
      context: g.context || "",
      bindings:
        g.bindings && typeof g.bindings === "object"
          ? Object.entries(g.bindings).map(([key, action]) => ({ key, action: String(action) }))
          : [],
    })),
  };
}

// ── Statusline (config + script content) ──────────────────────────────

function readStatusline() {
  const userSettingsPath = path.join(getClaudeHome(), "settings.json");
  const j = readJson(userSettingsPath);
  const config = j.ok && j.data && j.data.statusLine ? j.data.statusLine : null;
  const candidates = [
    path.join(getClaudeHome(), "statusline.py"),
    path.join(getClaudeHome(), "statusline-command.sh"),
  ];
  const scripts = [];
  for (const file of candidates) {
    const r = safeReadText(file);
    if (r) {
      scripts.push({
        file,
        size: r.size,
        mtime: r.mtime,
        truncated: r.truncated,
        preview: r.text.slice(0, 4000),
      });
    }
  }
  return { config, scripts };
}

// ── Hook handler scripts dir (~/.claude/hooks/) ───────────────────────

function readHookScripts() {
  const dir = path.join(getClaudeHome(), "hooks");
  const entries = listDir(dir);
  return {
    dir,
    items: entries
      .filter((e) => e.isFile())
      .map((e) => {
        const file = path.join(dir, e.name);
        let stat;
        try {
          stat = fs.statSync(file);
        } catch {
          return null;
        }
        return { name: e.name, file, size: stat.size, mtime: stat.mtimeMs };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Memory (CLAUDE.md + per-project file-based memory) ─────────────────

// Index/manifest files inside a memory dir (MEMORY.md, INDEX-*.md) sort
// before the per-fact files so the table-of-contents shows up first.
const MEMORY_INDEX_RE = /^(MEMORY|INDEX)\b/i;

/**
 * Read the two primary CLAUDE.md memory files (user + project) PLUS every
 * markdown file under ~/.claude/projects/<slug>/memory/ — the common
 * community pattern of a file-based agent memory store (a MEMORY.md index
 * plus one file per remembered fact). The latter are emitted with
 * scope "auto-memory" and carry `project` (the projects/<slug> dir name)
 * and `name` (the filename) so the UI can group + label them. They are
 * mutable via cc-mutate's "auto-memory" type (create/edit/delete + backup).
 */
function readMemory(opts = {}) {
  const sources = [
    { scope: "user", file: path.join(getClaudeHome(), "CLAUDE.md") },
    { scope: "project", file: path.join(getProjectRoot(opts.cwd), "CLAUDE.md") },
  ];
  const result = [];
  for (const { scope, file } of sources) {
    const r = safeReadText(file);
    if (!r) continue;
    result.push({
      scope,
      file,
      size: r.size,
      mtime: r.mtime,
      truncated: r.truncated,
      preview: r.text.slice(0, 480),
    });
  }

  // Per-project file-based memory dirs. Best-effort: a missing projects
  // root, an unreadable memory dir, or a single bad file must never break
  // the memory tab — every layer is wrapped so we degrade to "fewer files".
  try {
    const projectsRoot = path.join(getClaudeHome(), "projects");
    for (const proj of fs.readdirSync(projectsRoot)) {
      const memDir = path.join(projectsRoot, proj, "memory");
      let files;
      try {
        files = fs.readdirSync(memDir);
      } catch {
        continue;
      }
      files = files
        .filter((f) => f.endsWith(".md"))
        .sort((a, b) => {
          const rank = (f) => (MEMORY_INDEX_RE.test(f) ? 0 : 1);
          return rank(a) - rank(b) || a.localeCompare(b);
        });
      for (const f of files) {
        const file = path.join(memDir, f);
        const r = safeReadText(file);
        if (!r) continue;
        // Per-fact memory files commonly carry YAML frontmatter (name,
        // description, metadata.type) — parse it like the other MD surfaces
        // so the UI can show a clean title + description instead of raw text.
        const { frontmatter, body } = parseFrontmatter(r.text);
        result.push({
          scope: "auto-memory",
          project: proj,
          name: f,
          isIndex: MEMORY_INDEX_RE.test(f),
          file,
          size: r.size,
          mtime: r.mtime,
          truncated: r.truncated,
          frontmatter: frontmatter || {},
          preview: (body || r.text).slice(0, 480),
        });
      }
    }
  } catch {
    /* best-effort: never break the memory tab */
  }

  return result;
}

// ── Single-file body endpoint (with strict path containment) ───────────

function readFileSafe(absPath, opts = {}) {
  const allowedRoots = [
    getClaudeHome(),
    getProjectClaudeDir(opts.cwd),
    getProjectRoot(opts.cwd), // for CLAUDE.md only — caller must pass exact name
  ];
  const resolved = path.resolve(absPath);
  const inside = allowedRoots.some((root) => isUnder(root, resolved));
  if (!inside) return { error: "path is outside allowed roots" };
  // Extra guard: under project root we only allow CLAUDE.md (avoid leaking
  // arbitrary repo files via this endpoint).
  if (
    isUnder(getProjectRoot(opts.cwd), resolved) &&
    !isUnder(getProjectClaudeDir(opts.cwd), resolved) &&
    path.basename(resolved) !== "CLAUDE.md"
  ) {
    return { error: "only CLAUDE.md is readable from project root" };
  }
  const r = safeReadText(resolved);
  if (!r) return { error: "file not readable" };
  return { ok: true, file: resolved, ...r };
}

// ── Overview (counts + roots) ──────────────────────────────────────────

function readOverview(opts = {}) {
  const skills = readSkills(opts);
  const agents = readAgents(opts);
  const commands = readCommands(opts);
  const outputStyles = readOutputStyles(opts);
  const plugins = readPlugins();
  const mcp = readMcpServers(opts);
  const hooks = readHooks(opts);
  const settings = readSettings(opts);
  const memory = readMemory(opts);
  const marketplaces = readMarketplaces();
  const keybindings = readKeybindings();

  const countByScope = (arr) => ({
    user: arr.filter((x) => x.scope === "user").length,
    project: arr.filter((x) => x.scope === "project").length,
  });

  const enabledPlugins = plugins.plugins.filter((p) => p.enabled === true).length;
  const disabledPlugins = plugins.plugins.filter((p) => p.enabled === false).length;
  const keybindingTotal = keybindings.exists
    ? keybindings.groups.reduce((n, g) => n + g.bindings.length, 0)
    : 0;

  return {
    roots: {
      claudeHome: getClaudeHome(),
      projectClaudeDir: getProjectClaudeDir(opts.cwd),
      projectRoot: getProjectRoot(opts.cwd),
      claudeJson: getClaudeJsonPath(),
    },
    counts: {
      skills: countByScope(skills),
      agents: countByScope(agents),
      commands: countByScope(commands),
      outputStyles: countByScope(outputStyles),
      plugins: plugins.plugins.length,
      pluginsEnabled: enabledPlugins,
      pluginsDisabled: disabledPlugins,
      marketplaces: marketplaces.items.length,
      keybindings: keybindingTotal,
      mcpServers: { user: mcp.user.length, project: mcp.projectScoped.length },
      hooks: hooks.reduce(
        (acc, src) => {
          acc[src.scope] = Object.values(src.hooks).reduce(
            (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
            0
          );
          return acc;
        },
        { user: 0, project: 0, "project-local": 0 }
      ),
      memory: memory.length,
      settingsFiles: settings.filter((s) => s.exists).length,
    },
  };
}

module.exports = {
  // surface readers
  readSkills,
  readAgents,
  readCommands,
  readOutputStyles,
  readPlugins,
  readMcpServers,
  readHooks,
  readSettings,
  readMemory,
  readMarketplaces,
  readKeybindings,
  readStatusline,
  readHookScripts,
  readOverview,
  readFileSafe,
  // helpers exported for tests
  parseFrontmatter,
  redactSettings,
  isUnder,
  MAX_FILE_BYTES,
  HOOK_EVENT_TYPES,
};
