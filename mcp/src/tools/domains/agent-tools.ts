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

export function registerAgentTools(context: ToolContext): void {
  const { api, logger, server, config } = context;
  const register = createToolRegistrar(server, logger);

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
