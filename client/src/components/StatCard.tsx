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
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/StatCard.tsx
 * **Area:** client component
 * **Responsibility:**
 * Compact metric tile for dashboard and analytics grids. Shows a label, large formatted value,
 * Lucide icon, and optional trend suffix. When the displayed value is abbreviated (e.g. "1.2k"),
 * pass the full precision string via `raw` so {@link Tip} can reveal it on hover. ## Loading state
 * Set `loading` while fetching so the card renders {@link StatValueSkeleton} instead of flashing
 * placeholder dashes or zeros before real data arrives.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Local dependency edges
 * - `./Skeleton` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Tip` — repository-local contract consumed by this module; review its exports before changing
 *   assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `StatCard` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `StatCard` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `StatCardProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/StatCard.tsx` .
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

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Tip } from "./Tip";
import { StatValueSkeleton } from "./Skeleton";

/** Props for {@link StatCard}. */
interface StatCardProps {
  /** Uppercase label above the value (usually a translated metric name). */
  label: string;
  /** Optional control rendered immediately after the label. */
  labelAccessory?: ReactNode;
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
  labelAccessory,
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
        {labelAccessory ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
              {label}
            </span>
            {labelAccessory}
          </div>
        ) : (
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
            {label}
          </span>
        )}
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
