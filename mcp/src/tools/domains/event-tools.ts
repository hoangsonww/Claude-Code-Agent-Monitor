/**
 * @file event-tools.ts
 * @description Defines tools related to event management in the dashboard, including listing events with optional filters and ingesting hook events from Claude Code. The tools are registered with the tool registry and include input validation using Zod schemas. The event listing tool supports pagination and session filtering, while the hook event ingestion tool allows for adding new events into the dashboard pipeline, with a guard to ensure that mutations are enabled in the configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/event-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * Defines tools related to event management in the dashboard, including listing events with
 * optional filters and ingesting hook events from Claude Code. The tools are registered with the
 * tool registry and include input validation using Zod schemas. The event listing tool supports
 * pagination and session filtering, while the hook event ingestion tool allows for adding new
 * events into the dashboard pipeline, with a guard to ensure that mutations are enabled in the
 * configuration.
 *
 * ## Architectural boundary
 * - Exposes one dashboard capability through a schema-validated MCP tool while delegating data
 *   access to the API client.
 * - Tool descriptions and schemas are part of the model-facing API and must remain precise enough
 *   for safe selection.
 * - Mutation and destructive permissions are enforced centrally and cannot be bypassed by a domain
 *   handler.
 *
 * ## Local dependency edges
 * - `../../core/tool-registry.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../../policy/tool-guards.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../../types/tool-context.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../schemas.js` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `registerEventTools` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerEventTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/events` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/hooks/event` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 *
 * ## Area invariants
 * - Validate every argument with the declared schema before constructing requests or selecting
 *   resource identifiers.
 * - Keep read, mutation, and destructive operations correctly classified for policy guards.
 * - Return structured tool results through shared helpers so errors and JSON payloads remain
 *   transport-neutral.
 * - Do not leak dashboard tokens, webhook secrets, SSH material, raw environment values, or
 *   unredacted configuration.
 * - Preserve pagination and explicit limits for potentially large session, event, transcript, or
 *   metrics responses.
 * - Use exact API route and field names from the typed client rather than duplicating ad hoc HTTP
 *   calls.
 * - Keep tool names stable; hosts and prompts may persist them outside this repository.
 * - Explain confirmation requirements in both schema descriptions and policy errors for destructive
 *   actions.
 * - Keep handlers independent of stdio, HTTP, and REPL transport details.
 * - Test successful, validation, permission-denied, API-error, and redaction paths for each
 *   risk-bearing tool.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/event-tools.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
 *
 * @param context - Shared tool context.
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
