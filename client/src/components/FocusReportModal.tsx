/**
 * @file FocusReportModal.tsx
 * @description Popup showing a project-scoped focus-time breakdown — how
 * long the project's sessions spent on a declared plan item versus a plain
 * detour, a feature aside, or a bug fix, reconstructed server-side from
 * existing `Focus` event history (see server/lib/focus-report.js). Opened by
 * a report icon next to the existing "view plan" icon on a project's card
 * (Projects page and Kanban's Projects view). Fetches on open — the report
 * isn't pre-computed for every project up front, only when actually looked
 * at. Read-only; this never writes anything.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart3, X } from "lucide-react";
import { api } from "../lib/api";
import { formatMs } from "../lib/format";
import { FOCUS_KIND_CONFIG } from "../lib/types";
import type { FocusKind, FocusKindTotals, FocusReport, FocusReportSegment } from "../lib/types";

const ALL_KINDS: FocusKind[] = ["item", "detour", "feature", "bug"];

/** Solid fill classes for a segment bar - {@link FOCUS_KIND_CONFIG}'s own
 *  `bg` is a translucent badge wash (10% opacity), not meant for a bar
 *  that has to read at a glance, so this is a small local, deliberately
 *  separate mapping onto the same hues. */
const SEGMENT_FILL: Record<FocusKind, string> = {
  item: "bg-green-500",
  detour: "bg-amber-500",
  feature: "bg-violet-500",
  bug: "bg-rose-500",
};

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
          <button
            type="button"
            onClick={onClose}
            title={t("common:close")}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 overflow-y-auto">
          {loading && (
            <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.loading")}</p>
          )}
          {!loading && failed && (
            <p className="text-xs text-rose-400 py-6 text-center">{t("report.error")}</p>
          )}
          {!loading && !failed && report && <ReportBody report={report} />}
        </div>
      </div>
    </div>
  );
}

function ReportBody({ report }: { report: FocusReport }) {
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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <StatTile
          label={t("report.activeTime")}
          value={formatMs(report.totals.active_ms)}
          sub={t("report.ofWallClock", { total: formatMs(report.totals.wall_ms) })}
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

      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.sessionsHeading")}</h3>
        <div className="space-y-4">
          {report.sessions.map((session) => {
            const totalMs = session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0);
            return (
              <div key={session.session_id} className="space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <Link
                    to={`/sessions/${session.session_id}`}
                    draggable={false}
                    className="text-xs font-medium text-gray-200 hover:text-accent hover:underline truncate min-w-0"
                  >
                    {session.name?.trim() || session.session_id.slice(0, 8)}
                  </Link>
                  <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">
                    {formatMs(totalMs)}
                  </span>
                </div>
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
                <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${SEGMENT_FILL[kind]}`} />
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
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-surface-1 px-3.5 py-3 flex flex-col gap-1 min-w-0">
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
 *  (when one exists), and duration, keeping hover detail without a
 *  custom-positioned popup. */
function SegmentedBar({
  segments,
  totalMs,
  height,
}: {
  segments: Pick<FocusReportSegment, "kind" | "wall_ms" | "label">[];
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
        const title = seg.label
          ? `${kindLabel}: ${seg.label} (${formatMs(seg.wall_ms)})`
          : `${kindLabel} (${formatMs(seg.wall_ms)})`;
        return (
          <div
            key={i}
            className={`${SEGMENT_FILL[seg.kind]} ${i > 0 ? "border-l-2 border-surface-1" : ""}`}
            style={{ width: `${pct}%` }}
            title={title}
          />
        );
      })}
    </div>
  );
}
