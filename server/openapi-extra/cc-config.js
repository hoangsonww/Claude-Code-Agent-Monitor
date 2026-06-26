/**
 * @file OpenAPI 3.0 fragment for the Claude Config Explorer router
 * (`server/routes/cc-config.js`, mounted at `/api/cc-config`). Documents
 * every read surface (skills, agents, commands, output styles, plugins, MCP
 * servers, hooks, settings, memory, marketplaces, keybindings, statusline,
 * hook scripts, single-file body) plus the low-risk mutation surface
 * (PUT/DELETE /file) and the backups listing.
 *
 * Exports `{ tags, schemas, paths }` for deep-merge by
 * `server/openapi-extra.js`. All schema names are prefixed with `CcConfig`
 * to avoid collisions with the base spec. The shared `{ error: { code,
 * message } }` envelope reuses the base `ErrorResponse` schema (defined in
 * server/openapi.js) — it is NOT redefined here.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// ── Tags ───────────────────────────────────────────────────────────────

const tags = [
  {
    name: "CcConfig",
    description:
      "Claude Code configuration explorer: discover and (for low-risk artifacts) edit skills, agents, commands, output styles, MCP servers, hooks, settings, memory, plugins, marketplaces, keybindings, statusline",
  },
];

// ── Shared sub-schemas ─────────────────────────────────────────────────

const schemas = {
  CcConfigScope: {
    type: "string",
    enum: ["user", "project", "all"],
    description:
      "Discovery scope. `user` = ~/.claude (or CLAUDE_HOME); `project` = <cwd>/.claude (and project CLAUDE.md); `all` = both, merged. Defaults to `all` when omitted or unrecognized.",
    example: "all",
  },

  CcConfigFrontmatter: {
    type: "object",
    additionalProperties: { type: "string" },
    description:
      "Parsed YAML frontmatter from the artifact's markdown header (key → string value). Empty object when the file has no parseable frontmatter. Multi-line values are preserved as raw strings; quotes are stripped.",
    example: {
      name: "code-reviewer",
      description: "Reviews diffs for regressions",
      model: "sonnet",
    },
  },

  // ── Skill ──────────────────────────────────────────────────────────
  CcConfigSkill: {
    type: "object",
    description:
      "A discovered skill: a directory containing a SKILL.md file under <root>/skills/<name>/.",
    required: [
      "scope",
      "name",
      "path",
      "file",
      "size",
      "mtime",
      "truncated",
      "frontmatter",
      "preview",
    ],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project"],
        description: "Which root this skill was discovered under.",
        example: "user",
      },
      name: {
        type: "string",
        description: "Skill directory name.",
        example: "code-reviewer",
      },
      path: {
        type: "string",
        description: "Absolute path to the skill directory.",
        example: "/Users/son/.claude/skills/code-reviewer",
      },
      file: {
        type: "string",
        description: "Absolute path to the SKILL.md file.",
        example: "/Users/son/.claude/skills/code-reviewer/SKILL.md",
      },
      size: {
        type: "integer",
        description: "Size of SKILL.md in bytes.",
        example: 2048,
      },
      mtime: {
        type: "number",
        description: "Last-modified time of SKILL.md in epoch milliseconds.",
        example: 1718900000000,
      },
      truncated: {
        type: "boolean",
        description:
          "True when SKILL.md exceeds 256 KiB and the read was truncated to the first 256 KiB.",
        example: false,
      },
      frontmatter: { $ref: "#/components/schemas/CcConfigFrontmatter" },
      preview: {
        type: "string",
        description: "First 320 characters of the markdown body (after frontmatter).",
        example: "Use this skill to review pull requests for correctness and style...",
      },
    },
  },

  // ── Markdown surface item (agents / commands / output-styles) ───────
  CcConfigMdItem: {
    type: "object",
    description:
      "A single-file markdown artifact (subagent, slash command, or output style) found under <root>/<subdir>/<name>.md.",
    required: ["scope", "name", "file", "size", "mtime", "truncated", "frontmatter", "preview"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project"],
        description: "Which root this artifact was discovered under.",
        example: "project",
      },
      name: {
        type: "string",
        description: "Artifact name (filename with the trailing .md stripped).",
        example: "backend-reviewer",
      },
      file: {
        type: "string",
        description: "Absolute path to the .md file.",
        example: "/repo/.claude/agents/backend-reviewer.md",
      },
      size: { type: "integer", description: "File size in bytes.", example: 1536 },
      mtime: {
        type: "number",
        description: "Last-modified time in epoch milliseconds.",
        example: 1718900000000,
      },
      truncated: {
        type: "boolean",
        description: "True when the file exceeded 256 KiB and was truncated.",
        example: false,
      },
      frontmatter: { $ref: "#/components/schemas/CcConfigFrontmatter" },
      preview: {
        type: "string",
        description: "First 320 characters of the markdown body (after frontmatter).",
        example: "Review backend route and hook logic for regressions...",
      },
    },
  },

  // ── Plugin contributions ────────────────────────────────────────────
  CcConfigPluginContributions: {
    type: "object",
    nullable: true,
    description:
      "Counts of artifacts a plugin contributes, plus its parsed .claude-plugin/plugin.json. Null when the plugin's installPath does not exist on disk.",
    required: ["skills", "agents", "commands", "outputStyles", "hooks", "pluginJson"],
    properties: {
      skills: {
        type: "integer",
        description: "Number of skill directories (containing SKILL.md) under the plugin.",
        example: 3,
      },
      agents: {
        type: "integer",
        description: "Number of .md agent files under the plugin.",
        example: 2,
      },
      commands: {
        type: "integer",
        description: "Number of .md command files under the plugin.",
        example: 5,
      },
      outputStyles: {
        type: "integer",
        description: "Number of .md output-style files under the plugin.",
        example: 0,
      },
      hooks: {
        type: "integer",
        description: "Number of files under the plugin's hooks/ directory.",
        example: 1,
      },
      pluginJson: {
        type: "object",
        nullable: true,
        additionalProperties: true,
        description:
          "Parsed contents of .claude-plugin/plugin.json, or null when absent/unparseable.",
        example: { name: "superpowers", version: "1.2.0" },
      },
    },
  },

  // ── Plugin ───────────────────────────────────────────────────────────
  CcConfigPlugin: {
    type: "object",
    description: "An installed plugin instance derived from the plugins manifest.",
    required: [
      "key",
      "name",
      "marketplace",
      "scope",
      "version",
      "installPath",
      "installedAt",
      "lastUpdated",
      "gitCommitSha",
      "installPathExists",
      "enabled",
      "contributes",
    ],
    properties: {
      key: {
        type: "string",
        description:
          "Manifest key for this plugin, either the bare name or `<name>@<marketplace>`.",
        example: "superpowers@obra",
      },
      name: {
        type: "string",
        description: "Plugin name (the portion of `key` before any `@`).",
        example: "superpowers",
      },
      marketplace: {
        type: "string",
        nullable: true,
        description: "Marketplace portion of `key` (after `@`), or null when unscoped.",
        example: "obra",
      },
      scope: {
        type: "string",
        description: "Install scope reported by the manifest instance (defaults to `user`).",
        example: "user",
      },
      version: {
        type: "string",
        nullable: true,
        description: "Installed plugin version, or null.",
        example: "1.2.0",
      },
      installPath: {
        type: "string",
        nullable: true,
        description: "Absolute install path, or null.",
        example: "/Users/son/.claude/plugins/superpowers",
      },
      installedAt: {
        type: "string",
        nullable: true,
        description: "Install timestamp from the manifest, or null.",
        example: "2026-05-01T12:00:00.000Z",
      },
      lastUpdated: {
        type: "string",
        nullable: true,
        description: "Last-updated timestamp from the manifest, or null.",
        example: "2026-06-01T09:30:00.000Z",
      },
      gitCommitSha: {
        type: "string",
        nullable: true,
        description: "Pinned git commit SHA from the manifest, or null.",
        example: "a1b2c3d4e5f6",
      },
      installPathExists: {
        type: "boolean",
        description: "True when installPath resolves to an existing directory on disk.",
        example: true,
      },
      enabled: {
        type: "boolean",
        nullable: true,
        description:
          "Tri-state enabled flag from settings.json `enabledPlugins`: true, false, or null when the plugin is not listed there.",
        example: true,
      },
      contributes: { $ref: "#/components/schemas/CcConfigPluginContributions" },
    },
  },

  CcConfigPluginsResponse: {
    type: "object",
    description: "Plugins manifest summary plus the resolved plugin list (user scope only).",
    required: ["manifestPath", "manifestExists", "plugins"],
    properties: {
      manifestPath: {
        type: "string",
        description: "Absolute path to plugins/installed_plugins.json under the Claude home.",
        example: "/Users/son/.claude/plugins/installed_plugins.json",
      },
      manifestExists: {
        type: "boolean",
        description: "True when the manifest file was found and parsed.",
        example: true,
      },
      plugins: {
        type: "array",
        description: "Plugins sorted by `key`.",
        items: { $ref: "#/components/schemas/CcConfigPlugin" },
      },
    },
  },

  // ── MCP server ─────────────────────────────────────────────────────
  CcConfigMcpServer: {
    type: "object",
    description:
      "A summarized MCP server definition. Sensitive details (header values, env values) are NOT returned — only their key NAMES are surfaced.",
    required: ["name", "source", "kind"],
    properties: {
      name: {
        type: "string",
        description: "Server name (object key in the source config).",
        example: "github",
      },
      source: {
        type: "string",
        description:
          "Where the definition was found, e.g. `~/.claude.json (top-level)`, `~/.claude.json (projects[<root>])`, or `~/.claude/settings.json`.",
        example: "~/.claude.json (top-level)",
      },
      kind: {
        type: "string",
        enum: ["http", "stdio", "unknown"],
        description:
          "Transport kind inferred from the definition: `http` (has url), `stdio` (has command), or `unknown`.",
        example: "stdio",
      },
      url: {
        type: "string",
        description: "Endpoint URL — present only for `http` servers.",
        example: "https://mcp.example.com/sse",
      },
      headers: {
        type: "array",
        items: { type: "string" },
        description:
          "Header NAMES (values redacted) — present only for `http` servers. Empty array when no headers.",
        example: ["Authorization"],
      },
      command: {
        type: "string",
        description: "Executable — present only for `stdio` servers.",
        example: "npx",
      },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Command arguments — present only for `stdio` servers.",
        example: ["-y", "@modelcontextprotocol/server-github"],
      },
      envNames: {
        type: "array",
        items: { type: "string" },
        description:
          "Environment-variable NAMES (values redacted) — present only for `stdio` servers.",
        example: ["GITHUB_TOKEN"],
      },
    },
  },

  CcConfigMcpResponse: {
    type: "object",
    description:
      "MCP servers split by where they apply: globally to the user, or scoped to the resolved project (cwd) in ~/.claude.json projects[<root>].",
    required: ["user", "projectScoped"],
    properties: {
      user: {
        type: "array",
        description:
          "User/global MCP servers (top-level ~/.claude.json plus ~/.claude/settings.json).",
        items: { $ref: "#/components/schemas/CcConfigMcpServer" },
      },
      projectScoped: {
        type: "array",
        description: "MCP servers scoped to the current project root in ~/.claude.json.",
        items: { $ref: "#/components/schemas/CcConfigMcpServer" },
      },
    },
  },

  // ── Hooks ────────────────────────────────────────────────────────────
  CcConfigHookEntry: {
    type: "object",
    description: "A single flattened hook command bound to a matcher.",
    required: ["matcher", "type", "command", "timeout"],
    properties: {
      matcher: {
        type: "string",
        description: "Tool/event matcher pattern (defaults to `*`).",
        example: "Bash",
      },
      type: {
        type: "string",
        description: "Hook type (defaults to `command`).",
        example: "command",
      },
      command: {
        type: "string",
        nullable: true,
        description: "Shell command to run, or null.",
        example: "node ~/.claude/hooks/handler.js",
      },
      timeout: {
        type: "integer",
        nullable: true,
        description: "Per-hook timeout in seconds, or null when unset.",
        example: 30,
      },
    },
  },

  CcConfigHookSource: {
    type: "object",
    description:
      "Hooks read from one settings file. `hooks` is keyed by event name (e.g. PreToolUse, PostToolUse, Stop); each known-event value is an array of flattened hook entries, while unknown events are passed through verbatim.",
    required: ["scope", "file", "exists", "hooks"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project", "project-local"],
        description: "Which settings file this hook block came from.",
        example: "user",
      },
      file: {
        type: "string",
        description: "Absolute path to the settings file.",
        example: "/Users/son/.claude/settings.json",
      },
      exists: {
        type: "boolean",
        description: "True when the settings file was found and parsed.",
        example: true,
      },
      hooks: {
        type: "object",
        description:
          "Event name → array of hook entries (for the known event types) or the raw matcher array (for unknown events). Only non-empty events are included.",
        additionalProperties: {
          type: "array",
          items: { $ref: "#/components/schemas/CcConfigHookEntry" },
        },
        example: {
          PreToolUse: [
            { matcher: "Bash", type: "command", command: "node guard.js", timeout: null },
          ],
        },
      },
    },
  },

  // ── Settings ───────────────────────────────────────────────────────
  CcConfigSettingsSource: {
    type: "object",
    description:
      "One settings file's redacted contents. Secret-like keys (matching /token|secret|password|api[_-]?key|auth/i with string values) are replaced with the literal string `<redacted>`.",
    required: ["scope", "file", "exists"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project", "project-local"],
        description: "Which settings file this entry represents.",
        example: "user",
      },
      file: {
        type: "string",
        description: "Absolute path to the settings file.",
        example: "/Users/son/.claude/settings.json",
      },
      exists: {
        type: "boolean",
        description:
          "True when the file was found and parsed. When false, `data`/`raw_size` are omitted.",
        example: true,
      },
      data: {
        type: "object",
        additionalProperties: true,
        description: "Parsed, secret-redacted settings JSON. Present only when `exists` is true.",
        example: { model: "sonnet", apiKey: "<redacted>", statusLine: { type: "command" } },
      },
      raw_size: {
        type: "integer",
        description: "Byte length of the raw file contents. Present only when `exists` is true.",
        example: 412,
      },
    },
  },

  // ── Memory ───────────────────────────────────────────────────────────
  CcConfigMemoryItem: {
    type: "object",
    description:
      "A memory artifact: either a primary CLAUDE.md (scope `user`/`project`) or a per-project file-based auto-memory markdown file (scope `auto-memory`). Auto-memory items additionally carry `project`, `name`, `isIndex`, and parsed `frontmatter`.",
    required: ["scope", "file", "size", "mtime", "truncated", "preview"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project", "auto-memory"],
        description:
          "`user`/`project` = the two primary CLAUDE.md files; `auto-memory` = a *.md file under ~/.claude/projects/<slug>/memory/.",
        example: "auto-memory",
      },
      project: {
        type: "string",
        description:
          "Auto-memory only: the ~/.claude/projects/<slug> directory name the file belongs to.",
        example: "-Users-son-repo",
      },
      name: {
        type: "string",
        description: "Auto-memory only: the markdown filename.",
        example: "MEMORY.md",
      },
      isIndex: {
        type: "boolean",
        description:
          "Auto-memory only: true for index/manifest files (MEMORY.md, INDEX-*.md), which sort first.",
        example: true,
      },
      file: {
        type: "string",
        description: "Absolute path to the memory file.",
        example: "/Users/son/.claude/projects/-Users-son-repo/memory/MEMORY.md",
      },
      size: { type: "integer", description: "File size in bytes.", example: 980 },
      mtime: {
        type: "number",
        description: "Last-modified time in epoch milliseconds.",
        example: 1718900000000,
      },
      truncated: {
        type: "boolean",
        description: "True when the file exceeded 256 KiB and was truncated.",
        example: false,
      },
      frontmatter: { $ref: "#/components/schemas/CcConfigFrontmatter" },
      preview: {
        type: "string",
        description:
          "First 480 characters of the body (frontmatter stripped for auto-memory files; raw head for CLAUDE.md).",
        example: "## Persistent facts\\n- Never run destructive ops without confirmation...",
      },
    },
  },

  // ── Marketplaces ───────────────────────────────────────────────────
  CcConfigMarketplace: {
    type: "object",
    description: "A known plugin marketplace and (best-effort) its parsed manifest summary.",
    required: [
      "name",
      "source",
      "installLocation",
      "lastUpdated",
      "pluginCount",
      "marketplaceName",
      "marketplaceDescription",
      "marketplaceOwner",
    ],
    properties: {
      name: { type: "string", description: "Marketplace key/name.", example: "obra" },
      source: {
        type: "object",
        nullable: true,
        additionalProperties: true,
        description: "Source descriptor object (e.g. git/github source), or null.",
        example: { source: "github", repo: "obra/superpowers-marketplace" },
      },
      installLocation: {
        type: "string",
        nullable: true,
        description: "Absolute path where the marketplace is checked out, or null.",
        example: "/Users/son/.claude/plugins/marketplaces/obra",
      },
      lastUpdated: {
        type: "string",
        nullable: true,
        description: "Last-updated timestamp, or null.",
        example: "2026-06-10T00:00:00.000Z",
      },
      pluginCount: {
        type: "integer",
        nullable: true,
        description:
          "Number of plugins in the marketplace manifest, or null when no manifest was readable.",
        example: 12,
      },
      marketplaceName: {
        type: "string",
        nullable: true,
        description: "`name` from the marketplace manifest, or null.",
        example: "Superpowers",
      },
      marketplaceDescription: {
        type: "string",
        nullable: true,
        description: "`description` from the marketplace manifest, or null.",
        example: "Curated agent skills",
      },
      marketplaceOwner: {
        description: "`owner` from the marketplace manifest (object or string), or null.",
        nullable: true,
        oneOf: [{ type: "object", additionalProperties: true }, { type: "string" }],
        example: { name: "obra" },
      },
    },
  },

  CcConfigMarketplacesResponse: {
    type: "object",
    description: "Known-marketplaces manifest summary plus the resolved marketplace list.",
    required: ["knownPath", "knownExists", "items"],
    properties: {
      knownPath: {
        type: "string",
        description: "Absolute path to plugins/known_marketplaces.json under the Claude home.",
        example: "/Users/son/.claude/plugins/known_marketplaces.json",
      },
      knownExists: {
        type: "boolean",
        description: "True when the known-marketplaces file was found and parsed.",
        example: true,
      },
      items: {
        type: "array",
        description: "Marketplaces sorted by name.",
        items: { $ref: "#/components/schemas/CcConfigMarketplace" },
      },
    },
  },

  // ── Keybindings ────────────────────────────────────────────────────
  CcConfigKeybinding: {
    type: "object",
    description: "A single key → action binding.",
    required: ["key", "action"],
    properties: {
      key: { type: "string", description: "Key chord.", example: "ctrl+s" },
      action: { type: "string", description: "Action name (stringified).", example: "submit" },
    },
  },

  CcConfigKeybindingGroup: {
    type: "object",
    description: "A context-scoped group of keybindings.",
    required: ["context", "bindings"],
    properties: {
      context: {
        type: "string",
        description: "The context the bindings apply in (empty string when global).",
        example: "editor",
      },
      bindings: {
        type: "array",
        items: { $ref: "#/components/schemas/CcConfigKeybinding" },
      },
    },
  },

  CcConfigKeybindingsResponse: {
    type: "object",
    description:
      "Parsed ~/.claude/keybindings.json. When the file is absent, only `{ file, exists: false }` is returned.",
    required: ["file", "exists"],
    properties: {
      file: {
        type: "string",
        description: "Absolute path to keybindings.json.",
        example: "/Users/son/.claude/keybindings.json",
      },
      exists: {
        type: "boolean",
        description: "True when the file was found and parsed.",
        example: true,
      },
      schema: {
        type: "string",
        nullable: true,
        description: "`$schema` value from the file, or null. Present only when `exists` is true.",
        example: "https://json.schemastore.org/claude-keybindings",
      },
      docs: {
        type: "string",
        nullable: true,
        description: "`$docs` value from the file, or null. Present only when `exists` is true.",
        example: "https://docs.claude.com/keybindings",
      },
      groups: {
        type: "array",
        description: "Binding groups. Present only when `exists` is true.",
        items: { $ref: "#/components/schemas/CcConfigKeybindingGroup" },
      },
    },
  },

  // ── Statusline ─────────────────────────────────────────────────────
  CcConfigStatuslineScript: {
    type: "object",
    description:
      "A statusline script (statusline.py or statusline-command.sh) discovered under the Claude home.",
    required: ["file", "size", "mtime", "truncated", "preview"],
    properties: {
      file: {
        type: "string",
        description: "Absolute path to the script.",
        example: "/Users/son/.claude/statusline.py",
      },
      size: { type: "integer", description: "File size in bytes.", example: 1280 },
      mtime: {
        type: "number",
        description: "Last-modified time in epoch milliseconds.",
        example: 1718900000000,
      },
      truncated: {
        type: "boolean",
        description: "True when the file exceeded 256 KiB and was truncated.",
        example: false,
      },
      preview: {
        type: "string",
        description: "First 4000 characters of the script body.",
        example: "#!/usr/bin/env python3\\nimport json, sys\\n...",
      },
    },
  },

  CcConfigStatuslineResponse: {
    type: "object",
    description: "The statusLine config block from user settings.json plus any statusline scripts.",
    required: ["config", "scripts"],
    properties: {
      config: {
        type: "object",
        nullable: true,
        additionalProperties: true,
        description: "The `statusLine` object from ~/.claude/settings.json, or null when unset.",
        example: { type: "command", command: "python3 ~/.claude/statusline.py" },
      },
      scripts: {
        type: "array",
        items: { $ref: "#/components/schemas/CcConfigStatuslineScript" },
      },
    },
  },

  // ── Hook scripts ───────────────────────────────────────────────────
  CcConfigHookScript: {
    type: "object",
    description: "A file in the ~/.claude/hooks/ directory.",
    required: ["name", "file", "size", "mtime"],
    properties: {
      name: { type: "string", description: "File name.", example: "post-tool-use.js" },
      file: {
        type: "string",
        description: "Absolute path to the script.",
        example: "/Users/son/.claude/hooks/post-tool-use.js",
      },
      size: { type: "integer", description: "File size in bytes.", example: 640 },
      mtime: {
        type: "number",
        description: "Last-modified time in epoch milliseconds.",
        example: 1718900000000,
      },
    },
  },

  CcConfigHookScriptsResponse: {
    type: "object",
    description: "Listing of the ~/.claude/hooks/ directory (files only, sorted by name).",
    required: ["dir", "items"],
    properties: {
      dir: {
        type: "string",
        description: "Absolute path to the hooks directory.",
        example: "/Users/son/.claude/hooks",
      },
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/CcConfigHookScript" },
      },
    },
  },

  // ── Overview ─────────────────────────────────────────────────────────
  CcConfigScopeCount: {
    type: "object",
    description: "Per-scope counts (user vs project).",
    required: ["user", "project"],
    properties: {
      user: { type: "integer", description: "Count under the user root.", example: 12 },
      project: { type: "integer", description: "Count under the project root.", example: 3 },
    },
  },

  CcConfigOverviewResponse: {
    type: "object",
    description:
      "Top-level summary for the Claude Config Explorer landing page: resolved roots plus aggregate counts across every surface.",
    required: ["roots", "counts"],
    properties: {
      roots: {
        type: "object",
        description: "The four filesystem roots the explorer reads from.",
        required: ["claudeHome", "projectClaudeDir", "projectRoot", "claudeJson"],
        properties: {
          claudeHome: {
            type: "string",
            description: "Claude home (CLAUDE_HOME or ~/.claude).",
            example: "/Users/son/.claude",
          },
          projectClaudeDir: {
            type: "string",
            description: "Project .claude directory under the resolved cwd.",
            example: "/repo/.claude",
          },
          projectRoot: {
            type: "string",
            description: "Resolved project root (the cwd).",
            example: "/repo",
          },
          claudeJson: {
            type: "string",
            description: "Path to ~/.claude.json (resolved from $HOME, not CLAUDE_HOME).",
            example: "/Users/son/.claude.json",
          },
        },
      },
      counts: {
        type: "object",
        description: "Aggregate counts by surface.",
        required: [
          "skills",
          "agents",
          "commands",
          "outputStyles",
          "plugins",
          "pluginsEnabled",
          "pluginsDisabled",
          "marketplaces",
          "keybindings",
          "mcpServers",
          "hooks",
          "memory",
          "settingsFiles",
        ],
        properties: {
          skills: { $ref: "#/components/schemas/CcConfigScopeCount" },
          agents: { $ref: "#/components/schemas/CcConfigScopeCount" },
          commands: { $ref: "#/components/schemas/CcConfigScopeCount" },
          outputStyles: { $ref: "#/components/schemas/CcConfigScopeCount" },
          plugins: { type: "integer", description: "Total plugins.", example: 8 },
          pluginsEnabled: {
            type: "integer",
            description: "Plugins explicitly enabled in settings.",
            example: 6,
          },
          pluginsDisabled: {
            type: "integer",
            description: "Plugins explicitly disabled in settings.",
            example: 1,
          },
          marketplaces: { type: "integer", description: "Known marketplaces.", example: 2 },
          keybindings: {
            type: "integer",
            description: "Total individual key bindings across all groups.",
            example: 24,
          },
          mcpServers: {
            type: "object",
            description: "MCP server counts by scope.",
            required: ["user", "project"],
            properties: {
              user: { type: "integer", example: 3 },
              project: { type: "integer", example: 1 },
            },
          },
          hooks: {
            type: "object",
            description: "Total hook entries per settings scope.",
            required: ["user", "project", "project-local"],
            properties: {
              user: { type: "integer", example: 2 },
              project: { type: "integer", example: 0 },
              "project-local": { type: "integer", example: 1 },
            },
          },
          memory: { type: "integer", description: "Total memory items.", example: 5 },
          settingsFiles: {
            type: "integer",
            description: "Number of settings files that exist (of the three scopes).",
            example: 2,
          },
        },
      },
    },
  },

  // ── List wrappers ────────────────────────────────────────────────────
  CcConfigSkillsResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigSkill" } },
    },
  },
  CcConfigAgentsResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigMdItem" } },
    },
  },
  CcConfigCommandsResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigMdItem" } },
    },
  },
  CcConfigOutputStylesResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigMdItem" } },
    },
  },
  CcConfigHooksResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigHookSource" } },
    },
  },
  CcConfigSettingsResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigSettingsSource" } },
    },
  },
  CcConfigMemoryResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CcConfigMemoryItem" } },
    },
  },

  // ── /file read ───────────────────────────────────────────────────────
  CcConfigFileReadResponse: {
    type: "object",
    description:
      "Body of a single file resolved under an allowed root. Returned only on success; failures return an ErrorResponse with HTTP 400.",
    required: ["ok", "file", "truncated", "size", "text", "mtime"],
    properties: {
      ok: { type: "boolean", enum: [true], description: "Always true on success.", example: true },
      file: {
        type: "string",
        description: "Absolute, resolved path that was read.",
        example: "/Users/son/.claude/skills/code-reviewer/SKILL.md",
      },
      truncated: {
        type: "boolean",
        description:
          "True when the file exceeded 256 KiB and only the first 256 KiB are in `text`.",
        example: false,
      },
      size: { type: "integer", description: "Full file size in bytes.", example: 2048 },
      text: {
        type: "string",
        description: "File contents (truncated to 256 KiB).",
        example: "---\\nname: code-reviewer\\n---\\n# Code Reviewer\\n...",
      },
      mtime: {
        type: "number",
        description: "Last-modified time in epoch milliseconds.",
        example: 1718900000000,
      },
    },
  },

  // ── PUT /file ──────────────────────────────────────────────────────
  CcConfigFileWriteRequest: {
    type: "object",
    description:
      "Create-or-overwrite request for a low-risk text artifact. `name` is required for every type except `memory` (which targets CLAUDE.md). `project` is required for `auto-memory`. `scope` is ignored for `auto-memory` (always under the Claude home).",
    required: ["scope", "type", "content"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project"],
        description:
          "Target root: `user` (Claude home) or `project` (<cwd>/.claude, or project root for memory). Ignored for `auto-memory`.",
        example: "user",
      },
      type: {
        type: "string",
        enum: ["skills", "agents", "commands", "output-styles", "memory", "auto-memory"],
        description:
          "Artifact type. `skills` writes <root>/skills/<name>/SKILL.md; `agents`/`commands`/`output-styles` write <root>/<type>/<name>.md; `memory` writes the scope's CLAUDE.md; `auto-memory` writes ~/.claude/projects/<project>/memory/<name>.",
        example: "agents",
      },
      name: {
        type: "string",
        description:
          "Artifact name. Required for all types except `memory`. For skills/agents/commands/output-styles must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/. For auto-memory must be a flat *.md filename (/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\\.md$/i, no `..`).",
        example: "my-reviewer",
      },
      content: {
        type: "string",
        description: "Full file contents to write. Must be a string and ≤ 256 KiB (UTF-8 bytes).",
        example: "---\\nname: my-reviewer\\n---\\n# My Reviewer\\nReview the diff...",
      },
      project: {
        type: "string",
        description:
          "Required for `auto-memory`: the ~/.claude/projects/<slug> directory name. Validated against /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,255}$/ and rejected if it contains `..`.",
        example: "-Users-son-repo",
      },
    },
  },

  CcConfigFileWriteResponse: {
    type: "object",
    description: "Result of a successful create-or-overwrite.",
    required: ["ok", "file", "target", "backupPath", "created"],
    properties: {
      ok: { type: "boolean", enum: [true], example: true },
      file: {
        type: "string",
        description: "Absolute path to the .md file that was written.",
        example: "/Users/son/.claude/agents/my-reviewer.md",
      },
      target: {
        type: "string",
        description:
          "Absolute path to the artifact target (the skill directory for skills; same as `file` otherwise).",
        example: "/Users/son/.claude/agents/my-reviewer.md",
      },
      backupPath: {
        type: "string",
        nullable: true,
        description:
          "Absolute path to the timestamped backup created before overwriting, or null when this was a fresh create (nothing to back up).",
        example:
          "/Users/son/.claude/cc-config-backups/agents/my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
      },
      created: {
        type: "boolean",
        description: "True when the artifact did not exist before this write.",
        example: true,
      },
    },
  },

  // ── DELETE /file ───────────────────────────────────────────────────
  CcConfigFileDeleteRequest: {
    type: "object",
    description:
      "Delete request for a low-risk text artifact. Same (scope, type, name, project) semantics as the write request, without `content`.",
    required: ["scope", "type"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project"],
        description: "Target root. Ignored for `auto-memory`.",
        example: "user",
      },
      type: {
        type: "string",
        enum: ["skills", "agents", "commands", "output-styles", "memory", "auto-memory"],
        description: "Artifact type to delete.",
        example: "agents",
      },
      name: {
        type: "string",
        description: "Artifact name. Required for all types except `memory`.",
        example: "my-reviewer",
      },
      project: {
        type: "string",
        description: "Required for `auto-memory`: the projects/<slug> directory name.",
        example: "-Users-son-repo",
      },
    },
  },

  CcConfigFileDeleteResponse: {
    type: "object",
    description: "Result of a successful delete (a mandatory backup is created first).",
    required: ["ok", "file", "target", "backupPath"],
    properties: {
      ok: { type: "boolean", enum: [true], example: true },
      file: {
        type: "string",
        description: "Absolute path to the .md file inside the deleted target.",
        example: "/Users/son/.claude/agents/my-reviewer.md",
      },
      target: {
        type: "string",
        description: "Absolute path to the deleted artifact (skill directory for skills).",
        example: "/Users/son/.claude/agents/my-reviewer.md",
      },
      backupPath: {
        type: "string",
        nullable: true,
        description: "Absolute path to the backup taken before deletion.",
        example:
          "/Users/son/.claude/cc-config-backups/agents/my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
      },
    },
  },

  // ── Backups ──────────────────────────────────────────────────────────
  CcConfigBackup: {
    type: "object",
    description: "A single backup entry under a cc-config-backups directory.",
    required: ["scope", "type", "name", "backupPath", "isDir", "mtime", "size"],
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project", "auto-memory"],
        description: "Scope the backup belongs to. `auto-memory` backups are per-project.",
        example: "user",
      },
      project: {
        type: "string",
        description: "Auto-memory only: the projects/<slug> directory name.",
        example: "-Users-son-repo",
      },
      type: {
        type: "string",
        enum: ["skills", "agents", "commands", "output-styles", "memory", "auto-memory"],
        description: "Artifact type the backup was taken from.",
        example: "agents",
      },
      name: {
        type: "string",
        description: "Backup file/directory name (includes the timestamp and .bak suffix).",
        example: "my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
      },
      backupPath: {
        type: "string",
        description: "Absolute path to the backup.",
        example:
          "/Users/son/.claude/cc-config-backups/agents/my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
      },
      isDir: {
        type: "boolean",
        description: "True when the backup is a directory (skill backups).",
        example: false,
      },
      mtime: {
        type: "number",
        description: "Backup modification time in epoch milliseconds (results sort newest first).",
        example: 1718900000000,
      },
      size: {
        type: "integer",
        nullable: true,
        description: "Backup size in bytes, or null for directory backups.",
        example: 2048,
      },
    },
  },

  CcConfigBackupsResponse: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        description: "Backups across the requested scope/type buckets, sorted newest first.",
        items: { $ref: "#/components/schemas/CcConfigBackup" },
      },
    },
  },
};

// ── Reusable parameters (inlined per-operation to match base style) ────

const scopeParam = {
  name: "scope",
  in: "query",
  required: false,
  schema: { type: "string", enum: ["user", "project", "all"], default: "all" },
  description:
    "Discovery scope: `user`, `project`, or `all` (default). Unrecognized values fall back to `all`.",
  example: "all",
};

const cwdParam = {
  name: "cwd",
  in: "query",
  required: false,
  schema: { type: "string" },
  description:
    "Override the working directory used to resolve the project root and project .claude dir. Defaults to the dashboard server's own cwd.",
  example: "/repo",
};

// ── Paths ───────────────────────────────────────────────────────────────

const paths = {
  "/api/cc-config/overview": {
    get: {
      tags: ["CcConfig"],
      summary: "Config explorer overview",
      description:
        "Read-only. Returns the four resolved filesystem roots plus aggregate counts across every surface (skills, agents, commands, output styles, plugins, marketplaces, keybindings, MCP servers, hooks, memory, settings files). All sub-reads degrade to empty on any I/O error, so this endpoint never errors.",
      operationId: "ccConfigGetOverview",
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Overview of roots and counts.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigOverviewResponse" },
              example: {
                roots: {
                  claudeHome: "/Users/son/.claude",
                  projectClaudeDir: "/repo/.claude",
                  projectRoot: "/repo",
                  claudeJson: "/Users/son/.claude.json",
                },
                counts: {
                  skills: { user: 12, project: 3 },
                  agents: { user: 5, project: 2 },
                  commands: { user: 8, project: 0 },
                  outputStyles: { user: 1, project: 0 },
                  plugins: 8,
                  pluginsEnabled: 6,
                  pluginsDisabled: 1,
                  marketplaces: 2,
                  keybindings: 24,
                  mcpServers: { user: 3, project: 1 },
                  hooks: { user: 2, project: 0, "project-local": 1 },
                  memory: 5,
                  settingsFiles: 2,
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/skills": {
    get: {
      tags: ["CcConfig"],
      summary: "List discovered skills",
      description:
        "Read-only. Lists skill directories (each containing a SKILL.md) under the user and/or project roots, with parsed frontmatter and a 320-char body preview. Files over 256 KiB are read truncated. Degrades to an empty list on I/O errors.",
      operationId: "ccConfigGetSkills",
      parameters: [scopeParam, cwdParam],
      responses: {
        200: {
          description: "Skills list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigSkillsResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    name: "code-reviewer",
                    path: "/Users/son/.claude/skills/code-reviewer",
                    file: "/Users/son/.claude/skills/code-reviewer/SKILL.md",
                    size: 2048,
                    mtime: 1718900000000,
                    truncated: false,
                    frontmatter: { name: "code-reviewer", description: "Reviews diffs" },
                    preview: "Use this skill to review pull requests...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/agents": {
    get: {
      tags: ["CcConfig"],
      summary: "List subagents",
      description:
        "Read-only. Lists single-file subagent definitions (<root>/agents/*.md) under the user and/or project roots, with parsed frontmatter and a 320-char preview. Truncated above 256 KiB; degrades to empty on errors.",
      operationId: "ccConfigGetAgents",
      parameters: [scopeParam, cwdParam],
      responses: {
        200: {
          description: "Agents list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigAgentsResponse" },
              example: {
                items: [
                  {
                    scope: "project",
                    name: "backend-reviewer",
                    file: "/repo/.claude/agents/backend-reviewer.md",
                    size: 1536,
                    mtime: 1718900000000,
                    truncated: false,
                    frontmatter: { name: "backend-reviewer", model: "sonnet" },
                    preview: "Review backend route and hook logic for regressions...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/commands": {
    get: {
      tags: ["CcConfig"],
      summary: "List slash commands",
      description:
        "Read-only. Lists slash-command definitions (<root>/commands/*.md) under the user and/or project roots, with parsed frontmatter and a 320-char preview. Truncated above 256 KiB; degrades to empty on errors.",
      operationId: "ccConfigGetCommands",
      parameters: [scopeParam, cwdParam],
      responses: {
        200: {
          description: "Commands list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigCommandsResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    name: "commit",
                    file: "/Users/son/.claude/commands/commit.md",
                    size: 800,
                    mtime: 1718900000000,
                    truncated: false,
                    frontmatter: { description: "Create a commit" },
                    preview: "Commit the staged changes with a descriptive message...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/output-styles": {
    get: {
      tags: ["CcConfig"],
      summary: "List output styles",
      description:
        "Read-only. Lists output-style definitions (<root>/output-styles/*.md) under the user and/or project roots, with parsed frontmatter and a 320-char preview. Truncated above 256 KiB; degrades to empty on errors.",
      operationId: "ccConfigGetOutputStyles",
      parameters: [scopeParam, cwdParam],
      responses: {
        200: {
          description: "Output styles list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigOutputStylesResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    name: "concise",
                    file: "/Users/son/.claude/output-styles/concise.md",
                    size: 420,
                    mtime: 1718900000000,
                    truncated: false,
                    frontmatter: { name: "concise" },
                    preview: "Respond tersely, no preamble...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/plugins": {
    get: {
      tags: ["CcConfig"],
      summary: "List installed plugins",
      description:
        "Read-only. Reads the user-scope plugins manifest (~/.claude/plugins/installed_plugins.json), resolves each instance's on-disk contributions, and reports its tri-state enabled flag from settings.json. Read-only by design: plugins are written concurrently by the running Claude Code CLI. No scope/cwd parameters. Degrades to an empty plugin list when the manifest is missing.",
      operationId: "ccConfigGetPlugins",
      responses: {
        200: {
          description: "Plugins manifest summary and list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigPluginsResponse" },
              example: {
                manifestPath: "/Users/son/.claude/plugins/installed_plugins.json",
                manifestExists: true,
                plugins: [
                  {
                    key: "superpowers@obra",
                    name: "superpowers",
                    marketplace: "obra",
                    scope: "user",
                    version: "1.2.0",
                    installPath: "/Users/son/.claude/plugins/superpowers",
                    installedAt: "2026-05-01T12:00:00.000Z",
                    lastUpdated: "2026-06-01T09:30:00.000Z",
                    gitCommitSha: "a1b2c3d4e5f6",
                    installPathExists: true,
                    enabled: true,
                    contributes: {
                      skills: 3,
                      agents: 2,
                      commands: 5,
                      outputStyles: 0,
                      hooks: 1,
                      pluginJson: { name: "superpowers", version: "1.2.0" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/mcp": {
    get: {
      tags: ["CcConfig"],
      summary: "List MCP servers",
      description:
        "Read-only. Discovers MCP servers from ~/.claude.json (top-level and projects[<root>]) and ~/.claude/settings.json, split into `user` and `projectScoped`. Header and env VALUES are never returned — only their key NAMES. Read-only by design (the CLI writes these files concurrently). Degrades to empty arrays on errors.",
      operationId: "ccConfigGetMcp",
      parameters: [cwdParam],
      responses: {
        200: {
          description: "MCP servers grouped by scope.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigMcpResponse" },
              example: {
                user: [
                  {
                    name: "github",
                    source: "~/.claude.json (top-level)",
                    kind: "stdio",
                    command: "npx",
                    args: ["-y", "@modelcontextprotocol/server-github"],
                    envNames: ["GITHUB_TOKEN"],
                  },
                ],
                projectScoped: [
                  {
                    name: "internal",
                    source: "~/.claude.json (projects[/repo])",
                    kind: "http",
                    url: "https://mcp.example.com/sse",
                    headers: ["Authorization"],
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/hooks": {
    get: {
      tags: ["CcConfig"],
      summary: "List configured hooks",
      description:
        "Read-only. Reads hooks from the user, project, and project-local settings files. Known event types (SessionStart, SessionEnd, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, PreCompact) are flattened into matcher/type/command/timeout entries; unknown events are passed through verbatim. Hooks in settings are read-only here. Degrades to per-file `exists:false` on errors.",
      operationId: "ccConfigGetHooks",
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Hook sources by scope.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigHooksResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    file: "/Users/son/.claude/settings.json",
                    exists: true,
                    hooks: {
                      PostToolUse: [
                        {
                          matcher: "*",
                          type: "command",
                          command: "node ~/.claude/hooks/post-tool-use.js",
                          timeout: null,
                        },
                      ],
                    },
                  },
                  {
                    scope: "project",
                    file: "/repo/.claude/settings.json",
                    exists: false,
                    hooks: {},
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/settings": {
    get: {
      tags: ["CcConfig"],
      summary: "List settings files",
      description:
        "Read-only. Returns the user, project, and project-local settings.json contents with secret-like keys redacted to the literal `<redacted>` (keys matching /token|secret|password|api[_-]?key|auth/i with string values). Missing files report `exists:false`. Settings files are read-only here (concurrent CLI writes).",
      operationId: "ccConfigGetSettings",
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Settings sources by scope (secrets redacted).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigSettingsResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    file: "/Users/son/.claude/settings.json",
                    exists: true,
                    data: { model: "sonnet", apiKey: "<redacted>" },
                    raw_size: 412,
                  },
                  { scope: "project", file: "/repo/.claude/settings.json", exists: false },
                  {
                    scope: "project-local",
                    file: "/repo/.claude/settings.local.json",
                    exists: false,
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/memory": {
    get: {
      tags: ["CcConfig"],
      summary: "List memory files",
      description:
        "Read-only. Returns the two primary CLAUDE.md files (scopes `user`/`project`) plus every per-project file-based auto-memory markdown file under ~/.claude/projects/<slug>/memory/ (scope `auto-memory`, sorted index files first). Previews are 480 chars; files over 256 KiB are truncated. Degrades to fewer files on errors.",
      operationId: "ccConfigGetMemory",
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Memory items.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigMemoryResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    file: "/Users/son/.claude/CLAUDE.md",
                    size: 1200,
                    mtime: 1718900000000,
                    truncated: false,
                    preview: "# Workspace & Productivity System...",
                  },
                  {
                    scope: "auto-memory",
                    project: "-Users-son-repo",
                    name: "MEMORY.md",
                    isIndex: true,
                    file: "/Users/son/.claude/projects/-Users-son-repo/memory/MEMORY.md",
                    size: 980,
                    mtime: 1718900000000,
                    truncated: false,
                    frontmatter: {},
                    preview:
                      "## Persistent facts\\n- Never run destructive ops without confirmation...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/marketplaces": {
    get: {
      tags: ["CcConfig"],
      summary: "List plugin marketplaces",
      description:
        "Read-only. Reads ~/.claude/plugins/known_marketplaces.json and, best-effort, each marketplace's .claude-plugin/marketplace.json for plugin count and metadata. No scope/cwd parameters. Degrades to an empty list when the file is missing.",
      operationId: "ccConfigGetMarketplaces",
      responses: {
        200: {
          description: "Known marketplaces summary and list.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigMarketplacesResponse" },
              example: {
                knownPath: "/Users/son/.claude/plugins/known_marketplaces.json",
                knownExists: true,
                items: [
                  {
                    name: "obra",
                    source: { source: "github", repo: "obra/superpowers-marketplace" },
                    installLocation: "/Users/son/.claude/plugins/marketplaces/obra",
                    lastUpdated: "2026-06-10T00:00:00.000Z",
                    pluginCount: 12,
                    marketplaceName: "Superpowers",
                    marketplaceDescription: "Curated agent skills",
                    marketplaceOwner: { name: "obra" },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/keybindings": {
    get: {
      tags: ["CcConfig"],
      summary: "Get keybindings",
      description:
        "Read-only. Parses ~/.claude/keybindings.json into context-scoped groups of key → action bindings. When the file is absent, returns only `{ file, exists:false }`. No scope/cwd parameters.",
      operationId: "ccConfigGetKeybindings",
      responses: {
        200: {
          description: "Parsed keybindings (or exists:false).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigKeybindingsResponse" },
              example: {
                file: "/Users/son/.claude/keybindings.json",
                exists: true,
                schema: null,
                docs: null,
                groups: [
                  {
                    context: "editor",
                    bindings: [{ key: "ctrl+s", action: "submit" }],
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/statusline": {
    get: {
      tags: ["CcConfig"],
      summary: "Get statusline config and scripts",
      description:
        "Read-only. Returns the `statusLine` block from ~/.claude/settings.json plus any statusline scripts (statusline.py, statusline-command.sh) with a 4000-char preview. Scripts over 256 KiB are truncated. No scope/cwd parameters.",
      operationId: "ccConfigGetStatusline",
      responses: {
        200: {
          description: "Statusline config and scripts.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigStatuslineResponse" },
              example: {
                config: { type: "command", command: "python3 ~/.claude/statusline.py" },
                scripts: [
                  {
                    file: "/Users/son/.claude/statusline.py",
                    size: 1280,
                    mtime: 1718900000000,
                    truncated: false,
                    preview: "#!/usr/bin/env python3\\nimport json, sys\\n...",
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/hook-scripts": {
    get: {
      tags: ["CcConfig"],
      summary: "List hook scripts",
      description:
        "Read-only. Lists files in the ~/.claude/hooks/ directory (name, path, size, mtime), sorted by name. Returns metadata only — no file contents. Use GET /file to read an individual script. No scope/cwd parameters.",
      operationId: "ccConfigGetHookScripts",
      responses: {
        200: {
          description: "Hook scripts directory listing.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigHookScriptsResponse" },
              example: {
                dir: "/Users/son/.claude/hooks",
                items: [
                  {
                    name: "post-tool-use.js",
                    file: "/Users/son/.claude/hooks/post-tool-use.js",
                    size: 640,
                    mtime: 1718900000000,
                  },
                ],
              },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/file": {
    get: {
      tags: ["CcConfig"],
      summary: "Read a single file body",
      description:
        "Read-only. Returns the body of one file. Strict path containment: the resolved absolute path MUST live under the Claude home, the project .claude dir, or (only for a file literally named CLAUDE.md) the project root. Bodies over 256 KiB are truncated. NOTE: there is no 404 path — a missing, unreadable, or out-of-root file all return 400.",
      operationId: "ccConfigGetFile",
      parameters: [
        {
          name: "path",
          in: "query",
          required: true,
          schema: { type: "string" },
          description:
            "Absolute path to read. Must resolve under an allowed root; under the project root only CLAUDE.md is permitted.",
          example: "/Users/son/.claude/skills/code-reviewer/SKILL.md",
        },
        cwdParam,
      ],
      responses: {
        200: {
          description: "File body with metadata.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigFileReadResponse" },
              example: {
                ok: true,
                file: "/Users/son/.claude/skills/code-reviewer/SKILL.md",
                truncated: false,
                size: 2048,
                text: "---\\nname: code-reviewer\\n---\\n# Code Reviewer\\n...",
                mtime: 1718900000000,
              },
            },
          },
        },
        400: {
          description:
            "Bad or denied path. `BAD_PATH` — `path` query is missing or empty. `READ_DENIED` — path is outside the allowed roots, only CLAUDE.md is readable from the project root, or the file is missing/unreadable (there is no 404).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "READ_DENIED", message: "path is outside allowed roots" } },
            },
          },
        },
      },
    },
    put: {
      tags: ["CcConfig"],
      summary: "Create or overwrite a text artifact",
      description:
        "Mutating. Creates or overwrites a low-risk text artifact (skills, agents, commands, output-styles, memory, auto-memory). Before overwriting an existing artifact a timestamped backup is created under a cc-config-backups directory (well outside the dirs Claude Code scans); fresh creates have no backup (backupPath:null). Writes are atomic (temp file + rename). Names are validated against a strict allowlist and the resolved path is re-checked to be inside its containment root. Content must be a string ≤ 256 KiB (UTF-8). Plugins, MCP servers, hooks-in-settings, and settings.json are intentionally NOT writable. Emits a `cc_config_changed` websocket event on success.",
      operationId: "ccConfigPutFile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CcConfigFileWriteRequest" },
            example: {
              scope: "user",
              type: "agents",
              name: "my-reviewer",
              content: "---\\nname: my-reviewer\\n---\\n# My Reviewer\\nReview the diff...",
            },
          },
        },
      },
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Artifact created or overwritten.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigFileWriteResponse" },
              example: {
                ok: true,
                file: "/Users/son/.claude/agents/my-reviewer.md",
                target: "/Users/son/.claude/agents/my-reviewer.md",
                backupPath: null,
                created: true,
              },
            },
          },
        },
        400: {
          description:
            "Bad request. `EBADREQ` — scope/type missing or not strings. `EBADTYPE` — unknown type. `EBADSCOPE` — scope not user/project. `EBADNAME` — name fails the allowlist (or auto-memory name is not a flat *.md). `EBADPROJECT` — invalid auto-memory project slug. `EBADCONTENT` — content is not a string. `EOUTOFROOT` — resolved path escapes its containment root.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "EBADNAME",
                  message: "name must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/",
                },
              },
            },
          },
        },
        413: {
          description: "`ETOOLARGE` — content exceeds the 256 KiB (262144-byte) limit.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "ETOOLARGE", message: "content exceeds 262144 bytes" } },
            },
          },
        },
        500: {
          description: "`EINTERNAL` (or any unmapped error code) — unexpected filesystem error.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "EINTERNAL", message: "EACCES: permission denied" } },
            },
          },
        },
      },
    },
    delete: {
      tags: ["CcConfig"],
      summary: "Delete a text artifact",
      description:
        "Mutating. Deletes a low-risk text artifact (same type/scope/name/project semantics as PUT, no content). A mandatory backup is created BEFORE deletion — if the backup fails the original is left intact. Skill deletes remove the whole skill directory. Emits a `cc_config_changed` websocket event on success. Plugins, MCP servers, hooks-in-settings, and settings.json are NOT deletable.",
      operationId: "ccConfigDeleteFile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CcConfigFileDeleteRequest" },
            example: { scope: "user", type: "agents", name: "my-reviewer" },
          },
        },
      },
      parameters: [cwdParam],
      responses: {
        200: {
          description: "Artifact deleted (backup taken first).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigFileDeleteResponse" },
              example: {
                ok: true,
                file: "/Users/son/.claude/agents/my-reviewer.md",
                target: "/Users/son/.claude/agents/my-reviewer.md",
                backupPath:
                  "/Users/son/.claude/cc-config-backups/agents/my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
              },
            },
          },
        },
        400: {
          description:
            "Bad request. `EBADREQ` — scope/type missing or not strings. `EBADTYPE` — unknown type. `EBADSCOPE` — scope not user/project. `EBADNAME` — invalid name. `EBADPROJECT` — invalid auto-memory project slug. `EOUTOFROOT` — resolved path escapes its containment root.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "EBADTYPE", message: "unknown type: plugins" } },
            },
          },
        },
        404: {
          description: "`ENOTFOUND` — the target artifact does not exist.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "ENOTFOUND", message: "agents/my-reviewer does not exist" },
              },
            },
          },
        },
        500: {
          description: "`EINTERNAL` (or any unmapped error code) — unexpected filesystem error.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "EINTERNAL", message: "EACCES: permission denied" } },
            },
          },
        },
      },
    },
  },

  "/api/cc-config/backups": {
    get: {
      tags: ["CcConfig"],
      summary: "List artifact backups",
      description:
        "Read-only. Lists backups taken by the mutation endpoints, across the user and project roots plus per-project auto-memory backup dirs. Optional `scope`/`type` narrow the search. Results are sorted newest first. Best-effort: unreadable backup dirs are skipped, never erroring.",
      operationId: "ccConfigGetBackups",
      parameters: [
        {
          name: "scope",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["user", "project"] },
          description:
            "Narrow to a single root scope. Only `user` or `project` are honored; any other value is ignored (both scopes scanned).",
          example: "user",
        },
        {
          name: "type",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["skills", "agents", "commands", "output-styles", "memory", "auto-memory"],
          },
          description: "Narrow to a single artifact type. When omitted, all types are scanned.",
          example: "agents",
        },
        cwdParam,
      ],
      responses: {
        200: {
          description: "Backups sorted newest first.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CcConfigBackupsResponse" },
              example: {
                items: [
                  {
                    scope: "user",
                    type: "agents",
                    name: "my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
                    backupPath:
                      "/Users/son/.claude/cc-config-backups/agents/my-reviewer.md.2026-06-25T12-00-00.000Z.bak",
                    isDir: false,
                    mtime: 1718900000000,
                    size: 2048,
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
