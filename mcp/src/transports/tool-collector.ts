/**
 * @file tool-collector.ts
 * @description Collects the canonical MCP domain registrations for direct
 * REPL invocation, preserving the same input schemas and policy guards used by
 * stdio and HTTP protocol transports.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/transports/tool-collector.ts
 * **Area:** MCP transport
 * **Responsibility:**
 * Collects the canonical MCP domain registrations for direct REPL invocation, preserving the same
 * input schemas and policy guards used by stdio and HTTP protocol transports.
 *
 * ## Architectural boundary
 * - Owns protocol lifecycle and connection-specific state while keeping tool semantics in the
 *   shared registry.
 * - Transport code must not write non-protocol data to stdio stdout or retain resources after
 *   disconnect.
 * - Authentication, origin, session, timeout, and graceful-shutdown behavior are explicit security
 *   boundaries.
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
 * - `../tools/index.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Public surface
 * - `collectAllTools` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `collectAllTools` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep stdout reserved for JSON-RPC in stdio mode; diagnostic output belongs through the
 *   configured logger.
 * - Create and dispose per-client server/session resources exactly once across normal close and
 *   error paths.
 * - Bound request bodies, idle sessions, connection counts, and retained event streams.
 * - Validate authentication before allocating expensive state or exposing tool metadata.
 * - Preserve compatibility between streamable HTTP and supported legacy transport behavior where
 *   documented.
 * - Make shutdown idempotent so signals, host disappearance, and transport close cannot race
 *   teardown.
 * - Do not trust forwarded host/origin information unless the server configuration explicitly
 *   enables that topology.
 * - Keep health endpoints lightweight and independent of long-lived MCP session initialization.
 * - Surface protocol errors in the shape expected by the SDK without leaking internal stacks or
 *   secrets.
 * - Test disconnect, expiration, duplicate close, authentication failure, and concurrent-session
 *   isolation.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/transports/tool-collector.ts` .
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
 * **Path:** `mcp/src/transports/tool-collector.ts`
 * **Purpose:** Part of the local MCP server (`npm run mcp:start`) that exposes dashboard operations as MCP tools for Claude Code and other hosts.
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
 * - `../core/tool-registry.js`
 * - `../tools/index.js`
 *
 * ## Public surface
 * - `collectAllTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **collectAllTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";
import { type ToolEntry, createCollectorRegistrar } from "../core/tool-registry.js";
import { registerAllTools } from "../tools/index.js";

/**
 * Collect the canonical tool declarations without constructing an MCP protocol
 * server. The REPL invokes these handlers directly, while schema validation is
 * retained by the collector registrar.
 *
 * @param config - Resolved configuration.
 * @param api - Dashboard API client the tools call.
 * @param logger - Logger.
 * @returns Every tool with its domain, ready for direct invocation.
 */
export function collectAllTools(
  config: AppConfig,
  api: DashboardApiClient,
  logger: Logger
): ToolEntry[] {
  const tools: ToolEntry[] = [];
  registerAllTools({
    config,
    api,
    logger,
    register: createCollectorRegistrar(tools),
  });
  return tools;
}
