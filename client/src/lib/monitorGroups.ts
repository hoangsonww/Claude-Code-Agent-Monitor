/**
 * @file monitorGroups.ts
 * @description Server-backed store for the Kanban Board's "Projects" view
 * monitor swimlanes - user-named groups (mirroring physical displays) that
 * project columns can be dragged into, the project id -> monitor id map, and
 * the per-project-column collapsed-state map. Global and shared across every
 * computer connected to this dashboard: hydrated from GET /api/monitors on
 * first subscribe and kept live via `monitors_updated` WebSocket pushes -
 * mirrors focusStore.ts's pattern for session_focus. The very first hydrate
 * that finds the server empty seeds it once from this browser's legacy
 * localStorage keys (kanban-monitors/kanban-monitor-map/
 * kanban-collapsed-projects) so a layout set up before this became
 * server-backed isn't silently lost.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useSyncExternalStore } from "react";
import { api } from "./api";
import { eventBus } from "./eventBus";
import type { MonitorGroup, MonitorLayoutPayload, WSMessage } from "./types";

export type { MonitorGroup };

const EMPTY_LAYOUT: MonitorLayoutPayload = { monitors: [], monitorMap: {}, collapsedProjects: {} };

/** Current snapshot. Swapped wholesale so `useSyncExternalStore` gets a
 *  stable reference between changes. */
let snapshot: MonitorLayoutPayload = EMPTY_LAYOUT;
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

function setSnapshot(next: MonitorLayoutPayload): void {
  snapshot = next;
  notify();
}

// Merge live pushes for the lifetime of the tab, so a layout change made from
// another connected computer shows up here without a reload - registered at
// module scope (like the socket itself) so updates accumulate even while no
// component is currently subscribed.
eventBus.subscribe((msg: WSMessage) => {
  try {
    if (msg.type !== "monitors_updated") return;
    const data = msg.data as MonitorLayoutPayload;
    if (!data || !Array.isArray(data.monitors)) return;
    setSnapshot({
      monitors: data.monitors,
      monitorMap: data.monitorMap ?? {},
      collapsedProjects: data.collapsedProjects ?? {},
    });
  } catch {
    /* never propagate into the bus dispatch loop */
  }
});

// ───── Legacy localStorage (pre-server-backed layout) - read-only, used only
// to seed the server once if it has nothing yet. ─────

const LEGACY_MONITORS_KEY = "kanban-monitors";
const LEGACY_MONITOR_MAP_KEY = "kanban-monitor-map";
const LEGACY_COLLAPSED_PROJECTS_KEY = "kanban-collapsed-projects";

function loadLegacyMonitors(): MonitorGroup[] {
  try {
    const raw = localStorage.getItem(LEGACY_MONITORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MonitorGroup =>
        !!m && typeof m === "object" && typeof m.id === "string" && typeof m.name === "string"
    );
  } catch {
    return [];
  }
}

function loadLegacyMonitorMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LEGACY_MONITOR_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

function loadLegacyCollapsedProjects(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LEGACY_COLLAPSED_PROJECTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** True when a layout has nothing in it - used to decide whether the
 *  one-time legacy-localStorage migration should fire. */
function isEmptyLayout(layout: MonitorLayoutPayload): boolean {
  return (
    layout.monitors.length === 0 &&
    Object.keys(layout.monitorMap).length === 0 &&
    Object.keys(layout.collapsedProjects).length === 0
  );
}

export const monitorStore = {
  /** Subscribe to snapshot changes; triggers the lazy first hydrate. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    void monitorStore.hydrate();
    return () => listeners.delete(listener);
  },

  /** Current immutable snapshot (stable reference between changes). */
  getSnapshot(): MonitorLayoutPayload {
    return snapshot;
  },

  /** One-shot bulk hydrate from GET /api/monitors. If the server has nothing
   *  yet and this browser still has a pre-server-backed layout in
   *  localStorage, seeds the server from it once (see file header). */
  hydrate(): Promise<void> {
    if (hydrated) return Promise.resolve();
    if (hydrating) return hydrating;
    // Guards older test mocks that stub the api module without a `monitors`
    // namespace (mirrors focusStore.ts's identical guard for `api.plans`).
    if (typeof api.monitors?.get !== "function") {
      hydrated = true;
      return Promise.resolve();
    }
    hydrating = api.monitors
      .get()
      .then(async (layout) => {
        if (isEmptyLayout(layout)) {
          const legacy: MonitorLayoutPayload = {
            monitors: loadLegacyMonitors(),
            monitorMap: loadLegacyMonitorMap(),
            collapsedProjects: loadLegacyCollapsedProjects(),
          };
          if (!isEmptyLayout(legacy)) {
            try {
              layout = await api.monitors.update(legacy);
            } catch {
              /* server unavailable for the migration write; keep the empty
                 layout and try again on a later hydrate */
            }
          }
        }
        hydrated = true;
        setSnapshot(layout);
      })
      .catch(() => {
        // Leave hydrated=false so a later subscribe retries (e.g. the server
        // wasn't up yet); WS pushes still populate the snapshot meanwhile.
        hydrating = null;
      });
    return hydrating;
  },

  /** Test-only: reset the store to its pristine state. */
  __resetForTest(): void {
    snapshot = EMPTY_LAYOUT;
    hydrated = false;
    hydrating = null;
  },

  /** Optimistically updates the monitor list, then best-effort persists it. */
  saveMonitors(monitors: MonitorGroup[]): void {
    setSnapshot({ ...snapshot, monitors });
    void api.monitors.update({ monitors }).catch(() => {
      /* best-effort; a later hydrate/WS push reconciles */
    });
  },

  /** Optimistically updates the project -> monitor map, then best-effort persists it. */
  saveMonitorMap(monitorMap: Record<string, string>): void {
    setSnapshot({ ...snapshot, monitorMap });
    void api.monitors.update({ monitorMap }).catch(() => {
      /* best-effort; a later hydrate/WS push reconciles */
    });
  },

  /** Optimistically updates the project-column collapsed-state map, then best-effort persists it. */
  saveCollapsedProjects(collapsedProjects: Record<string, boolean>): void {
    setSnapshot({ ...snapshot, collapsedProjects });
    void api.monitors.update({ collapsedProjects }).catch(() => {
      /* best-effort; a later hydrate/WS push reconciles */
    });
  },
};

/** React hook: the whole live monitor layout (monitors, monitorMap,
 *  collapsedProjects). Re-renders on store changes only. */
export function useMonitorLayout(): MonitorLayoutPayload {
  return useSyncExternalStore(monitorStore.subscribe, monitorStore.getSnapshot);
}

/** Creates a new monitor group with a fresh id. Pure - no persistence. */
export function createMonitor(name: string): MonitorGroup {
  return { id: crypto.randomUUID(), name };
}
