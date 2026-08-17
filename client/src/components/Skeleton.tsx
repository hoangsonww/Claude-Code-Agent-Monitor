/**
 * @file Skeleton.tsx
 * @description Loading skeleton primitives. Use these in place of "-", "0", or
 * empty bodies while data is still being fetched so the UI never flashes
 * placeholder values that the user might read as real zeros. All variants are
 * pure presentational and respect prefers-reduced-motion (animate-pulse is a
 * native Tailwind utility that already honors the OS setting).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Skeleton.tsx`
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
 * - `Skeleton` — exported API; see TSDoc on the symbol for behavior.
 * - `StatValueSkeleton` — exported API; see TSDoc on the symbol for behavior.
 * - `TextSkeleton` — exported API; see TSDoc on the symbol for behavior.
 * - `TableRowSkeleton` — exported API; see TSDoc on the symbol for behavior.
 * - `CardSkeleton` — exported API; see TSDoc on the symbol for behavior.
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
 * **Skeleton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **StatValueSkeleton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TextSkeleton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TableRowSkeleton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CardSkeleton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** Rounded shape variant. Defaults to "md". */
  rounded?: "sm" | "md" | "lg" | "full";
  /** Aria label for screen readers. Defaults to "Loading". */
  label?: string;
}

const ROUNDED_CLASS = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

/**
 * Base shimmer block. Compose with width/height utilities for any shape:
 *   <Skeleton className="h-6 w-24" />
 */
export function Skeleton({
  className = "",
  style,
  rounded = "md",
  label = "Loading",
}: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`inline-block bg-surface-3/70 animate-pulse ${ROUNDED_CLASS[rounded]} ${className}`}
      style={style}
    />
  );
}

/**
 * Stat-card value placeholder. Sized to match the 2xl semibold number that
 * StatCard renders so layout doesn't jump when real data arrives.
 */
export function StatValueSkeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-7 w-20 align-middle ${className}`} />;
}

/**
 * Single-line text placeholder. Good for trend/sub labels.
 */
export function TextSkeleton({
  className = "",
  width = "w-16",
}: {
  className?: string;
  width?: string;
}) {
  return <Skeleton className={`h-3 ${width} align-middle ${className}`} />;
}

/**
 * Full table-row skeleton for tabular pages. Caller passes the column count so
 * the skeleton lines up under existing headers.
 */
export function TableRowSkeleton({ columns, widths }: { columns: number; widths?: string[] }) {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Skeleton className={`h-4 ${widths?.[i] ?? "w-24"}`} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Block placeholder for card-shaped content (kanban cards, list items).
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-4 space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
