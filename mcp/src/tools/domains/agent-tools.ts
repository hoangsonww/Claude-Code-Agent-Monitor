/**
 * @file agent-tools.ts
 * @description Defines and registers tools for managing agents in the dashboard, including listing agents with filters, retrieving agent details, creating new agents, and updating existing agents. Each tool includes input validation using Zod schemas and interacts with the dashboard API to perform the necessary operations. The tools also check for mutation permissions before allowing changes to agent data, ensuring that the application configuration is respected.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { createToolRegistrar } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { AgentStatusSchema, JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers the four agent-management tools backing `/api/agents/*`. List/
 * get are unconditional reads; create/update call
 * {@link assertMutationsEnabled} first. Agents mirror Claude Code's own
 * main-agent/subagent model: one main agent plus zero or more subagents
 * (`type: "subagent"`, optional `subagent_type`, linked via `parent_agent_id`).
 */
export function registerAgentTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

  // Policy: none. Input: limit (1-500, default 50), offset (default 0),
  // status/session_id (optional). Calls GET /api/agents?... — the dashboard
  // honors only ONE of status/session_id per call (session_id wins,
  // ignoring limit/offset), so passing both doesn't intersect-filter.
  // Output: { agents, limit, offset }, each agent's own cost attached (from
  // its metadata token buckets, not its session's total).
  register(
    "dashboard_list_agents",
    "List agents with optional status/session filters and pagination.",
    {
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
      status: AgentStatusSchema.optional(),
      session_id: z.string().min(1).max(256).optional(),
    },
    async (args) => {
      const limit = (args.limit as number | undefined) ?? 50;
      const offset = (args.offset as number | undefined) ?? 0;
      return api.get("/api/agents", {
        query: {
          limit,
          offset,
          status: args.status as string | undefined,
          session_id: args.session_id as string | undefined,
        },
      });
    }
  );

  // Policy: none. Input: agent_id (required). Calls GET /api/agents/:id.
  // Output: { agent } — 404s (ApiError, NOT_FOUND) if missing; unlike
  // dashboard_list_agents, no per-agent cost is attached.
  register(
    "dashboard_get_agent",
    "Get a single agent by ID.",
    {
      agent_id: z.string().min(1).max(256),
    },
    async (args) => {
      const agentId = args.agent_id as string;
      return api.get(`/api/agents/${encodeURIComponent(agentId)}`);
    }
  );

  // Policy: MUTATIONS required. Input: id/session_id/name (required); type
  // (default "main"), subagent_type, status (default "waiting"), task,
  // parent_agent_id, metadata (all optional). Calls POST /api/agents.
  // Output: { agent, created } — an existing id returns as-is (created: false).
  register(
    "dashboard_create_agent",
    "Create a new agent in a session.",
    {
      id: z.string().min(1).max(256),
      session_id: z.string().min(1).max(256),
      name: z.string().min(1).max(500),
      type: z.enum(["main", "subagent"]).optional(),
      subagent_type: z.string().max(128).optional(),
      status: AgentStatusSchema.optional(),
      task: z.string().max(5000).optional(),
      parent_agent_id: z.string().max(256).optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/agents", {
        body: {
          id: args.id,
          session_id: args.session_id,
          name: args.name,
          type: args.type,
          subagent_type: args.subagent_type,
          status: args.status,
          task: args.task,
          parent_agent_id: args.parent_agent_id,
          metadata: args.metadata,
        },
      });
    }
  );

  // Policy: MUTATIONS required. Input: agent_id (required);
  // name/status/task/current_tool/ended_at/metadata optional — current_tool
  // is nullable (explicitly clearable) and preserved when omitted entirely.
  // Calls PATCH /api/agents/:id. Output: { agent } — 404s if missing.
  register(
    "dashboard_update_agent",
    "Update an existing agent's lifecycle state and metadata.",
    {
      agent_id: z.string().min(1).max(256),
      name: z.string().max(500).optional(),
      status: AgentStatusSchema.optional(),
      task: z.string().max(5000).optional(),
      current_tool: z.string().max(256).nullable().optional(),
      ended_at: z.string().datetime().optional(),
      metadata: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const agentId = args.agent_id as string;
      return api.patch(`/api/agents/${encodeURIComponent(agentId)}`, {
        body: {
          name: args.name,
          status: args.status,
          task: args.task,
          current_tool: args.current_tool,
          ended_at: args.ended_at,
          metadata: args.metadata,
        },
      });
    }
  );
}
