/**
 * @file Discovery helpers for the local Codex configuration explorer. They
 * enumerate safe metadata, account-visible model catalogs, installed-plugin
 * state, and redacted file previews beneath CODEX_HOME; a separate tightly
 * scoped mutation helper owns edits.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { getCodexHome } = require("./codex-home");

const MAX_FILE_BYTES = 256 * 1024;
// The model cache carries model instructions and can legitimately exceed the
// editor/preview cap. We parse a bounded local copy and return only its small,
// safe metadata fields to the browser.
const MAX_MODEL_CATALOG_BYTES = 4 * 1024 * 1024;
const SENSITIVE_KEY = /(token|secret|password|api[_-]?key|bearer|credential|private[_-]?key)/i;
const PROFILE_NAME_RE = /^[A-Za-z0-9_-]+$/;
const PROFILE_SUFFIX = ".config.toml";

function stat(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}
function list(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
function safeRead(file) {
  const meta = stat(file);
  if (!meta?.isFile()) return null;
  try {
    const body = fs.readFileSync(file, "utf8");
    return {
      path: file,
      text: body.slice(0, MAX_FILE_BYTES),
      size: meta.size,
      mtime: meta.mtimeMs,
      truncated: meta.size > MAX_FILE_BYTES,
    };
  } catch {
    return null;
  }
}
function readBoundedJson(file, maxBytes = MAX_MODEL_CATALOG_BYTES) {
  const meta = stat(file);
  if (!meta?.isFile() || meta.size > maxBytes) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function redactToml(text) {
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*([^=\s]+)\s*=\s*)(.*)$/);
      return match && SENSITIVE_KEY.test(match[2]) ? `${match[1]}"[redacted]"` : line;
    })
    .join("\n");
}
function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : redactJson(item),
    ])
  );
}
function relativeToAllowed(file) {
  const home = getCodexHome();
  const resolved = path.resolve(file);
  const projectInstructions = path.resolve(process.cwd(), "AGENTS.md");
  if (resolved !== projectInstructions && !resolved.startsWith(`${home}${path.sep}`)) return null;
  try {
    const canonical = fs.realpathSync(resolved);
    const canonicalHome = fs.realpathSync(home);
    const canonicalInstructions = fs.existsSync(projectInstructions)
      ? fs.realpathSync(projectInstructions)
      : projectInstructions;
    if (
      canonical === canonicalInstructions ||
      canonical === canonicalHome ||
      canonical.startsWith(`${canonicalHome}${path.sep}`)
    ) {
      return canonical;
    }
  } catch {
    return null;
  }
  return null;
}
function summary(file) {
  const meta = stat(file);
  return {
    path: file,
    exists: Boolean(meta?.isFile()),
    size: meta?.size || 0,
    mtime: meta?.mtimeMs || null,
  };
}
function configLines() {
  const file = path.join(getCodexHome(), "config.toml");
  return { file, read: safeRead(file) };
}
function tomlScalar(lines, key) {
  const match = lines.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n#]+)`, "m"));
  return match ? match[1].trim() : null;
}
function tableNames(text, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*\\[${escaped}\\.([^\\]]+)\\]\\s*$`, "gm");
  return Array.from(text.matchAll(re), (match) => match[1]);
}
function readMcp(text) {
  const names = tableNames(text, "mcp_servers").filter((name) => !name.includes(".tools."));
  return names.map((name) => {
    const start = text.indexOf(`[mcp_servers.${name}]`);
    const next = text.indexOf("\n[", start + 1);
    const block = text.slice(start, next < 0 ? text.length : next);
    return {
      name,
      command: tomlScalar(block, "command"),
      url: tomlScalar(block, "url"),
      enabled: tomlScalar(block, "enabled") !== "false",
      envNames: Array.from(
        block.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$?\{?([A-Z][A-Z0-9_]+)/g),
        (match) => match[2]
      ),
    };
  });
}
function readProjects(text) {
  return tableNames(text, "projects").map((name) => {
    const value = name.replace(/^"|"$/g, "");
    return { path: value, name: path.basename(value) || value };
  });
}
function modelId(model) {
  for (const key of ["slug", "id", "model", "name"]) {
    if (typeof model?.[key] === "string" && model[key].trim()) return model[key].trim();
  }
  return null;
}
function catalogEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["models", "items", "data"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}
function normalizeModel(model, source) {
  const id = modelId(model);
  if (!id) return null;
  const visibility = String(model.visibility || "").toLowerCase();
  return {
    id,
    name:
      (typeof model.display_name === "string" && model.display_name) ||
      (typeof model.displayName === "string" && model.displayName) ||
      id,
    description:
      (typeof model.description === "string" && model.description) ||
      (typeof model.summary === "string" && model.summary) ||
      null,
    defaultEffort:
      (typeof model.default_reasoning_level === "string" && model.default_reasoning_level) ||
      (typeof model.defaultReasoningEffort === "string" && model.defaultReasoningEffort) ||
      null,
    efforts: Array.isArray(model.supported_reasoning_levels)
      ? model.supported_reasoning_levels.map((entry) => entry?.effort || entry).filter(Boolean)
      : Array.isArray(model.reasoning_efforts)
        ? model.reasoning_efforts.filter((entry) => typeof entry === "string")
        : [],
    contextWindow:
      (typeof model.context_window === "number" && model.context_window) ||
      (typeof model.contextWindow === "number" && model.contextWindow) ||
      null,
    visible: visibility !== "hidden" && visibility !== "hide",
    sources: [source],
    baseDefault: false,
    profiles: [],
    providers: [],
  };
}
function mergeModel(models, item) {
  const existing = models.get(item.id);
  if (!existing) {
    models.set(item.id, item);
    return item;
  }
  for (const source of item.sources || []) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
  }
  for (const profile of item.profiles || []) {
    if (!existing.profiles.includes(profile)) existing.profiles.push(profile);
  }
  for (const provider of item.providers || []) {
    if (!existing.providers.includes(provider)) existing.providers.push(provider);
  }
  existing.baseDefault ||= Boolean(item.baseDefault);
  existing.visible ||= item.visible;
  existing.description ||= item.description;
  existing.defaultEffort ||= item.defaultEffort;
  existing.contextWindow ||= item.contextWindow;
  if (!existing.efforts.length && item.efforts.length) existing.efforts = item.efforts;
  return existing;
}
function catalogPath(raw, home) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(home, raw);
}
function addCatalog(models, file, source) {
  const parsed = readBoundedJson(file);
  for (const entry of catalogEntries(parsed)) {
    const item = normalizeModel(entry, source);
    if (item) mergeModel(models, item);
  }
}
function addConfiguredModel(models, id, { baseDefault = false, profile = null, provider = null }) {
  if (typeof id !== "string" || !id.trim()) return;
  const item = mergeModel(models, {
    id: id.trim(),
    name: id.trim(),
    description: null,
    defaultEffort: null,
    efforts: [],
    contextWindow: null,
    visible: true,
    sources: ["configured"],
    baseDefault,
    profiles: profile ? [profile] : [],
    providers: provider ? [provider] : [],
  });
  item.baseDefault ||= baseDefault;
}
function readModels(home, config, profiles) {
  const file = path.join(home, "models_cache.json");
  const parsed = readBoundedJson(file);
  const models = new Map();
  for (const entry of catalogEntries(parsed)) {
    const item = normalizeModel(entry, "account");
    if (item) mergeModel(models, item);
  }
  const defaultProvider = tomlScalar(config, "model_provider");
  addConfiguredModel(models, tomlScalar(config, "model"), {
    baseDefault: true,
    provider: defaultProvider,
  });
  addCatalog(models, catalogPath(tomlScalar(config, "model_catalog_json"), home), "custom");
  for (const profile of profiles) {
    addConfiguredModel(models, profile.model, {
      profile: profile.name,
      provider: profile.provider,
    });
    addCatalog(models, catalogPath(profile.modelCatalog, home), "custom");
  }
  return {
    file,
    fetchedAt: typeof parsed?.fetched_at === "string" ? parsed.fetched_at : null,
    items: Array.from(models.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
function profileNameFromPath(file) {
  const base = path.basename(file);
  if (!base.endsWith(PROFILE_SUFFIX)) return null;
  const name = base.slice(0, -PROFILE_SUFFIX.length);
  return PROFILE_NAME_RE.test(name) ? name : null;
}
function readProfiles(home) {
  return list(home)
    .filter(
      (entry) =>
        entry.isFile() &&
        PROFILE_NAME_RE.test(entry.name.slice(0, -PROFILE_SUFFIX.length)) &&
        entry.name.endsWith(PROFILE_SUFFIX)
    )
    .map((entry) => {
      const file = path.join(home, entry.name);
      const read = safeRead(file);
      const text = read?.text || "";
      return {
        ...summary(file),
        name: profileNameFromPath(file),
        model: tomlScalar(text, "model"),
        reasoningEffort: tomlScalar(text, "model_reasoning_effort"),
        approvalPolicy: tomlScalar(text, "approval_policy"),
        sandboxMode: tomlScalar(text, "sandbox_mode"),
        serviceTier: tomlScalar(text, "service_tier"),
        modelCatalog: tomlScalar(text, "model_catalog_json"),
        provider: tomlScalar(text, "model_provider"),
      };
    })
    .filter((profile) => profile.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}
function readSkills(home) {
  const base = path.join(home, "skills");
  return list(base)
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(base, entry.name, "SKILL.md");
      const read = safeRead(file);
      return read
        ? {
            name: entry.name,
            file,
            preview: read.text.replace(/^---[\s\S]*?---\s*/, "").slice(0, 260),
            mtime: read.mtime,
          }
        : null;
    })
    .filter(Boolean);
}
function readRules(home) {
  const base = path.join(home, "rules");
  return list(base)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".rules"))
    .map((entry) => {
      const file = path.join(base, entry.name);
      const read = safeRead(file);
      return {
        name: entry.name,
        file,
        preview: read?.text.slice(0, 260) || "",
        mtime: read?.mtime || null,
      };
    });
}
function readHooks(home) {
  const file = path.join(home, "hooks.json");
  const read = safeRead(file);
  if (!read) return { file, exists: false, items: [] };
  try {
    const hooks = JSON.parse(read.text)?.hooks;
    return {
      file,
      exists: true,
      items:
        hooks && typeof hooks === "object"
          ? Object.entries(hooks).map(([event, groups]) => ({
              event,
              groups: Array.isArray(groups) ? groups.length : 0,
            }))
          : [],
    };
  } catch {
    return { file, exists: true, items: [] };
  }
}

function readJson(file) {
  const read = safeRead(file);
  if (!read || read.truncated) return null;
  try {
    return JSON.parse(read.text);
  } catch {
    return null;
  }
}

function titleCase(value) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pluginKey(name, marketplace) {
  return `${name}@${marketplace}`.toLowerCase();
}

function pluginIdParts(id) {
  const at = id.lastIndexOf("@");
  if (at <= 0 || at === id.length - 1) return null;
  return { name: id.slice(0, at), marketplace: id.slice(at + 1) };
}

function pluginManifest(file, marketplace, installPath) {
  const manifest = readJson(file);
  if (!manifest || typeof manifest.name !== "string") return null;
  const ui = manifest.interface && typeof manifest.interface === "object" ? manifest.interface : {};
  return {
    id: pluginKey(manifest.name, marketplace),
    name: manifest.name,
    displayName: typeof ui.displayName === "string" ? ui.displayName : titleCase(manifest.name),
    description:
      typeof ui.shortDescription === "string"
        ? ui.shortDescription
        : typeof manifest.description === "string"
          ? manifest.description
          : null,
    marketplace,
    marketplaceLabel: titleCase(marketplace),
    version: typeof manifest.version === "string" ? manifest.version : null,
    installPath,
  };
}

/**
 * Codex stores downloaded plugin manifests below `plugins/cache`, but cache is
 * an implementation detail, not a plugin. This function only returns actual
 * manifests at the leaf directories, never a cache/marketplace folder.
 */
function cachedPluginManifests(home) {
  const cache = path.join(home, "plugins", "cache");
  const items = [];
  for (const marketplaceEntry of list(cache)) {
    if (!marketplaceEntry.isDirectory() || marketplaceEntry.name.startsWith(".")) continue;
    const marketplace = marketplaceEntry.name;
    const marketplaceDir = path.join(cache, marketplace);
    for (const pluginEntry of list(marketplaceDir)) {
      if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith(".")) continue;
      const pluginDir = path.join(marketplaceDir, pluginEntry.name);
      for (const versionEntry of list(pluginDir)) {
        if (!versionEntry.isDirectory() || versionEntry.name.startsWith(".")) continue;
        const installPath = path.join(pluginDir, versionEntry.name);
        const item = pluginManifest(
          path.join(installPath, ".codex-plugin", "plugin.json"),
          marketplace,
          installPath
        );
        if (item) items.push(item);
      }
    }
  }
  return items;
}

function pluginTables(text) {
  const starts = Array.from(text.matchAll(/^\s*\[plugins\.(?:"([^"]+)"|([^\]]+))\]\s*$/gm));
  return starts
    .map((match, index) => {
      const id = (match[1] || match[2] || "").trim();
      const parts = pluginIdParts(id);
      if (!parts) return null;
      const start = (match.index || 0) + match[0].length;
      const next = starts[index + 1]?.index ?? text.length;
      const block = text.slice(start, next);
      return {
        ...parts,
        enabled: !/^\s*enabled\s*=\s*false\b/m.test(block),
      };
    })
    .filter(Boolean);
}

function parsePluginList(stdout) {
  const plugins = [];
  for (const line of stdout.split("\n")) {
    const match = line.match(
      /^\s*(\S+@\S+)\s{2,}installed(?:,\s*(enabled|disabled))?\s{2,}(\S+)\s{2,}(.+?)\s*$/i
    );
    if (!match) continue;
    const parts = pluginIdParts(match[1]);
    if (!parts) continue;
    plugins.push({
      ...parts,
      enabled: match[2] !== "disabled",
      version: match[3] || null,
      installPath: match[4] || null,
    });
  }
  return plugins;
}

/**
 * `codex plugin list` is the CLI's authoritative installation registry. The
 * cache is used only to enrich entries with presentation metadata, and only
 * when the CLI is unavailable do we fall back to configured/cache records.
 */
function installedPluginsFromCli(home) {
  if (process.env.DASHBOARD_DISABLE_CODEX_PLUGIN_CLI === "1") return [];
  try {
    return parsePluginList(
      execFileSync("codex", ["plugin", "list"], {
        encoding: "utf8",
        timeout: 4_000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, CODEX_HOME: home },
      })
    );
  } catch {
    return [];
  }
}

function readPlugins(home, configText) {
  const manifests = cachedPluginManifests(home);
  const manifestsById = new Map(manifests.map((item) => [item.id, item]));
  const manifestsByName = new Map();
  for (const manifest of manifests) {
    if (!manifestsByName.has(manifest.name)) manifestsByName.set(manifest.name, manifest);
  }
  const cliItems = installedPluginsFromCli(home);
  const configured = pluginTables(configText);
  const installed = cliItems.length ? cliItems : configured;

  const result = new Map();
  for (const item of installed) {
    const key = pluginKey(item.name, item.marketplace);
    const fromCache = manifestsById.get(key) || manifestsByName.get(item.name) || null;
    let fromInstall = null;
    if (item.installPath) {
      fromInstall = pluginManifest(
        path.join(item.installPath, ".codex-plugin", "plugin.json"),
        item.marketplace,
        item.installPath
      );
    }
    const metadata = fromInstall || fromCache;
    result.set(key, {
      id: key,
      name: item.name,
      displayName: metadata?.displayName || titleCase(item.name),
      description: metadata?.description || null,
      marketplace: item.marketplace,
      marketplaceLabel: titleCase(item.marketplace),
      version: item.version || metadata?.version || null,
      enabled: item.enabled,
    });
  }

  // Remote curated installs are managed separately from config.toml. Their
  // marker is written only once Codex installs them, so it is a reliable
  // fallback for an unavailable/older CLI. When `plugin list` works we leave
  // it authoritative rather than mixing stale downloaded cache entries in.
  if (!cliItems.length) {
    for (const manifest of manifests) {
      const pluginDir = path.dirname(manifest.installPath);
      const remoteMarker = path.join(pluginDir, ".codex-remote-plugin-install.json");
      if (!stat(remoteMarker)?.isFile()) continue;
      const alreadyInstalled = Array.from(result.values()).some(
        (item) => item.name === manifest.name
      );
      if (alreadyInstalled) continue;
      result.set(manifest.id, { ...manifest, enabled: true });
    }
  }
  return Array.from(result.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
function readInstructions(home) {
  return [path.join(home, "AGENTS.md"), path.join(process.cwd(), "AGENTS.md")]
    .map((file) => {
      const read = safeRead(file);
      return read
        ? {
            path: file,
            name: path.basename(file),
            preview: read.text.slice(0, 320),
            mtime: read.mtime,
          }
        : null;
    })
    .filter(Boolean);
}

function readOverview() {
  const home = getCodexHome();
  const { file: configPath, read } = configLines();
  const config = read?.text || "";
  const skills = readSkills(home);
  const rules = readRules(home);
  const hooks = readHooks(home);
  const profiles = readProfiles(home);
  const models = readModels(home, config, profiles);
  const mcp = readMcp(config);
  const projects = readProjects(config);
  const plugins = readPlugins(home, config);
  const instructions = readInstructions(home);
  return {
    home,
    config: {
      ...summary(configPath),
      text: read ? redactToml(read.text) : "",
      truncated: Boolean(read?.truncated),
    },
    defaults: {
      model: tomlScalar(config, "model"),
      reasoningEffort: tomlScalar(config, "model_reasoning_effort"),
      personality: tomlScalar(config, "personality"),
    },
    counts: {
      models: models.items.length,
      profiles: profiles.length,
      mcp: mcp.length,
      projects: projects.length,
      skills: skills.length,
      hooks: hooks.items.length,
      rules: rules.length,
      plugins: plugins.length,
      instructions: instructions.length,
    },
    models,
    profiles,
    mcp,
    projects,
    skills,
    hooks,
    rules,
    plugins,
    instructions,
  };
}
function editablePath(file) {
  if (typeof file !== "string") return null;
  const home = getCodexHome();
  const resolved = path.resolve(file);
  const projectInstructions = path.resolve(process.cwd(), "AGENTS.md");
  const allowedExact = new Set([
    path.join(home, "config.toml"),
    path.join(home, "hooks.json"),
    path.join(home, "AGENTS.md"),
    projectInstructions,
  ]);
  if (allowedExact.has(resolved)) return resolved;
  if (path.dirname(resolved) === home && profileNameFromPath(resolved)) return resolved;
  const skillsRoot = path.join(home, "skills");
  const rulesRoot = path.join(home, "rules");
  const skillRelative = path.relative(skillsRoot, resolved);
  if (
    skillRelative &&
    !skillRelative.startsWith("..") &&
    !path.isAbsolute(skillRelative) &&
    path.basename(resolved) === "SKILL.md"
  ) {
    return resolved;
  }
  const ruleRelative = path.relative(rulesRoot, resolved);
  if (
    ruleRelative &&
    !ruleRelative.startsWith("..") &&
    !path.isAbsolute(ruleRelative) &&
    resolved.endsWith(".rules")
  ) {
    return resolved;
  }
  return null;
}

/**
 * Only user-maintained leaf artifacts may be removed from the dashboard.
 * `config.toml` is the root of a Codex installation and must always remain a
 * deliberate edit-only surface: deleting it would discard unrelated settings
 * in one click. Every other supported deletion still receives a backup in the
 * mutation layer before bytes are removed.
 */
function deletablePath(file) {
  const target = editablePath(file);
  if (!target) return null;
  if (target === path.join(getCodexHome(), "config.toml")) return null;
  return target;
}

function readFileSafe(file) {
  const allowed = typeof file === "string" && relativeToAllowed(file);
  if (!allowed) return { error: "File must be inside Codex home or this project's AGENTS.md" };
  const read = safeRead(allowed);
  if (!read) return { error: "File is not readable" };
  const text = allowed.endsWith(".json")
    ? (() => {
        try {
          return JSON.stringify(redactJson(JSON.parse(read.text)), null, 2);
        } catch {
          return read.text;
        }
      })()
    : allowed.endsWith(".toml")
      ? redactToml(read.text)
      : read.text;
  return { ...read, text };
}

module.exports = {
  MAX_FILE_BYTES,
  PROFILE_NAME_RE,
  PROFILE_SUFFIX,
  deletablePath,
  editablePath,
  profileNameFromPath,
  readOverview,
  readFileSafe,
};
