/**
 * @file FocusCalendarBoard.tsx
 * @description Standalone, first-class page (route `/focus-calendar`, sidebar
 * label "Calendar" per DEC-5) rendering the existing focus-time swimlane
 * calendar across every monitored project at once — the cross-project sibling
 * of the existing per-project `FocusReportModal`. Filterable by three
 * genuinely independent controls (per DEC-2): a project filter (optional,
 * default "all projects"), a GLOBAL session filter (every session across
 * every project, never scoped to the selected project), and a time-period
 * filter (`TimePeriodPicker`: day-by-day nav, default "today," or a custom
 * date range). None of the three ever clears another.
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
  const [timeWindow, setTimeWindow] = useState<TimePeriodValue>(() => ({
    mode: "day",
    date: startOfDay(new Date()),
  }));
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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

  // Fetches on mount and on any filter change (project/session/time-period) -
  // every request carries an explicit from/to (DEC-3, no hidden default).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const { from, to } = windowBounds(timeWindow);
    api
      .focusReport({ projectId, sessionId, from, to })
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
  }, [projectId, sessionId, timeWindow]);

  const selectedDate = timeWindow.mode === "day" ? timeWindow.date : timeWindow.start;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-accent flex-shrink-0" />
        <h1 className="text-lg font-semibold text-gray-100">{t("report.board.title")}</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("report.board.projectFilter")}
          </span>
          <select
            aria-label={t("report.board.projectFilter")}
            value={projectId ?? ""}
            onChange={(e) => setProjectId(e.target.value || undefined)}
            className="input bg-surface-1 min-w-[160px]"
          >
            <option value="">{t("report.board.allProjects")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("report.board.sessionFilter")}
          </span>
          <select
            aria-label={t("report.board.sessionFilter")}
            value={sessionId ?? ""}
            onChange={(e) => setSessionId(e.target.value || undefined)}
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
