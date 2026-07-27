/**
 * @file ProjectScopeFilters.tsx
 * @description The project-chip-row + session-select filter pair — extracted
 * out of `FocusCalendarBoard.tsx` (where it lived as ~150 lines of inline JSX)
 * so a second consumer, the new `FocusPage.tsx` report, can render the exact
 * same project/session scoping controls without copy-pasting them. Pure
 * lift-and-shift: markup, classes, and behavior are unchanged from the
 * original inline version.
 *
 * Renders one chip per project reflected in the currently loaded report
 * (`activeProjectIds`) plus an "All projects" chip, a project dormant for the
 * current window collapsing behind a one-shot "show more" expansion
 * (`projectsExpanded`), and a fixed "Unassigned" chip (amber-tinted, never
 * hidden) for sessions whose cwd isn't mapped to any project. `projectId` and
 * `unassignedOnly` are mutually exclusive — selecting one always clears the
 * other, mirrored here via `onSelectProject`/`onSelectUnassigned` each
 * updating both.
 *
 * The session `<select>` is a second, fully independent filter (DEC-2 in
 * `FocusCalendarBoard.tsx`'s own header) — never scoped to the selected
 * project, never cleared by a project change.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Project, Session } from "../lib/types";

export interface ProjectScopeFiltersProps {
  projects: Project[];
  sessions: Session[];
  /** Projects with at least one session in the currently loaded report —
   *  lets the chip row default to what's actually reflected in the selected
   *  window instead of every monitored project ever, however long dormant. */
  activeProjectIds: Set<string>;
  projectId: string | undefined;
  sessionId: string | undefined;
  unassignedOnly: boolean;
  projectsExpanded: boolean;
  onProjectsExpandedChange: (expanded: boolean) => void;
  /** Selecting a real project chip (or "All projects" with `undefined`) —
   *  always clears `unassignedOnly` too, since the two are mutually
   *  exclusive client-side (the server 400s if both are sent). */
  onSelectProject: (projectId: string | undefined) => void;
  /** Selecting the fixed "Unassigned" chip — always clears `projectId`. */
  onSelectUnassigned: () => void;
  onSessionChange: (sessionId: string | undefined) => void;
}

/** The project-chip-row + session-select filter pair shared by
 *  `FocusCalendarBoard` and `FocusPage`. See file header. */
export function ProjectScopeFilters({
  projects,
  sessions,
  activeProjectIds,
  projectId,
  sessionId,
  unassignedOnly,
  projectsExpanded,
  onProjectsExpandedChange,
  onSelectProject,
  onSelectUnassigned,
  onSessionChange,
}: ProjectScopeFiltersProps) {
  const { t } = useTranslation("plan");

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  // The currently selected project's own chip must never disappear, even if
  // selecting it emptied the report (zero activity on this particular day) -
  // otherwise the chip the user just clicked would vanish out from under
  // them.
  const visibleProjects = sortedProjects.filter(
    (p) => activeProjectIds.has(p.id) || p.id === projectId
  );
  const hiddenProjects = sortedProjects.filter(
    (p) => !activeProjectIds.has(p.id) && p.id !== projectId
  );

  const chipClass = (active: boolean) =>
    `px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
      active
        ? "bg-accent text-white"
        : "bg-surface-2 text-gray-400 hover:bg-surface-3 hover:text-gray-200"
    }`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {t("report.board.projectFilter")}
        </span>
        <div
          role="group"
          aria-label={t("report.board.projectFilter")}
          className="flex flex-wrap items-center gap-1.5 max-w-lg"
        >
          <button
            type="button"
            onClick={() => onSelectProject(undefined)}
            aria-pressed={projectId === undefined && !unassignedOnly}
            className={chipClass(projectId === undefined && !unassignedOnly)}
          >
            {t("report.board.allProjects")}
          </button>
          {visibleProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              aria-pressed={projectId === project.id}
              className={chipClass(projectId === project.id)}
            >
              {project.name}
            </button>
          ))}
          {!projectsExpanded && hiddenProjects.length > 0 && (
            <button
              type="button"
              onClick={() => onProjectsExpandedChange(true)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-dashed border-border text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
            >
              {t("common:showMore", { count: hiddenProjects.length })}
            </button>
          )}
          {projectsExpanded &&
            hiddenProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                aria-pressed={projectId === project.id}
                className={chipClass(projectId === project.id)}
              >
                {project.name}
              </button>
            ))}
          {/* A fixed, always-visible special category (unlike real project
              chips, never hidden behind "show more") for sessions whose
              cwd isn't mapped to any project - a distinct amber tint in
              both its selected and unselected states so it never reads as
              just another project. */}
          <button
            type="button"
            onClick={onSelectUnassigned}
            aria-pressed={unassignedOnly}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
              unassignedOnly
                ? "bg-amber-600 text-white"
                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            {t("projects:unassigned")}
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          {t("report.board.sessionFilter")}
        </span>
        <select
          aria-label={t("report.board.sessionFilter")}
          value={sessionId ?? ""}
          onChange={(e) => onSessionChange(e.target.value || undefined)}
          className="input bg-surface-1 min-w-[160px]"
        >
          <option value="">{t("report.board.allSessions")}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name?.trim() || session.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
