/**
 * @file config-tools.ts
 * @description MCP tools for comprehensive Claude Code and Codex configuration
 * discovery plus the same backup-backed, allowlisted edits exposed by the app.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/tools/domains/config-tools.ts
 * **Area:** MCP tool
 * **Responsibility:**
 * MCP tools for comprehensive Claude Code and Codex configuration discovery plus the same
 * backup-backed, allowlisted edits exposed by the app.
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
 * - `registerConfigTools` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ClaudeArtifactTypeSchema` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `ClaudeScopeSchema` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `ClaudeSurfaceSchema` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `registerConfigTools` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/cc-config/backups` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/cc-config/file` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/cc-config/keybindings` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/codex-config/edit-file` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/codex-config/file` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/codex-config/overview` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 * - `/api/codex-config/profiles` — route literal present in this source; keep request/response
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/tools/domains/config-tools.ts` .
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
 * **Path:** `mcp/src/tools/domains/config-tools.ts`
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
 * - `../schemas.js`
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerConfigTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerConfigTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

/** Scope filter for listing Claude Code config artifacts. */
const ClaudeScopeSchema = z.enum(["all", "user", "project"]);
/** Kinds of Claude Code config artifact the write and delete tools accept. */
const ClaudeArtifactTypeSchema = z.enum([
  "skills",
  "agents",
  "commands",
  "output-styles",
  "memory",
  "auto-memory",
]);
/** Config surfaces `dashboard_get_claude_config` can read. */
const ClaudeSurfaceSchema = z.enum([
  "overview",
  "skills",
  "agents",
  "commands",
  "output-styles",
  "plugins",
  "mcp",
  "hooks",
  "settings",
  "memory",
  "marketplaces",
  "keybindings",
  "statusline",
  "hook-scripts",
]);

/**
 * Register the agent-configuration tools: reading, writing, and deleting Claude Code config
 * artifacts and keybindings, listing their backups, and reading, editing, and creating Codex config
 * files and profiles. Writes and deletes always take a server-side backup first.
 *
 * @param context - Shared tool context.
 */
export function registerConfigTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_claude_config",
    "Inspect one Claude Code configuration surface from the dashboard Config Explorer.",
    {
      surface: ClaudeSurfaceSchema,
      scope: ClaudeScopeSchema.optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      const surface = args.surface as string;
      const scoped = new Set([
        "overview",
        "skills",
        "agents",
        "commands",
        "output-styles",
        "mcp",
        "hooks",
        "settings",
        "memory",
      ]);
      return api.get(`/api/cc-config/${surface}`, {
        query: scoped.has(surface)
          ? {
              scope: args.scope as string | undefined,
              cwd: args.cwd as string | undefined,
            }
          : undefined,
      });
    }
  );

  register(
    "dashboard_read_claude_config_file",
    "Read one allowlisted Claude Code configuration or memory file by absolute path.",
    {
      path: z.string().min(1).max(4096),
      cwd: z.string().max(4096).optional(),
    },
    async (args) =>
      api.get("/api/cc-config/file", {
        query: {
          path: args.path as string,
          cwd: args.cwd as string | undefined,
        },
      })
  );

  register(
    "dashboard_list_claude_config_backups",
    "List timestamped backups created by Claude Config Explorer edits.",
    {
      scope: z.enum(["user", "project"]).optional(),
      artifact_type: ClaudeArtifactTypeSchema.optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) =>
      api.get("/api/cc-config/backups", {
        query: {
          scope: args.scope as string | undefined,
          type: args.artifact_type as string | undefined,
          cwd: args.cwd as string | undefined,
        },
      })
  );

  register(
    "dashboard_write_claude_config_artifact",
    "Create or overwrite an allowlisted Claude Code text artifact with an automatic timestamped backup.",
    {
      scope: z.enum(["user", "project", "auto-memory"]),
      artifact_type: ClaudeArtifactTypeSchema,
      name: z.string().max(256).optional(),
      content: z.string().max(1_000_000),
      project: z.string().max(512).optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/cc-config/file", {
        query: { cwd: args.cwd as string | undefined },
        body: {
          scope: args.scope,
          type: args.artifact_type,
          name: args.name,
          content: args.content,
          project: args.project,
        },
      });
    }
  );

  register(
    "dashboard_delete_claude_config_artifact",
    "Delete an allowlisted Claude Code text artifact after creating a timestamped backup.",
    {
      scope: z.enum(["user", "project", "auto-memory"]),
      artifact_type: ClaudeArtifactTypeSchema,
      name: z.string().max(256).optional(),
      project: z.string().max(512).optional(),
      cwd: z.string().max(4096).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete("/api/cc-config/file", {
        query: { cwd: args.cwd as string | undefined },
        body: {
          scope: args.scope as string,
          type: args.artifact_type as string,
          name: args.name as string | undefined,
          project: args.project as string | undefined,
        },
      });
    }
  );

  register(
    "dashboard_write_claude_keybindings",
    "Replace Claude Code keybinding groups through the structured, backup-backed editor.",
    {
      groups: z.array(JsonObjectSchema).max(500),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/cc-config/keybindings", { body: { groups: args.groups } });
    }
  );

  register(
    "dashboard_get_codex_config",
    "Get the full Codex Config Explorer overview with redacted previews.",
    {},
    async () => api.get("/api/codex-config/overview")
  );

  register(
    "dashboard_read_codex_config_file",
    "Read a redacted Codex configuration preview, or an unredacted editable file when edit=true.",
    {
      path: z.string().min(1).max(4096),
      edit: z.boolean().optional(),
    },
    async (args) =>
      api.get(args.edit ? "/api/codex-config/edit-file" : "/api/codex-config/file", {
        query: { path: args.path as string },
      })
  );

  register(
    "dashboard_write_codex_config_file",
    "Write one allowlisted Codex config, profile, hooks, rule, skill, or instruction file with a timestamped backup.",
    {
      path: z.string().min(1).max(4096),
      content: z.string().max(1_000_000),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.put("/api/codex-config/file", {
        body: { path: args.path, content: args.content },
      });
    }
  );

  register(
    "dashboard_delete_codex_config_file",
    "Delete one allowlisted user-managed Codex file or skill directory after backing it up.",
    { path: z.string().min(1).max(4096) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete("/api/codex-config/file", {
        body: { path: args.path as string },
      });
    }
  );

  register(
    "dashboard_create_codex_profile",
    "Create a new documented Codex profile overlay without modifying config.toml.",
    {
      name: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .max(64),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/codex-config/profiles", { body: { name: args.name } });
    }
  );
}
