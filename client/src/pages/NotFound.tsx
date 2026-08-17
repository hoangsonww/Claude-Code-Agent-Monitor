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
