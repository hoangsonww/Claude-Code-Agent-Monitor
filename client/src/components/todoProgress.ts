/**
 * @file Shared visual metadata and formatting helpers for compact and detailed
 * session task-progress surfaces.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/todoProgress.ts
 * **Area:** client component
 * **Responsibility:**
 * Shared visual metadata and formatting helpers for compact and detailed session task-progress
 * surfaces.
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
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Public surface
 * - `taskProgressAriaLabel` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `taskProgressSegments` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `taskSourceLabel` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TODO_STATUS_META` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `taskProgressAriaLabel` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `taskProgressSegments` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `taskSourceLabel` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TODO_STATUS_META` (variable) — top-level declaration that helps orient code review and focused
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/todoProgress.ts` .
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
 * **Path:** `client/src/components/todoProgress.ts`
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
 * - `../lib/types`
 *
 * ## Public surface
 * - `TODO_STATUS_META` — exported API; see TSDoc on the symbol for behavior.
 * - `taskProgressSegments` — exported API; see TSDoc on the symbol for behavior.
 * - `taskSourceLabel` — exported API; see TSDoc on the symbol for behavior.
 * - `taskProgressAriaLabel` — exported API; see TSDoc on the symbol for behavior.
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
 * **TODO_STATUS_META**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **taskProgressSegments**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **taskSourceLabel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **taskProgressAriaLabel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { SessionTodoSnapshot, SessionTodoStatus, SessionTodoSummary } from "../lib/types";

/**
 * Display metadata for each task status: chart color, text and background classes, and translation
 * key, shared by every task-progress view.
 */
export const TODO_STATUS_META: Record<
  SessionTodoStatus,
  {
    color: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    labelKey: string;
  }
> = {
  completed: {
    color: "#34d399",
    textClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    labelKey: "taskProgress.status.completed",
  },
  in_progress: {
    color: "#60a5fa",
    textClass: "text-blue-300",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
    labelKey: "taskProgress.status.inProgress",
  },
  pending: {
    color: "#a78bfa",
    textClass: "text-violet-300",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
    labelKey: "taskProgress.status.pending",
  },
  cancelled: {
    color: "#6b7280",
    textClass: "text-gray-400",
    bgClass: "bg-gray-500/10",
    borderClass: "border-gray-500/20",
    labelKey: "taskProgress.status.cancelled",
  },
  unknown: {
    color: "#f59e0b",
    textClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    labelKey: "taskProgress.status.unknown",
  },
};

/**
 * Counts per status in display order, for the donut and the summary grid.
 *
 * @param progress - Summary or snapshot.
 * @returns One segment per status with its count.
 */
export function taskProgressSegments(progress: SessionTodoSummary | SessionTodoSnapshot) {
  return [
    { status: "completed" as const, value: progress.completed },
    { status: "in_progress" as const, value: progress.inProgress },
    { status: "pending" as const, value: progress.pending },
    { status: "cancelled" as const, value: progress.cancelled },
    { status: "unknown" as const, value: progress.unknown },
  ].filter((segment) => segment.value > 0);
}

/**
 * Readable name for the tool that produced the task state, such as `Codex update_plan`, `Claude
 * TodoWrite`, or `Claude TaskUpdate`.
 *
 * @param sourceTool - Tool name, or null.
 * @param fallbackLabel - Label when the tool is unknown.
 * @returns The display name.
 */
export function taskSourceLabel(sourceTool: string | null | undefined, fallbackLabel: string) {
  if (!sourceTool) return fallbackLabel;
  if (sourceTool === "update_plan") return "Codex update_plan";
  if (sourceTool === "TodoWrite") return "Claude TodoWrite";
  if (sourceTool.startsWith("Task")) return `Claude ${sourceTool}`;
  return sourceTool;
}

/**
 * Accessible label such as `3 of 5 complete`.
 *
 * @param progress - Summary or snapshot.
 * @param completeWord - Localized word for complete.
 * @returns The label.
 */
export function taskProgressAriaLabel(
  progress: SessionTodoSummary | SessionTodoSnapshot,
  completeWord = "complete"
) {
  return `${progress.completed} of ${progress.total} ${completeWord}`;
}
