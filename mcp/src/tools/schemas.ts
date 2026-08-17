/**
 * @file schemas.ts
 * @description Defines common Zod schemas used across different tools in the MCP application, including enumerations for session status, agent status, and hook types, as well as a generic JSON object schema. These schemas are used for input validation in various tools that manage sessions, agents, events, and hooks within the dashboard. By centralizing these schemas, we ensure consistency and reusability across the codebase.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
