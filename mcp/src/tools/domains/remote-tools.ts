/**
 * @file remote-tools.ts
 * @description MCP tools for Remote Data Sources — list configured SSH sources
 * and trigger on-demand syncs so agents can operate remotes without the UI/CLI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers remote-source tools against `/api/remote-sources/*`.
 * List is read-only; sync tools require the mutations policy gate.
 */
export function registerRemoteTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_list_remote_sources",
    "List configured Remote Data Sources (SSH machines) with status and last sync.",
    {},
    async () => api.get("/api/remote-sources")
  );

  register(
    "dashboard_create_remote_source",
    "Create an SSH Remote Data Source for Claude Code and/or Codex history.",
    {
      label: z.string().min(1).max(100),
      host: z.string().min(1).max(255),
      ssh_port: z.number().int().min(1).max(65535).nullable().optional(),
      identity_file: z.string().max(4096).nullable().optional(),
      remote_home: z.string().max(4096).nullable().optional(),
      remote_codex_home: z.string().max(4096).nullable().optional(),
      enabled: z.boolean().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/remote-sources", {
        body: {
          label: args.label,
          host: args.host,
          ssh_port: args.ssh_port,
          identity_file: args.identity_file,
          remote_home: args.remote_home,
          remote_codex_home: args.remote_codex_home,
          enabled: args.enabled,
        },
      });
    }
  );

  register(
    "dashboard_update_remote_source",
    "Update an SSH Remote Data Source, including its enabled state and provider homes.",
    {
      source_id: z.string().min(1).max(256),
      label: z.string().min(1).max(100).optional(),
      host: z.string().min(1).max(255).optional(),
      ssh_port: z.number().int().min(1).max(65535).nullable().optional(),
      identity_file: z.string().max(4096).nullable().optional(),
      remote_home: z.string().max(4096).nullable().optional(),
      remote_codex_home: z.string().max(4096).nullable().optional(),
      enabled: z.boolean().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.patch(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}`, {
        body: {
          label: args.label,
          host: args.host,
          ssh_port: args.ssh_port,
          identity_file: args.identity_file,
          remote_home: args.remote_home,
          remote_codex_home: args.remote_codex_home,
          enabled: args.enabled,
        },
      });
    }
  );

  register(
    "dashboard_test_remote_source",
    "Probe SSH connectivity and provider-history paths for one Remote Data Source without importing.",
    { source_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}/test`);
    }
  );

  register(
    "dashboard_sync_remote_source",
    "Trigger an immediate SSH pull+import for one Remote Data Source by id.",
    {
      source_id: z.string().min(1).describe("Remote source id (src_…)"),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const id = encodeURIComponent(args.source_id as string);
      return api.post(`/api/remote-sources/${id}/sync`);
    }
  );

  register(
    "dashboard_sync_all_remote_sources",
    "Trigger an immediate SSH pull+import for every enabled Remote Data Source.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/remote-sources/sync-all");
    }
  );

  register(
    "dashboard_delete_remote_source",
    "Delete a Remote Data Source. Imported sessions are retained unless purge_data is explicitly true.",
    {
      source_id: z.string().min(1).max(256),
      purge_data: z.boolean().optional(),
      confirmation_token: z.string().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      if (args.purge_data && args.confirmation_token !== "PURGE_REMOTE_SOURCE_DATA") {
        throw new Error(
          'Purging imported sessions requires confirmation_token = "PURGE_REMOTE_SOURCE_DATA".'
        );
      }
      return api.delete(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}`, {
        query: { purge: args.purge_data as boolean | undefined },
      });
    }
  );
}
