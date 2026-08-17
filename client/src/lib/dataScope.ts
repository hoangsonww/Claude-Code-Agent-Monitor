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

export type ScopeMode = "all" | "local" | "selected";
export type ProviderScope = "claude" | "codex" | "both";

export interface DataScope {
  mode: ScopeMode;
  /** Source ids selected when `mode === "selected"`. */
  selected: string[];
  /** Product data included globally. `both` leaves the API provider filter unset. */
  provider?: ProviderScope;
}

const STORAGE_KEY = "ccam-data-scope";
const DEFAULT_SCOPE: DataScope = { mode: "all", selected: [] };

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

// The single source of truth for this tab. Replaced wholesale on every change so
// useSyncExternalStore's getSnapshot returns a stable reference between changes.
let current: DataScope = load();
const listeners = new Set<() => void>();

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

/** Replace the scope, persist it, and notify all subscribers. */
export function setScope(next: DataScope): void {
  current = {
    mode: next.mode,
    selected: [...next.selected],
    provider: next.provider ?? current.provider,
  };
  persist();
  listeners.forEach((l) => l());
}

/** Subscribe to scope changes (for useSyncExternalStore / manual wiring). */
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

/** Update only the product dimension while preserving the selected machines. */
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
