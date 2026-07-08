/**
 * @file schemas.ts
 * @description Defines common Zod schemas used across different tools in the MCP application, including enumerations for session status, agent status, and hook types, as well as a generic JSON object schema. These schemas are used for input validation in various tools that manage sessions, agents, events, and hooks within the dashboard. By centralizing these schemas, we ensure consistency and reusability across the codebase.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
