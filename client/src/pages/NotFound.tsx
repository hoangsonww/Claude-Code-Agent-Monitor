/**
 * @file NotFound.tsx
 * @description Catch-all route for unknown paths (`path="*"` in {@link App}).
 * Presents a friendly 404 card with translated copy and two recovery actions:
 * navigate home (dashboard) or go back one history entry.
 *
 * Uses the `errors` i18n namespace (`notFound.*` keys) so the page stays
 * localized without hard-coded English strings.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/NotFound.tsx
 * **Area:** client page
 * **Responsibility:**
 * Catch-all route for unknown paths (`path="*"` in {@link App}). Presents a friendly 404 card with
 * translated copy and two recovery actions: navigate home (dashboard) or go back one history entry.
 * Uses the `errors` i18n namespace (`notFound.*` keys) so the page stays localized without
 * hard-coded English strings.
 *
 * ## Architectural boundary
 * - Route-level orchestration belongs here: load scoped data, subscribe to live updates, and
 *   compose reusable components.
 * - Server authority remains on the API side; the page may explain or confirm actions but must not
 *   invent authorization rules.
 * - The global data-source scope must flow through shared API helpers so local, all-source, and
 *   selected-source views agree.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `NotFound` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `NotFound` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useNavigate` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `errors` — visible copy resolves through this namespace; key and interpolation parity applies
 *   to every supported locale.
 *
 * ## Area invariants
 * - Represent loading, empty, partial, error, and refreshed states deliberately; a blank panel is
 *   not an error strategy.
 * - Cancel or ignore stale asynchronous work when parameters, source scope, or component lifetime
 *   changes.
 * - Merge WebSocket deltas without duplicating entities already returned by the REST snapshot.
 * - Keep query parameters and route state shareable when the surrounding router already exposes
 *   that state in URLs.
 * - Use translation keys for visible copy and preserve interpolation tokens across every supported
 *   locale.
 * - Keep expensive derivations memoized only when profiling or dependency stability justifies the
 *   extra contract.
 * - Preserve keyboard focus and useful headings when switching tabs, filters, drawers, or modal
 *   states.
 * - Do not make destructive requests without the confirmation and server-side gate required by the
 *   underlying API.
 * - Use canonical formatting helpers for timestamps, durations, token counts, costs, and provider
 *   labels.
 * - Keep page-level polling and event subscriptions bounded; cleanup must run on unmount and scope
 *   changes.
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
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/NotFound.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/pages/NotFound.tsx`
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
 * ## Public surface
 * - `NotFound` — exported API; see TSDoc on the symbol for behavior.
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
 * **NotFound**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";

/**
 * 404 page rendered for unmatched routes.
 * @returns Centered error card with navigation actions.
 */
export function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation("errors");

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center animate-fade-in">
      <div className="card max-w-xl w-full p-8 md:p-10 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-accent" />
        </div>

        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">
          {t("notFound.code")}
        </p>
        <h2 className="text-2xl font-semibold text-gray-100 mb-2">{t("notFound.title")}</h2>
        <p className="text-sm text-gray-400 mb-8">{t("notFound.description")}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="btn-primary" onClick={() => navigate("/")}>
            <Home className="w-4 h-4" />
            {t("notFound.goDashboard")}
          </button>
          <button
            className="btn-ghost border border-border hover:border-border-light"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            {t("notFound.goBack")}
          </button>
        </div>
      </div>
    </div>
  );
}
