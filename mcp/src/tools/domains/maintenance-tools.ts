/**
 * @file maintenance-tools.ts
 * @description Defines a set of maintenance tools for the MCP dashboard, including functions to clean up stale sessions, re-import legacy data, reinstall hooks, and clear all data. These tools are registered with the MCP server and include appropriate guards to ensure that mutating and destructive actions are only performed when explicitly allowed in the configuration. The tools interact with the MCP server's API to perform the necessary maintenance tasks, providing a way for administrators to manage the dashboard's data and settings effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertDestructiveEnabled, assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers four administrative tools against `/api/settings/*`. All four
 * require mutations; `dashboard_clear_all_data` additionally requires the
 * destructive tier plus an exact confirmation token, since it's the only
 * irreversible one (cleanup only touches stale/old rows; reimport and
 * reinstall-hooks are idempotent, repeatable operations).
 */
export function registerMaintenanceTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  // Policy: MUTATIONS required (checked before the "at least one field"
  // validation below). Input: abandon_hours (1 to 24*365) and/or purge_days
  // (1-3650) — at least one required. Calls POST /api/settings/cleanup.
  // abandon_hours marks "active" sessions with no recent events as
  // "abandoned" (completing lingering agents); purge_days permanently
  // deletes terminal sessions (+ agents/events) older than N days. Output:
  // { abandoned, purged_sessions, purged_events, purged_agents } counts.
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

  // Policy: MUTATIONS required. Calls POST /api/settings/reimport, invoking
  // scripts/import-history.js against ~/.claude session-history JSONL files
  // — useful for backfilling sessions that predate hook installation or
  // recovering after a reset. Output: { ok: true, ...result }. Throws
  // (ApiError, IMPORT_FAILED) if the import script itself throws.
  register(
    "dashboard_reimport_history",
    "Re-import legacy Claude sessions from ~/.claude into the local dashboard database.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reimport");
    }
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/reinstall-hooks,
  // invoking scripts/install-hooks.js to (re)write the seven hook entries
  // (PreToolUse/PostToolUse/Stop/SubagentStop/Notification/SessionStart/
  // SessionEnd) into ~/.claude/settings.json, overwriting any existing
  // config. Output: { ok, hooks } — same shape as dashboard_get_system_info.
  register(
    "dashboard_reinstall_hooks",
    "Reinstall Claude Code hooks in ~/.claude/settings.json.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reinstall-hooks");
    }
  );

  // Policy: DESTRUCTIVE required — the strictest gate in the server. Input:
  // confirmation_token, must exactly equal "CLEAR_ALL_DATA". Calls
  // POST /api/settings/clear-data, irreversibly deleting every row from
  // sessions, agents, events, token_usage, alert_events, and
  // webhook_deliveries — but preserving alert rules, webhook targets, and
  // pricing rules (user configuration, not activity data). Output:
  // { ok: true, cleared } with pre-deletion row counts. No undo; the only
  // tool gated by MCP_DASHBOARD_ALLOW_DESTRUCTIVE.
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
