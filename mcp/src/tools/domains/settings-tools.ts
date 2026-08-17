/**
 * @file settings-tools.ts
 * @description MCP tools for dashboard update status, hook installation, and
 * live-safe Claude Code/Codex home-directory configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerSettingsTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_update_status",
    "Get cached or current upstream checkout status.",
    {},
    async () => api.get("/api/updates/status")
  );

  register(
    "dashboard_check_for_updates",
    "Refresh upstream checkout status and broadcast the result to connected dashboards.",
    {},
    async () => api.post("/api/updates/check")
  );

  register(
    "dashboard_get_agent_homes",
    "Get the active Claude Code and Codex state directories.",
    {},
    async () => {
      const [claude, codex] = await Promise.all([
        api.get("/api/settings/claude-home"),
        api.get("/api/settings/codex-home"),
      ]);
      return { claude, codex };
    }
  );

  register(
    "dashboard_set_claude_home",
    "Set the Claude Code state directory used by hook and transcript discovery.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/settings/claude-home", { body: { path: args.path } });
    }
  );

  register(
    "dashboard_set_codex_home",
    "Set the Codex state directory and re-arm the live rollout synchronizer.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/settings/codex-home", { body: { path: args.path } });
    }
  );

  register(
    "dashboard_install_hooks",
    "Install or update the selected Claude Code and Codex hook integrations.",
    {
      providers: z
        .array(z.enum(["claude", "codex"]))
        .min(1)
        .max(2)
        .refine((providers) => new Set(providers).size === providers.length, {
          message: "providers must not contain duplicates",
        }),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/install-hooks", { body: { providers: args.providers } });
    }
  );
}
