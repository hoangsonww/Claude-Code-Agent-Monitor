/**
 * @file recentCommands.ts
 * @description Tiny most-recently-used store for command-palette picks, kept in
 * `localStorage` so the launcher gets faster the more it is used.
 *
 * Only the command id is stored — never a label, a session name, or a path. The
 * palette re-resolves ids against the live catalog on every open, so a renamed
 * page or a deleted session simply stops appearing instead of leaving a dead row
 * behind, and nothing about the user's work is written to disk by this feature.
 *
 * Every access is wrapped: `localStorage` throws in private mode and in embedded
 * webviews, and a launcher must never fail to open because a nicety could not be
 * persisted.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const STORAGE_KEY = "ccam-palette-recent";

/** Kept short on purpose: a "Recent" group longer than this is just a second list. */
export const RECENT_LIMIT = 5;

/** Ids of the most recently run commands, newest first. */
export function loadRecentCommands(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Move `id` to the front of the MRU list.
 *
 * @returns The new list, so callers can update state without a second read.
 */
export function rememberCommand(id: string): string[] {
  const next = [id, ...loadRecentCommands().filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persistence is best-effort; the in-memory list returned below still works
    // for the rest of this session.
  }
  return next;
}

/** Forget every remembered pick. Exposed as a palette action. */
export function clearRecentCommands(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if it was never written */
  }
}
