/**
 * @file monitorGroups.ts
 * @description Shared localStorage persistence for the Kanban Board's
 * "Projects" view monitor swimlanes - user-named groups (mirroring physical
 * displays) that project columns can be dragged into, plus the map from
 * project id to the monitor it's currently assigned to, plus the per-project
 * column collapsed-state map. Purely a personal, per-browser arrangement -
 * none of it has a server-side representation and none of it is ever sent
 * to the API. Mirrors lib/projectOrder.ts's shape and conventions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

export interface MonitorGroup {
  id: string;
  name: string;
  /** True when the box is collapsed to just its header (columns hidden).
   *  Absent/false means expanded - the long-standing default, so existing
   *  stored monitors from before this field existed still render open. */
  collapsed?: boolean;
  /** Direction the box lays out its assigned project columns in. Absent
   *  means "horizontal" - the long-standing default, so existing stored
   *  monitors from before this field existed still render as a row. */
  orientation?: "horizontal" | "vertical";
}

const MONITORS_STORAGE_KEY = "kanban-monitors";
const MONITOR_MAP_STORAGE_KEY = "kanban-monitor-map";

/** Reads the persisted monitor list (display order), or `[]` if none is
 *  stored yet / storage is unavailable / the stored value is malformed. */
export function loadMonitors(): MonitorGroup[] {
  try {
    const raw = localStorage.getItem(MONITORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is MonitorGroup =>
          !!m && typeof m === "object" && typeof m.id === "string" && typeof m.name === "string"
      )
      .map((m) => (typeof m.collapsed === "boolean" ? m : { ...m, collapsed: false }))
      .map((m) =>
        m.orientation === "horizontal" || m.orientation === "vertical"
          ? m
          : { ...m, orientation: "horizontal" as const }
      );
  } catch {
    return [];
  }
}

/** Persists the given monitor list. Best-effort; silently no-ops if storage
 *  is unavailable (private browsing, quota, etc.). */
export function persistMonitors(monitors: MonitorGroup[]): void {
  try {
    localStorage.setItem(MONITORS_STORAGE_KEY, JSON.stringify(monitors));
  } catch {
    /* ignore */
  }
}

/** Reads the persisted project id -> monitor id map. A project id absent
 *  from the map means "ungrouped" - there is no explicit sentinel for it. */
export function loadMonitorMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MONITOR_MAP_STORAGE_KEY);
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

/** Persists the given project id -> monitor id map. Best-effort; silently
 *  no-ops if storage is unavailable. */
export function persistMonitorMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(MONITOR_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Creates a new monitor group with a fresh id. */
export function createMonitor(name: string): MonitorGroup {
  return { id: crypto.randomUUID(), name };
}

const COLLAPSED_PROJECTS_STORAGE_KEY = "kanban-collapsed-projects";

/** Reads the persisted project-column collapsed-state map (project id, or
 *  "__unassigned__" for the Unassigned bucket, -> collapsed), or `{}` if
 *  none is stored yet / storage is unavailable / the stored value is
 *  malformed. A project id absent from the map means "expanded". */
export function loadCollapsedProjects(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY);
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

/** Persists the given project-column collapsed-state map. Best-effort;
 *  silently no-ops if storage is unavailable. */
export function persistCollapsedProjects(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(COLLAPSED_PROJECTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
