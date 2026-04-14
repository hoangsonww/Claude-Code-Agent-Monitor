/**
 * @file tool-collector.ts
 * @description This module defines the collectAllTools function, which is responsible for collecting and registering all tool handlers available in the MCP application. The function takes the application configuration, a dashboard API client, and a logger as arguments, and returns an array of ToolEntry objects representing each registered tool. The tools cover various domains such as observability, session management, agent management, event handling, pricing, and maintenance. This collector is used in REPL mode to allow direct invocation of tools without requiring an MCP Server instance.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";
import {
  type ToolEntry,
  createCollectorRegistrar,
  type ToolHandler,
} from "../core/tool-registry.js";
import { assertMutationsEnabled, assertDestructiveEnabled } from "../policy/tool-guards.js";
import { z } from "zod";
import {
  SessionStatusSchema,
  AgentStatusSchema,
  HookTypeSchema,
  JsonObjectSchema,
} from "../tools/schemas.js";

/**
 * Collect all tool handlers without requiring an MCP Server instance.
 * Used by REPL mode to invoke tools directly.
 */
export function collectAllTools(
  config: AppConfig,
  api: DashboardApiClient,
  logger: Logger
): ToolEntry[] {
  const tools: ToolEntry[] = [];
  const register = createCollectorRegistrar(tools);

  // ── Observability ───────────────────────────────────────────
  register(
    "dashboard_health_check",
    "Check health of the local Agent Dashboard API.",
    {},
    async () => api.get("/api/health")
  );
  register("dashboard_get_stats", "Get dashboard overview stats.", {}, async () =>
    api.get("/api/stats")
  );
  register("dashboard_get_analytics", "Get analytics summary.", {}, async () =>
    api.get("/api/analytics")
  );
  register("dashboard_get_system_info", "Get system info, DB stats, hook status.", {}, async () =>
    api.get("/api/settings/info")
  );
  register("dashboard_export_data", "Export complete dashboard data payload.", {}, async () =>
    api.get("/api/settings/export")
  );
  register(
    "dashboard_get_operational_snapshot",
    "High-signal operational snapshot.",
    {
      recent_events_limit: z.number().int().min(1).max(50).optional(),
      active_sessions_limit: z.number().int().min(1).max(100).optional(),
      active_agents_limit: z.number().int().min(1).max(200).optional(),
    },
    async (args) => {
      const eventsLimit = (args.recent_events_limit as number | undefined) ?? 20;
      const sessionsLimit = (args.active_sessions_limit as number | undefined) ?? 25;
      const agentsLimit = (args.active_agents_limit as number | undefined) ?? 100;
      const [stats, analytics, recentEvents, activeSessions, workingAgents, connectedAgents] =
        await Promise.all([
          api.get("/api/stats"),
          api.get("/api/analytics"),
          api.get("/api/events", { query: { limit: eventsLimit, offset: 0 } }),
          api.get("/api/sessions", {
            query: { status: "active", limit: sessionsLimit, offset: 0 },
          }),
          api.get("/api/agents", { query: { status: "working", limit: agentsLimit, offset: 0 } }),
          api.get("/api/agents", { query: { status: "connected", limit: agentsLimit, offset: 0 } }),
        ]);
      return {
        stats,
        analytics,
        recent_events: recentEvents,
        active_sessions: activeSessions,
        active_agents: { working: workingAgents, connected: connectedAgents },
        generated_at: new Date().toISOString(),
      };
    }
  );

  // ── Sessions ────────────────────────────────────────────────
  register("dashboard_list_sessions", "List sessions with optional filter.", {}, async (args) => {
    return api.get("/api/sessions", {
      query: {
        limit: (args.limit as number) ?? 50,
        offset: (args.offset as number) ?? 0,
        status: args.status as string | undefined,
      },
    });
  });
  register("dashboard_get_session", "Get one session with agents and events.", {}, async (args) => {
    return api.get(`/api/sessions/${encodeURIComponent(args.session_id as string)}`);
  });
  register("dashboard_create_session", "Create a new session record.", {}, async (args) => {
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
  });
  register("dashboard_update_session", "Update session metadata or status.", {}, async (args) => {
    assertMutationsEnabled(config);
    return api.patch(`/api/sessions/${encodeURIComponent(args.session_id as string)}`, {
      body: {
        name: args.name,
        status: args.status,
        ended_at: args.ended_at,
        metadata: args.metadata,
      },
    });
  });

  // ── Agents ──────────────────────────────────────────────────
  register("dashboard_list_agents", "List agents with filters.", {}, async (args) => {
    return api.get("/api/agents", {
      query: {
        limit: (args.limit as number) ?? 50,
        offset: (args.offset as number) ?? 0,
        status: args.status as string | undefined,
        session_id: args.session_id as string | undefined,
      },
    });
  });
  register("dashboard_get_agent", "Get a single agent by ID.", {}, async (args) => {
    return api.get(`/api/agents/${encodeURIComponent(args.agent_id as string)}`);
  });
  register("dashboard_create_agent", "Create a new agent in a session.", {}, async (args) => {
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
  });
  register("dashboard_update_agent", "Update agent lifecycle state.", {}, async (args) => {
    assertMutationsEnabled(config);
    return api.patch(`/api/agents/${encodeURIComponent(args.agent_id as string)}`, {
      body: {
        name: args.name,
        status: args.status,
        task: args.task,
        current_tool: args.current_tool,
        ended_at: args.ended_at,
        metadata: args.metadata,
      },
    });
  });

  // ── Events ──────────────────────────────────────────────────
  register(
    "dashboard_list_events",
    "List events with optional session filter.",
    {},
    async (args) => {
      return api.get("/api/events", {
        query: {
          limit: (args.limit as number) ?? 50,
          offset: (args.offset as number) ?? 0,
          session_id: args.session_id as string | undefined,
        },
      });
    }
  );
  register("dashboard_ingest_hook_event", "Ingest a Claude Code hook event.", {}, async (args) => {
    assertMutationsEnabled(config);
    return api.post("/api/hooks/event", { body: { hook_type: args.hook_type, data: args.data } });
  });

  // ── Pricing ─────────────────────────────────────────────────
  register("dashboard_get_pricing_rules", "List all model pricing rules.", {}, async () =>
    api.get("/api/pricing")
  );
  register("dashboard_get_total_cost", "Get total usage cost.", {}, async () =>
    api.get("/api/pricing/cost")
  );
  register(
    "dashboard_get_session_cost",
    "Get cost breakdown for one session.",
    {},
    async (args) => {
      return api.get(`/api/pricing/cost/${encodeURIComponent(args.session_id as string)}`);
    }
  );
  register(
    "dashboard_upsert_pricing_rule",
    "Create or update a pricing rule.",
    {},
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/pricing", {
        body: {
          model_pattern: args.model_pattern,
          display_name: args.display_name,
          input_per_mtok: args.input_per_mtok ?? 0,
          output_per_mtok: args.output_per_mtok ?? 0,
          cache_read_per_mtok: args.cache_read_per_mtok ?? 0,
          cache_write_per_mtok: args.cache_write_per_mtok ?? 0,
        },
      });
    }
  );
  register("dashboard_delete_pricing_rule", "Delete one pricing rule.", {}, async (args) => {
    assertMutationsEnabled(config);
    return api.delete(`/api/pricing/${encodeURIComponent(args.model_pattern as string)}`);
  });
  register("dashboard_reset_pricing_defaults", "Reset pricing rules to defaults.", {}, async () => {
    assertMutationsEnabled(config);
    return api.post("/api/settings/reset-pricing");
  });

  // ── Maintenance ─────────────────────────────────────────────
  register(
    "dashboard_cleanup_data",
    "Abandon stale sessions or purge old data.",
    {},
    async (args) => {
      assertMutationsEnabled(config);
      const abandonHours = args.abandon_hours as number | undefined;
      const purgeDays = args.purge_days as number | undefined;
      if (!abandonHours && !purgeDays)
        throw new Error("At least one of abandon_hours or purge_days is required.");
      return api.post("/api/settings/cleanup", {
        body: { abandon_hours: abandonHours, purge_days: purgeDays },
      });
    }
  );
  register("dashboard_reimport_history", "Re-import legacy Claude sessions.", {}, async () => {
    assertMutationsEnabled(config);
    return api.post("/api/settings/reimport");
  });
  register("dashboard_reinstall_hooks", "Reinstall Claude Code hooks.", {}, async () => {
    assertMutationsEnabled(config);
    return api.post("/api/settings/reinstall-hooks");
  });
  register("dashboard_clear_all_data", "Delete all data. Highly destructive.", {}, async (args) => {
    assertDestructiveEnabled(config, args.confirmation_token as string);
    return api.post("/api/settings/clear-data");
  });

  return tools;
}
