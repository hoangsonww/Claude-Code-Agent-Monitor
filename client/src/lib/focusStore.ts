/**
 * @file focusStore.ts
 * @description Module-level store for per-session focus state (which
 * AGENT-PLAN.md item each session declared it is serving, plus detour stack
 * and drift verdict). Mirrors the eventBus singleton pattern: one immutable
 * Map per browser tab, hydrated lazily from GET /api/focus on first subscribe
 * and merged in place from `session_focus` WebSocket pushes — so SessionCard
 * can read focus for any session without prop drilling or per-card fetches.
 *
 * ## Design
 * - The snapshot is an immutable `ReadonlyMap` swapped wholesale on every
 *   change, which makes `getSnapshot` stable for `useSyncExternalStore`.
 * - Every eventBus handler is fully try/catch-wrapped: bus dispatch is
 *   synchronous with NO error isolation (a throwing handler starves later
 *   subscribers), so this store must never throw.
 * - A WS push that races the initial hydrate wins: hydrate only fills
 *   sessions the map doesn't already know, and pushes always overwrite.
 * - `typeof api.plans?.focusAll === "function"` guards older test mocks that
 *   stub the api module without a `plans` namespace.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useSyncExternalStore } from "react";
import { api } from "./api";
import { eventBus } from "./eventBus";
import type { SessionFocus, WSMessage } from "./types";

/** Current snapshot: session_id → focus wire shape. Swapped immutably. */
let focusMap: ReadonlyMap<string, SessionFocus> = new Map();
/** Store subscribers (React components via useSyncExternalStore). */
const listeners = new Set<() => void>();
/** One-shot hydrate latch. */
let hydrated = false;
let hydrating: Promise<void> | null = null;

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a broken listener must not starve the others */
    }
  });
}

function upsert(focus: SessionFocus): void {
  const next = new Map(focusMap);
  next.set(focus.session_id, focus);
  focusMap = next;
  notify();
}

// Merge live pushes for the lifetime of the tab. Registered at module scope
// (like the socket itself) so focus updates accumulate even while no
// component is currently subscribed.
eventBus.subscribe((msg: WSMessage) => {
  try {
    if (msg.type !== "session_focus") return;
    const focus = msg.data as SessionFocus;
    if (!focus || typeof focus.session_id !== "string") return;
    upsert(focus);
  } catch {
    /* never propagate into the bus dispatch loop */
  }
});

export const focusStore = {
  /** Subscribe to snapshot changes; triggers the lazy first hydrate. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    void focusStore.hydrate();
    return () => listeners.delete(listener);
  },

  /** Current immutable snapshot (stable reference between changes). */
  getSnapshot(): ReadonlyMap<string, SessionFocus> {
    return focusMap;
  },

  /** One-shot bulk hydrate from GET /api/focus. Entries already present
   *  (from a racing WS push) are kept — the push is newer. */
  hydrate(): Promise<void> {
    if (hydrated) return Promise.resolve();
    if (hydrating) return hydrating;
    if (typeof api.plans?.focusAll !== "function") {
      hydrated = true;
      return Promise.resolve();
    }
    hydrating = api.plans
      .focusAll()
      .then((res) => {
        hydrated = true;
        const next = new Map(focusMap);
        for (const focus of res.focus || []) {
          if (!focus || typeof focus.session_id !== "string") continue;
          if (!next.has(focus.session_id)) next.set(focus.session_id, focus);
        }
        focusMap = next;
        notify();
      })
      .catch(() => {
        // Leave hydrated=false so a later subscribe retries (e.g. the server
        // wasn't up yet); WS pushes still populate the map meanwhile.
        hydrating = null;
      });
    return hydrating;
  },

  /** Test-only: reset the store to its pristine state. */
  __resetForTest(): void {
    focusMap = new Map();
    hydrated = false;
    hydrating = null;
  },
};

/**
 * React hook: the live {@link SessionFocus} for one session, or null when the
 * session never declared focus. Re-renders on store changes only.
 */
export function useSessionFocus(sessionId: string): SessionFocus | null {
  const map = useSyncExternalStore(focusStore.subscribe, focusStore.getSnapshot);
  return map.get(sessionId) ?? null;
}

/**
 * React hook: the whole focus map (for pages that join focus across many
 * sessions, e.g. the Projects plan panel's per-item session chips).
 */
export function useFocusMap(): ReadonlyMap<string, SessionFocus> {
  return useSyncExternalStore(focusStore.subscribe, focusStore.getSnapshot);
}
