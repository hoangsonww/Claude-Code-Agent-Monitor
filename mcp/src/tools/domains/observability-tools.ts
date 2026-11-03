/**
 * @file observability-tools.ts
 * @description Tool registration for observability-related tools in the MCP server. This module defines a set of tools that interact with the Agent Dashboard API to provide health checks, stats, analytics, system information, data export, and operational snapshots. These tools enable users to monitor and analyze the performance and usage of their agents and sessions through the dashboard. Each tool is registered with a name, description, input schema (if applicable), and an asynchronous handler function that makes API calls to retrieve the necessary data.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/observability-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Tool registration for observability-related tools in the MCP server. This module defines a set of
 * tools that interact with the Agent Dashboard API to provide health checks, stats, analytics,
 * system information, data export, and operational snapshots. These tools enable users to monitor
 * and analyze the performance and usage of their agents and sessions through the dashboard. Each
 * tool is registered with a name, description, input schema (if applicable), and an asynchronous
 * handler function that makes API calls to retrieve the necessary data.
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
 * - `../../types/tool-context.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `registerObservabilityTools` (function) — exported contract; search downstream imports and
 *   tests before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerObservabilityTools` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 *
 * ## Literal API paths
 * - `/api/agents` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/analytics` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/events` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/health` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/metrics` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/sessions` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/settings/export` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/settings/info` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/stats` — route literal present in this source; keep request/response expectations aligned
 *   with the server and API docs.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/observability-tools.ts`
 *   .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/observability-tools.ts`
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
 * - `../../types/tool-context.js`
 * - `../../core/tool-registry.js`
 *
 * ## Public surface
 * - `registerObservabilityTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerObservabilityTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import type { ToolContext } from "../../types/tool-context.js";
import { registrarFor } from "../../core/tool-registry.js";

/**
 * Registers the six read-only observability tools. None call
 * {@link assertMutationsEnabled}/{@link assertDestructiveEnabled} — all are
 * plain GETs, always available regardless of policy flags.
 * `dashboard_get_operational_snapshot` is the only one fanning out to
 * multiple endpoints in parallel rather than proxying a single one.
 *
 * @param context - Shared tool context.
 */
export function registerObservabilityTools(context: ToolContext): void {
  const { api } = context;
  const register = registrarFor(context);

  // Calls GET /api/health. Output: dashboard liveness payload — a fast
  // pre-flight check, since every other tool needs the dashboard running at
  // config.dashboardBaseUrl or it fails with an ApiError network/timeout.
  register(
    "dashboard_health_check",
    "Check health of the local Agent Dashboard API.",
    {},
    async () => api.get("/api/health")
  );

  // Calls GET /api/stats. Output: session/agent counts by status,
  // events-today, and live websocket connection count.
  register(
    "dashboard_get_stats",
    "Get dashboard overview stats including session/agent counts and websocket connections.",
    {
      sources: z.array(z.string().min(1).max(256)).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .max(2)
        .optional(),
    },
    async (args) =>
      api.get("/api/stats", {
        query: {
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      })
  );

  // Calls GET /api/analytics. Output: token totals/cost, per-tool usage
  // counts, daily event/session counts, agent type distribution, and
  // event-type breakdown — backs the dashboard's Analytics page.
  register(
    "dashboard_get_analytics",
    "Get analytics summary including token totals, usage trends, and distributions.",
    {
      sources: z.array(z.string().min(1).max(256)).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .max(2)
        .optional(),
    },
    async (args) =>
      api.get("/api/analytics", {
        query: {
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      })
  );

  // Calls GET /api/settings/info. Output: SQLite path/size/counts/pragmas,
  // recent ingestion load (5/15/60 min), Claude Code hook install status,
  // and Node/OS process info (uptime, memory, cpu, ws connections).
  register(
    "dashboard_get_system_info",
    "Get system info, DB stats, and hook installation status.",
    {},
    async () => api.get("/api/settings/info")
  );

  // Calls GET /api/settings/export. Output: the full dashboard dataset —
  // sessions, agents, events, token_usage, pricing rules — same payload the
  // UI's "Export Data" button downloads (its attachment header has no
  // effect on this client).
  register(
    "dashboard_export_data",
    "Export complete dashboard data payload (sessions, agents, events, tokens, pricing).",
    {},
    async () => api.get("/api/settings/export")
  );

  // Input: three optional per-section limits, each defaulted below. Fans
  // out via Promise.all to GET /api/stats, /api/analytics, /api/events,
  // /api/sessions?status=active, and /api/agents queried twice
  // (status=working, status=connected — the dashboard filters one status
  // per call). Output: one combined { stats, analytics, recent_events,
  // active_sessions, active_agents: {working, connected}, generated_at }.
  register(
    "dashboard_get_operational_snapshot",
    "Get a high-signal operational snapshot combining stats, analytics, active sessions, active agents, and recent events.",
    {
      recent_events_limit: z.number().int().min(1).max(50).optional(),
      active_sessions_limit: z.number().int().min(1).max(100).optional(),
      active_agents_limit: z.number().int().min(1).max(200).optional(),
    },
    async (args) => {
      const eventsLimit = (args.recent_events_limit as number | undefined) ?? 20;
      const sessionsLimit = (args.active_sessions_limit as number | undefined) ?? 25;
      const agentsLimit = (args.active_agents_limit as number | undefined) ?? 100;

      const [stats, analytics, recentEvents, activeSessions, workingAgents, connectedAgents] =
        await Promise.all([
          api.get("/api/stats"),
          api.get("/api/analytics"),
          api.get("/api/events", { query: { limit: eventsLimit, offset: 0 } }),
          api.get("/api/sessions", {
            query: { status: "active", limit: sessionsLimit, offset: 0 },
          }),
          api.get("/api/agents", {
            query: { status: "working", limit: agentsLimit, offset: 0 },
          }),
          api.get("/api/agents", {
            query: { status: "connected", limit: agentsLimit, offset: 0 },
          }),
        ]);

      return {
        stats,
        analytics,
        recent_events: recentEvents,
        active_sessions: activeSessions,
        active_agents: {
          working: workingAgents,
          connected: connectedAgents,
        },
        generated_at: new Date().toISOString(),
      };
    }
  );

  register(
    "dashboard_get_prometheus_metrics",
    "Get the dashboard's Prometheus text exposition as returned by /api/metrics.",
    {},
    async () => api.get("/api/metrics")
  );
}
