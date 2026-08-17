/**
 * @file import-tools.ts
 * @description MCP tools for provider-aware history discovery/import and
 * idempotent restoration of a dashboard export from a local JSON file.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

const ProviderSchema = z.enum(["claude", "codex"]);

export function registerImportTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_import_guide",
    "Get provider-aware history locations, archive commands, supported files, and import limits.",
    { provider: ProviderSchema.optional() },
    async (args) =>
      api.get("/api/import/guide", {
        query: { provider: (args.provider as string | undefined) ?? "claude" },
      })
  );

  register(
    "dashboard_rescan_history",
    "Rescan the selected provider's configured default history directory.",
    { provider: ProviderSchema.optional() },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/import/rescan", {
        body: { provider: (args.provider as string | undefined) ?? "claude" },
      });
    }
  );

  register(
    "dashboard_import_history_path",
    "Import Claude Code or Codex history from an existing absolute directory on the dashboard host.",
    {
      path: z.string().min(1).max(4096),
      provider: ProviderSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/import/scan-path", {
        body: {
          path: args.path,
          provider: (args.provider as string | undefined) ?? "claude",
        },
      });
    }
  );

  register(
    "dashboard_upload_history_files",
    "Upload local Claude Code or Codex JSONL/archive files through the same multipart importer used by the app.",
    {
      paths: z.array(z.string().min(1).max(4096)).min(1).max(100),
      provider: ProviderSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.postFiles("/api/import/upload", args.paths as string[], {
        provider: (args.provider as string | undefined) ?? "claude",
      });
    }
  );

  register(
    "dashboard_restore_export",
    "Restore an exported dashboard JSON bundle from an absolute local file path. Existing rows are never overwritten.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/import", { body: { path: args.path } });
    }
  );
}
