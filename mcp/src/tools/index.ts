/**
 * @file index.ts
 * @description Main entry point for registering all tools in the MCP application. This module imports and registers tools from various domains, including observability, session management, agent management, event handling, pricing, and maintenance. The registerAllTools function takes a ToolContext as an argument and calls the respective registration functions for each domain to ensure that all tools are properly set up and available for use within the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/index.ts`
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
 * - `../types/tool-context.js`
 * - `./domains/observability-tools.js`
 * - `./domains/session-tools.js`
 * - `./domains/agent-tools.js`
 * - `./domains/event-tools.js`
 * - `./domains/pricing-tools.js`
 * - `./domains/maintenance-tools.js`
 *
 * ## Public surface
 * - `registerAllTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerAllTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { ToolContext } from "../types/tool-context.js";
import { registerObservabilityTools } from "./domains/observability-tools.js";
import { registerSessionTools } from "./domains/session-tools.js";
import { registerAgentTools } from "./domains/agent-tools.js";
import { registerEventTools } from "./domains/event-tools.js";
import { registerPricingTools } from "./domains/pricing-tools.js";
import { registerMaintenanceTools } from "./domains/maintenance-tools.js";
import { registerRemoteTools } from "./domains/remote-tools.js";
import { registerWorkflowTools } from "./domains/workflow-tools.js";
import { registerAlertTools } from "./domains/alert-tools.js";
import { registerWebhookTools } from "./domains/webhook-tools.js";
import { registerImportTools } from "./domains/import-tools.js";
import { registerConfigTools } from "./domains/config-tools.js";
import { registerRunTools } from "./domains/run-tools.js";
import { registerSettingsTools } from "./domains/settings-tools.js";
import { registerSessionDetailTools } from "./domains/session-detail-tools.js";
import { registerPushTools } from "./domains/push-tools.js";

/**
 * Registers all 29 `dashboard_*` tools with the given {@link ToolContext} in
 * one call. `server.ts`'s `buildServer` calls this per `McpServer` instance;
 * `transports/tool-collector.ts`'s `collectAllTools` independently
 * re-implements the same registrations for REPL mode (no live server), so
 * the two files must be kept in sync by hand when a tool changes.
 */
export function registerAllTools(context: ToolContext): void {
  registerObservabilityTools(context);
  registerSessionTools(context);
  registerAgentTools(context);
  registerEventTools(context);
  registerPricingTools(context);
  registerMaintenanceTools(context);
  registerRemoteTools(context);
  registerWorkflowTools(context);
  registerAlertTools(context);
  registerWebhookTools(context);
  registerImportTools(context);
  registerConfigTools(context);
  registerRunTools(context);
  registerSettingsTools(context);
  registerSessionDetailTools(context);
  registerPushTools(context);
}
