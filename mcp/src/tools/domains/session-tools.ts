/**
 * @file session-tools.ts
 * @description Defines and registers tools for managing sessions in the dashboard, including listing sessions with optional filters, retrieving session details, creating new sessions, and updating existing sessions. Each tool includes input validation using Zod schemas and interacts with the dashboard API to perform the necessary operations. The tools also check for mutation permissions before allowing changes to session data, ensuring that the application configuration is respected.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { SessionStatusSchema, JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerSessionTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  register(
    "dashboard_list_sessions",
    "List sessions with optional status filter and pagination.",
    {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
      status: SessionStatusSchema.optional(),
    },
    async (args) => {
      const limit = (args.limit as number | undefined) ?? 50;
      const offset = (args.offset as number | undefined) ?? 0;
      const status = args.status as string | undefined;
      return api.get("/api/sessions", { query: { limit, offset, status } });
    }
  );

  register(
    "dashboard_get_session",
    "Get one session with its full agents list and event timeline.",
    {
      session_id: z.string().min(1).max(256),
    },
    async (args) => {
      const sessionId = args.session_id as string;
      return api.get(`/api/sessions/${encodeURIComponent(sessionId)}`);
    }
  );

  register(
    "dashboard_create_session",
    "Create a new session record if it does not already exist.",
    {
      id: z.string().min(1).max(256),
      name: z.string().max(500).optional(),
      cwd: z.string().max(2048).optional(),
      model: z.string().max(256).optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/sessions", {
        body: {
          id: args.id,
          name: args.name,
          cwd: args.cwd,
          model: args.model,
          metadata: args.metadata,
        },
      });
    }
  );

  register(
    "dashboard_update_session",
    "Update session metadata or lifecycle status.",
    {
      session_id: z.string().min(1).max(256),
      name: z.string().max(500).optional(),
      status: SessionStatusSchema.optional(),
      ended_at: z.string().datetime().optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const sessionId = args.session_id as string;
      return api.patch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        body: {
          name: args.name,
          status: args.status,
          ended_at: args.ended_at,
          metadata: args.metadata,
        },
      });
    }
  );
}
