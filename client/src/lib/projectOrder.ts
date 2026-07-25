/**
 * @file projectOrder.ts
 * @description Shared localStorage persistence for a user's manual project
 * display order. Used by both the standalone Projects page (drag-reorder on
 * its cards) and the Kanban Board's "Projects" view (drag-reorder on its
 * columns), so arranging projects once applies consistently in both places.
 * Purely a personal, per-browser arrangement - it has no server-side
 * representation and is never sent to the API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const ORDER_STORAGE_KEY = "projects-page-order";

/** Reads the persisted project order (an array of project ids), or `[]` if
 *  none is stored yet / storage is unavailable / the stored value is malformed. */
export function loadProjectOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Persists the given project id order. Best-effort; silently no-ops if
 *  storage is unavailable (private browsing, quota, etc.). */
export function persistProjectOrder(order: string[]): void {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

/**
 * Reorders `items` (each with an `id`) to match `orderIds` where possible,
 * appending any item whose id isn't in `orderIds` at the end in its existing
 * relative order - covers new projects, and the case where nothing has been
 * manually reordered yet.
 */
export function applyProjectOrder<T extends { id: string }>(items: T[], orderIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of orderIds) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) {
      ordered.push(item);
      seen.add(item.id);
    }
  }
  return ordered;
}
