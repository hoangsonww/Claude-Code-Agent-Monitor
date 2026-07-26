/**
 * @file FocusReportModal.tsx
 * @description Popup showing a project-scoped focus-time breakdown — how
 * long the project's sessions spent on a declared plan item versus a plain
 * detour, a feature aside, or a bug fix, reconstructed server-side from
 * existing `Focus` event history (see server/lib/focus-report.js). Sessions
 * that never declared a focus surface via the background classifier's
 * verdict instead — flagged with an "≈ inferred" chip (tooltip carries the
 * classifier's own one-sentence justification) so guessed attribution never
 * masquerades as declared history. A single-segment session (every inferred
 * session, plus most simple declared ones) also gets a visible caption
 * naming what it was attributed to — a bare session name plus a small chip
 * isn't enough to say what actually happened, especially for a detour,
 * which otherwise has no other on-screen text at all. Opened by
 * a report icon next to the existing "view plan" icon on a project's card
 * (Projects page and Kanban's Projects view). Fetches on open — the report
 * isn't pre-computed for every project up front, only when actually looked
 * at. Read-only; this never writes anything.
 *
 * Stat tiles distinguish EFFORT time (`totals.active_ms`, the plain sum
 * across every session — inflates when sessions run concurrently) from
 * WALL-CLOCK time (`wall_clock_ms`, the union of each session's own span —
 * concurrent sessions collapse into shared coverage instead of stacking).
 * The Concurrency tile (`concurrency_ratio` = effort ÷ wall-clock) makes
 * that gap legible as a single number instead of two durations that look
 * like they don't add up. See server/lib/focus-report.js for the math.
 *
 * A List/Calendar toggle in the header switches the body between this
 * list-style breakdown (default) and FocusCalendarView's swimlane day
 * view — same already-fetched `report`, no second request. Stat tiles
 * stay visible in both modes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, List, X } from "lucide-react";
import { api } from "../lib/api";
import { formatMs } from "../lib/format";
import { FOCUS_KIND_CONFIG, FOCUS_KIND_SOLID } from "../lib/types";
import type { FocusKind, FocusKindTotals, FocusReport, FocusReportSegment } from "../lib/types";
import { FocusCalendarView } from "./FocusCalendarView";

type ViewMode = "list" | "calendar";

const ALL_KINDS: FocusKind[] = ["item", "detour", "feature", "bug"];

export interface FocusReportModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

/**
 * Centered popup rendering one project's focus-time report.
 * @param props See {@link FocusReportModalProps}.
 */
export function FocusReportModal({ projectId, projectName, onClose }: FocusReportModalProps) {
  const { t } = useTranslation("plan");
  const [report, setReport] = useState<FocusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api.projects
      .focusReport(projectId)
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
  }, [projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-report-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] card shadow-2xl animate-slide-up overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-accent flex-shrink-0" />
            <h2 id="focus-report-title" className="text-sm font-semibold text-gray-100 truncate">
              {t("report.title", { project: projectName })}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!loading && !failed && report && report.sessions.length > 0 && (
              <div
                role="group"
                aria-label={t("report.viewList") + " / " + t("report.viewCalendar")}
                className="inline-flex items-center bg-surface-2 border border-border rounded-lg p-0.5 gap-0.5"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  title={t("report.viewList")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-accent text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-surface-4"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  aria-pressed={viewMode === "calendar"}
                  title={t("report.viewCalendar")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === "calendar"
                      ? "bg-accent text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-surface-4"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              title={t("common:close")}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6 overflow-y-auto">
          {loading && (
            <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.loading")}</p>
          )}
          {!loading && failed && (
            <p className="text-xs text-rose-400 py-6 text-center">{t("report.error")}</p>
          )}
          {!loading && !failed && report && <ReportBody report={report} viewMode={viewMode} />}
        </div>
      </div>
    </div>
  );
}

function ReportBody({ report, viewMode }: { report: FocusReport; viewMode: ViewMode }) {
  const { t } = useTranslation("plan");

  if (report.sessions.length === 0) {
    return <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.empty")}</p>;
  }

  const onItemPct =
    report.totals.active_ms > 0
      ? Math.round((report.totals.by_kind.item.active_ms / report.totals.active_ms) * 100)
      : 0;
  const graceLabel =
    report.idle_grace_seconds > 0
      ? formatMs(report.idle_grace_seconds * 1000)
      : t("report.graceDisabled");
  const concurrencyValue =
    report.concurrency_ratio != null ? `${report.concurrency_ratio.toFixed(2)}x` : "—";

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <StatTile
          label={t("report.activeTime")}
          value={formatMs(report.totals.active_ms)}
          // wall_clock_ms (not totals.wall_ms) - the latter is a per-segment
          // sum that inflates with concurrency same as effort does, so it
          // can't answer "of how much calendar time" once sessions overlap.
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
        <StatTile label={t("report.idleExcluded")} value={formatMs(report.totals.idle_ms)} />
      </div>
      {report.idle_grace_seconds >= 0 && (
        <p className="text-[11px] text-gray-600 -mt-3">
          {t("report.graceNote", { grace: graceLabel })}
        </p>
      )}

      {viewMode === "calendar" ? (
        <FocusCalendarView report={report} />
      ) : (
        <ListView report={report} />
      )}
    </>
  );
}

/** The original list-style body: per-session breakdown, per-item rollup,
 *  project-wide split. Extracted so ReportBody can swap it for
 *  FocusCalendarView without duplicating the stat-tile/grace-note header
 *  that's shared between both view modes. */
function ListView({ report }: { report: FocusReport }) {
  const { t } = useTranslation("plan");

  return (
    <>
      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.sessionsHeading")}</h3>
        <div className="space-y-4">
          {report.sessions.map((session) => {
            const totalMs = session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0);
            const inferredSegment = session.segments.find((seg) => seg.inferred);
            const inferredTitle = inferredSegment?.inferred_reason
              ? `${t("report.inferredNote")}: ${inferredSegment.inferred_reason}`
              : t("report.inferredNote");
            return (
              <div key={session.session_id} className="space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <Link
                      to={`/sessions/${session.session_id}`}
                      draggable={false}
                      className="text-xs font-medium text-gray-200 hover:text-accent hover:underline truncate min-w-0"
                    >
                      {session.name?.trim() || session.session_id.slice(0, 8)}
                    </Link>
                    {inferredSegment && (
                      <span
                        title={inferredTitle}
                        className="text-[10px] px-1.5 py-px rounded border border-border text-gray-500 flex-shrink-0 cursor-default"
                      >
                        ≈ {t("report.inferred")}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">
                    {formatMs(totalMs)}
                  </span>
                </div>
                {session.segments.length === 1 && session.segments[0] && (
                  <p className="text-[11px] text-gray-500 truncate">
                    {session.segments[0].kind === "item" && session.segments[0].item_number != null
                      ? t("focus.itemLabel", { number: session.segments[0].item_number })
                      : t(FOCUS_KIND_CONFIG[session.segments[0].kind].labelKey)}
                    {session.segments[0].label ? `: ${session.segments[0].label}` : ""}
                  </p>
                )}
                <SegmentedBar segments={session.segments} totalMs={totalMs} height="h-5" />
              </div>
            );
          })}
        </div>
      </section>

      {report.items.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.itemsHeading")}</h3>
          <div className="space-y-3">
            {report.items.map((item) => (
              <div key={`${item.cwd}-${item.item_number}`} className="space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="text-xs text-gray-300 truncate min-w-0">
                    <span className="font-mono text-gray-500 mr-1.5">
                      {t("focus.itemLabel", { number: item.item_number })}
                    </span>
                    {item.text ?? t("focus.unknownItem")}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">
                    {formatMs(item.totals.active_ms)}
                  </span>
                </div>
                <SegmentedBar
                  segments={kindTotalsAsSegments(item.totals)}
                  totalMs={item.totals.wall_ms}
                  height="h-3"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.splitHeading")}</h3>
        <SegmentedBar
          segments={kindTotalsAsSegments(report.totals)}
          totalMs={report.totals.wall_ms}
          height="h-6"
        />
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {ALL_KINDS.map((kind) => {
            const ms = report.totals.by_kind[kind].active_ms;
            if (ms <= 0) return null;
            const cfg = FOCUS_KIND_CONFIG[kind];
            return (
              <span key={kind} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${FOCUS_KIND_SOLID[kind]}`} />
                {t(cfg.labelKey)}
                <span className="font-mono text-gray-500">{formatMs(ms)}</span>
              </span>
            );
          })}
        </div>
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  sub,
  valueClassName,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  /** Native hover tooltip for a tile whose meaning isn't self-evident from
   *  its label alone (e.g. what a bare "1.08x" ratio is actually of). */
  title?: string;
}) {
  return (
    <div className="bg-surface-1 px-3.5 py-3 flex flex-col gap-1 min-w-0" title={title}>
      <span className="text-[10.5px] text-gray-500 truncate">{label}</span>
      <span
        className={`font-mono text-lg font-semibold tabular-nums ${valueClassName ?? "text-gray-100"}`}
      >
        {value}
      </span>
      {sub && <span className="text-[10.5px] text-gray-600 truncate">{sub}</span>}
    </div>
  );
}

/** Reduces a per-kind totals object down to the pseudo-segment shape
 *  {@link SegmentedBar} renders, in the FocusKind's fixed display order.
 *  Kinds with zero time are dropped so they don't render a 0-width sliver. */
function kindTotalsAsSegments(
  totals: FocusKindTotals
): Pick<FocusReportSegment, "kind" | "wall_ms" | "label">[] {
  return ALL_KINDS.map((kind) => ({
    kind,
    wall_ms: totals.by_kind[kind].wall_ms,
    label: null,
  })).filter((s) => s.wall_ms > 0);
}

/** A single horizontal bar divided into colored, width-proportional
 *  segments - shared by the per-session, per-item, and project-split
 *  views. Each segment's native `title` tooltip carries its kind, label
 *  (when one exists), duration, and — for an inferred segment — the
 *  classifier's own one-sentence justification (`inferred_reason`) when one
 *  was recorded, keeping hover detail without a custom-positioned popup. */
function SegmentedBar({
  segments,
  totalMs,
  height,
}: {
  segments: (Pick<FocusReportSegment, "kind" | "wall_ms" | "label"> &
    Partial<Pick<FocusReportSegment, "inferred" | "inferred_reason">>)[];
  totalMs: number;
  height: string;
}) {
  const { t } = useTranslation("plan");
  if (totalMs <= 0 || segments.length === 0) {
    return <div className={`${height} rounded-md bg-surface-3`} />;
  }
  return (
    <div className={`flex ${height} rounded-md overflow-hidden bg-surface-3`}>
      {segments.map((seg, i) => {
        const pct = (seg.wall_ms / totalMs) * 100;
        if (pct <= 0) return null;
        const kindLabel = t(FOCUS_KIND_CONFIG[seg.kind].labelKey);
        const inferredSuffix = seg.inferred
          ? ` — ≈ ${t("report.inferred")}${seg.inferred_reason ? `: ${seg.inferred_reason}` : ""}`
          : "";
        const title = seg.label
          ? `${kindLabel}: ${seg.label} (${formatMs(seg.wall_ms)})${inferredSuffix}`
          : `${kindLabel} (${formatMs(seg.wall_ms)})${inferredSuffix}`;
        return (
          <div
            key={i}
            className={`${FOCUS_KIND_SOLID[seg.kind]} ${i > 0 ? "border-l-2 border-surface-1" : ""}`}
            style={{ width: `${pct}%` }}
            title={title}
          />
        );
      })}
    </div>
  );
}
