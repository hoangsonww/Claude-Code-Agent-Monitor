/**
 * @file dataScope.ts
 * @description Global source-and-provider scope store. It drives Remote Data
 * Sources and the Claude Code/Codex selection so every scoped page updates
 * immediately.
 *
 * This is a tiny module-level singleton (one per tab), mirroring the eventBus
 * pattern. `api.ts` reads {@link activeSourcesParam} to append `?sources=...` to
 * the scoped GET endpoints; React components read {@link useDataScope} (via
 * `useSyncExternalStore`) to render the selector and to re-fetch when the scope
 * changes. The choice is persisted to localStorage so it survives reloads.
 *
 * Scope semantics:
 *   - `all`      → no `sources` param (server returns every machine's data)
 *   - `local`    → `sources=local` (only this machine)
 *   - `selected` → `sources=<comma-separated ids>` (an empty selection falls
 *                  back to `local` so the UI never shows a confusing empty app)
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
 * **Module:** client/src/lib/dataScope.ts
 * **Area:** client library
 * **Responsibility:**
 * Global source-and-provider scope store. It drives Remote Data Sources and the Claude Code/Codex
 * selection so every scoped page updates immediately. This is a tiny module-level singleton (one
 * per tab), mirroring the eventBus pattern. `api.ts` reads {@link activeSourcesParam} to append
 * `?sources=...` to the scoped GET endpoints; React components read {@link useDataScope} (via
 * `useSyncExternalStore` ) to render the selector and to re-fetch when the scope changes. The
 * choice is persisted to localStorage so it survives reloads. Scope semantics: - `all` → no
 * `sources` param (server returns every machine's data) - `local` → `sources=local` (only this
 * machine) - `selected` → `sources=<comma-separated ids>` (an empty selection falls back to `local`
 * so the UI never shows a confusing empty app)
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
 * - `activeProvidersParam` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `activeSourcesParam` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `DataScope` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `getScope` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `ProviderScope` (type) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `ScopeMode` (type) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `setProviderScope` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `setScope` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `subscribeScope` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `useDataScope` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `activeProvidersParam` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `activeSourcesParam` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `current` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DataScope` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DEFAULT_SCOPE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `getScope` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `listeners` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `load` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `persist` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ProviderScope` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ScopeMode` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `setProviderScope` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `setScope` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STORAGE_KEY` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `subscribeScope` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `useDataScope` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/dataScope.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/lib/dataScope.ts`
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
 * - `ScopeMode` — exported API; see TSDoc on the symbol for behavior.
 * - `DataScope` — exported API; see TSDoc on the symbol for behavior.
 * - `getScope` — exported API; see TSDoc on the symbol for behavior.
 * - `setScope` — exported API; see TSDoc on the symbol for behavior.
 * - `subscribeScope` — exported API; see TSDoc on the symbol for behavior.
 * - `activeSourcesParam` — exported API; see TSDoc on the symbol for behavior.
 * - `useDataScope` — exported API; see TSDoc on the symbol for behavior.
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
 * **ScopeMode**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DataScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **getScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **setScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **subscribeScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **activeSourcesParam**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **useDataScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

/**
 * Which machines' data is shown: `all` (this machine and every remote source), `local` (this
 * machine only), or `selected` (the chosen sources).
 */
export type ScopeMode = "all" | "local" | "selected";
/** Which product's data is shown: Claude-compatible (Claude Code and Cursor), Codex, or both. */
export type ProviderScope = "claude" | "codex" | "both";

/** The global data scope applied to every scoped list and aggregate request. */
export interface DataScope {
  /** Machine selection mode. */
  mode: ScopeMode;
  /** Source ids selected when `mode === "selected"`. */
  selected: string[];
  /** Product data included globally. `both` leaves the API provider filter unset. */
  provider?: ProviderScope;
}

/** localStorage key for the persisted scope. */
const STORAGE_KEY = "ccam-data-scope";
/** Scope for a first visit: every machine and both products. */
const DEFAULT_SCOPE: DataScope = { mode: "all", selected: [] };

/**
 * Read the persisted scope, validating each field so a corrupt or outdated entry falls back to the
 * defaults.
 *
 * @returns The stored scope, or {@link DEFAULT_SCOPE}.
 */
function load(): DataScope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCOPE;
    const parsed = JSON.parse(raw) as Partial<DataScope>;
    const mode: ScopeMode =
      parsed.mode === "local" || parsed.mode === "selected" || parsed.mode === "all"
        ? parsed.mode
        : "all";
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.filter((s): s is string => typeof s === "string")
      : [];
    const provider: ProviderScope | undefined =
      parsed.provider === "codex" || parsed.provider === "both" || parsed.provider === "claude"
        ? parsed.provider
        : undefined;
    return provider ? { mode, selected, provider } : { mode, selected };
  } catch {
    return DEFAULT_SCOPE;
  }
}

/**
 * The single source of truth for this tab's scope. It is replaced wholesale on every change so
 * `useSyncExternalStore`'s snapshot stays referentially stable between changes.
 */
let current: DataScope = load();
/** Subscribers notified when the scope changes. */
const listeners = new Set<() => void>();

/**
 * Save the current scope to localStorage. If storage is disabled, the in-memory scope still works
 * for the session.
 */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage disabled — in-memory scope still works for this session */
  }
}

/** Current scope (stable reference until the next {@link setScope}). */
export function getScope(): DataScope {
  return current;
}

/**
 * Replace the scope, persist it, and notify all subscribers.
 *
 * @param next - New scope; when it has no provider, the current provider is kept.
 */
export function setScope(next: DataScope): void {
  current = {
    mode: next.mode,
    selected: [...next.selected],
    provider: next.provider ?? current.provider,
  };
  persist();
  listeners.forEach((l) => l());
}

/**
 * Subscribe to scope changes (for useSyncExternalStore / manual wiring).
 *
 * @param cb - Called after every change.
 * @returns A function that unsubscribes.
 */
export function subscribeScope(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * The `sources` query-param value for the current scope, or `null` when no
 * filter should be sent (mode "all"). `api.ts` calls this for every scoped
 * endpoint so a scope change transparently narrows all data.
 */
export function activeSourcesParam(): string | null {
  if (current.mode === "all") return null;
  if (current.mode === "local") return "local";
  // "selected": empty selection degrades to local-only rather than showing
  // nothing, which would look like a broken/empty dashboard.
  return current.selected.length > 0 ? current.selected.join(",") : "local";
}

/** The `providers` API query value, or null when the viewer selected both products. */
export function activeProvidersParam(): string | null {
  return current.provider === "both" ? null : current.provider || "claude";
}

/**
 * Update only the product dimension while preserving the selected machines.
 *
 * @param provider - New product scope.
 */
export function setProviderScope(provider: ProviderScope): void {
  setScope({ ...current, provider });
}

/**
 * React binding: returns `[scope, setScope]`. Components include `scope` in
 * their data-loading effect deps so a change re-fetches; the selector calls the
 * setter. `getScope` is a stable snapshot getter (server snapshot is the same,
 * so SSR/first paint is consistent).
 */
export function useDataScope(): [DataScope, (next: DataScope) => void] {
  const scope = useSyncExternalStore(subscribeScope, getScope, getScope);
  return [scope, setScope];
}
