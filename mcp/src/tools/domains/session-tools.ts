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

/**
 * Registers the four session-management tools backing `/api/sessions/*`.
 * List/get are read-only; create/update both call
 * {@link assertMutationsEnabled} first. None are gated by the
 * destructive-tools flag.
 */
export function registerSessionTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  // Policy: none. Input: limit (1-200, default 50), offset (default 0),
  // status (optional; omitted means all). Calls
  // GET /api/sessions?limit&offset&status. Output: { sessions, total, limit,
  // offset }.
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

  // Policy: none. Input: session_id (required). Calls
  // GET /api/sessions/:id. Output: { session, agents, events, workflows } —
  // agents carry their own cost (from agent.metadata token buckets),
  // workflows are any Workflow-tool runs launched in this session. 404s
  // (ApiError, NOT_FOUND) if missing.
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

  // Policy: MUTATIONS required. Input: id (required); name/cwd/model/
  // metadata (optional). Calls POST /api/sessions. Output: { session,
  // created } — an existing id returns as-is (created: false), matching how
  // the hook pipeline lazily creates sessions without erroring on a
  // duplicate id; a new session starts as "active".
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

  // Policy: MUTATIONS required. Input: session_id (required);
  // name/status/ended_at/metadata (optional; ended_at is ISO-8601). Calls
  // PATCH /api/sessions/:id. Output: the updated session record.
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
