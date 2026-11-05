/**
 * @file schemas.ts
 * @description Defines common Zod schemas used across different tools in the MCP application, including enumerations for session status, agent status, and hook types, as well as a generic JSON object schema. These schemas are used for input validation in various tools that manage sessions, agents, events, and hooks within the dashboard. By centralizing these schemas, we ensure consistency and reusability across the codebase.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/schemas.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Defines common Zod schemas used across different tools in the MCP application, including
 * enumerations for session status, agent status, and hook types, as well as a generic JSON object
 * schema. These schemas are used for input validation in various tools that manage sessions,
 * agents, events, and hooks within the dashboard. By centralizing these schemas, we ensure
 * consistency and reusability across the codebase.
 *
 * ## Architectural boundary
 * - Exposes one dashboard capability through a schema-validated MCP tool while delegating data
 *   access to the API client.
 * - Tool descriptions and schemas are part of the model-facing API and must remain precise enough
 *   for safe selection.
 * - Mutation and destructive permissions are enforced centrally and cannot be bypassed by a domain
 *   handler.
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `AgentStatusSchema` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `HookTypeSchema` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `JsonObjectSchema` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SessionStatusSchema` (variable) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AgentStatusSchema` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `HookTypeSchema` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `JsonObjectSchema` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionStatusSchema` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/schemas.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/schemas.ts`
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
 * ## Public surface
 * - `SessionStatusSchema` — exported API; see TSDoc on the symbol for behavior.
 * - `AgentStatusSchema` — exported API; see TSDoc on the symbol for behavior.
 * - `HookTypeSchema` — exported API; see TSDoc on the symbol for behavior.
 * - `JsonObjectSchema` — exported API; see TSDoc on the symbol for behavior.
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
 * **SessionStatusSchema**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AgentStatusSchema**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **HookTypeSchema**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **JsonObjectSchema**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";

/** Session lifecycle states, mirroring the dashboard's `sessions.status`
 * column. Used by `dashboard_list_sessions`'s `status` filter and
 * `dashboard_update_session`'s `status` field. Only `"active"` sessions are
 * eligible for `dashboard_cleanup_data`'s `abandon_hours`; only terminal
 * states are eligible for its `purge_days`. */
export const SessionStatusSchema = z.enum(["active", "completed", "error", "abandoned"]);

/** Agent lifecycle states, mirroring `agents.status`. Used by
 * `dashboard_list_agents`'s `status` filter and `dashboard_create_agent`/
 * `dashboard_update_agent`'s `status` field; new agents default to
 * `"waiting"` server-side when omitted. */
export const AgentStatusSchema = z.enum(["working", "waiting", "completed", "error"]);

/** The seven Claude Code hook lifecycle events the dashboard's ingestion
 * pipeline understands, matching the hook names Claude Code invokes (wired
 * into `~/.claude/settings.json` by `scripts/install-hooks.js`). Used only
 * by `dashboard_ingest_hook_event`'s `hook_type` field — every real hook
 * firing posts one of these via `scripts/hook-handler.js`. */
export const HookTypeSchema = z.enum([
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "Notification",
  "SessionStart",
  "SessionEnd",
]);

/** Permissive arbitrary-JSON-object schema, used for the free-form
 * `metadata` field on session/agent tools and the hook `data` payload in
 * `dashboard_ingest_hook_event`, whose actual shape varies by `hook_type`
 * and is validated by the dashboard server itself, not this MCP layer. */
export const JsonObjectSchema = z.record(z.unknown());
