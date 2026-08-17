/**
 * @file EmptyState.tsx
 * @description Centered empty-state panel used whenever a page or section has
 * nothing to render yet — no sessions, no events, no search hits, or a feature
 * that has not been configured. Keeps the UI from looking broken by giving the
 * user a clear icon, title, explanation, and an optional call-to-action slot.
 *
 * ## When to use
 * Prefer this over ad-hoc "No data" paragraphs so every list/table page shares
 * the same vertical rhythm, typography, and card chrome. The optional `action`
 * slot accepts any React node (usually a `<Link>` or `<button>`) without this
 * component needing to know about routing.
 *
 * ## Accessibility
 * The icon is decorative (no separate `aria-label`); meaning comes from the
 * visible `title` (`<h3>`) and `description` (`<p>`). Callers should pass
 * translated strings via `useTranslation`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/EmptyState.tsx`
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
 * - `EmptyStateProps` — exported API; see TSDoc on the symbol for behavior.
 * - `EmptyState` — exported API; see TSDoc on the symbol for behavior.
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
 * **EmptyStateProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EmptyState**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { LucideIcon } from "lucide-react";

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Lucide icon shown inside the rounded square above the title. */
  icon: LucideIcon;
  /** Primary heading — keep short (one line). */
  title: string;
  /** Supporting copy; wrapped at `max-w-md` for comfortable line length. */
  description: string;
  /** Optional CTA rendered below the description (button, link, or form). */
  action?: React.ReactNode;
}

/**
 * Renders a vertically centered empty state inside the main content column.
 * @param props See {@link EmptyStateProps}.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-4 flex items-center justify-center mb-5">
        <Icon className="w-6 h-6 text-gray-500" />
      </div>
      <h3 className="text-base font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}
