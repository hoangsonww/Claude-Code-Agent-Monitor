/**
 * @file event-tools.ts
 * @description Defines tools related to event management in the dashboard, including listing events with optional filters and ingesting hook events from Claude Code. The tools are registered with the tool registry and include input validation using Zod schemas. The event listing tool supports pagination and session filtering, while the hook event ingestion tool allows for adding new events into the dashboard pipeline, with a guard to ensure that mutations are enabled in the configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/event-tools.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../../core/tool-registry.js`
 * - `../../policy/tool-guards.js`
 * - `../schemas.js`
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerEventTools` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **registerEventTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
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
  const { api, config } = context;
  const register = registrarFor(context);

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
      session_ids: z.array(z.string().min(1).max(256)).min(1).max(100).optional(),
      event_types: z.array(z.string().min(1).max(128)).min(1).max(100).optional(),
      tool_names: z.array(z.string().min(1).max(256)).min(1).max(100).optional(),
      agent_ids: z.array(z.string().min(1).max(256)).min(1).max(100).optional(),
      query: z.string().max(1000).optional(),
      from: z.string().max(128).optional(),
      to: z.string().max(128).optional(),
      sources: z.array(z.string().min(1).max(256)).min(1).max(100).optional(),
      providers: z
        .array(z.enum(["claude", "codex"]))
        .min(1)
        .max(2)
        .optional(),
    },
    async (args) => {
      const limit = (args.limit as number | undefined) ?? 50;
      const offset = (args.offset as number | undefined) ?? 0;
      return api.get("/api/events", {
        query: {
          limit,
          offset,
          session_id:
            (args.session_ids as string[] | undefined)?.join(",") ??
            (args.session_id as string | undefined),
          event_type: (args.event_types as string[] | undefined)?.join(","),
          tool_name: (args.tool_names as string[] | undefined)?.join(","),
          agent_id: (args.agent_ids as string[] | undefined)?.join(","),
          q: args.query as string | undefined,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
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
