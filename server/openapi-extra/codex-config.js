/**
 * @file OpenAPI fragments for the Codex configuration explorer at
 * `/api/codex-config`. It exposes redacted inspection, guarded profile
 * creation, and small explicit local edit/delete surfaces with automatic backups.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "CodexConfig",
    description:
      "Codex CLI configuration discovery plus guarded editing for config.toml, hooks, user rules, skills, and instruction files.",
  },
];

const schemas = {
  CodexConfigOverview: {
    type: "object",
    description:
      "Safe metadata discovered beneath the configured CODEX_HOME. Values of secret-like TOML/JSON keys are redacted before the response is sent.",
    required: [
      "home",
      "config",
      "defaults",
      "counts",
      "models",
      "profiles",
      "mcp",
      "projects",
      "skills",
      "hooks",
      "rules",
      "plugins",
      "instructions",
    ],
    properties: {
      home: {
        type: "string",
        description: "Resolved Codex home directory.",
        example: "/Users/dev/.codex",
      },
      config: {
        type: "object",
        properties: {
          path: { type: "string" },
          exists: { type: "boolean" },
          text: { type: "string", description: "Redacted config.toml preview." },
          truncated: { type: "boolean" },
        },
      },
      defaults: {
        type: "object",
        properties: {
          model: { type: "string", nullable: true },
          reasoningEffort: { type: "string", nullable: true },
          personality: { type: "string", nullable: true },
        },
      },
      counts: { type: "object", additionalProperties: { type: "integer" } },
      models: { type: "object", additionalProperties: true },
      profiles: { type: "array", items: { type: "object", additionalProperties: true } },
      mcp: { type: "array", items: { type: "object", additionalProperties: true } },
      projects: { type: "array", items: { type: "object", additionalProperties: true } },
      skills: { type: "array", items: { type: "object", additionalProperties: true } },
      hooks: { type: "object", additionalProperties: true },
      rules: { type: "array", items: { type: "object", additionalProperties: true } },
      plugins: { type: "array", items: { type: "object", additionalProperties: true } },
      instructions: { type: "array", items: { type: "object", additionalProperties: true } },
    },
  },
  CodexConfigFile: {
    type: "object",
    required: ["path", "text", "size", "mtime", "truncated"],
    properties: {
      path: { type: "string" },
      text: {
        type: "string",
        description: "Contents, redacted where applicable and capped at 256 KiB.",
      },
      size: { type: "integer" },
      mtime: { type: "number" },
      truncated: { type: "boolean" },
    },
  },
  CodexConfigEditableFile: {
    type: "object",
    description:
      "Unredacted local text from the narrowly editable Codex file allowlist. This is intentionally separate from redacted previews so saving never replaces real secret values with placeholders.",
    required: ["path", "text", "size", "mtime", "truncated", "exists"],
    properties: {
      path: { type: "string" },
      text: { type: "string", description: "Unredacted local file contents, capped at 256 KiB." },
      size: { type: "integer" },
      mtime: { type: "number", nullable: true },
      truncated: { type: "boolean" },
      exists: { type: "boolean" },
    },
  },
  CodexConfigWriteResult: {
    type: "object",
    required: ["ok", "file", "backupPath", "created"],
    properties: {
      ok: { type: "boolean", example: true },
      file: { type: "string" },
      backupPath: { type: "string", nullable: true },
      created: { type: "boolean" },
    },
  },
  CodexConfigDeleteResult: {
    type: "object",
    required: ["ok", "file", "backupPath", "deletedDirectory"],
    properties: {
      ok: { type: "boolean", example: true },
      file: { type: "string" },
      backupPath: { type: "string" },
      deletedDirectory: {
        type: "boolean",
        description: "True when removing a skill also removed its containing skill directory.",
      },
    },
  },
  CodexConfigCreateProfile: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        pattern: "^[A-Za-z0-9_-]+$",
        description: "Profile name; creates CODEX_HOME/<name>.config.toml.",
        example: "deep-review",
      },
    },
  },
};

const paths = {
  "/api/codex-config/overview": {
    get: {
      tags: ["CodexConfig"],
      summary: "Read safe Codex configuration metadata",
      description:
        "Returns the current Codex defaults, available model cache, profiles, configured MCP servers/projects, skills, rules, hooks, plugins, and instruction-file metadata. This endpoint only reads local files and redacts secret-like values.",
      operationId: "codexConfigOverview",
      responses: {
        200: {
          description: "Read-only Codex configuration overview.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CodexConfigOverview" } },
          },
        },
      },
    },
  },
  "/api/codex-config/file": {
    get: {
      tags: ["CodexConfig"],
      summary: "Read one safe Codex configuration file",
      description:
        "Reads one file contained by CODEX_HOME, or this repository's AGENTS.md. The target is canonicalized before containment is checked, so a symlink cannot escape the trusted roots. TOML and JSON secret-like values are redacted; files are capped at 256 KiB. Paths outside those roots are refused.",
      operationId: "codexConfigFile",
      parameters: [
        {
          name: "path",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Absolute path under CODEX_HOME or to this project's AGENTS.md.",
        },
      ],
      responses: {
        200: {
          description: "Redacted file content.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CodexConfigFile" } },
          },
        },
        400: {
          description:
            "READ_DENIED — the requested file is outside the allowed roots or unreadable.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
      },
    },
    put: {
      tags: ["CodexConfig"],
      summary: "Save one editable Codex configuration file",
      description:
        "Atomically saves config.toml, named profile overlays, hooks.json, user rules, user skill SKILL.md files, or Codex/project AGENTS.md only. Existing path components may not be symbolic links, the canonical parent must remain inside the trusted root, and content containing the redacted-preview marker `[redacted]` is refused. A timestamped backup is created before every overwrite. The dashboard does not validate TOML, JSON, hook, or instruction syntax.",
      operationId: "codexConfigWriteFile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["path", "content"],
              properties: { path: { type: "string" }, content: { type: "string" } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "The file was saved atomically.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CodexConfigWriteResult" } },
          },
        },
        400: { description: "The path is not in the editable allowlist or content is invalid." },
        413: { description: "The file content exceeds the 256 KiB editor limit." },
      },
    },
    delete: {
      tags: ["CodexConfig"],
      summary: "Delete one user-maintained Codex artifact",
      description:
        "Deletes only hooks.json, a valid named profile overlay, a user rule, a user skill directory, or a Codex/project AGENTS.md file. config.toml is explicitly edit-only. A timestamped backup is made before removal; skill deletion backs up and removes the whole skill directory.",
      operationId: "codexConfigDeleteFile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["path"],
              properties: { path: { type: "string" } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "The artifact was backed up and deleted.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CodexConfigDeleteResult" },
            },
          },
        },
        400: { description: "The path is not allowed to be deleted, including config.toml." },
        404: { description: "The requested artifact does not exist." },
        409: { description: "The path is not a removable file." },
      },
    },
  },
  "/api/codex-config/edit-file": {
    get: {
      tags: ["CodexConfig"],
      summary: "Read one editable Codex file for local editing",
      description:
        "Returns unredacted content only for the editable allowlist. Existing path components may not be symbolic links. Use the normal /file endpoint for redacted read-only previews.",
      operationId: "codexConfigEditableFile",
      parameters: [
        {
          name: "path",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "An allowlisted config, hooks, rule, skill, or instruction file path.",
        },
      ],
      responses: {
        200: {
          description: "Unredacted editable content.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CodexConfigEditableFile" },
            },
          },
        },
        400: { description: "The path is not editable from the dashboard." },
      },
    },
  },
  "/api/codex-config/profiles": {
    post: {
      tags: ["CodexConfig"],
      summary: "Create a named Codex profile overlay",
      description:
        "Creates CODEX_HOME/<name>.config.toml with commented guidance. Codex applies this file over config.toml only when launched with --profile <name>; an existing profile is never overwritten.",
      operationId: "codexConfigCreateProfile",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CodexConfigCreateProfile" },
          },
        },
      },
      responses: {
        201: {
          description: "The newly created editable profile file.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CodexConfigEditableFile" },
            },
          },
        },
        400: { description: "The profile name is invalid." },
        409: { description: "A profile with that name already exists." },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
