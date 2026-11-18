/**
 * @file project.ts
 * @description Maps a session's working directory to the project it belongs to, so the UI can
 * show a handful of projects instead of one entry per folder. Folded together:
 * - git worktrees under `<repo>/.claude/worktrees/<name>` or `<repo>/.worktrees/<name>`;
 * - orchestrator worktrees under `~/.ao/data/worktrees/<project>/...`;
 * - throw-away chat scratch folders under `.../scratch-workspaces/...` (one "scratch" project).
 * Projects are keyed by name, so the same repository checked out in two places shows once.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** `<repo>/.claude/worktrees/<name>[/...]` or `<repo>/.worktrees/<name>[/...]`. */
const WORKTREE = /[\\/](?:\.claude[\\/]worktrees|\.worktrees)[\\/]([^\\/]+)(?:[\\/].*)?$/i;
/** `~/.ao/data/worktrees/<project>/...`. */
const AO_WORKTREE = /[\\/]\.ao[\\/]data[\\/]worktrees[\\/]([^\\/]+)/i;
/** Desktop-app scratch folders. */
const SCRATCH = /[\\/]scratch-workspaces[\\/]/i;

/** Display name used for all scratch folders. */
export const SCRATCH_PROJECT = "scratch";

/**
 * The project root for a working directory (worktree suffix removed).
 *
 * @param cwd - Absolute working directory.
 */
export function projectRoot(cwd: string): string {
  return cwd.replace(WORKTREE, "");
}

/**
 * Short display name of the project a directory belongs to.
 *
 * @param cwd - Absolute working directory.
 */
export function projectName(cwd: string): string {
  if (SCRATCH.test(cwd)) return SCRATCH_PROJECT;
  const ao = AO_WORKTREE.exec(cwd);
  if (ao?.[1]) return ao[1];
  const root = projectRoot(cwd);
  return root.split(/[\\/]/).filter(Boolean).pop() ?? root;
}

/**
 * Name of the worktree a directory is inside, if any.
 *
 * @param cwd - Absolute working directory.
 * @returns The worktree folder name, or null for the main checkout.
 */
export function worktreeName(cwd: string): string | null {
  return WORKTREE.exec(cwd)?.[1] ?? null;
}

/** One project and the directories folded into it. */
export interface ProjectGroup {
  name: string;
  dirs: string[];
}

/**
 * Group directories by project (case-insensitive name).
 *
 * @param dirs - Working directories.
 * @returns Lower-cased project key → group, sorted by name with "scratch" last.
 */
export function groupByProject(dirs: string[]): Map<string, ProjectGroup> {
  const map = new Map<string, ProjectGroup>();
  for (const d of dirs) {
    const name = projectName(d);
    const key = name.toLowerCase();
    const g = map.get(key);
    if (g) g.dirs.push(d);
    else map.set(key, { name, dirs: [d] });
  }
  return new Map(
    [...map.entries()].sort((a, b) => {
      if (a[0] === SCRATCH_PROJECT) return 1;
      if (b[0] === SCRATCH_PROJECT) return -1;
      return a[1].name.localeCompare(b[1].name);
    })
  );
}
