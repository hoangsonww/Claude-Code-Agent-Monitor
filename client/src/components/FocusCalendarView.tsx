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
 * Hovering a block shows its detail in a floating popup (portaled to
 * `document.body`, anchored off the block's own rect) rather than a native
 * `title` tooltip — same pattern as SessionCard's focus-breadcrumb popup —
 * since a bare OS tooltip can't carry the kind's color-coding or wrap the
 * label/inferred-reason text legibly.
 *
 * Each block also carries a small "</>" icon (top-right corner, a sibling of
 * the block's own Link rather than nested inside it, so it isn't invalid
 * HTML and doesn't inherit the block's navigate-to-session click) that opens
 * SegmentEventsModal — the raw hook events recorded in that segment's real
 * time window, bucketed into 10-minute rows, for checking what data is
 * actually backing an attributed duration rather than taking the report's
 * math on faith.
 *
 * A segment's wall-clock span can run far longer than its actual worked
 * time (a whole-session inferred segment rides straight through to
 * session.ended_at regardless of how much of that was silence — see
 * server/lib/focus-report.js). Two things surface that honestly instead of
 * letting one solid block imply continuous work: (1) each block draws a
 * dark overlay stripe over any 10-minute chunk with zero real events
 * (`seg.chunks`, same 10-minute grain as the events modal) — active chunks
 * need no overlay, the block's own kind color already reads correctly for
 * them; (2) the hover popup and events-modal header both state wall-clock
 * time AND idle-grace-discounted active ("agent") time side by side, rather
 * than only the raw span.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Code2 } from "lucide-react";
import { formatMs, formatTime, getCurrentLocale, parseDate } from "../lib/format";
import { FOCUS_KIND_CONFIG, FOCUS_KIND_SOLID } from "../lib/types";
import type { FocusKind, FocusReport, FocusReportChunk } from "../lib/types";
import { assignLanes } from "../lib/calendarLanes";
import { idleStripesInRange } from "../lib/idleStripes";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";
import { FOCUS_KIND_ICONS } from "./PlanModal";
import { SegmentEventsModal } from "./SegmentEventsModal";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface CalendarBlock {
  startMs: number;
  endMs: number;
  /** Real (unclipped) duration, in ms — shown in the hover title even when
   *  the rendered bar is visually clipped at a day boundary. */
  wallMs: number;
  /** Idle-grace-discounted active time, in ms — shown alongside wallMs so
   *  the popup/modal never state only the raw span for a segment whose
   *  actual worked time is much smaller (see server/lib/focus-report.js). */
  activeMs: number;
  realStart: string;
  realEnd: string;
  kind: FocusKind;
  label: string | null;
  itemNumber: number | null;
  inferred: boolean;
  inferredReason: string | null;
  sessionId: string;
  sessionName: string | null;
  /** Resolved via the optional `projectLabelForCwd` prop (board mode only) -
   *  `undefined` when unresolved/omitted, in which case nothing extra
   *  renders. Disambiguates concurrent same-named sessions from different
   *  projects on the cross-project board. */
  projectLabel: string | undefined;
  /** True for the open (still-growing) segment of a session with no
   *  `ended_at` yet — the pulsing, open-ended treatment only makes sense
   *  on today's view, but the flag itself doesn't depend on which day is
   *  showing. */
  live: boolean;
  /** The segment's own activity chunks (real, unclipped timestamps) — used
   *  to render idle stretches within the block distinctly from active ones.
   *  Clipped to this block's visible day range at render time, same as the
   *  block's own startMs/endMs. */
  chunks: FocusReportChunk[];
}

/** Data the hover popup needs, snapshotted at mouseenter time rather than
 *  re-derived from the block on every render — the same fields already
 *  computed once per block for its accessible label, just kept around. */
interface BlockPopupInfo {
  sessionName: string | null;
  sessionId: string;
  kindLabel: string;
  kindColor: string;
  kindIcon: (typeof FOCUS_KIND_ICONS)[FocusKind];
  label: string | null;
  realStart: string;
  realEnd: string;
  wallMs: number;
  activeMs: number;
  inferred: boolean;
  inferredReason: string | null;
  live: boolean;
}

const BLOCK_POPUP_WIDTH = 300;

/** Popup anchored off the hovered block's rect — opens below by default,
 *  flipping above when there's more room that direction, and clamped to the
 *  viewport on both axes. Mirrors SessionCard's `computeFocusPopupStyle`:
 *  short, structured content rather than an arbitrarily long message, so a
 *  measured two-phase layout isn't needed. */
function computeBlockPopupStyle(rect: DOMRect): React.CSSProperties {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const pad = 12;
  const width = Math.min(BLOCK_POPUP_WIDTH, vw - pad * 2);
  const left = Math.min(Math.max(rect.left, pad), Math.max(pad, vw - width - pad));

  const spaceBelow = vh - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(Math.max(openBelow ? spaceBelow : spaceAbove, 90), 320);
  const top = openBelow ? rect.bottom + 6 : Math.max(pad, rect.top - 6 - maxHeight);

  return { position: "fixed", left, top, width, maxHeight, zIndex: 9999 };
}

export interface FocusCalendarViewProps {
  report: FocusReport;
  /** Resolves a block's session `cwd` to a project name/label, for
   *  cross-project disambiguation — populated only by the new
   *  `FocusCalendarBoard` page (via `FocusReportBody`), never by the
   *  existing per-project modal. Returning `undefined` (including when the
   *  prop itself is omitted) renders nothing extra — no crash, no stray
   *  label. Additive/optional; omitting it preserves today's exact
   *  rendering. */
  projectLabelForCwd?: (cwd: string | null) => string | undefined;
  /** Controls which day is rendered, overriding the component's own
   *  internal `today`-defaulted state (controlled mode) — used by the board
   *  page, whose own page-level time-period control (`TimePeriodPicker`)
   *  owns the selected day instead. Additive/optional; omitting it preserves
   *  today's exact uncontrolled behavior (defaults to, and can still
   *  self-navigate via the internal nav row to, today). */
  selectedDate?: Date;
  /** Suppresses the internal prev/today/next day-nav row entirely when
   *  `true` — the board page renders its own page-level day-nav
   *  (`TimePeriodPicker`) instead, so there is exactly one day-nav control on
   *  the page rather than two stacked ones. Additive/optional, defaults to
   *  `false` (nav visible), matching today's exact modal rendering when
   *  omitted. */
  hideDateNav?: boolean;
}

/** One day's swimlane rendering of a project's focus-time report. */
export function FocusCalendarView({
  report,
  projectLabelForCwd,
  selectedDate: selectedDateProp,
  hideDateNav = false,
}: FocusCalendarViewProps) {
  const { t } = useTranslation("plan");
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => startOfDay(new Date()));
  // Controlled mode: a supplied `selectedDate` always wins over internal
  // state (re-normalized to its own local midnight so a caller passing a
  // non-midnight Date still lines up with this component's own day-boundary
  // math). Omitted -> today's exact uncontrolled behavior, unchanged.
  const selectedDate = selectedDateProp ? startOfDay(selectedDateProp) : internalSelectedDate;

  // Hover popup for a block — a single slot (not per-block state) since only
  // one can be open at a time. Closing on a short delay rather than instantly
  // on mouseleave gives the pointer time to cross the gap into the portaled
  // popup itself; both the block and the popup clear this timer on their own
  // mouseenter, so it only actually closes once the pointer has left both.
  const [hoveredBlock, setHoveredBlock] = useState<BlockPopupInfo | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHoveredBlock(null), 150);
  }, [clearCloseTimer]);

  // The block whose "</>" icon was clicked - opens SegmentEventsModal for
  // its real time window. Separate from hoveredBlock (a different
  // interaction, a bigger modal, and it should survive the pointer leaving
  // the block, unlike the hover popup above).
  const [inspectingBlock, setInspectingBlock] = useState<BlockPopupInfo | null>(null);

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
          activeMs: seg.active_ms,
          realStart: seg.start,
          realEnd: seg.end,
          kind: seg.kind,
          label: seg.label,
          itemNumber: seg.item_number,
          inferred: seg.inferred,
          inferredReason: seg.inferred_reason,
          sessionId: session.session_id,
          sessionName: session.name,
          projectLabel: projectLabelForCwd?.(session.cwd),
          live: session.ended_at == null && i === segCount - 1,
          chunks: seg.chunks ?? [],
        });
      });
    }
    const assigned = assignLanes(blocks);
    return { lanes: assigned.items, laneCount: Math.max(assigned.laneCount, 1) };
  }, [report.sessions, dayStart, dayEnd, projectLabelForCwd]);

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
      {!hideDateNav && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setInternalSelectedDate(new Date(dayStart - DAY_MS))}
              title={t("report.calendar.prevDay")}
              className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setInternalSelectedDate(startOfDay(new Date()))}
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
              onClick={() => setInternalSelectedDate(new Date(dayStart + DAY_MS))}
              title={t("report.calendar.nextDay")}
              className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs font-medium text-gray-200">{dateLabel}</span>
        </div>
      )}

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
                // Built once per block, per render - shared by the hover
                // popup (onMouseEnter below) and the "</>" icon's click
                // handler so both read the exact same snapshot.
                const popupInfo: BlockPopupInfo = {
                  sessionName: block.sessionName,
                  sessionId: block.sessionId,
                  kindLabel,
                  kindColor: cfg.color,
                  kindIcon: FOCUS_KIND_ICONS[block.kind],
                  label: block.label,
                  realStart: block.realStart,
                  realEnd: block.realEnd,
                  wallMs: block.wallMs,
                  activeMs: block.activeMs,
                  inferred: block.inferred,
                  inferredReason: block.inferredReason,
                  live: block.live,
                };
                const idleStripes = idleStripesInRange(block.chunks, block.startMs, block.endMs);

                return (
                  <Fragment key={`${block.sessionId}-${i}`}>
                    <Link
                      to={`/sessions/${block.sessionId}`}
                      aria-label={title}
                      onMouseEnter={(e) => {
                        clearCloseTimer();
                        setAnchorRect(e.currentTarget.getBoundingClientRect());
                        setHoveredBlock(popupInfo);
                      }}
                      onMouseLeave={scheduleClose}
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
                      {/* Idle-chunk overlays - drawn first so the text
                          labels below (made `relative` to share this same
                          z-index:auto paint step, ordered by DOM position)
                          paint on top of them rather than being covered. An
                          active chunk needs no overlay at all: the block's
                          own kind-color background already reads correctly
                          for it. */}
                      {idleStripes.map((stripe, si) => (
                        <div
                          key={si}
                          data-testid="idle-stripe"
                          className="absolute inset-x-0 bg-black/45"
                          style={{ top: `${stripe.offsetPct}%`, height: `${stripe.spanPct}%` }}
                        />
                      ))}
                      <div className="relative text-[10px] font-semibold text-gray-100 truncate leading-tight">
                        {block.inferred ? "≈ " : ""}
                        {block.sessionName?.trim() || block.sessionId.slice(0, 8)}
                      </div>
                      <div className={`relative text-[9.5px] truncate leading-tight ${cfg.color}`}>
                        {kindLabel}
                        {block.label ? `: ${block.label}` : ""}
                      </div>
                      {block.projectLabel && (
                        <div className="relative text-[9px] truncate leading-tight text-gray-400">
                          {block.projectLabel}
                        </div>
                      )}
                    </Link>
                    {/* A sibling of the Link above, not nested inside it -
                        clicking it must open the events modal instead of
                        navigating to the session, and a <button> nested in
                        an <a> is invalid HTML anyway. Positioned to sit in
                        the block's own top-right corner via the same
                        top/left/width geometry. */}
                    <button
                      type="button"
                      onClick={() => {
                        // Closes the hover popup too - the two would
                        // otherwise sit visually on top of each other while
                        // the modal's fade-in animates in.
                        clearCloseTimer();
                        setHoveredBlock(null);
                        setInspectingBlock(popupInfo);
                      }}
                      title={t("report.calendar.viewEvents")}
                      aria-label={t("report.calendar.viewEvents")}
                      className="absolute z-[2] flex items-center justify-center w-3.5 h-3.5 rounded-sm bg-black/40 text-gray-300 hover:bg-black/70 hover:text-white transition-colors"
                      style={{
                        top: `calc(${topPct}% + 1px)`,
                        left: `calc(${leftPct}% + ${widthPct}% - 15px)`,
                      }}
                    >
                      <Code2 className="w-2 h-2" />
                    </button>
                  </Fragment>
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

      {hoveredBlock &&
        anchorRect &&
        createPortal(
          <div
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            style={computeBlockPopupStyle(anchorRect)}
            className="flex flex-col rounded-lg border border-border bg-surface-2 shadow-2xl overflow-hidden animate-fade-in"
          >
            <div
              className={`flex items-center gap-1.5 px-3 py-2 border-b border-border/60 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${hoveredBlock.kindColor}`}
            >
              <hoveredBlock.kindIcon className="w-3 h-3" />
              {hoveredBlock.kindLabel}
              {hoveredBlock.live && (
                <span className="ml-auto normal-case tracking-normal text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
                  {t("report.calendar.stillRunning")}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 text-xs text-gray-300 leading-relaxed">
              <p className="font-medium text-gray-100">
                {hoveredBlock.inferred ? "≈ " : ""}
                {hoveredBlock.sessionName?.trim() || hoveredBlock.sessionId.slice(0, 8)}
              </p>
              {hoveredBlock.label && <p className="text-gray-400">{hoveredBlock.label}</p>}
              <p className="text-gray-500">
                {formatTime(hoveredBlock.realStart)}–{formatTime(hoveredBlock.realEnd)}
              </p>
              <p className="text-gray-500">
                {t("report.wallClockLabel")}: {formatMs(hoveredBlock.wallMs)}
                {" · "}
                {t("report.activeLabel")}: {formatMs(hoveredBlock.activeMs)}
              </p>
              {hoveredBlock.inferred && (
                <p className="text-[11px] text-gray-400 italic">
                  {t("report.inferredNote")}
                  {hoveredBlock.inferredReason ? ` (${hoveredBlock.inferredReason})` : ""}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}

      {inspectingBlock && (
        <SegmentEventsModal
          sessionId={inspectingBlock.sessionId}
          sessionName={inspectingBlock.sessionName}
          kindLabel={inspectingBlock.kindLabel}
          kindColor={inspectingBlock.kindColor}
          label={inspectingBlock.label}
          realStart={inspectingBlock.realStart}
          realEnd={inspectingBlock.realEnd}
          wallMs={inspectingBlock.wallMs}
          activeMs={inspectingBlock.activeMs}
          inferred={inspectingBlock.inferred}
          inferredReason={inspectingBlock.inferredReason}
          onClose={() => setInspectingBlock(null)}
        />
      )}
    </div>
  );
}
