/**
 * @file FocusCalendarView.tsx
 * @description Day-view swimlane calendar for a project's focus-time report
 * — the sibling view to FocusReportModal's list-style breakdown. Every
 * session's segments (already fetched by the modal; this component makes
 * no requests of its own) get positioned on a real 24-hour time axis for
 * one selected day; segments whose time spans overlap split into
 * side-by-side lanes via `assignLanes()` (client/src/lib/calendarLanes.ts)
 * instead of stacking, so concurrency reads as geometry rather than a
 * number to interpret. A dashed border marks an inferred segment (mirrors
 * the "≈ inferred" convention already used in the list view); a pulsing,
 * open-ended block marks a session that's still actually running. Design
 * approved from a sketch before this was built — see the `holistic-focus-
 * history` project memory for the full design thread and the v1 scoping
 * decision (Day view + simple date nav only; no Week/Month zoom and no
 * aggregate time-range selector yet — those are a separate, still-open
 * design thread).
 *
 * A segment that spans past midnight is clipped to each day it touches
 * (so it can appear, clipped, on more than one day) — full multi-day
 * continuation rendering is a possible future refinement, not v1.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMs, formatTime, getCurrentLocale, parseDate } from "../lib/format";
import { FOCUS_KIND_CONFIG, FOCUS_KIND_SOLID } from "../lib/types";
import type { FocusKind, FocusReport } from "../lib/types";
import { assignLanes } from "../lib/calendarLanes";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface CalendarBlock {
  startMs: number;
  endMs: number;
  /** Real (unclipped) duration, in ms — shown in the hover title even when
   *  the rendered bar is visually clipped at a day boundary. */
  wallMs: number;
  realStart: string;
  realEnd: string;
  kind: FocusKind;
  label: string | null;
  itemNumber: number | null;
  inferred: boolean;
  inferredReason: string | null;
  sessionId: string;
  sessionName: string | null;
  /** True for the open (still-growing) segment of a session with no
   *  `ended_at` yet — the pulsing, open-ended treatment only makes sense
   *  on today's view, but the flag itself doesn't depend on which day is
   *  showing. */
  live: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface FocusCalendarViewProps {
  report: FocusReport;
}

/** One day's swimlane rendering of a project's focus-time report. */
export function FocusCalendarView({ report }: FocusCalendarViewProps) {
  const { t } = useTranslation("plan");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const dayStart = selectedDate.getTime();
  const dayEnd = dayStart + DAY_MS;
  const isToday = dayStart === startOfDay(new Date()).getTime();

  const { lanes, laneCount } = useMemo(() => {
    const blocks: CalendarBlock[] = [];
    for (const session of report.sessions) {
      const segCount = session.segments.length;
      session.segments.forEach((seg, i) => {
        const segStartMs = parseDate(seg.start).getTime();
        const segEndMs = parseDate(seg.end).getTime();
        if (segEndMs <= dayStart || segStartMs >= dayEnd) return; // doesn't touch this day
        const clippedStart = Math.max(segStartMs, dayStart);
        const clippedEnd = Math.min(segEndMs, dayEnd);
        if (clippedEnd <= clippedStart) return;
        blocks.push({
          startMs: clippedStart,
          endMs: clippedEnd,
          wallMs: seg.wall_ms,
          realStart: seg.start,
          realEnd: seg.end,
          kind: seg.kind,
          label: seg.label,
          itemNumber: seg.item_number,
          inferred: seg.inferred,
          inferredReason: seg.inferred_reason,
          sessionId: session.session_id,
          sessionName: session.name,
          live: session.ended_at == null && i === segCount - 1,
        });
      });
    }
    const assigned = assignLanes(blocks);
    return { lanes: assigned.items, laneCount: Math.max(assigned.laneCount, 1) };
  }, [report.sessions, dayStart, dayEnd]);

  const hourLabels = useMemo(
    () =>
      HOURS.map((h) =>
        new Date(dayStart + h * 60 * 60_000).toLocaleTimeString(getCurrentLocale(), {
          hour: "numeric",
        })
      ),
    [dayStart]
  );

  const nowPct = isToday ? ((Date.now() - dayStart) / DAY_MS) * 100 : null;

  const dateLabel = selectedDate.toLocaleDateString(getCurrentLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedDate(new Date(dayStart - DAY_MS))}
            title={t("report.calendar.prevDay")}
            className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(startOfDay(new Date()))}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              isToday
                ? "bg-accent text-white"
                : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"
            }`}
          >
            {t("report.calendar.today")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(new Date(dayStart + DAY_MS))}
            title={t("report.calendar.nextDay")}
            className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs font-medium text-gray-200">{dateLabel}</span>
      </div>

      {lanes.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-10 text-center">
          {t("report.calendar.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-[560px]">
            <div className="relative flex-shrink-0 w-11" style={{ height: 1440 }}>
              {HOURS.map((h) => (
                <span
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-[10px] font-mono text-gray-600 whitespace-nowrap"
                  style={{ top: `${(h / 24) * 100}%` }}
                >
                  {hourLabels[h]}
                </span>
              ))}
            </div>

            <div
              className="relative flex-1 bg-surface-2 rounded-md border border-border overflow-hidden"
              style={{ height: 1440 }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: `${(h / 24) * 100}%` }}
                />
              ))}

              {nowPct != null && (
                <div
                  className="absolute inset-x-0 z-10 border-t border-dashed border-accent-hover"
                  style={{ top: `${nowPct}%` }}
                >
                  <span className="absolute left-0 -translate-x-full -translate-y-1/2 -ml-1 bg-accent text-white text-[9px] font-mono font-semibold px-1.5 py-px rounded-full whitespace-nowrap">
                    {formatTime(new Date().toISOString())}
                  </span>
                </div>
              )}

              {lanes.map((block, i) => {
                const cfg = FOCUS_KIND_CONFIG[block.kind];
                const topPct = ((block.startMs - dayStart) / DAY_MS) * 100;
                const heightPct = ((block.endMs - block.startMs) / DAY_MS) * 100;
                const leftPct = (block.lane / laneCount) * 100;
                const widthPct = 100 / laneCount;
                const kindLabel =
                  block.kind === "item" && block.itemNumber != null
                    ? t("focus.itemLabel", { number: block.itemNumber })
                    : t(cfg.labelKey);
                const inferredSuffix = block.inferred
                  ? ` — ≈ ${t("report.inferred")}${
                      block.inferredReason ? `: ${block.inferredReason}` : ""
                    }`
                  : "";
                const title = `${block.sessionName?.trim() || block.sessionId.slice(0, 8)} — ${kindLabel}${
                  block.label ? `: ${block.label}` : ""
                } (${formatTime(block.realStart)}–${formatTime(block.realEnd)}, ${formatMs(
                  block.wallMs
                )})${inferredSuffix}`;

                return (
                  <Link
                    key={`${block.sessionId}-${i}`}
                    to={`/sessions/${block.sessionId}`}
                    title={title}
                    className={`absolute rounded-md border px-1.5 py-1 overflow-hidden hover:brightness-125 transition-[filter] ${cfg.bg} ${
                      block.inferred ? "border-dashed" : ""
                    } ${block.live ? "animate-pulse-slow" : ""}`}
                    style={{
                      top: `${topPct}%`,
                      height: `max(${heightPct}%, 3px)`,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <div className="text-[10px] font-semibold text-gray-100 truncate leading-tight">
                      {block.inferred ? "≈ " : ""}
                      {block.sessionName?.trim() || block.sessionId.slice(0, 8)}
                    </div>
                    <div className={`text-[9.5px] truncate leading-tight ${cfg.color}`}>
                      {kindLabel}
                      {block.label ? `: ${block.label}` : ""}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap gap-4">
          {(["item", "detour", "feature", "bug"] as const).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${FOCUS_KIND_SOLID[kind]}`} />
              {t(FOCUS_KIND_CONFIG[kind].labelKey)}
            </span>
          ))}
        </div>
        <div className="flex gap-3 text-[11px] text-gray-500">
          <span>
            <span className="inline-block w-4 h-2.5 rounded-sm border border-gray-500 align-[-1px] mr-1" />
            {t("report.calendar.declared")}
          </span>
          <span>
            <span className="inline-block w-4 h-2.5 rounded-sm border border-dashed border-gray-500 align-[-1px] mr-1" />
            {t("report.calendar.inferredProvenance")}
          </span>
        </div>
      </div>
    </div>
  );
}
