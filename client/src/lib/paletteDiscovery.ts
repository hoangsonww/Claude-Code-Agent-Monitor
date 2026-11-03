/**
 * @file paletteDiscovery.ts
 * @description Tracks whether this browser has ever opened the command palette,
 * so the hints that teach `Cmd/Ctrl+K` can delete themselves once they have done
 * their job.
 *
 * The palette is keyboard-only by design — a launcher button beside the sidebar
 * duplicates navigation the sidebar already shows — which leaves it invisible to
 * anyone who has not been told it exists. The answer is not permanent chrome for
 * a fact you learn in one second. It is a hint that appears where the need is
 * felt (the splash on first run, and beside the narrow search field a user is
 * already typing into) and never renders again after the first successful open.
 *
 * State lives in `localStorage`, not `sessionStorage`: discovery is a property of
 * the person, not of the tab. Every access is wrapped — storage throws in private
 * mode and in embedded webviews — and a failure degrades to "not yet discovered",
 * because showing a hint twice is a nuisance while never showing it is the bug
 * this module exists to fix.
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
 * **Module:** client/src/lib/paletteDiscovery.ts
 * **Area:** client library
 * **Responsibility:**
 * Tracks whether this browser has ever opened the command palette, so the hints that teach
 * `Cmd/Ctrl+K` can delete themselves once they have done their job. The palette is keyboard-only by
 * design — a launcher button beside the sidebar duplicates navigation the sidebar already shows —
 * which leaves it invisible to anyone who has not been told it exists. The answer is not permanent
 * chrome for a fact you learn in one second. It is a hint that appears where the need is felt (the
 * splash on first run, and beside the narrow search field a user is already typing into) and never
 * renders again after the first successful open. State lives in `localStorage` , not
 * `sessionStorage` : discovery is a property of the person, not of the tab. Every access is wrapped
 * — storage throws in private mode and in embedded webviews — and a failure degrades to "not yet
 * discovered", because showing a hint twice is a nuisance while never showing it is the bug this
 * module exists to fix.
 *
 * ## Architectural boundary
 * - Provides shared typed behavior or wire contracts consumed by multiple client screens and
 *   components.
 * - Keep functions deterministic and side effects explicit; central helpers amplify both correct
 *   behavior and regressions.
 * - Types mirroring server payloads must stay aligned with serializers, OpenAPI descriptions, and
 *   WebSocket messages.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `hasDiscoveredPalette` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `markPaletteDiscovered` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `resetPaletteDiscovery` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `subscribeToPaletteDiscovery` (function) — exported contract; search downstream imports and
 *   tests before changing its name, shape, or timing.
 * - `useShowPaletteHint` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `discovered` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `hasDiscoveredPalette` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `listeners` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `markPaletteDiscovered` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `read` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `resetPaletteDiscovery` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `STORAGE_KEY` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `subscribeToPaletteDiscovery` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `useShowPaletteHint` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useSyncExternalStore` — lifecycle/state dependency detected in this module; preserve
 *   dependency freshness and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/paletteDiscovery.ts` .
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
 * **Path:** `client/src/lib/paletteDiscovery.ts`
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
 * - `hasDiscoveredPalette` — exported API; see TSDoc on the symbol for behavior.
 * - `markPaletteDiscovered` — exported API; see TSDoc on the symbol for behavior.
 * - `subscribeToPaletteDiscovery` — exported API; see TSDoc on the symbol for behavior.
 * - `useShowPaletteHint` — exported API; see TSDoc on the symbol for behavior.
 * - `resetPaletteDiscovery` — exported API; see TSDoc on the symbol for behavior.
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
 * **hasDiscoveredPalette**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **markPaletteDiscovered**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **subscribeToPaletteDiscovery**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **useShowPaletteHint**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **resetPaletteDiscovery**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage key recording that the user has opened the command palette at least once, which
 * retires the "press Cmd/Ctrl+K" hints.
 */
const STORAGE_KEY = "ccam-palette-discovered";

/** In-memory mirror so a hint hides the instant the palette opens. */
let discovered = read();
/** Subscribers notified when the discovered flag changes. */
const listeners = new Set<() => void>();

/**
 * Read the stored flag.
 *
 * @returns True once the palette has been opened; false when unset or storage is unavailable.
 */
function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Has this browser ever opened the palette? */
export function hasDiscoveredPalette(): boolean {
  return discovered;
}

/**
 * Record that the palette has been opened. Idempotent, and safe to call on every
 * open — subscribers are only notified on the transition, so the hints do not
 * re-render for the rest of the session.
 */
export function markPaletteDiscovered(): void {
  if (discovered) return;
  discovered = true;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // The in-memory flag still hides the hints for this session; the worst case
    // is that they return on the next visit, which is the safe direction.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Subscribe to the one transition this store can make.
 *
 * @param listener - Called when the discovered flag changes.
 * @returns A function that unsubscribes.
 */
export function subscribeToPaletteDiscovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * True while the `Cmd/Ctrl+K` hints should still be shown.
 *
 * @returns `false` once the palette has been opened, permanently.
 */
export function useShowPaletteHint(): boolean {
  /** Stable subscribe function for `useSyncExternalStore`. */
  const subscribe = useCallback(
    (listener: () => void) => subscribeToPaletteDiscovery(listener),
    []
  );
  return !useSyncExternalStore(subscribe, hasDiscoveredPalette, () => true);
}

/** Reset discovery. Test-only; nothing in the app un-teaches a shortcut. */
export function resetPaletteDiscovery(): void {
  discovered = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if it was never written */
  }
  listeners.forEach((listener) => listener());
}
