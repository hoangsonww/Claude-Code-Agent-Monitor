/**
 * @file agent-tools.ts
 * @description Defines and registers tools for managing agents in the dashboard, including listing agents with filters, retrieving agent details, creating new agents, and updating existing agents. Each tool includes input validation using Zod schemas and interacts with the dashboard API to perform the necessary operations. The tools also check for mutation permissions before allowing changes to agent data, ensuring that the application configuration is respected.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/agent-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Defines and registers tools for managing agents in the dashboard, including listing agents with
 * filters, retrieving agent details, creating new agents, and updating existing agents. Each tool
 * includes input validation using Zod schemas and interacts with the dashboard API to perform the
 * necessary operations. The tools also check for mutation permissions before allowing changes to
 * agent data, ensuring that the application configuration is respected.
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
 * - `../schemas.js` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `registerAgentTools` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerAgentTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/agents` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/agent-tools.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/agent-tools.ts`
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
 * - `../schemas.js`
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerAgentTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerAgentTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { AgentStatusSchema, JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers the four agent-management tools backing `/api/agents/*`. List/
 * get are unconditional reads; create/update call
 * {@link assertMutationsEnabled} first. Agents mirror Claude Code's own
 * main-agent/subagent model: one main agent plus zero or more subagents
 * (`type: "subagent"`, optional `subagent_type`, linked via `parent_agent_id`).
 *
 * @param context - Shared tool context.
 */
export function registerAgentTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  // Policy: none. Input: limit (1-500, default 50), offset (default 0),
  // status/session_id (optional). Calls GET /api/agents?... — the dashboard
  // honors only ONE of status/session_id per call (session_id wins,
  // ignoring limit/offset), so passing both doesn't intersect-filter.
  // Output: { agents, limit, offset }, each agent's own cost attached (from
  // its metadata token buckets, not its session's total).
  register(
    "dashboard_list_agents",
    "List agents with optional status/session filters and pagination.",
    {
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
      status: AgentStatusSchema.optional(),
      session_id: z.string().min(1).max(256).optional(),
      sources: z.array(z.string().min(1).max(256)).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .max(2)
        .optional(),
    },
    async (args) => {
      const limit = (args.limit as number | undefined) ?? 50;
      const offset = (args.offset as number | undefined) ?? 0;
      return api.get("/api/agents", {
        query: {
          limit,
          offset,
          status: args.status as string | undefined,
          session_id: args.session_id as string | undefined,
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      });
    }
  );

  // Policy: none. Input: agent_id (required). Calls GET /api/agents/:id.
  // Output: { agent } — 404s (ApiError, NOT_FOUND) if missing; unlike
  // dashboard_list_agents, no per-agent cost is attached.
  register(
    "dashboard_get_agent",
    "Get a single agent by ID.",
    {
      agent_id: z.string().min(1).max(256),
    },
    async (args) => {
      const agentId = args.agent_id as string;
      return api.get(`/api/agents/${encodeURIComponent(agentId)}`);
    }
  );

  // Policy: MUTATIONS required. Input: id/session_id/name (required); type
  // (default "main"), subagent_type, status (default "waiting"), task,
  // parent_agent_id, metadata (all optional). Calls POST /api/agents.
  // Output: { agent, created } — an existing id returns as-is (created: false).
  register(
    "dashboard_create_agent",
    "Create a new agent in a session.",
    {
      id: z.string().min(1).max(256),
      session_id: z.string().min(1).max(256),
      name: z.string().min(1).max(500),
      type: z.enum(["main", "subagent"]).optional(),
      subagent_type: z.string().max(128).optional(),
      status: AgentStatusSchema.optional(),
      task: z.string().max(5000).optional(),
      parent_agent_id: z.string().max(256).optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/agents", {
        body: {
          id: args.id,
          session_id: args.session_id,
          name: args.name,
          type: args.type,
          subagent_type: args.subagent_type,
          status: args.status,
          task: args.task,
          parent_agent_id: args.parent_agent_id,
          metadata: args.metadata,
        },
      });
    }
  );

  // Policy: MUTATIONS required. Input: agent_id (required);
  // name/status/task/current_tool/ended_at/metadata optional — current_tool
  // is nullable (explicitly clearable) and preserved when omitted entirely.
  // Calls PATCH /api/agents/:id. Output: { agent } — 404s if missing.
  register(
    "dashboard_update_agent",
    "Update an existing agent's lifecycle state and metadata.",
    {
      agent_id: z.string().min(1).max(256),
      name: z.string().max(500).optional(),
      status: AgentStatusSchema.optional(),
      task: z.string().max(5000).optional(),
      current_tool: z.string().max(256).nullable().optional(),
      ended_at: z.string().datetime().optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const agentId = args.agent_id as string;
      return api.patch(`/api/agents/${encodeURIComponent(agentId)}`, {
        body: {
          name: args.name,
          status: args.status,
          task: args.task,
          current_tool: args.current_tool,
          ended_at: args.ended_at,
          metadata: args.metadata,
        },
      });
    }
  );
}
