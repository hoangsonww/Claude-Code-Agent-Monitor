/**
 * @file FocusPage.tsx
 * @description Standalone, first-class page (route `/focus`, sidebar label
 * "Focus") answering "what did we actually do" as a stakeholder-readable
 * report — not a card squeezed into the Calendar page's swimlane view. Same
 * project/session/time-window controls as `FocusCalendarBoard.tsx` (project
 * chips via `ProjectScopeFilters`, a global session `<select>`, and
 * `TimePeriodPicker`), but the body is stat tiles (same numbers/formula as
 * `FocusReportBody`) plus the new `FocusActivityCard` — a simple list of
 * "this happened" rows (one per plan item / detour-bug-feature / unclassified
 * bucket), each with a label and, for classifier-inferred entries, the
 * one-sentence reason — instead of a calendar grid. Deliberately does not
 * render `FocusCalendarView`/the List-Calendar toggle at all.
 *
 * Reuses `api.focusReport` (`GET /api/focus-report`) exactly as
 * `FocusCalendarBoard` does — that endpoint already clips every session's
 * segments to the requested `from`/`to` server-side (see its own file
 * header), so this page never needs `windowedTotals.ts`'s client-side
 * clipping: `report.totals`/`report.wall_clock_ms`/`report.concurrency_ratio`
 * already ARE the selected window's numbers.
 *
 * The on-item/off-plan split mirrors `FocusReportBody`'s exact formula
 * (`totals.by_kind.item.active_ms / totals.active_ms`) — keep the two in
 * sync if that formula ever changes, so the same window/scope reads the same
 * percentage whether viewed here or on the Calendar page.
 *
 * `showProjectLabel` (passed to `FocusActivityCard`) is true only in "all
 * projects" scope (`projectId === undefined && !unassignedOnly`) — a
 * single-project view never prefixes its rows with a project name.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Focus as FocusIcon } from "lucide-react";
import { api } from "../lib/api";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";
import { formatMs } from "../lib/format";
import { groupFocusActivity } from "../lib/focusActivity";
import type { FocusReport, Project, Session } from "../lib/types";
import { ProjectScopeFilters } from "../components/ProjectScopeFilters";
import { StatTile } from "../components/StatTile";
import { FocusActivityCard } from "../components/FocusActivityCard";
import { TimePeriodPicker } from "../components/TimePeriodPicker";
import type { TimePeriodValue } from "../components/TimePeriodPicker";

/** Derives the `[from, to)` ISO-8601 instant bounds `api.focusReport` always
 *  requires from the page's own `TimePeriodValue` — identical to
 *  `FocusCalendarBoard.tsx`'s own `windowBounds`, duplicated rather than
 *  imported since it's a few lines of pure `startOfDay`/`DAY_MS` math, not a
 *  meaningfully shared abstraction. */
function windowBounds(tw: TimePeriodValue): { from: string; to: string } {
  if (tw.mode === "day") {
    const start = startOfDay(tw.date);
    return { from: start.toISOString(), to: new Date(start.getTime() + DAY_MS).toISOString() };
  }
  const start = startOfDay(tw.start);
  const end = startOfDay(tw.end);
  return { from: start.toISOString(), to: new Date(end.getTime() + DAY_MS).toISOString() };
}

/** The "what did we actually do" Focus report page — see file header. */
export function FocusPage() {
  const { t } = useTranslation("plan");

  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Independent filters, same shape/semantics as FocusCalendarBoard.
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [timeWindow, setTimeWindow] = useState<TimePeriodValue>(() => ({
    mode: "day",
    date: startOfDay(new Date()),
  }));

  const [report, setReport] = useState<FocusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  const activeProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of report?.sessions ?? []) {
      const id = session.cwd ? cwdToProjectId.get(session.cwd) : undefined;
      if (id) ids.add(id);
    }
    return ids;
  }, [report, cwdToProjectId]);

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

  const showProjectLabel = projectId === undefined && !unassignedOnly;

  return (
    <div className="-mx-5 lg:-mx-6 px-[25px] space-y-5">
      <div className="flex items-center gap-2">
        <FocusIcon className="w-5 h-5 text-accent flex-shrink-0" />
        <h1 className="text-lg font-semibold text-gray-100">{t("report.activityBoard.title")}</h1>
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
        {loading && (
          <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.loading")}</p>
        )}
        {!loading && failed && (
          <p className="text-xs text-rose-400 py-6 text-center">{t("report.error")}</p>
        )}
        {!loading && !failed && report && report.sessions.length === 0 && (
          <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.empty")}</p>
        )}
        {!loading && !failed && report && report.sessions.length > 0 && (
          <FocusPageBody
            report={report}
            projectLabelForCwd={projectLabelForCwd}
            showProjectLabel={showProjectLabel}
          />
        )}
      </div>
    </div>
  );
}

/** Stat tiles (same numbers/formula as `FocusReportBody`, unwindowed since
 *  `report` is already scoped to the selected window) plus the activity
 *  card. Split out of `FocusPage` only to keep that component's own
 *  data-fetching/filter-state focused. */
function FocusPageBody({
  report,
  projectLabelForCwd,
  showProjectLabel,
}: {
  report: FocusReport;
  projectLabelForCwd: (cwd: string | null) => string | undefined;
  showProjectLabel: boolean;
}) {
  const { t } = useTranslation("plan");

  const totals = report.totals;
  const onItemPct =
    totals.active_ms > 0 ? Math.round((totals.by_kind.item.active_ms / totals.active_ms) * 100) : 0;
  const graceLabel =
    report.idle_grace_seconds > 0
      ? formatMs(report.idle_grace_seconds * 1000)
      : t("report.graceDisabled");
  const concurrencyValue =
    report.concurrency_ratio != null ? `${report.concurrency_ratio.toFixed(2)}x` : "—";

  const entries = useMemo(
    () => groupFocusActivity(report, projectLabelForCwd),
    [report, projectLabelForCwd]
  );

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <StatTile
          label={t("report.activeTime")}
          value={formatMs(totals.active_ms)}
          sub={t("report.ofWallClock", { total: formatMs(report.wall_clock_ms) })}
        />
        <StatTile
          label={t("report.concurrency")}
          value={concurrencyValue}
          title={t("report.concurrencyTitle")}
        />
        <StatTile
          label={t("report.onItem")}
          value={`${onItemPct}%`}
          valueClassName="text-green-400"
        />
        <StatTile label={t("report.offPlan")} value={`${Math.max(0, 100 - onItemPct)}%`} />
        <StatTile
          label={t("report.idleExcluded")}
          value={formatMs(totals.idle_ms)}
          sub={t("report.idleExcludedSub")}
        />
      </div>
      {report.idle_grace_seconds >= 0 && (
        <p className="text-[11px] text-gray-600 -mt-3">
          {t("report.graceNote", { grace: graceLabel })}
        </p>
      )}

      <FocusActivityCard entries={entries} showProjectLabel={showProjectLabel} />
    </>
  );
}
