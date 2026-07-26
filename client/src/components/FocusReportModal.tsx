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
 *
 * The stat-tile/List-Calendar toggle/list-body rendering itself lives in
 * `FocusReportBody.tsx` (extracted so the new cross-project
 * `FocusCalendarBoard` page can reuse the exact same implementation instead
 * of copy-pasting it) — this file owns only the modal chrome (header,
 * loading/error states, `viewMode` state) around that shared body.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, X } from "lucide-react";
import { api } from "../lib/api";
import type { FocusReport } from "../lib/types";
import { FocusReportBody, FocusReportViewToggle } from "./FocusReportBody";
import type { ViewMode } from "./FocusReportBody";

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
              <FocusReportViewToggle viewMode={viewMode} onChange={setViewMode} />
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
          {!loading && !failed && report && <FocusReportBody report={report} viewMode={viewMode} />}
        </div>
      </div>
    </div>
  );
}
