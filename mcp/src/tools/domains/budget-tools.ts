/**
 * @file budget-tools.ts
 * @description Tool registration for spend-budget functionality in the dashboard.
 * Exposes read access to budgets (with live current-period spend and status) and,
 * when mutations are enabled, create / update / delete operations. Mirrors the
 * REST surface at /api/budgets. Input is validated with Zod before reaching the
 * backend.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

const periodSchema = z.enum(["daily", "weekly", "monthly"]);
const thresholdsSchema = z.array(z.number().int().min(1).max(100)).max(20);

export function registerBudgetTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  register(
    "dashboard_get_budgets",
    "List spend budgets with live current-period spend, percentage, status (ok/warning/exceeded), and remaining headroom.",
    {},
    async () => api.get("/api/budgets")
  );

  register(
    "dashboard_create_budget",
    "Create a spend budget. period is daily/weekly/monthly, limit_usd is the USD ceiling, alert_thresholds are percent-of-limit alert points (default 80 and 100).",
    {
      period: periodSchema,
      limit_usd: z.number().positive().max(1_000_000),
      label: z.string().max(120).optional(),
      enabled: z.boolean().optional(),
      alert_thresholds: thresholdsSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/budgets", {
        body: {
          period: args.period,
          limit_usd: args.limit_usd,
          ...(args.label !== undefined ? { label: args.label } : {}),
          ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
          ...(args.alert_thresholds !== undefined
            ? { alert_thresholds: args.alert_thresholds }
            : {}),
        },
      });
    }
  );

  register(
    "dashboard_update_budget",
    "Update an existing spend budget by id. Provide any subset of period, limit_usd, label, enabled, alert_thresholds.",
    {
      id: z.number().int().positive(),
      period: periodSchema.optional(),
      limit_usd: z.number().positive().max(1_000_000).optional(),
      label: z.string().max(120).nullable().optional(),
      enabled: z.boolean().optional(),
      alert_thresholds: thresholdsSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const { id, ...rest } = args;
      const body: Record<string, unknown> = {};
      for (const key of ["period", "limit_usd", "label", "enabled", "alert_thresholds"] as const) {
        if (rest[key] !== undefined) body[key] = rest[key];
      }
      return api.put(`/api/budgets/${encodeURIComponent(String(id))}`, { body });
    }
  );

  register(
    "dashboard_delete_budget",
    "Delete a spend budget by id.",
    {
      id: z.number().int().positive(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/budgets/${encodeURIComponent(String(args.id))}`);
    }
  );
}
