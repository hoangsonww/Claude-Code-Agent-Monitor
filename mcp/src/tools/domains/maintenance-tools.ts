/**
 * @file maintenance-tools.ts
 * @description Defines a set of maintenance tools for the MCP dashboard, including functions to clean up stale sessions, re-import legacy data, reinstall hooks, and clear all data. These tools are registered with the MCP server and include appropriate guards to ensure that mutating and destructive actions are only performed when explicitly allowed in the configuration. The tools interact with the MCP server's API to perform the necessary maintenance tasks, providing a way for administrators to manage the dashboard's data and settings effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertDestructiveEnabled, assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerMaintenanceTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  register(
    "dashboard_cleanup_data",
    "Maintenance: abandon stale sessions and/or purge old completed data.",
    {
      abandon_hours: z
        .number()
        .int()
        .min(1)
        .max(24 * 365)
        .optional(),
      purge_days: z.number().int().min(1).max(3650).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const abandonHours = args.abandon_hours as number | undefined;
      const purgeDays = args.purge_days as number | undefined;
      if (abandonHours === undefined && purgeDays === undefined) {
        throw new Error("At least one field is required: abandon_hours or purge_days.");
      }
      return api.post("/api/settings/cleanup", {
        body: {
          abandon_hours: abandonHours,
          purge_days: purgeDays,
        },
      });
    }
  );

  register(
    "dashboard_reimport_history",
    "Re-import legacy Claude sessions from ~/.claude into the local dashboard database.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reimport");
    }
  );

  register(
    "dashboard_reinstall_hooks",
    "Reinstall Claude Code hooks in ~/.claude/settings.json.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reinstall-hooks");
    }
  );

  register(
    "dashboard_clear_all_data",
    "Delete all tracked sessions, agents, events, and token usage. Highly destructive.",
    {
      confirmation_token: z.string().min(1),
    },
    async (args) => {
      const confirmationToken = args.confirmation_token as string;
      assertDestructiveEnabled(config, confirmationToken);
      return api.post("/api/settings/clear-data");
    }
  );
}
