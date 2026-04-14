/**
 * @file observability-tools.ts
 * @description Tool registration for observability-related tools in the MCP server. This module defines a set of tools that interact with the Agent Dashboard API to provide health checks, stats, analytics, system information, data export, and operational snapshots. These tools enable users to monitor and analyze the performance and usage of their agents and sessions through the dashboard. Each tool is registered with a name, description, input schema (if applicable), and an asynchronous handler function that makes API calls to retrieve the necessary data.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import type { ToolContext } from "../../types/tool-context.js";
import { createToolRegistrar } from "../../core/tool-registry.js";

export function registerObservabilityTools(context: ToolContext): void {
  const { api, logger, server } = context;
  const register = createToolRegistrar(server, logger);

  register(
    "dashboard_health_check",
    "Check health of the local Agent Dashboard API.",
    {},
    async () => api.get("/api/health")
  );

  register(
    "dashboard_get_stats",
    "Get dashboard overview stats including session/agent counts and websocket connections.",
    {},
    async () => api.get("/api/stats")
  );

  register(
    "dashboard_get_analytics",
    "Get analytics summary including token totals, usage trends, and distributions.",
    {},
    async () => api.get("/api/analytics")
  );

  register(
    "dashboard_get_system_info",
    "Get system info, DB stats, and hook installation status.",
    {},
    async () => api.get("/api/settings/info")
  );

  register(
    "dashboard_export_data",
    "Export complete dashboard data payload (sessions, agents, events, tokens, pricing).",
    {},
    async () => api.get("/api/settings/export")
  );

  register(
    "dashboard_get_operational_snapshot",
    "Get a high-signal operational snapshot combining stats, analytics, active sessions, active agents, and recent events.",
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
          api.get("/api/agents", {
            query: { status: "working", limit: agentsLimit, offset: 0 },
          }),
          api.get("/api/agents", {
            query: { status: "connected", limit: agentsLimit, offset: 0 },
          }),
        ]);

      return {
        stats,
        analytics,
        recent_events: recentEvents,
        active_sessions: activeSessions,
        active_agents: {
          working: workingAgents,
          connected: connectedAgents,
        },
        generated_at: new Date().toISOString(),
      };
    }
  );
}
