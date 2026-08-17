/**
 * @file StatCard.tsx
 * @description Compact metric tile for dashboard and analytics grids. Shows a
 * label, large formatted value, Lucide icon, and optional trend suffix. When
 * the displayed value is abbreviated (e.g. "1.2k"), pass the full precision
 * string via `raw` so {@link Tip} can reveal it on hover.
 *
 * ## Loading state
 * Set `loading` while fetching so the card renders {@link StatValueSkeleton}
 * instead of flashing placeholder dashes or zeros before real data arrives.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/StatCard.tsx`
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
 * - `./Tip`
 * - `./Skeleton`
 *
 * ## Public surface
 * - `StatCard` — exported API; see TSDoc on the symbol for behavior.
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
 * **StatCard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { LucideIcon } from "lucide-react";
import { Tip } from "./Tip";
import { StatValueSkeleton } from "./Skeleton";

/** Props for {@link StatCard}. */
interface StatCardProps {
  /** Uppercase label above the value (usually a translated metric name). */
  label: string;
  /** Primary metric — pre-formatted by the caller. */
  value: string | number;
  /** Decorative icon in the card header. */
  icon: LucideIcon;
  /** Optional secondary line (e.g. "+12% vs last week"). */
  trend?: string;
  /** Tailwind text-color class for the icon. Defaults to `text-accent`. */
  accentColor?: string;
  /** Full-precision value shown in the hover tooltip when `value` is abbreviated. */
  raw?: string;
  /** When true, render skeletons in place of value/trend. */
  loading?: boolean;
}

/**
 * Renders a single statistic inside the shared `card` chrome.
 * @param props See {@link StatCardProps}.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accentColor = "text-accent",
  raw,
  loading = false,
}: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
          {label}
        </span>
        <Icon className={`w-5 h-5 flex-shrink-0 ${accentColor}`} />
      </div>
      <div className="flex items-end gap-2 min-w-0">
        {loading ? (
          <StatValueSkeleton />
        ) : (
          <Tip raw={raw}>
            <span className="text-2xl font-semibold text-gray-100 truncate">{value}</span>
          </Tip>
        )}
        {!loading && trend && (
          <span className="text-xs text-gray-500 mb-1 flex-shrink-0">{trend}</span>
        )}
      </div>
    </div>
  );
}
