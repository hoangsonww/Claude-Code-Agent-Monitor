/**
 * @file workflow-tools.ts
 * @description MCP tools for aggregate and per-session workflow intelligence,
 * including Workflow-tool run journals and individual run drill-down.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerWorkflowTools(context: ToolContext): void {
  const { api } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_workflows",
    "Get aggregate workflow intelligence, optionally filtered by lifecycle status and data source.",
    {
      status: z.string().max(64).optional(),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get("/api/workflows", {
        query: {
          status: args.status as string | undefined,
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_get_session_workflow",
    "Get workflow intelligence reconstructed for one session.",
    {
      session_id: z.string().min(1).max(256),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get(`/api/workflows/session/${encodeURIComponent(args.session_id as string)}`, {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_list_workflow_runs",
    "List Workflow-tool fleet runs with optional status and launching-session filters.",
    {
      status: z.string().max(64).optional(),
      session_id: z.string().max(256).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
    },
    async (args) =>
      api.get("/api/workflows/runs", {
        query: {
          status: args.status as string | undefined,
          session_id: args.session_id as string | undefined,
          limit: (args.limit as number | undefined) ?? 50,
          offset: (args.offset as number | undefined) ?? 0,
        },
      })
  );

  register(
    "dashboard_get_workflow_run",
    "Get one Workflow-tool fleet run with its per-agent phases, metrics, prompts, and results.",
    {
      run_id: z.string().min(1).max(512),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get(`/api/workflows/runs/${encodeURIComponent(args.run_id as string)}`, {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );
}
