/**
 * @file session-tools.ts
 * @description Defines and registers tools for managing sessions in the dashboard, including listing sessions with optional filters, retrieving session details, creating new sessions, and updating existing sessions. Each tool includes input validation using Zod schemas and interacts with the dashboard API to perform the necessary operations. The tools also check for mutation permissions before allowing changes to session data, ensuring that the application configuration is respected.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/session-tools.ts`
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
 * - `registerSessionTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerSessionTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
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
  const { api, config } = context;
  const register = registrarFor(context);

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
      query: z.string().max(1000).optional(),
      cwd: z.array(z.string().min(1).max(4096)).max(100).optional(),
      sort_by: z.enum(["time", "duration", "price"]).optional(),
      sort_desc: z.boolean().optional(),
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
      const status = args.status as string | undefined;
      return api.get("/api/sessions", {
        query: {
          limit,
          offset,
          status,
          q: args.query as string | undefined,
          cwd: args.cwd as string[] | undefined,
          sort_by: args.sort_by as string | undefined,
          sort_desc: args.sort_desc as boolean | undefined,
          sources: (args.sources as string[] | undefined)?.join(","),
          providers: (args.providers as string[] | undefined)?.join(","),
        },
      });
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
