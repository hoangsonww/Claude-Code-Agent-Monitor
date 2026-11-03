/**
 * @file tool-context.ts
 * @description Defines the ToolContext interface, which encapsulates the necessary context for tool handlers in the MCP application. This context includes references to the MCP server instance, application configuration, dashboard API client, and logger. The ToolContext is passed to tool registration functions to provide them with access to these resources when defining and implementing tools. This design promotes modularity and separation of concerns by centralizing shared dependencies in a single context object.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/types/tool-context.ts
 * **Area:** MCP server
 * **Responsibility:**
 * Defines the ToolContext interface, which encapsulates the necessary context for tool handlers in
 * the MCP application. This context includes references to the MCP server instance, application
 * configuration, dashboard API client, and logger. The ToolContext is passed to tool registration
 * functions to provide them with access to these resources when defining and implementing tools.
 * This design promotes modularity and separation of concerns by centralizing shared dependencies in
 * a single context object.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Local dependency edges
 * - `../clients/dashboard-api-client.js` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 * - `../config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../core/logger.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../core/tool-registry.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@modelcontextprotocol/sdk/server/mcp.js` — external package boundary; keep usage within the
 *   installed version and the repository's existing adapter patterns.
 *
 * ## Public surface
 * - `ToolContext` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ToolContext` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/types/tool-context.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/types/tool-context.ts`
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
 * - `../config/app-config.js`
 * - `../clients/dashboard-api-client.js`
 * - `../core/logger.js`
 *
 * ## Public surface
 * - `ToolContext` — exported API; see TSDoc on the symbol for behavior.
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
 * **ToolContext**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";
import type { ToolRegistrar } from "../core/tool-registry.js";

/**
 * Shared dependency bundle injected into every `register*Tools` function
 * under `tools/domains/`. Adding a new dependency only requires updating
 * this interface and `server.ts` (the sole place that constructs it).
 */
export interface ToolContext {
  /** MCP server tool modules call `registerTool` on. Omitted when collecting
   * the same catalog for the direct-invocation REPL. */
  server?: McpServer;
  /** Optional registrar override used by the REPL collector. Domain modules
   * fall back to a live MCP registrar when this is omitted. */
  register?: ToolRegistrar;
  /** Resolved config — dashboard URL, timeouts/retries, mutation/destructive
   * policy flags checked by `policy/tool-guards.ts`. */
  config: AppConfig;
  /** HTTP client to the dashboard's `/api/*` Express API — the only way
   * tools read or write dashboard state. */
  api: DashboardApiClient;
  /** Shared structured JSON logger (stderr). */
  logger: Logger;
}
