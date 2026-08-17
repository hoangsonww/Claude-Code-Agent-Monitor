/**
 * @file tool-context.ts
 * @description Defines the ToolContext interface, which encapsulates the necessary context for tool handlers in the MCP application. This context includes references to the MCP server instance, application configuration, dashboard API client, and logger. The ToolContext is passed to tool registration functions to provide them with access to these resources when defining and implementing tools. This design promotes modularity and separation of concerns by centralizing shared dependencies in a single context object.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
