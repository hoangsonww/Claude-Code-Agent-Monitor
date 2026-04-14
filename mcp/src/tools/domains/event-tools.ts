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

export function registerEventTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

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
