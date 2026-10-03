/**
 * @file maintenance-tools.ts
 * @description Defines a set of maintenance tools for the MCP dashboard, including functions to clean up stale sessions, re-import legacy data, reinstall hooks, inspect/compress/prune durable transcript snapshots, and clear all data. These tools are registered with the MCP server and include appropriate guards to ensure that mutating and destructive actions are only performed when explicitly allowed in the configuration. The tools interact with the MCP server's API to perform the necessary maintenance tasks, providing a way for administrators to manage the dashboard's data and settings effectively.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/tools/domains/maintenance-tools.ts`
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
 * - `../../types/tool-context.js`
 *
 * ## Public surface
 * - `registerMaintenanceTools` — exported API; see TSDoc on the symbol for behavior.
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
 * **registerMaintenanceTools**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertDestructiveEnabled, assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

/**
 * Registers the administrative tools against `/api/settings/*`. Writes
 * require mutations; the irreversible ones — `dashboard_clear_all_data` and an
 * applied `dashboard_prune_snapshots` — additionally require the destructive
 * tier plus an exact confirmation token (cleanup only touches stale/old rows;
 * reimport, reinstall-hooks and snapshot compression are lossless, repeatable
 * operations). Snapshot storage reads and prune dry runs are read-only.
 */
export function registerMaintenanceTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  // Policy: MUTATIONS required (checked before the "at least one field"
  // validation below). Input: abandon_hours (1 to 24*365) and/or purge_days
  // (1-3650) — at least one required. Calls POST /api/settings/cleanup.
  // abandon_hours marks "active" sessions with no recent events as
  // "abandoned" (completing lingering agents); purge_days permanently
  // deletes terminal sessions (+ agents/events) older than N days. Output:
  // { abandoned, purged_sessions, purged_events, purged_agents } counts.
  register(
    "dashboard_cleanup_data",
    "Maintenance: abandon stale sessions and/or purge old completed data.",
    {
      abandon_hours: z
        .number()
        .int()
        .min(1)
        .max(24 * 365)
        .optional(),
      purge_days: z.number().int().min(1).max(3650).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const abandonHours = args.abandon_hours as number | undefined;
      const purgeDays = args.purge_days as number | undefined;
      if (abandonHours === undefined && purgeDays === undefined) {
        throw new Error("At least one of abandon_hours or purge_days is required.");
      }
      return api.post("/api/settings/cleanup", {
        body: {
          abandon_hours: abandonHours,
          purge_days: purgeDays,
        },
      });
    }
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/reimport, invoking
  // scripts/import-history.js against ~/.claude session-history JSONL files
  // — useful for backfilling sessions that predate hook installation or
  // recovering after a reset. Output: { ok: true, ...result }. Throws
  // (ApiError, IMPORT_FAILED) if the import script itself throws.
  register(
    "dashboard_reimport_history",
    "Re-import legacy Claude sessions from ~/.claude into the local dashboard database.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reimport");
    }
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/reinstall-hooks,
  // invoking scripts/install-hooks.js to (re)write the seven hook entries
  // (PreToolUse/PostToolUse/Stop/SubagentStop/Notification/SessionStart/
  // SessionEnd) into ~/.claude/settings.json, overwriting any existing
  // config. Output: { ok, hooks } — same shape as dashboard_get_system_info.
  register(
    "dashboard_reinstall_hooks",
    "Reinstall Claude Code hooks in ~/.claude/settings.json.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/reinstall-hooks");
    }
  );

  // Read-only. Calls GET /api/settings/snapshots. Output: per-provider
  // transcript snapshot storage ({ total_bytes, total_files, roots: {claude,
  // codex, cursor}: { path, files, bytes, compressed_files, compressed_bytes,
  // sessions }, policy: { compress, max_age_days, max_bytes } }).
  register(
    "dashboard_get_snapshot_storage",
    "Transcript snapshot storage per provider (bytes, files, compressed share) and retention policy.",
    {},
    async () => api.get("/api/settings/snapshots")
  );

  // Policy: MUTATIONS required. Calls POST /api/settings/snapshots/compress —
  // lossless: gzips snapshots whose original transcript is gone, verified
  // (decompress + SHA-256) before the plain copy is removed. Output: counts
  // { compressed, bytes_before, bytes_after, failed, skipped_roots, storage }.
  register(
    "dashboard_compress_snapshots",
    "Losslessly compress transcript snapshots whose original transcript was deleted by its provider.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/settings/snapshots/compress");
    }
  );

  // Policy: dry run (default) is READ-ONLY; dry_run=false is DESTRUCTIVE and
  // needs confirmation_token "PRUNE_SNAPSHOTS" — a pruned snapshot may be the
  // only remaining copy of a conversation once Claude Code/Codex/Cursor
  // deleted the original. Calls POST /api/settings/snapshots/prune with at
  // least one of max_age_days / max_bytes / orphans. max_bytes takes a byte
  // count or a size with a binary unit ("500MB", "5GB"), matching the API and
  // `ccam snapshots prune --max-size`; the server validates it. Output: the plan
  // (candidates, candidate_bytes, remaining_bytes, over_cap_bytes) and, when
  // applied, removed_files / removed_bytes.
  register(
    "dashboard_prune_snapshots",
    "Plan (dry run, default) or apply a prune of old transcript snapshots. Applying is destructive.",
    {
      max_age_days: z.number().positive().max(36500).optional(),
      max_bytes: z
        .union([
          z.number().int().positive(),
          z.string().regex(/^\s*\d+(\.\d+)?\s*[kmgt]?i?b?\s*$/i, 'Use bytes or a size like "5GB"'),
        ])
        .optional(),
      orphans: z.boolean().optional(),
      dry_run: z.boolean().optional(),
      confirmation_token: z.string().optional(),
    },
    async (args) => {
      const maxAgeDays = args.max_age_days as number | undefined;
      const maxBytes = args.max_bytes as number | string | undefined;
      const orphans = args.orphans as boolean | undefined;
      if (maxAgeDays === undefined && maxBytes === undefined && orphans !== true) {
        throw new Error("At least one of max_age_days, max_bytes, or orphans:true is required.");
      }
      const dryRun = args.dry_run !== false;
      if (!dryRun) {
        assertDestructiveEnabled(
          config,
          (args.confirmation_token as string | undefined) ?? "",
          "PRUNE_SNAPSHOTS"
        );
      }
      return api.post("/api/settings/snapshots/prune", {
        body: {
          max_age_days: maxAgeDays,
          max_bytes: maxBytes,
          orphans,
          dry_run: dryRun,
          ...(dryRun ? {} : { confirm: "PRUNE_SNAPSHOTS" }),
        },
      });
    }
  );

  // Policy: DESTRUCTIVE required — the strictest gate in the server. Input:
  // confirmation_token, must exactly equal "CLEAR_ALL_DATA". Calls
  // POST /api/settings/clear-data, irreversibly deleting every row from
  // sessions, agents, events, token_usage, alert_events, and
  // webhook_deliveries — but preserving alert rules, webhook targets, and
  // pricing rules (user configuration, not activity data). Output:
  // { ok: true, cleared } with pre-deletion row counts. No undo; the only
  // tool gated by MCP_DASHBOARD_ALLOW_DESTRUCTIVE.
  register(
    "dashboard_clear_all_data",
    "Delete all tracked sessions, agents, events, and token usage. Highly destructive.",
    {
      confirmation_token: z.string().min(1),
    },
    async (args) => {
      const confirmationToken = args.confirmation_token as string;
      assertDestructiveEnabled(config, confirmationToken);
      return api.post("/api/settings/clear-data");
    }
  );
}
