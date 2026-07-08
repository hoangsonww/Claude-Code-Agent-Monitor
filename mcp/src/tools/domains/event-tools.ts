/**
 * @file event-tools.ts
 * @description Defines tools related to event management in the dashboard, including listing events with optional filters and ingesting hook events from Claude Code. The tools are registered with the tool registry and include input validation using Zod schemas. The event listing tool supports pagination and session filtering, while the hook event ingestion tool allows for adding new events into the dashboard pipeline, with a guard to ensure that mutations are enabled in the configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { HookTypeSchema, JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers the two event-related tools: a read-only list and a mutation
 * that feeds the same ingestion pipeline the installed Claude Code hooks
 * use (`scripts/hook-handler.js` → `POST /api/hooks/event`) — the one domain
 * where a tool can inject data into the dashboard's real-time pipeline
 * (websocket broadcast + alert evaluation), useful for testing hook
 * behavior without a live Claude Code session.
 */
export function registerEventTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  // Policy: none. Input: limit (1-200, default 50), offset (default 0),
  // session_id (optional). Calls GET /api/events?limit&offset&session_id.
  // Output: paginated event rows, most recent first.
  register(
    "dashboard_list_events",
    "List events with optional session filter and pagination.",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
      session_id: z.string().min(1).max(256).optional(),
    },
    async (args) => {
      const limit = (args.limit as number | undefined) ?? 50;
      const offset = (args.offset as number | undefined) ?? 0;
      return api.get("/api/events", {
        query: {
          limit,
          offset,
          session_id: args.session_id as string | undefined,
        },
      });
    }
  );

  // Policy: MUTATIONS required. Input: hook_type (one of the seven Claude
  // Code hook names); data (arbitrary JSON — MUST include session_id, which
  // the dashboard uses to target the session). Calls POST /api/hooks/event,
  // the same endpoint scripts/hook-handler.js posts to on every real hook
  // firing. Output: { ok: true, event }. Side effects: bumps the session's
  // updated_at, broadcasts "new_event" over websocket, fire-and-forget
  // evaluates alert rules (failures swallowed), and — only for
  // "SubagentStop" with a transcript_path — scans that session's subagent
  // JSONL files for tool calls not yet recorded as events (the only path
  // that attributes subagent tool_use to the right agent_id, since those
  // never fire their own hooks). Throws (ApiError, MISSING_SESSION) if data
  // has no session_id.
  register(
    "dashboard_ingest_hook_event",
    "Ingest one Claude Code hook event into the dashboard pipeline.",
    {
      hook_type: HookTypeSchema,
      data: JsonObjectSchema,
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/hooks/event", {
        body: {
          hook_type: args.hook_type,
          data: args.data,
        },
      });
    }
  );
}
