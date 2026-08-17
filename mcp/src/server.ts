/**
 * @file server.ts
 * @description Main entry point for building the MCP server. This module defines the buildServer function, which initializes a new MCP server instance with the provided configuration, API client, and logger. It also registers all tools by calling the registerAllTools function, which sets up the tool handlers for the server. The buildServer function returns the configured MCP server instance, ready to be started and handle incoming requests from the MCP client. This module serves as the central place for assembling the server components and ensuring that all necessary tools are registered before the server starts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/server.ts`
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
 * - `./config/app-config.js`
 * - `./clients/dashboard-api-client.js`
 * - `./core/logger.js`
 * - `./tools/index.js`
 *
 * ## Public surface
 * - `buildServer` — exported API; see TSDoc on the symbol for behavior.
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
 * **buildServer**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config/app-config.js";
import { DashboardApiClient } from "./clients/dashboard-api-client.js";
import { Logger } from "./core/logger.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Constructs one fully-configured `McpServer` with every `dashboard_*` tool
 * registered. A factory, not a singleton: stdio calls it once, while the
 * HTTP transport calls it once per new client session (Streamable HTTP or
 * legacy SSE), giving each session isolated server state while sharing the
 * same {@link AppConfig}/{@link DashboardApiClient}.
 * @returns A new `McpServer` with all six tool domains registered, ready to
 *   `connect()` to a transport.
 */
export function buildServer(config: AppConfig, api: DashboardApiClient, logger: Logger): McpServer {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerAllTools({
    server,
    config,
    api,
    logger,
  });

  return server;
}
