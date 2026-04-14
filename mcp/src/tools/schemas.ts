/**
 * @file schemas.ts
 * @description Defines common Zod schemas used across different tools in the MCP application, including enumerations for session status, agent status, and hook types, as well as a generic JSON object schema. These schemas are used for input validation in various tools that manage sessions, agents, events, and hooks within the dashboard. By centralizing these schemas, we ensure consistency and reusability across the codebase.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";

export const SessionStatusSchema = z.enum(["active", "completed", "error", "abandoned"]);
export const AgentStatusSchema = z.enum(["idle", "connected", "working", "completed", "error"]);
export const HookTypeSchema = z.enum([
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "Notification",
  "SessionStart",
  "SessionEnd",
]);

export const JsonObjectSchema = z.record(z.unknown());
