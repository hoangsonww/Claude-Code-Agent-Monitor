/**
 * @file pricing-tools.ts
 * @description Tool registration for pricing-related functionalities in the dashboard. This includes tools for retrieving pricing rules and calculating total costs based on usage. The tools interact with the backend API to fetch the necessary data and perform calculations as needed. The file also includes input validation using Zod schemas to ensure that the tool arguments are correctly formatted before processing. These tools are essential for providing users with insights into their costs and helping them manage their usage effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerPricingTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  register(
    "dashboard_get_pricing_rules",
    "List all model pricing rules used for cost calculations.",
    {},
    async () => api.get("/api/pricing")
  );

  register(
    "dashboard_get_total_cost",
    "Get total model usage cost across all tracked sessions.",
    {},
    async () => api.get("/api/pricing/cost")
  );

  register(
    "dashboard_get_session_cost",
    "Get model usage cost breakdown for one session.",
    {
      session_id: z.string().min(1).max(256),
    },
    async (args) => {
      const sessionId = args.session_id as string;
      return api.get(`/api/pricing/cost/${encodeURIComponent(sessionId)}`);
    }
  );

  register(
    "dashboard_upsert_pricing_rule",
    "Create or update a pricing rule.",
    {
      model_pattern: z.string().min(1).max(256),
      display_name: z.string().min(1).max(256),
      input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      output_per_mtok: z.number().min(0).max(1_000_000).optional(),
      cache_read_per_mtok: z.number().min(0).max(1_000_000).optional(),
      cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/pricing", {
        body: {
          model_pattern: args.model_pattern,
          display_name: args.display_name,
          input_per_mtok: args.input_per_mtok ?? 0,
          output_per_mtok: args.output_per_mtok ?? 0,
          cache_read_per_mtok: args.cache_read_per_mtok ?? 0,
          cache_write_per_mtok: args.cache_write_per_mtok ?? 0,
        },
      });
    }
  );

  register(
    "dashboard_delete_pricing_rule",
    "Delete one pricing rule by exact model_pattern.",
    {
      model_pattern: z.string().min(1).max(256),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/pricing/${encodeURIComponent(args.model_pattern as string)}`);
    }
  );

  register(
    "dashboard_reset_pricing_defaults",
    "Reset pricing rules to dashboard defaults.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reset-pricing");
    }
  );
}
