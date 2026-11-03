/**
 * @file Skeleton.tsx
 * @description Loading skeleton primitives. Use these in place of "-", "0", or
 * empty bodies while data is still being fetched so the UI never flashes
 * placeholder values that the user might read as real zeros. All variants are
 * pure presentational and respect prefers-reduced-motion (animate-pulse is a
 * native Tailwind utility that already honors the OS setting).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Skeleton.tsx
 * **Area:** client component
 * **Responsibility:**
 * Loading skeleton primitives. Use these in place of "-", "0", or empty bodies while data is still
 * being fetched so the UI never flashes placeholder values that the user might read as real zeros.
 * All variants are pure presentational and respect prefers-reduced-motion (animate-pulse is a
 * native Tailwind utility that already honors the OS setting).
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CardSkeleton` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `Skeleton` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `StatValueSkeleton` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TableRowSkeleton` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TextSkeleton` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CardSkeleton` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ROUNDED_CLASS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Skeleton` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SkeletonProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `StatValueSkeleton` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `TableRowSkeleton` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TextSkeleton` (function) — top-level declaration that helps orient code review and focused
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Skeleton.tsx` .
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

/** Props for {@link Skeleton}. */
interface SkeletonProps {
  /** Extra classes, typically width and height. */
  className?: string;
  /** Inline styles, for sizes not covered by classes. */
  style?: CSSProperties;
  /** Rounded shape variant. Defaults to "md". */
  rounded?: "sm" | "md" | "lg" | "full";
  /** Aria label for screen readers. Defaults to "Loading". */
  label?: string;
}

/** Tailwind class for each corner style. */
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
  /** Extra classes for the wrapper. */
  className?: string;
  /** CSS width of the line; defaults to full width. */
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
