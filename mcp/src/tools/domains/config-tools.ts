/**
 * @file config-tools.ts
 * @description MCP tools for comprehensive Claude Code and Codex configuration
 * discovery plus the same backup-backed, allowlisted edits exposed by the app.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

const ClaudeScopeSchema = z.enum(["all", "user", "project"]);
const ClaudeArtifactTypeSchema = z.enum([
  "skills",
  "agents",
  "commands",
  "output-styles",
  "memory",
  "auto-memory",
]);
const ClaudeSurfaceSchema = z.enum([
  "overview",
  "skills",
  "agents",
  "commands",
  "output-styles",
  "plugins",
  "mcp",
  "hooks",
  "settings",
  "memory",
  "marketplaces",
  "keybindings",
  "statusline",
  "hook-scripts",
]);

export function registerConfigTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_claude_config",
    "Inspect one Claude Code configuration surface from the dashboard Config Explorer.",
    {
      surface: ClaudeSurfaceSchema,
      scope: ClaudeScopeSchema.optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      const surface = args.surface as string;
      const scoped = new Set([
        "overview",
        "skills",
        "agents",
        "commands",
        "output-styles",
        "mcp",
        "hooks",
        "settings",
        "memory",
      ]);
      return api.get(`/api/cc-config/${surface}`, {
        query: scoped.has(surface)
          ? {
              scope: args.scope as string | undefined,
              cwd: args.cwd as string | undefined,
            }
          : undefined,
      });
    }
  );

  register(
    "dashboard_read_claude_config_file",
    "Read one allowlisted Claude Code configuration or memory file by absolute path.",
    {
      path: z.string().min(1).max(4096),
      cwd: z.string().max(4096).optional(),
    },
    async (args) =>
      api.get("/api/cc-config/file", {
        query: {
          path: args.path as string,
          cwd: args.cwd as string | undefined,
        },
      })
  );

  register(
    "dashboard_list_claude_config_backups",
    "List timestamped backups created by Claude Config Explorer edits.",
    {
      scope: z.enum(["user", "project"]).optional(),
      artifact_type: ClaudeArtifactTypeSchema.optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) =>
      api.get("/api/cc-config/backups", {
        query: {
          scope: args.scope as string | undefined,
          type: args.artifact_type as string | undefined,
          cwd: args.cwd as string | undefined,
        },
      })
  );

  register(
    "dashboard_write_claude_config_artifact",
    "Create or overwrite an allowlisted Claude Code text artifact with an automatic timestamped backup.",
    {
      scope: z.enum(["user", "project", "auto-memory"]),
      artifact_type: ClaudeArtifactTypeSchema,
      name: z.string().max(256).optional(),
      content: z.string().max(1_000_000),
      project: z.string().max(512).optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/cc-config/file", {
        query: { cwd: args.cwd as string | undefined },
        body: {
          scope: args.scope,
          type: args.artifact_type,
          name: args.name,
          content: args.content,
          project: args.project,
        },
      });
    }
  );

  register(
    "dashboard_delete_claude_config_artifact",
    "Delete an allowlisted Claude Code text artifact after creating a timestamped backup.",
    {
      scope: z.enum(["user", "project", "auto-memory"]),
      artifact_type: ClaudeArtifactTypeSchema,
      name: z.string().max(256).optional(),
      project: z.string().max(512).optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete("/api/cc-config/file", {
        query: { cwd: args.cwd as string | undefined },
        body: {
          scope: args.scope as string,
          type: args.artifact_type as string,
          name: args.name as string | undefined,
          project: args.project as string | undefined,
        },
      });
    }
  );

  register(
    "dashboard_write_claude_keybindings",
    "Replace Claude Code keybinding groups through the structured, backup-backed editor.",
    {
      groups: z.array(JsonObjectSchema).max(500),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/cc-config/keybindings", { body: { groups: args.groups } });
    }
  );

  register(
    "dashboard_get_codex_config",
    "Get the full Codex Config Explorer overview with redacted previews.",
    {},
    async () => api.get("/api/codex-config/overview")
  );

  register(
    "dashboard_read_codex_config_file",
    "Read a redacted Codex configuration preview, or an unredacted editable file when edit=true.",
    {
      path: z.string().min(1).max(4096),
      edit: z.boolean().optional(),
    },
    async (args) =>
      api.get(args.edit ? "/api/codex-config/edit-file" : "/api/codex-config/file", {
        query: { path: args.path as string },
      })
  );

  register(
    "dashboard_write_codex_config_file",
    "Write one allowlisted Codex config, profile, hooks, rule, skill, or instruction file with a timestamped backup.",
    {
      path: z.string().min(1).max(4096),
      content: z.string().max(1_000_000),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/codex-config/file", {
        body: { path: args.path, content: args.content },
      });
    }
  );

  register(
    "dashboard_delete_codex_config_file",
    "Delete one allowlisted user-managed Codex file or skill directory after backing it up.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete("/api/codex-config/file", {
        body: { path: args.path as string },
      });
    }
  );

  register(
    "dashboard_create_codex_profile",
    "Create a new documented Codex profile overlay without modifying config.toml.",
    {
      name: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .max(64),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/codex-config/profiles", { body: { name: args.name } });
    }
  );
}
