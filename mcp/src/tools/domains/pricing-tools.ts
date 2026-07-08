/**
 * @file pricing-tools.ts
 * @description Tool registration for pricing-related functionalities in the dashboard. This includes tools for retrieving pricing rules and calculating total costs based on usage. The tools interact with the backend API to fetch the necessary data and perform calculations as needed. The file also includes input validation using Zod schemas to ensure that the tool arguments are correctly formatted before processing. These tools are essential for providing users with insights into their costs and helping them manage their usage effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers six tools covering `/api/pricing/*` plus the pricing-adjacent
 * `/api/settings/reset-pricing`. Reads are always available; writes
 * (upsert/delete/reset) require {@link assertMutationsEnabled}. Costs are
 * priced as of the usage date (session start date), not today's rate, so
 * historical costs stay correct across a promotional-rate cutover.
 */
export function registerPricingTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  // Policy: none. Calls GET /api/pricing. Output: all model_pricing rows
  // (model_pattern, display_name, per-million-token rates).
  register(
    "dashboard_get_pricing_rules",
    "List all model pricing rules used for cost calculations.",
    {},
    async () => api.get("/api/pricing")
  );

  // Policy: none. Calls GET /api/pricing/cost. Output: aggregate cost/token
  // totals across all sessions plus a per-day daily_costs breakdown, each
  // day priced at the rate effective on that date.
  register(
    "dashboard_get_total_cost",
    "Get total model usage cost across all tracked sessions.",
    {},
    async () => api.get("/api/pricing/cost")
  );

  // Policy: none. Input: session_id (required). Calls
  // GET /api/pricing/cost/:sessionId. Output: cost/token breakdown for that
  // session, priced as of its start date.
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

  // Policy: MUTATIONS required. Input: model_pattern + display_name
  // (required); input/output/cache_read/cache_write rates (optional,
  // defaulted to 0 here). Calls PUT /api/pricing — a true `INSERT ...
  // ON CONFLICT DO UPDATE` upsert (unlike sessions/agents' create-if-absent):
  // an existing rule is fully overwritten. CAUTION: cache_write_1h_per_mtok/
  // fast_input_per_mtok/fast_output_per_mtok aren't exposed here, so
  // upserting an existing rule silently zeroes those columns. Time-limited
  // intro_* rates are untouched (server only rewrites them when an intro_*
  // field is sent). Output: the upserted rule.
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

  // Policy: MUTATIONS required. Input: model_pattern (exact match). Calls
  // DELETE /api/pricing/:model_pattern. Output: { ok: true }. Throws
  // (ApiError, NOT_FOUND) if no rule matches.
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

  // Policy: MUTATIONS required. Calls POST /api/settings/reset-pricing,
  // which deletes ALL rules (including custom ones) and reseeds the
  // built-in defaults, then re-applies any active intro-rate promos so they
  // aren't lost. Output: { ok: true, pricing: [...] } — the reseeded list.
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
