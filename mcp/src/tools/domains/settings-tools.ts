/**
 * @file settings-tools.ts
 * @description MCP tools for dashboard update status, hook installation, and
 * live-safe Claude Code/Codex home-directory configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/settings-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * MCP tools for dashboard update status, hook installation, and live-safe Claude Code/Codex
 * home-directory configuration.
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
 * - `registerSettingsTools` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `registerSettingsTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/settings/claude-home` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/settings/codex-home` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/settings/install-hooks` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/updates/check` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/updates/status` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/settings-tools.ts` .
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
 * **Path:** `mcp/src/tools/domains/settings-tools.ts`
 * **Purpose:** Part of the local MCP server (`npm run mcp:start`) that exposes dashboard operations as MCP tools for Claude Code and other hosts.
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
 * - `registerSettingsTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerSettingsTools**
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
 * Register the settings tools: update status and checks, the Claude and Codex home directories, and
 * hook installation. Tools that change data check that mutations are enabled
 * (`MCP_DASHBOARD_ALLOW_MUTATIONS`) before calling the dashboard.
 *
 * @param context - Shared tool context.
 */
export function registerSettingsTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_update_status",
    "Get cached or current upstream checkout status.",
    {},
    async () => api.get("/api/updates/status")
  );

  register(
    "dashboard_check_for_updates",
    "Refresh upstream checkout status and broadcast the result to connected dashboards.",
    {},
    async () => api.post("/api/updates/check")
  );

  register(
    "dashboard_get_agent_homes",
    "Get the active Claude Code and Codex state directories.",
    {},
    async () => {
      const [claude, codex] = await Promise.all([
        api.get("/api/settings/claude-home"),
        api.get("/api/settings/codex-home"),
      ]);
      return { claude, codex };
    }
  );

  register(
    "dashboard_set_claude_home",
    "Set the Claude Code state directory used by hook and transcript discovery.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/settings/claude-home", { body: { path: args.path } });
    }
  );

  register(
    "dashboard_set_codex_home",
    "Set the Codex state directory and re-arm the live rollout synchronizer.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/settings/codex-home", { body: { path: args.path } });
    }
  );

  register(
    "dashboard_install_hooks",
    "Install or update the selected Claude Code and Codex hook integrations.",
    {
      providers: z
        .array(z.enum(["claude", "codex"]))
        .min(1)
        .max(2)
        .refine((providers) => new Set(providers).size === providers.length, {
          message: "providers must not contain duplicates",
        }),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/install-hooks", { body: { providers: args.providers } });
    }
  );
}
