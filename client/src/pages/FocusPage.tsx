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
 * Above the activity list sits an LLM-synthesized "Summary" block
 * (`api.focusReportSummary` → `GET /api/focus-report/summary`):
 * stakeholder-readable bullets for the SAME `from`/`to` window and scope as
 * the report fetch, GROUPED BY PROJECT (`summary.groups`, largest
 * wall-clock share first — the server partitions an all-projects window per
 * project). Group headers (project name, or the shared "Unassigned" label
 * for unmapped folders) render only in all-projects scope
 * (`showProjectLabel`) — a single-project view shows its one group's
 * bullets headerless, exactly like before grouping existed. Fetched independently and non-blocking (its own effect,
 * its own loading state) so a slow/unavailable synthesis never delays the
 * stat tiles or activity rows; a `null` summary (LLM path off, empty
 * window, failure) simply hides the block — never an error state. The
 * footer note names the model that wrote the bullets (`summary.model`,
 * via the `aiNoteWithModel` i18n key; plain `aiNote` when unknown) plus
 * either how long generation took (`generatedIn`, from the client-measured
 * elapsed fetch time) or `servedFromCache` for a cache hit. While loading,
 * a once-a-second elapsed clock (`formatMs`) and a duration-expectation
 * note (`loadingNote` — first view summarizes each day once, repeat views
 * are instant) keep a cold multi-week generation reading as progress
 * rather than a hang. The
 * summary always describes the full fetched window, NOT the hour-window
 * zoom's sub-window — it's a per-window synthesis cached server-side, not
 * a re-generatable per-zoom view (the `windowScopedNote` line already tells
 * the reader when the tiles/list below are narrower).
 *
 * Also offers the same intraday "hour-window zoom" as the Calendar page
 * (`useHourWindowZoom`/`HourWindowZoomBar`, extracted out of
 * `FocusCalendarView.tsx` so both pages share the identical control) —
 * duration presets (4h/8h/12h/24h), a start-time stepper/typed input, a
 * "Live" toggle, and quick-start presets. Anchored to `selectedDate`, the
 * same `timeWindow.mode === "day" ? timeWindow.date : timeWindow.start`
 * derivation `FocusCalendarBoard.tsx` already uses — so a custom multi-day
 * range's zoom narrows within the range's own *start* day, matching the
 * Board's existing behavior rather than inventing new semantics here. When
 * zoomed, BOTH the stat tiles (`computeWindowedTotals`, same substitution
 * `FocusReportBody` already does) AND the activity list below
 * (`groupFocusActivity`'s optional `window` param) are scoped together —
 * never just one, which would silently disagree with the other.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Focus as FocusIcon, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";
import { formatMs, formatModelName } from "../lib/format";
import { groupFocusActivity } from "../lib/focusActivity";
import { computeWindowedTotals } from "../lib/windowedTotals";
import type { FocusReport, FocusWindowSummary, Project, Session } from "../lib/types";
import { ProjectScopeFilters } from "../components/ProjectScopeFilters";
import { StatTile } from "../components/StatTile";
import { ConcurrencyStatTile } from "../components/ConcurrencyStatTile";
import { FocusActivityCard } from "../components/FocusActivityCard";
import { TimePeriodPicker } from "../components/TimePeriodPicker";
import type { TimePeriodValue } from "../components/TimePeriodPicker";
import { HourWindowZoomBar } from "../components/HourWindowZoomBar";
import { useHourWindowZoom } from "../hooks/useHourWindowZoom";

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

/** "Claude Sonnet" / "Claude Sonnet 5" from a raw model alias/id — the
 *  display form both summary-block notes use. `formatModelName` title-cases
 *  ("sonnet" → "Sonnet", "claude-sonnet-5" → "Claude Sonnet 5"); the Claude
 *  prefix is added only when not already present, so an alias never renders
 *  as a bare "Sonnet" and a full id never doubles up as "Claude Claude …". */
function claudeModelLabel(model: string | null): string | null {
  const formatted = formatModelName(model);
  if (!formatted) return null;
  return formatted.startsWith("Claude") ? formatted : `Claude ${formatted}`;
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

  // Independent, non-blocking summary fetch - see file header.
  const [summary, setSummary] = useState<FocusWindowSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  // Live elapsed clock for the summary fetch: ticks once a second while
  // loading (a cold multi-week window legitimately takes a minute-plus, so
  // the wait needs to read as progress, not a hang), then freezes at the
  // exact total so the finished block can say how long generation took.
  const [summaryElapsedMs, setSummaryElapsedMs] = useState(0);
  // The model the next generation would use - fetched once so the loading
  // state can already say "using Claude X" before any summary arrives.
  const [configuredModel, setConfiguredModel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .focusReportSummaryConfig()
      .then((res) => {
        if (!cancelled) setConfiguredModel(res.model);
      })
      .catch(() => {
        /* purely cosmetic - the plain loading string covers the gap */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    setSummaryElapsedMs(0);
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      setSummaryElapsedMs(Date.now() - startedAt);
    }, 1000);
    const { from, to } = windowBounds(timeWindow);
    api
      .focusReportSummary({
        projectId: unassignedOnly ? undefined : projectId,
        sessionId,
        unassigned: unassignedOnly,
        from,
        to,
      })
      .then((res) => {
        if (!cancelled) setSummary(res.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null); // unavailable, never an error state
      })
      .finally(() => {
        window.clearInterval(ticker);
        if (!cancelled) {
          setSummaryElapsedMs(Date.now() - startedAt); // freeze at the exact total
          setSummaryLoading(false);
        }
      });
    return () => {
      cancelled = true;
      window.clearInterval(ticker);
    };
  }, [projectId, sessionId, unassignedOnly, timeWindow]);

  const showProjectLabel = projectId === undefined && !unassignedOnly;

  // Same intraday hour-window zoom as the Calendar page - anchored to the
  // custom range's own START day, matching FocusCalendarBoard.tsx's existing
  // `selectedDate` derivation exactly (not new semantics invented here).
  // Defaults to 24h (unzoomed/full period) rather than the Calendar's own 4h
  // default - this page previously always showed the whole selected
  // day/range, so the zoom here is a purely additive, opt-in narrowing
  // rather than a silent change to what loads by default.
  const selectedDate = timeWindow.mode === "day" ? timeWindow.date : timeWindow.start;
  const zoom = useHourWindowZoom(selectedDate, { defaultHourWindow: 24 });
  const visibleWindow = zoom.zoomable
    ? { startMs: zoom.windowStartMs, endMs: zoom.windowEndMs }
    : null;

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

      <HourWindowZoomBar {...zoom} />

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
            visibleWindow={visibleWindow}
            summary={summary}
            summaryLoading={summaryLoading}
            summaryElapsedMs={summaryElapsedMs}
            configuredModel={configuredModel}
          />
        )}
      </div>
    </div>
  );
}

/** Stat tiles plus the activity card, both scoped to `visibleWindow` when the
 *  hour-window zoom is active (`null` reads `report`'s own already-fetched
 *  totals unchanged, same as before this existed) - mirrors
 *  `FocusReportBody`'s own established `computeWindowedTotals` substitution
 *  pattern exactly, so the same window/scope reads the same numbers whether
 *  viewed here or on the Calendar page. Split out of `FocusPage` only to keep
 *  that component's own data-fetching/filter-state focused. */
function FocusPageBody({
  report,
  projectLabelForCwd,
  showProjectLabel,
  visibleWindow,
  summary,
  summaryLoading,
  summaryElapsedMs,
  configuredModel,
}: {
  report: FocusReport;
  projectLabelForCwd: (cwd: string | null) => string | undefined;
  showProjectLabel: boolean;
  visibleWindow: { startMs: number; endMs: number } | null;
  summary: FocusWindowSummary | null;
  summaryLoading: boolean;
  summaryElapsedMs: number;
  configuredModel: string | null;
}) {
  const { t } = useTranslation("plan");

  const windowed = visibleWindow
    ? computeWindowedTotals(report, visibleWindow.startMs, visibleWindow.endMs)
    : null;
  const totals = windowed?.totals ?? report.totals;
  const wallClockMs = windowed?.wallClockMs ?? report.wall_clock_ms;
  const concurrencyRatio = windowed ? windowed.concurrencyRatio : report.concurrency_ratio;
  // Optional on FocusReport (older/cached responses may lack it) - the sub
  // line simply doesn't render when there's nothing to show.
  const activeConcurrencyRatio = windowed
    ? windowed.activeConcurrencyRatio
    : (report.active_concurrency_ratio ?? null);
  const activeWallClockMs = windowed
    ? windowed.activeWallClockMs
    : (report.active_wall_clock_ms ?? null);
  const windowHours = visibleWindow
    ? Math.round((visibleWindow.endMs - visibleWindow.startMs) / 3_600_000)
    : null;

  const onItemPct =
    totals.active_ms > 0 ? Math.round((totals.by_kind.item.active_ms / totals.active_ms) * 100) : 0;
  const graceLabel =
    report.idle_grace_seconds > 0
      ? formatMs(report.idle_grace_seconds * 1000)
      : t("report.graceDisabled");

  const entries = useMemo(
    () => groupFocusActivity(report, projectLabelForCwd, visibleWindow ?? undefined),
    [report, projectLabelForCwd, visibleWindow]
  );

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <StatTile
          label={t("report.activeTime")}
          value={formatMs(totals.active_ms)}
          sub={t("report.ofWallClock", { total: formatMs(wallClockMs) })}
        />
        <ConcurrencyStatTile
          concurrencyRatio={concurrencyRatio}
          activeConcurrencyRatio={activeConcurrencyRatio}
          wallClockMs={wallClockMs}
          activeWallClockMs={activeWallClockMs}
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
      {windowHours != null && (
        <p className="text-[11px] text-gray-600 -mt-3">
          {t("report.windowScopedNote", { hours: windowHours })}
        </p>
      )}

      {(summaryLoading || summary) && (
        <div data-testid="focus-window-summary" className="border border-border rounded-lg p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-hidden="true" />
            {t("report.summaryBlock.title")}
          </h2>
          {summaryLoading &&
            (() => {
              const label = claudeModelLabel(configuredModel);
              return (
                <>
                  <p className="text-xs text-gray-500 italic">
                    {label
                      ? t("report.summaryBlock.loadingWithModel", { model: label })
                      : t("report.summaryBlock.loading")}
                    <span className="ml-2 font-mono not-italic text-gray-400">
                      {formatMs(summaryElapsedMs)}
                    </span>
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1.5 max-w-[62ch]">
                    {t("report.summaryBlock.loadingNote")}
                  </p>
                </>
              );
            })()}
          {!summaryLoading && summary && (
            <>
              <div className="space-y-3">
                {summary.groups.map((group) => (
                  <div key={group.project_id ?? "unassigned"}>
                    {showProjectLabel && (
                      <h3
                        data-testid="focus-summary-group-label"
                        className="text-[11px] font-semibold text-gray-400 mb-1"
                      >
                        {group.project_name ?? t("projects:unassigned")}
                      </h3>
                    )}
                    <ul className="space-y-1.5 list-disc pl-4 text-xs text-gray-300">
                      {group.bullets.map((bullet, i) => (
                        <li key={i} className="max-w-[72ch]">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                {claudeModelLabel(summary.groups[0]?.model ?? null)
                  ? t("report.summaryBlock.aiNoteWithModel", {
                      model: claudeModelLabel(summary.groups[0]?.model ?? null),
                    })
                  : t("report.summaryBlock.aiNote")}
                {" · "}
                {summary.groups.every((group) => group.cached)
                  ? t("report.summaryBlock.servedFromCache")
                  : t("report.summaryBlock.generatedIn", {
                      duration: formatMs(summaryElapsedMs),
                    })}
              </p>
            </>
          )}
        </div>
      )}

      <FocusActivityCard entries={entries} showProjectLabel={showProjectLabel} />
    </>
  );
}
