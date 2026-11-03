/**
 * @file remote-tools.ts
 * @description MCP tools for Remote Data Sources — list configured SSH sources
 * and trigger on-demand syncs so agents can operate remotes without the UI/CLI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/remote-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * MCP tools for Remote Data Sources — list configured SSH sources and trigger on-demand syncs so
 * agents can operate remotes without the UI/CLI.
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
 *
 * ## Package dependency edges
 * - `zod` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 *
 * ## Public surface
 * - `registerRemoteTools` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerRemoteTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/remote-sources` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/remote-sources/sync-all` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 *
 * ## Named test contracts
 * - `Remote source id (src_…)` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/remote-tools.ts` .
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
 * **Path:** `mcp/src/tools/domains/remote-tools.ts`
 * **Purpose:** Supports federated dashboards: register SSH-backed or file-synced remote machines, health-check tunnels, and scope the entire UI to local vs all vs selected sources.
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
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerRemoteTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerRemoteTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers remote-source tools against `/api/remote-sources/*`.
 * List is read-only; sync tools require the mutations policy gate.
 *
 * @param context - Shared tool context.
 */
export function registerRemoteTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_list_remote_sources",
    "List configured Remote Data Sources (SSH machines) with status and last sync.",
    {},
    async () => api.get("/api/remote-sources")
  );

  register(
    "dashboard_create_remote_source",
    "Create an SSH Remote Data Source for Claude Code and/or Codex history.",
    {
      label: z.string().min(1).max(100),
      host: z.string().min(1).max(255),
      ssh_port: z.number().int().min(1).max(65535).nullable().optional(),
      identity_file: z.string().max(4096).nullable().optional(),
      remote_home: z.string().max(4096).nullable().optional(),
      remote_codex_home: z.string().max(4096).nullable().optional(),
      enabled: z.boolean().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/remote-sources", {
        body: {
          label: args.label,
          host: args.host,
          ssh_port: args.ssh_port,
          identity_file: args.identity_file,
          remote_home: args.remote_home,
          remote_codex_home: args.remote_codex_home,
          enabled: args.enabled,
        },
      });
    }
  );

  register(
    "dashboard_update_remote_source",
    "Update an SSH Remote Data Source, including its enabled state and provider homes.",
    {
      source_id: z.string().min(1).max(256),
      label: z.string().min(1).max(100).optional(),
      host: z.string().min(1).max(255).optional(),
      ssh_port: z.number().int().min(1).max(65535).nullable().optional(),
      identity_file: z.string().max(4096).nullable().optional(),
      remote_home: z.string().max(4096).nullable().optional(),
      remote_codex_home: z.string().max(4096).nullable().optional(),
      enabled: z.boolean().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.patch(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}`, {
        body: {
          label: args.label,
          host: args.host,
          ssh_port: args.ssh_port,
          identity_file: args.identity_file,
          remote_home: args.remote_home,
          remote_codex_home: args.remote_codex_home,
          enabled: args.enabled,
        },
      });
    }
  );

  register(
    "dashboard_test_remote_source",
    "Probe SSH connectivity and provider-history paths for one Remote Data Source without importing.",
    { source_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}/test`);
    }
  );

  register(
    "dashboard_sync_remote_source",
    "Trigger an immediate SSH pull+import for one Remote Data Source by id.",
    {
      source_id: z.string().min(1).describe("Remote source id (src_…)"),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const id = encodeURIComponent(args.source_id as string);
      return api.post(`/api/remote-sources/${id}/sync`);
    }
  );

  register(
    "dashboard_sync_all_remote_sources",
    "Trigger an immediate SSH pull+import for every enabled Remote Data Source.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/remote-sources/sync-all");
    }
  );

  register(
    "dashboard_delete_remote_source",
    "Delete a Remote Data Source. Imported sessions are retained unless purge_data is explicitly true.",
    {
      source_id: z.string().min(1).max(256),
      purge_data: z.boolean().optional(),
      confirmation_token: z.string().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      if (args.purge_data && args.confirmation_token !== "PURGE_REMOTE_SOURCE_DATA") {
        throw new Error(
          'Purging imported sessions requires confirmation_token = "PURGE_REMOTE_SOURCE_DATA".'
        );
      }
      return api.delete(`/api/remote-sources/${encodeURIComponent(args.source_id as string)}`, {
        query: { purge: args.purge_data as boolean | undefined },
      });
    }
  );
}
