/**
 * @file Shared cwd→project join. Single canonical extraction of the
 * `sessions.cwd` → `project_paths.cwd` lookup previously hand-rolled inline
 * in `KanbanBoard.tsx` (its `sessionsByCwd` forward join at ~494-502 and the
 * Projects view's per-project `cwds` derivation at ~707-712) — this is the
 * "extract, don't copy" half of the `DERIVED-DUAL-VIEW` durable cure
 * (technical-plan.md §5): `KanbanBoard.tsx` is refactored to call these two
 * functions instead of keeping its own inline logic, and the WIP queue page
 * (`wipQueue.ts`, `WipSessionCard.tsx`) is the fourth independent consumer of
 * `Session`/cwd→project derivation to route through this one shared surface
 * rather than re-deriving it. No path normalization anywhere here — a
 * trailing-slash cwd is a different string from its non-slashed counterpart,
 * matching the exact-string-equality behavior of the inline join this
 * replaces (see `projectLookup.test.ts`'s frozen-reference regression case).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { Project, Session } from "./types";

/**
 * Builds a `cwd -> Project` index from every project's mapped folders. A
 * project with zero mapped paths contributes no entries and never throws. If
 * two projects were ever mapped to the same cwd (the server enforces
 * uniqueness on `project_paths.cwd`, so this should not happen in practice),
 * the later project in the input array wins for that cwd.
 * @param projects Every project to index (typically GET /api/projects's
 *   `projects` array).
 * @returns A `Map` from cwd (exact string) to its owning {@link Project}.
 */
export function buildCwdProjectIndex(projects: Project[]): Map<string, Project> {
  const index = new Map<string, Project>();
  for (const project of projects) {
    for (const path of project.paths) {
      index.set(path.cwd, project);
    }
  }
  return index;
}

/**
 * Resolves the {@link Project} that owns a session's cwd, or `undefined`
 * when the session has no cwd or its cwd isn't mapped to any project.
 * @param session The session to resolve (only its `cwd` field is read).
 * @param index   The index built by {@link buildCwdProjectIndex}.
 * @returns The owning {@link Project}, or `undefined`.
 */
export function projectForSession(
  session: Session,
  index: Map<string, Project>
): Project | undefined {
  if (!session.cwd) return undefined;
  return index.get(session.cwd);
}
