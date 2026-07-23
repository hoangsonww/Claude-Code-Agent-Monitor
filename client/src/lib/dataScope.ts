/**
 * @file dataScope.ts
 * @description Global "data scope" store — which source machines' data the whole
 * dashboard should show. Backs the Remote Data Sources feature: the user picks
 * Local only / All / a specific subset, and every scoped page reflects it
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

import { useSyncExternalStore } from "react";

export type ScopeMode = "all" | "local" | "selected";

export interface DataScope {
  mode: ScopeMode;
  /** Source ids selected when `mode === "selected"`. */
  selected: string[];
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
    return { mode, selected };
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
  current = { mode: next.mode, selected: [...next.selected] };
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
