/**
 * @file pricing-tools.ts
 * @description Tool registration for pricing-related functionalities in the dashboard. This includes tools for retrieving pricing rules and calculating total costs based on usage. The tools interact with the backend API to fetch the necessary data and perform calculations as needed. The file also includes input validation using Zod schemas to ensure that the tool arguments are correctly formatted before processing. These tools are essential for providing users with insights into their costs and helping them manage their usage effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/pricing-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Tool registration for pricing-related functionalities in the dashboard. This includes tools for
 * retrieving pricing rules and calculating total costs based on usage. The tools interact with the
 * backend API to fetch the necessary data and perform calculations as needed. The file also
 * includes input validation using Zod schemas to ensure that the tool arguments are correctly
 * formatted before processing. These tools are essential for providing users with insights into
 * their costs and helping them manage their usage effectively.
 *
 * ## Architectural boundary
 * - Exposes one dashboard capability through a schema-validated MCP tool while delegating data
 *   access to the API client.
 * - Tool descriptions and schemas are part of the model-facing API and must remain precise enough
 *   for safe selection.
 * - Mutation and destructive permissions are enforced centrally and cannot be bypassed by a domain
 *   handler.
 *
 * ## Local dependency edges
 * - `../../core/tool-registry.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../../policy/tool-guards.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../../types/tool-context.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `registerPricingTools` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerPricingTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/pricing` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/pricing/cost` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/pricing/cursor` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/pricing/gpt` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/settings/reset-pricing` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 *
 * ## Area invariants
 * - Validate every argument with the declared schema before constructing requests or selecting
 *   resource identifiers.
 * - Keep read, mutation, and destructive operations correctly classified for policy guards.
 * - Return structured tool results through shared helpers so errors and JSON payloads remain
 *   transport-neutral.
 * - Do not leak dashboard tokens, webhook secrets, SSH material, raw environment values, or
 *   unredacted configuration.
 * - Preserve pagination and explicit limits for potentially large session, event, transcript, or
 *   metrics responses.
 * - Use exact API route and field names from the typed client rather than duplicating ad hoc HTTP
 *   calls.
 * - Keep tool names stable; hosts and prompts may persist them outside this repository.
 * - Explain confirmation requirements in both schema descriptions and policy errors for destructive
 *   actions.
 * - Keep handlers independent of stdio, HTTP, and REPL transport details.
 * - Test successful, validation, permission-denied, API-error, and redaction paths for each
 *   risk-bearing tool.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/pricing-tools.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
 * Registers provider-specific tools covering `/api/pricing/*` plus the pricing-adjacent
 * `/api/settings/reset-pricing`. Reads are always available; writes
 * (upsert/delete/reset) require {@link assertMutationsEnabled}. Costs are
 * priced as of the usage date (session start date), not today's rate, so
 * historical costs stay correct across a promotional-rate cutover.
 *
 * @param context - Shared tool context.
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

  register(
    "dashboard_get_cursor_pricing_rules",
    "List the independent Cursor model pricing rules.",
    {},
    async () => api.get("/api/pricing/cursor")
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
        .array(z.enum(["claude", "cursor", "codex"]))
        .max(3)
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
        .array(z.enum(["claude", "cursor", "codex"]))
        .max(3)
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

  register(
    "dashboard_upsert_cursor_pricing_rule",
    "Create or update a Cursor pricing rule with input, cache-write, cache-read, and output rates.",
    {
      model_pattern: z.string().min(1).max(256),
      display_name: z.string().min(1).max(256),
      input_per_mtok: z.number().min(0).max(1_000_000).optional(),
      cache_write_per_mtok: z.number().min(0).max(1_000_000).optional(),
      cache_read_per_mtok: z.number().min(0).max(1_000_000).optional(),
      output_per_mtok: z.number().min(0).max(1_000_000).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/pricing/cursor", {
        body: {
          model_pattern: args.model_pattern,
          display_name: args.display_name,
          input_per_mtok: args.input_per_mtok ?? 0,
          cache_write_per_mtok: args.cache_write_per_mtok ?? 0,
          cache_read_per_mtok: args.cache_read_per_mtok ?? 0,
          output_per_mtok: args.output_per_mtok ?? 0,
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

  register(
    "dashboard_delete_gpt_pricing_rule",
    "Delete one OpenAI/Codex pricing rule by exact model_pattern.",
    { model_pattern: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/pricing/gpt/${encodeURIComponent(args.model_pattern as string)}`);
    }
  );

  register(
    "dashboard_delete_cursor_pricing_rule",
    "Delete one Cursor pricing rule by exact model_pattern.",
    { model_pattern: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/pricing/cursor/${encodeURIComponent(args.model_pattern as string)}`);
    }
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/reset-pricing,
  // which deletes ALL rules (including custom ones) and reseeds the
  // built-in defaults, then re-applies any active intro-rate promos so they
  // aren't lost. With no provider body, this intentionally preserves the
  // compatibility behavior of resetting Claude, Cursor, and GPT tables. Output:
  // { ok, provider: "both", pricing, cursor_pricing, gpt_pricing }.
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
