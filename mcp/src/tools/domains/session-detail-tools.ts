/**
 * @file session-detail-tools.ts
 * @description MCP tools for session facets, computed detail statistics, and
 * provider-aware transcript discovery and cursor-paginated conversation reads.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import type { ToolContext } from "../../types/tool-context.js";

export function registerSessionDetailTools(context: ToolContext): void {
  const { api } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_session_facets",
    "Get distinct session filter values for project, model, provider, source, and status selectors.",
    {
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get("/api/sessions/facets", {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_get_session_stats",
    "Get one session's overview metrics, top tools, subagent breakdown, and token totals.",
    {
      session_id: z.string().min(1).max(256),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get(`/api/sessions/${encodeURIComponent(args.session_id as string)}/stats`, {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_list_session_transcripts",
    "List the main and nested transcript sources available for one session.",
    {
      session_id: z.string().min(1).max(256),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get(`/api/sessions/${encodeURIComponent(args.session_id as string)}/transcripts`, {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_get_session_transcript",
    "Read a cursor-paginated session transcript, optionally selecting a nested agent run.",
    {
      session_id: z.string().min(1).max(256),
      agent_id: z.string().max(256).optional(),
      run_id: z.string().max(512).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).max(1_000_000).optional(),
      after: z.number().int().min(0).optional(),
      before: z.number().int().min(0).optional(),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get(`/api/sessions/${encodeURIComponent(args.session_id as string)}/transcript`, {
        query: {
          agent_id: args.agent_id as string | undefined,
          run_id: args.run_id as string | undefined,
          limit: (args.limit as number | undefined) ?? 100,
          offset: args.offset as number | undefined,
          after: args.after as number | undefined,
          before: args.before as number | undefined,
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );

  register(
    "dashboard_get_transcript_image",
    "Fetch one persisted transcript image as base64 without exposing its local filesystem path.",
    {
      session_id: z.string().min(1).max(256),
      line: z.number().int().min(1),
      index: z.number().int().min(0),
      agent_id: z.string().max(256).optional(),
      run_id: z.string().max(512).optional(),
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.getBinary(
        `/api/sessions/${encodeURIComponent(args.session_id as string)}/transcript-image`,
        {
          line: args.line as number,
          index: args.index as number,
          agent_id: args.agent_id as string | undefined,
          run_id: args.run_id as string | undefined,
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        }
      )
  );

  register(
    "dashboard_get_event_facets",
    "Get distinct event filter values used by the Activity Feed.",
    {
      sources: z.string().max(4096).optional(),
      providers: z.string().max(256).optional(),
    },
    async (args) =>
      api.get("/api/events/facets", {
        query: {
          sources: args.sources as string | undefined,
          providers: args.providers as string | undefined,
        },
      })
  );
}
