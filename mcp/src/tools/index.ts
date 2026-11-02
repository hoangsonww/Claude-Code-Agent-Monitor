/**
 * @file index.ts
 * @description Main entry point for registering all tools in the MCP application. This module imports and registers tools from various domains, including observability, session management, agent management, event handling, pricing, and maintenance. The registerAllTools function takes a ToolContext as an argument and calls the respective registration functions for each domain to ensure that all tools are properly set up and available for use within the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/index.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Main entry point for registering all tools in the MCP application. This module imports and
 * registers tools from various domains, including observability, session management, agent
 * management, event handling, pricing, and maintenance. The registerAllTools function takes a
 * ToolContext as an argument and calls the respective registration functions for each domain to
 * ensure that all tools are properly set up and available for use within the application.
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
 * - `../types/tool-context.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/agent-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/alert-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/config-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/event-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/import-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/maintenance-tools.js` — repository-local contract consumed by this module; review
 *   its exports before changing assumptions here.
 * - `./domains/observability-tools.js` — repository-local contract consumed by this module; review
 *   its exports before changing assumptions here.
 * - `./domains/pricing-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/push-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/remote-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/run-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/session-detail-tools.js` — repository-local contract consumed by this module; review
 *   its exports before changing assumptions here.
 * - `./domains/session-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/settings-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/webhook-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./domains/workflow-tools.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Public surface
 * - `registerAllTools` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerAllTools` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/index.ts` .
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
 *
 * @param context - Shared tool context passed to every domain.
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
