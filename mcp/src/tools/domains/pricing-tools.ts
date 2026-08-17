/**
 * @file pricing-tools.ts
 * @description Tool registration for pricing-related functionalities in the dashboard. This includes tools for retrieving pricing rules and calculating total costs based on usage. The tools interact with the backend API to fetch the necessary data and perform calculations as needed. The file also includes input validation using Zod schemas to ensure that the tool arguments are correctly formatted before processing. These tools are essential for providing users with insights into their costs and helping them manage their usage effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/pricing-tools.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../../core/tool-registry.js`
 * - `../../policy/tool-guards.js`
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerPricingTools` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **registerPricingTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
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
  const { api, config } = context;
  const register = registrarFor(context);

  // Policy: none. Calls GET /api/pricing. Output: all model_pricing rows
  // (model_pattern, display_name, per-million-token rates).
  register(
    "dashboard_get_pricing_rules",
    "List all model pricing rules used for cost calculations.",
    {},
    async () => api.get("/api/pricing")
  );

  register(
    "dashboard_get_gpt_pricing_rules",
    "List the independent OpenAI/Codex model pricing rules.",
    {},
    async () => api.get("/api/pricing/gpt")
  );

  // Policy: none. Calls GET /api/pricing/cost. Output: aggregate cost/token
  // totals across all sessions plus a per-day daily_costs breakdown, each
  // day priced at the rate effective on that date.
  register(
    "dashboard_get_total_cost",
    "Get total model usage cost across all tracked sessions.",
    {
      timezone_offset_minutes: z.number().int().min(-1440).max(1440).optional(),
      sources: z.array(z.string().min(1).max(256)).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .max(2)
        .optional(),
    },
    async (args) =>
      api.get("/api/pricing/cost", {
        query: {
          tz_offset: args.timezone_offset_minutes as number | undefined,
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      })
  );

  // Policy: none. Input: session_id (required). Calls
  // GET /api/pricing/cost/:sessionId. Output: cost/token breakdown for that
  // session, priced as of its start date.
  register(
    "dashboard_get_session_cost",
    "Get model usage cost breakdown for one session.",
    {
      session_id: z.string().min(1).max(256),
      timezone_offset_minutes: z.number().int().min(-1440).max(1440).optional(),
      sources: z.array(z.string().min(1).max(256)).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .max(2)
        .optional(),
    },
    async (args) => {
      const sessionId = args.session_id as string;
      return api.get(`/api/pricing/cost/${encodeURIComponent(sessionId)}`, {
        query: {
          tz_offset: args.timezone_offset_minutes as number | undefined,
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      });
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
      cache_write_1h_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_output_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_output_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_cache_read_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_cache_write_1h_per_mtok: z.number().min(0).max(1_000_000).optional(),
      intro_until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
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
          cache_write_1h_per_mtok: args.cache_write_1h_per_mtok ?? 0,
          fast_input_per_mtok: args.fast_input_per_mtok ?? 0,
          fast_output_per_mtok: args.fast_output_per_mtok ?? 0,
          intro_input_per_mtok: args.intro_input_per_mtok,
          intro_output_per_mtok: args.intro_output_per_mtok,
          intro_cache_read_per_mtok: args.intro_cache_read_per_mtok,
          intro_cache_write_per_mtok: args.intro_cache_write_per_mtok,
          intro_cache_write_1h_per_mtok: args.intro_cache_write_1h_per_mtok,
          intro_until: args.intro_until,
        },
      });
    }
  );

  register(
    "dashboard_upsert_gpt_pricing_rule",
    "Create or update an OpenAI/Codex pricing rule for short, long-context, and fast-mode usage.",
    {
      model_pattern: z.string().min(1).max(256),
      display_name: z.string().min(1).max(256),
      short_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      short_cached_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      short_cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
      short_output_per_mtok: z.number().min(0).max(1_000_000).optional(),
      long_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      long_cached_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      long_cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
      long_output_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_cached_input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
      fast_output_per_mtok: z.number().min(0).max(1_000_000).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/pricing/gpt", { body: args });
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

  register(
    "dashboard_delete_gpt_pricing_rule",
    "Delete one OpenAI/Codex pricing rule by exact model_pattern.",
    { model_pattern: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/pricing/gpt/${encodeURIComponent(args.model_pattern as string)}`);
    }
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/reset-pricing,
  // which deletes ALL rules (including custom ones) and reseeds the
  // built-in defaults, then re-applies any active intro-rate promos so they
  // aren't lost. With no provider body, this intentionally preserves the
  // compatibility behavior of resetting both Claude and GPT tables. Output:
  // { ok, provider: "both", pricing, gpt_pricing }.
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
