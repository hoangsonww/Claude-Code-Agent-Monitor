/**
 * @file appEvents.ts
 * @description Window events used to trigger app-wide chrome from anywhere in the
 * tree, plus the typed helpers that dispatch them.
 *
 * These live in `lib/` rather than beside the components that handle them for one
 * reason: the trigger and the handler are usually in different components, and
 * importing one component from the other creates a cycle (the sidebar opens the
 * palette; the palette asks the sidebar to check for updates). A shared module
 * breaks that without giving either component knowledge of the other.
 *
 * A window event is also the right coupling here regardless: no context provider,
 * no lifted state, and any component — or a test — can trigger the behavior.
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
 * **Module:** client/src/lib/appEvents.ts
 * **Area:** client library
 * **Responsibility:**
 * Window events used to trigger app-wide chrome from anywhere in the tree, plus the typed helpers
 * that dispatch them. These live in `lib/` rather than beside the components that handle them for
 * one reason: the trigger and the handler are usually in different components, and importing one
 * component from the other creates a cycle (the sidebar opens the palette; the palette asks the
 * sidebar to check for updates). A shared module breaks that without giving either component
 * knowledge of the other. A window event is also the right coupling here regardless: no context
 * provider, no lifted state, and any component — or a test — can trigger the behavior.
 *
 * ## Architectural boundary
 * - Provides shared typed behavior or wire contracts consumed by multiple client screens and
 *   components.
 * - Keep functions deterministic and side effects explicit; central helpers amplify both correct
 *   behavior and regressions.
 * - Types mirroring server payloads must stay aligned with serializers, OpenAPI descriptions, and
 *   WebSocket messages.
 *
 * ## Public surface
 * - `ACTION_TOAST_EVENT` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `announceAction` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `COMMAND_PALETTE_EVENT` (variable) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `openCommandPalette` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `requestUpdateCheck` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `UPDATE_CHECK_EVENT` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ACTION_TOAST_EVENT` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `announceAction` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `COMMAND_PALETTE_EVENT` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `openCommandPalette` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `requestUpdateCheck` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `UPDATE_CHECK_EVENT` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Area invariants
 * - Preserve null, undefined, zero, and empty distinctions when they carry different server or
 *   presentation meaning.
 * - Do not mutate caller-owned collections in formatters, mergers, grouping helpers, or selectors.
 * - Keep stable sorting and tie-breakers explicit so live updates do not reorder equal records
 *   unpredictably.
 * - Use exhaustive checks for discriminated unions when new providers, messages, or statuses can be
 *   added.
 * - Keep URL construction encoded and route through shared auth/source-scope behavior.
 * - Return errors with enough context for the UI to explain the failed action without leaking
 *   secrets.
 * - Avoid browser globals at module evaluation time unless the module is deliberately browser-only
 *   and tested as such.
 * - Keep formatting locale-aware where the chosen UI language, not the browser default, owns the
 *   output.
 * - Document non-obvious thresholds, unit conversions, and compatibility fallbacks beside their
 *   definitions.
 * - Add table-driven tests for boundary values because library helpers often serve many visually
 *   unrelated screens.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/appEvents.ts` .
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
 * **Path:** `client/src/lib/appEvents.ts`
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
 * - `COMMAND_PALETTE_EVENT` — exported API; see TSDoc on the symbol for behavior.
 * - `UPDATE_CHECK_EVENT` — exported API; see TSDoc on the symbol for behavior.
 * - `ACTION_TOAST_EVENT` — exported API; see TSDoc on the symbol for behavior.
 * - `openCommandPalette` — exported API; see TSDoc on the symbol for behavior.
 * - `requestUpdateCheck` — exported API; see TSDoc on the symbol for behavior.
 * - `announceAction` — exported API; see TSDoc on the symbol for behavior.
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
 * **COMMAND_PALETTE_EVENT**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **UPDATE_CHECK_EVENT**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ACTION_TOAST_EVENT**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **openCommandPalette**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **requestUpdateCheck**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **announceAction**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Opens the command palette. Handled by `CommandPalette`. */
export const COMMAND_PALETTE_EVENT = "ccam:command-palette";

/** Asks the sidebar to run an update check. Handled by `Sidebar`. */
export const UPDATE_CHECK_EVENT = "ccam:check-updates";

/** Carries a short confirmation to the toast. Handled by `ActionToast`. */
export const ACTION_TOAST_EVENT = "ccam:action-toast";

/** Open the command palette from outside the component. */
export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/**
 * Ask the sidebar to re-check for a release. The check itself stays in the
 * sidebar, which owns the spinner, the failure state, and the modal that reports
 * the result.
 */
export function requestUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent(UPDATE_CHECK_EVENT));
}

/**
 * Confirm an action that changed something without moving the user.
 *
 * A palette command that toggles a preference or copies a link closes the
 * palette and then, visibly, does nothing — which reads as broken even when it
 * worked. Navigation is its own feedback; everything else needs this.
 *
 * @param message - Text to show in the action toast.
 */
export function announceAction(message: string): void {
  window.dispatchEvent(new CustomEvent(ACTION_TOAST_EVENT, { detail: message }));
}
