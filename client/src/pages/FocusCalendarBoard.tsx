/**
 * @file FocusCalendarBoard.tsx
 * @description Standalone, first-class page (route `/focus-calendar`, sidebar
 * label "Calendar" per DEC-5) rendering the existing focus-time swimlane
 * calendar across every monitored project at once — the cross-project sibling
 * of the existing per-project `FocusReportModal`. Filterable by three
 * genuinely independent controls (per DEC-2): a project filter (a chip row,
 * defaulting to "all projects" — see below), a GLOBAL session filter (every
 * session across every project, never scoped to the selected project), and a
 * time-period filter (`TimePeriodPicker`: day-by-day nav, default "today," or
 * a custom date range). None of the three ever clears another.
 *
 * The project filter renders one chip per project reflected in the currently
 * loaded report (i.e. with activity in the selected day/window) plus an
 * "All projects" chip, rather than every monitored project regardless of
 * whether it's ever been touched — a project dormant for months would
 * otherwise permanently clutter the row. Projects with no activity in the
 * current window collapse behind a "show more" chip (`hiddenProjects`),
 * expanded in place on click (one-shot, no collapse-back — same interaction
 * as KanbanBoard's own "show more" pagination). The currently selected
 * project's chip is always shown even if selecting it emptied the report
 * (zero activity that day), so it never disappears out from under the click
 * that selected it.
 *
 * A fixed "Unassigned" chip (amber-tinted in both its selected and
 * unselected states, never hidden behind "show more") scopes to sessions
 * whose cwd isn't mapped to any project — `unassignedOnly` state, sent as
 * `?unassigned=true` to `GET /api/focus-report`. Mutually exclusive with
 * `projectId` client-side (selecting one always clears the other) since the
 * server 400s if both are sent together.
 *
 * Powered by `api.focusReport` (the new, top-level `GET /api/focus-report`
 * client), which always receives an explicit `from`/`to` — there is no
 * hidden server-side default window (DEC-3). Consumes `FocusReportBody` /
 * `FocusReportViewToggle` / `FocusCalendarView` / `TimePeriodPicker` /
 * `calendarWindow.ts` exactly as built for the existing modal — no
 * re-derived rendering JSX or day-boundary math lives in this file.
 *
 * The project filter's `cwd -> project name` map is also threaded into
 * `FocusReportBody` as `projectLabelForCwd`, letting the calendar view
 * disambiguate concurrent same-named sessions from different projects — a
 * need that only exists once a report can span more than one project.
 *
 * Per DEC-6, the Concurrency stat tile is relabeled here (`report.board.
 * concurrentSessions`, "Concurrent agent sessions") since the same
 * `concurrency_ratio` figure now reads as cross-project overlap rather than
 * a single project's own multitasking — the existing modal's per-project
 * "Concurrency" copy is untouched.
 *
 * The page heading itself just says "Calendar" (`report.board.title`,
 * matching the sidebar label) - the swimlane calendar is the only thing
 * this page renders, so "Focus Calendar" (the original heading) was
 * redundant. The root container also breaks out of the app shell's own
 * `Layout.tsx` padding (`-mx-5 lg:-mx-6`, canceling its `p-5 lg:p-6`) and
 * re-applies exactly 25px (`px-[25px]`) instead, dropping the `max-w-6xl
 * mx-auto` cap this page used to be the only one in the app to apply to its
 * root - a wide calendar benefits from the full viewport width other pages
 * already get, not a centered, capped column.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { api } from "../lib/api";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";
import type { FocusReport, Project, Session } from "../lib/types";
import { FocusReportBody, FocusReportViewToggle } from "../components/FocusReportBody";
import type { ViewMode } from "../components/FocusReportBody";
import { ProjectScopeFilters } from "../components/ProjectScopeFilters";
import { TimePeriodPicker } from "../components/TimePeriodPicker";
import type { TimePeriodValue } from "../components/TimePeriodPicker";

/** Derives the `[from, to)` ISO-8601 instant bounds `api.focusReport` always
 *  requires from the page's own `TimePeriodValue` — day mode covers exactly
 *  one day; range mode covers the full selected range, inclusive of its last
 *  day. Always computed via the one shared `startOfDay`/`DAY_MS` — never a
 *  hand-derived literal. */
function windowBounds(tw: TimePeriodValue): { from: string; to: string } {
  if (tw.mode === "day") {
    const start = startOfDay(tw.date);
    return { from: start.toISOString(), to: new Date(start.getTime() + DAY_MS).toISOString() };
  }
  const start = startOfDay(tw.start);
  const end = startOfDay(tw.end);
  return { from: start.toISOString(), to: new Date(end.getTime() + DAY_MS).toISOString() };
}

/** Cross-project Focus Calendar board — see file header. */
export function FocusCalendarBoard() {
  const { t } = useTranslation("plan");

  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Independent filters (DEC-2) - none of the three ever clears another.
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  // A fourth project-filter STATE (not a real project) scoping to sessions
  // whose cwd isn't mapped to any project - mutually exclusive with
  // `projectId` (selecting one always clears the other; the server 400s if
  // both are sent together), so kept as its own boolean rather than a
  // `projectId` sentinel value that could collide with a real id.
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  // Reveals the project chips hidden by default (see `hiddenProjects` below)
  // — one-shot, matches KanbanBoard's own "show more" precedent (click, no
  // collapse-back).
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [timeWindow, setTimeWindow] = useState<TimePeriodValue>(() => ({
    mode: "day",
    date: startOfDay(new Date()),
  }));
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const [report, setReport] = useState<FocusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Project filter options + cwd->name map for projectLabelForCwd, and the
  // GLOBAL session list - both fetched exactly once, on mount, independent
  // of any filter (the session list is never re-fetched on project change,
  // and never carries a `cwd` filter - it must stay genuinely global).
  useEffect(() => {
    let cancelled = false;
    api.projects.list().then((res) => {
      if (!cancelled) setProjects(res.projects);
    });
    api.sessions.list({ limit: 10000 }).then((res) => {
      if (!cancelled) setSessions(res.sessions);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cwdToProjectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      for (const path of project.paths) {
        map.set(path.cwd, project.name);
      }
    }
    return map;
  }, [projects]);

  const projectLabelForCwd = useCallback(
    (cwd: string | null) => (cwd ? cwdToProjectName.get(cwd) : undefined),
    [cwdToProjectName]
  );

  const cwdToProjectId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      for (const path of project.paths) {
        map.set(path.cwd, project.id);
      }
    }
    return map;
  }, [projects]);

  // Projects with at least one session in the currently loaded report - lets
  // the "all projects" chip row default to what's actually reflected on the
  // selected day/window instead of every monitored project ever, however
  // long dormant.
  const activeProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of report?.sessions ?? []) {
      const id = session.cwd ? cwdToProjectId.get(session.cwd) : undefined;
      if (id) ids.add(id);
    }
    return ids;
  }, [report, cwdToProjectId]);

  // Fetches on mount and on any filter change (project/session/time-period) -
  // every request carries an explicit from/to (DEC-3, no hidden default).
  // `projectId` is never sent alongside `unassignedOnly` - the two chip
  // groups are kept mutually exclusive client-side (see the click handlers
  // below) since the server 400s on that combination.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const { from, to } = windowBounds(timeWindow);
    api
      .focusReport({
        projectId: unassignedOnly ? undefined : projectId,
        sessionId,
        unassigned: unassignedOnly,
        from,
        to,
      })
      .then((res) => {
        if (!cancelled) setReport(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, sessionId, unassignedOnly, timeWindow]);

  const selectedDate = timeWindow.mode === "day" ? timeWindow.date : timeWindow.start;

  return (
    <div className="-mx-5 lg:-mx-6 px-[25px] space-y-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-accent flex-shrink-0" />
        <h1 className="text-lg font-semibold text-gray-100">{t("report.board.title")}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <ProjectScopeFilters
          projects={projects}
          sessions={sessions}
          activeProjectIds={activeProjectIds}
          projectId={projectId}
          sessionId={sessionId}
          unassignedOnly={unassignedOnly}
          projectsExpanded={projectsExpanded}
          onProjectsExpandedChange={setProjectsExpanded}
          onSelectProject={(id) => {
            setProjectId(id);
            setUnassignedOnly(false);
          }}
          onSelectUnassigned={() => {
            setProjectId(undefined);
            setUnassignedOnly(true);
          }}
          onSessionChange={setSessionId}
        />

        <TimePeriodPicker value={timeWindow} onChange={setTimeWindow} />
      </div>

      <div className="card p-5 space-y-6">
        <div className="flex items-center justify-end">
          {!loading && !failed && report && report.sessions.length > 0 && (
            <FocusReportViewToggle viewMode={viewMode} onChange={setViewMode} />
          )}
        </div>
        {loading && (
          <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.loading")}</p>
        )}
        {!loading && failed && (
          <p className="text-xs text-rose-400 py-6 text-center">{t("report.error")}</p>
        )}
        {!loading && !failed && report && (
          <FocusReportBody
            report={report}
            viewMode={viewMode}
            projectLabelForCwd={projectLabelForCwd}
            selectedDate={selectedDate}
            hideDateNav={true}
            concurrencyLabel={t("report.board.concurrentSessions")}
          />
        )}
      </div>
    </div>
  );
}
