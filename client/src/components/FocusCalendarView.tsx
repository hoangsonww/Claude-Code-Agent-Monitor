/**
 * @file FocusCalendarView.tsx
 * @description Day-view swimlane calendar for a project's focus-time report
 * — the sibling view to FocusReportModal's list-style breakdown. Every
 * session's segments (already fetched by the modal; this component makes
 * no requests of its own) get positioned on a real 24-hour time axis for
 * one selected day, snapped outward to the nearest quarter-hour (floor the
 * start, ceil the end - see `QUARTER_MS`) rather than lined up to the exact
 * minute, so even a very short segment renders as a full, comfortably
 * clickable 15-minute-or-more block instead of an easy-to-miss sliver;
 * segments whose (snapped) spans overlap split into side-by-side lanes via
 * `assignLanes()` (client/src/lib/calendarLanes.ts) instead of stacking, so
 * concurrency reads as geometry rather than a number to interpret. Each lane
 * is a fixed `LANE_WIDTH_PX` wide (not a shrinking `100 / laneCount` share)
 * so a session's column never gets more cramped as concurrency grows; the
 * grid's total width scales with lane count instead, scrolling horizontally
 * under a time axis that stays fixed in place (a sibling of the scrollable
 * grid, not inside it). Each card also carries a solid, `SESSION_STRIP_-
 * WIDTH_PX`-wide (20px) color bar down its left edge, cycled per session
 * from `SESSION_STRIP_COLORS` (see `sessionStripColor`) - a session keeps
 * the same strip color across every block it owns and across day
 * navigation, so two adjacent-in-time blocks from different sessions read
 * as visually distinct at a glance even when they share the same kind
 * color. A dashed border marks an inferred segment (mirrors
 * the "≈ inferred" convention already used in the list view); a still-open
 * block marks a session that's actually running with a small bright-green
 * "power light" fixed to the top of its session-color strip (steady, not
 * animated - an opacity pulse across the whole block turned out too easy to
 * miss at a glance) that disappears the moment the session ends. Design
 * approved from a sketch before this was built — see the `holistic-focus-
 * history` project memory for the full design thread and the v1 scoping
 * decision (Day view + simple date nav only — Week/Month zoom is still a
 * separate, open design thread).
 *
 * Today's own view can additionally "zoom" to an hour-window (`hourWindow`
 * state, `HOUR_WINDOW_OPTIONS`: 4/8/12/24 hours, default 4) rather than
 * always showing the full day: every size under 24 shows that many hours
 * BEHIND the real current time plus `FUTURE_PAD_MS` (2h) ahead of it,
 * re-anchoring to "now" every `ZOOM_REFRESH_MS` (a forced re-render, since
 * nothing else here would otherwise notice real time passing); `24` is the
 * plain, unzoomed full day, with no future padding added on top since
 * there's no more day left to pad into. A past/future day (`!isToday`)
 * always renders the full day regardless of this setting - there's no
 * meaningful "now" to window around once you're not looking at today.
 * Container height and every tick/block position scale to the CURRENT
 * window (`windowStartMs`/`windowMs`), not always the full day, at the same
 * fixed per-minute pixel density `DAY_HEIGHT_PX`/`DAY_MS` establishes.
 *
 * That same current window is reported outward via the optional
 * `onVisibleWindowChange` prop (`{startMs, endMs}` while zoomed, `null` when
 * not) so a caller — `FocusReportBody`'s stat tiles — can scope its own
 * numbers to match what's actually rendered here instead of always
 * reflecting the full fetched report regardless of zoom (previously the two
 * could show wildly different numbers with nothing on screen explaining
 * why). This component makes no data-fetching decision of its own either
 * way; it only exposes the window it's already computing for its own layout.
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
 * Sessions whose cwd is a scratch/temp directory (`isScratchCwd` —
 * `/tmp/...` or `/private/var/folders/...`, macOS's per-process `$TMPDIR`)
 * aren't tied to any real project and are usually short one-off agent runs
 * (a quick fix, a throwaway script) rather than focused project work, so
 * scattering each one across the grid as its own full-width card would be
 * noise. Instead every scratch-cwd segment is bucketed into 15-minute
 * "Scratch Work" bundle cards (`ScratchBundle`, one dedicated lane at index
 * 0 whenever at least one exists that day — see `laneOffset` in the lanes
 * `useMemo`), deduped per real `session.session_id` per bundle window so a
 * session with several scratch segments in the same window still counts
 * once. The card shows only a title + session count, never a project (there
 * isn't one); hovering it lists each bundled session's real name/kind/cwd/
 * time range, keyed by that same real session_id. A segment straddling a
 * 15-minute boundary is intentionally duplicated into both adjacent bundle
 * cards (each showing the session, clipped to that window) rather than
 * arbitrarily assigned to just one, so hovering either card always shows
 * everything actually happening in that window.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Code2 } from "lucide-react";
import { formatMs, formatTime, getCurrentLocale, parseDate } from "../lib/format";
import { FOCUS_KIND_CONFIG, FOCUS_KIND_SOLID } from "../lib/types";
import type { FocusReport, FocusReportChunk, FocusSegmentKind } from "../lib/types";
import { assignLanes } from "../lib/calendarLanes";
import { idleStripesInRange } from "../lib/idleStripes";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";
import { FOCUS_KIND_ICONS } from "./PlanModal";
import { SegmentEventsModal } from "./SegmentEventsModal";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Pixel height of the whole 24-hour column - 2x a plain one-pixel-per-minute
 *  scale (1440), so an hour reads as ~120px instead of 60px and even a short
 *  segment is tall enough to hover/click precisely. */
const DAY_HEIGHT_PX = 2880;
/** Grid quantum for both the tick lines below and every block's own
 *  geometry (see `snapToQuarterGrid` in the lanes memo) - a block always
 *  renders as a whole number of these slots, never a sliver lined up to the
 *  exact minute, so it stays comfortably hoverable/clickable regardless of
 *  its real (often much shorter) duration. */
const QUARTER_MS = 15 * 60_000;
/** One tick per 15-minute slot (96/day) for the grid beneath it - a finer
 *  reference than hour-only lines so a block's start/end reads at a glance
 *  against the nearest quarter-hour instead of having to eyeball a fraction
 *  of an hour-tall row. */
const QUARTERS_PER_DAY = DAY_MS / QUARTER_MS;
/** Fixed pixel width of one lane/session column - 3x a ~100px column (the
 *  cramped end of the old `100 / laneCount` split once several sessions
 *  overlapped), comparable to a Kanban column's own ~288px width. Fixed
 *  (not a percentage of the available area) so a session's column never
 *  shrinks again as concurrency grows - the grid's total width scales with
 *  `laneCount` instead, and the grid area scrolls horizontally under a
 *  time axis that stays put (see the `overflow-x-auto` wrapper below). */
const LANE_WIDTH_PX = 300;
/** Width of the solid session-identity bar on each card's left edge - see
 *  `SESSION_STRIP_COLORS` below. Hardcoded as a literal Tailwind arbitrary
 *  value (`pl-[26px]` = this + the card's own 6px gap) everywhere it's used
 *  as a class, not interpolated from this constant, since Tailwind's JIT
 *  scanner only generates CSS for class names it finds as literal
 *  substrings in source (same constraint FOCUS_KIND_SOLID's own comment in
 *  lib/types.ts documents) - keep both in sync by hand if this changes. */
const SESSION_STRIP_WIDTH_PX = 20;
/** Cycled by each session's position in `report.sessions` (see the
 *  `sessionStripColor` memo) so adjacent-in-time blocks from two different
 *  sessions read as visually distinct at a glance, and the same session
 *  keeps the same color across every block it owns and across day
 *  navigation. Deliberately disjoint from `FOCUS_KIND_SOLID`'s hues
 *  (green/amber/violet/rose/gray) so the two color systems - kind
 *  (semantic, the card's whole background) and session identity (this
 *  left-edge strip) - never get confused for one another. */
const SESSION_STRIP_COLORS = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];

/** Wraps `SESSION_STRIP_COLORS[i % length]` with a definite (never
 *  `undefined`) return type - plain indexed access on an array literal
 *  widens to `string | undefined` under this project's strict indexing
 *  settings, even though `% length` always lands in bounds. */
function sessionColorAt(i: number): string {
  return SESSION_STRIP_COLORS[i % SESSION_STRIP_COLORS.length] ?? "bg-blue-500";
}

/** Selectable hour-window "zoom" sizes for today's view (see `hourWindow`
 *  state) - `24` means the full, unzoomed day. */
const HOUR_WINDOW_OPTIONS = [4, 8, 12, 24] as const;
type HourWindowOption = (typeof HOUR_WINDOW_OPTIONS)[number];
const DEFAULT_HOUR_WINDOW: HourWindowOption = 4;
/** Every zoomed window (anything under the full 24h) shows this many hours
 *  PAST "now" on top of its own selected size, plus this many hours of
 *  empty future headroom - e.g. the "4" option shows 4h in the past + 2h
 *  ahead (6h total), "8" shows 8h past + 2h ahead (10h total). The "24"
 *  option gets none of this: it's already the whole day, so there's no
 *  "ahead" left to pad with (and the total across every option therefore
 *  never exceeds the nominal 24h max). Only applies to TODAY's view - a
 *  past/future day has no meaningful "now" to window around, so it always
 *  renders the full day regardless of this setting (see `isZoomed` below). */
const FUTURE_PAD_MS = 2 * 60 * 60_000;
/** How often the zoomed (today, non-24h) window re-anchors to the real
 *  current time - the block list and now-line already recompute from
 *  `Date.now()` on every render, but nothing here otherwise forces a
 *  render as real time passes, so a zoomed view would otherwise look
 *  static/stale until some unrelated interaction happened to re-render it. */
const ZOOM_REFRESH_MS = 60_000;
/** macOS/Linux temp-directory cwd prefixes (`os.tmpdir()`-style scratch
 *  locations - a `mktemp` working directory, not a real project folder):
 *  `/tmp/...`, `/private/tmp/...` (macOS's real path for `/tmp`), and
 *  `/var/folders/...`/`/private/var/folders/...` (macOS's actual per-user
 *  temp root - what `os.tmpdir()` returns there). A session launched from
 *  one of these gets bundled into the single "Scratch Work" lane (see
 *  `scratchBundles`) instead of scattering across the normal per-session
 *  lanes - these are one-off/throwaway sessions, not real project work. */
const SCRATCH_CWD_PATTERN = /^\/(private\/)?(tmp\/|var\/folders\/)/;

function isScratchCwd(cwd: string | null): boolean {
  return cwd != null && SCRATCH_CWD_PATTERN.test(cwd);
}

interface CalendarBlock {
  /** Rendered box bounds - clipped to this day AND snapped outward to the
   *  quarter-hour grid (see `QUARTER_MS`), so they're deliberately NOT the
   *  segment's real start/end. Use `realStart`/`realEnd`/`wallMs` below for
   *  anything that needs the true, unpadded span. */
  startMs: number;
  endMs: number;
  /** Real (unclipped, unsnapped) duration, in ms — shown in the hover title
   *  even when the rendered bar is visually clipped/padded. */
  wallMs: number;
  /** Idle-grace-discounted active time, in ms — shown alongside wallMs so
   *  the popup/modal never state only the raw span for a segment whose
   *  actual worked time is much smaller (see server/lib/focus-report.js). */
  activeMs: number;
  realStart: string;
  realEnd: string;
  kind: FocusSegmentKind;
  label: string | null;
  itemNumber: number | null;
  inferred: boolean;
  inferredReason: string | null;
  sessionId: string;
  sessionName: string | null;
  sessionCwd: string | null;
  /** Resolved via the optional `projectLabelForCwd` prop - `undefined` when
   *  unresolved/omitted, in which case the card falls back to
   *  `projects:unassigned` rather than showing a blank second line. */
  projectLabel: string | undefined;
  /** True for the open (still-growing) segment of a session with no
   *  `ended_at` yet — the pulsing, open-ended treatment only makes sense
   *  on today's view, but the flag itself doesn't depend on which day is
   *  showing. */
  live: boolean;
  /** The segment's own activity chunks (real, unclipped timestamps) — used
   *  to render idle stretches within the block distinctly from active ones.
   *  Rendered against this block's own (snapped) startMs/endMs via
   *  `idleStripesInRange`, so any padding the snap added shows as plain
   *  kind-color (neither active nor idle) rather than a fabricated stripe —
   *  there's no real chunk data for time outside the segment's true span. */
  chunks: FocusReportChunk[];
}

/** One session's brief summary inside a Scratch Work bundle's hover list -
 *  deliberately NOT a full CalendarBlock: a bundle has no single kind
 *  color/idle-chunk/wall-clock story of its own, just a roster of the real
 *  sessions that touched its 15-minute window. If a session has more than
 *  one segment overlapping the same window, only the first encountered is
 *  kept - a brief roster, not a full per-segment breakdown. */
interface ScratchBundleSessionEntry {
  sessionId: string;
  sessionName: string | null;
  sessionCwd: string | null;
  kind: FocusSegmentKind;
  itemNumber: number | null;
  label: string | null;
  realStart: string;
  realEnd: string;
  inferred: boolean;
}

/** One 15-minute grid window's worth of bundled scratch-directory activity.
 *  `startMs`/`endMs` are the window's OWN grid bounds (clipped to the day/
 *  zoom window) - never derived from any one session's real times, since
 *  the bundle box itself isn't any single session's segment. A session
 *  whose real span crosses into the next window gets its own entry in THAT
 *  window's bundle too - recognizable as the same session across both by
 *  its `sessionId`, never scattered into the normal per-session lanes. */
interface ScratchBundle {
  startMs: number;
  endMs: number;
  sessions: ScratchBundleSessionEntry[];
}

/** Data the hover popup needs, snapshotted at mouseenter time rather than
 *  re-derived from the block on every render — the same fields already
 *  computed once per block for its accessible label, just kept around. */
interface BlockPopupInfo {
  sessionName: string | null;
  sessionCwd: string | null;
  sessionId: string;
  kindLabel: string;
  kindColor: string;
  kindIcon: (typeof FOCUS_KIND_ICONS)[FocusSegmentKind];
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
  /** Resolves a block's session `cwd` to a project name/label - every card
   *  shows this as its second line (falling back to `projects:unassigned`
   *  when it resolves to `undefined`, e.g. a board-mode session whose cwd
   *  isn't mapped to any project). Both `FocusReportModal` (a resolver that
   *  always returns its one already-known project) and `FocusCalendarBoard`
   *  (a real per-cwd lookup, for cross-project disambiguation) pass this
   *  today. Additive/optional so a bare consumer without a resolver still
   *  renders — just always showing the `unassigned` fallback. */
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
  /** Fires whenever the actually-visible hour-window changes — zoomed
   *  in (`{ startMs, endMs }`, see the file header's `hourWindow` doc) or
   *  back out to the full day (`null`, e.g. `hourWindow` set to 24 or
   *  navigating off today). Lets a caller (`FocusReportBody`'s stat tiles)
   *  scope its own numbers to what this calendar is actually showing instead
   *  of always reflecting the full fetched report regardless of zoom.
   *  Additive/optional — omitting it changes nothing about this component's
   *  own rendering. */
  onVisibleWindowChange?: (window: { startMs: number; endMs: number } | null) => void;
}

/** One day's swimlane rendering of a project's focus-time report. */
export function FocusCalendarView({
  report,
  projectLabelForCwd,
  selectedDate: selectedDateProp,
  hideDateNav = false,
  onVisibleWindowChange,
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
  // Same popup/anchor/close-delay mechanism, for a Scratch Work bundle block
  // instead of a single segment - mutually exclusive with `hoveredBlock`
  // (setting one always clears the other; only one popup renders at a time).
  const [hoveredBundle, setHoveredBundle] = useState<ScratchBundle | null>(null);
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
    closeTimerRef.current = setTimeout(() => {
      setHoveredBlock(null);
      setHoveredBundle(null);
    }, 150);
  }, [clearCloseTimer]);

  // The block whose "</>" icon was clicked - opens SegmentEventsModal for
  // its real time window. Separate from hoveredBlock (a different
  // interaction, a bigger modal, and it should survive the pointer leaving
  // the block, unlike the hover popup above).
  const [inspectingBlock, setInspectingBlock] = useState<BlockPopupInfo | null>(null);

  const dayStart = selectedDate.getTime();
  const dayEnd = dayStart + DAY_MS;
  const isToday = dayStart === startOfDay(new Date()).getTime();

  const [hourWindow, setHourWindow] = useState<HourWindowOption>(DEFAULT_HOUR_WINDOW);
  // Only today's view ever zooms - a past/future day has no "now" to window
  // around, so it always shows the full day regardless of this setting.
  const isZoomed = isToday && hourWindow < 24;

  // Forces a re-render every ZOOM_REFRESH_MS while zoomed so the window
  // keeps re-anchoring to the real current time instead of freezing at
  // whatever moment the zoom was last (re)computed.
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    if (!isZoomed) return;
    const id = setInterval(() => forceRefresh((n) => n + 1), ZOOM_REFRESH_MS);
    return () => clearInterval(id);
  }, [isZoomed]);

  // The visible time range this render actually covers - the full day
  // unless today's view is zoomed, in which case it's `hourWindow` hours
  // behind "now" plus `FUTURE_PAD_MS` ahead, clamped to this day's own
  // bounds (never bleeding into yesterday/tomorrow). All positioning below
  // (blocks, hour/quarter ticks, the now-line, container height) is
  // relative to THIS range, not always the full day.
  const windowStartMs = isZoomed
    ? Math.max(dayStart, Date.now() - hourWindow * 60 * 60_000)
    : dayStart;
  const windowEndMs = isZoomed ? Math.min(dayEnd, Date.now() + FUTURE_PAD_MS) : dayEnd;
  const windowMs = windowEndMs - windowStartMs;

  // Tells a caller what this calendar is actually showing right now, so its
  // own numbers (FocusReportBody's stat tiles) can scope to the zoom instead
  // of always reflecting the full fetched report. Fires on every window
  // change (zoom option, day-nav, the periodic re-anchor while zoomed).
  useEffect(() => {
    onVisibleWindowChange?.(isZoomed ? { startMs: windowStartMs, endMs: windowEndMs } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZoomed, windowStartMs, windowEndMs]);

  // Unmount-only counterpart to the effect above - a caller must never hold
  // onto a stale visible window once this component stops rendering at all
  // (e.g. the List/Calendar toggle switching away), which the effect above
  // alone can't guarantee since its own cleanup would also fire (redundantly)
  // on every ordinary window change, not just unmount.
  useEffect(() => {
    return () => onVisibleWindowChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyed off `report.sessions`' own order (stable per fetch, not just
  // per-day-visible order) so a session keeps the same strip color across
  // every block it owns and across day navigation, not just within one day.
  const sessionStripColor = useMemo(() => {
    const map = new Map<string, string>();
    report.sessions.forEach((session, i) => {
      map.set(session.session_id, sessionColorAt(i));
    });
    return map;
  }, [report.sessions]);

  const { lanes, laneCount, scratchBundles } = useMemo(() => {
    const blocks: CalendarBlock[] = [];
    // Quarter-index (relative to dayStart, same grid `visibleQuarters` walks)
    // -> sessionId -> that session's bundle entry. Built in the same pass as
    // `blocks` so both respect identical day-boundary/hour-zoom clipping.
    const bundlesByQuarter = new Map<number, Map<string, ScratchBundleSessionEntry>>();

    for (const session of report.sessions) {
      const scratch = isScratchCwd(session.cwd);
      const segCount = session.segments.length;
      session.segments.forEach((seg, i) => {
        const segStartMs = parseDate(seg.start).getTime();
        const segEndMs = parseDate(seg.end).getTime();
        if (segEndMs <= dayStart || segStartMs >= dayEnd) return; // doesn't touch this day
        const clippedStart = Math.max(segStartMs, dayStart);
        const clippedEnd = Math.min(segEndMs, dayEnd);
        if (clippedEnd <= clippedStart) return;

        if (scratch) {
          // Bundled into every 15-minute grid window this (day-clipped)
          // segment touches, further clipped to the current hour-zoom
          // window - never becomes an individual CalendarBlock/lane, so a
          // temp-dir session's activity never scatters across the normal
          // per-session lanes.
          const windowClippedStart = Math.max(clippedStart, windowStartMs);
          const windowClippedEnd = Math.min(clippedEnd, windowEndMs);
          if (windowClippedEnd <= windowClippedStart) return;
          const firstQ = Math.floor((windowClippedStart - dayStart) / QUARTER_MS);
          const lastQ = Math.ceil((windowClippedEnd - dayStart) / QUARTER_MS) - 1;
          for (let q = firstQ; q <= lastQ; q++) {
            let sessionsInWindow = bundlesByQuarter.get(q);
            if (!sessionsInWindow) {
              sessionsInWindow = new Map();
              bundlesByQuarter.set(q, sessionsInWindow);
            }
            // Only the first segment encountered per session per window -
            // a brief roster entry, not a full per-segment breakdown.
            if (!sessionsInWindow.has(session.session_id)) {
              sessionsInWindow.set(session.session_id, {
                sessionId: session.session_id,
                sessionName: session.name,
                sessionCwd: session.cwd,
                kind: seg.kind,
                itemNumber: seg.item_number,
                label: seg.label,
                realStart: seg.start,
                realEnd: seg.end,
                inferred: seg.inferred,
              });
            }
          }
          return;
        }

        // Snap the rendered box to the quarter-hour grid (floor the start,
        // ceil the end, both relative to dayStart so they land on the same
        // lines the grid itself draws) - a block always covers every
        // 15-minute slot it touches, never a sliver lined up to the real
        // minute, so it stays clickable regardless of how short the real
        // segment was. Snapping BEFORE assignLanes (not just at render time)
        // means two blocks padding into each other split into separate
        // lanes exactly like a genuine overlap would.
        const snappedStart =
          dayStart + Math.floor((clippedStart - dayStart) / QUARTER_MS) * QUARTER_MS;
        const snappedEnd = dayStart + Math.ceil((clippedEnd - dayStart) / QUARTER_MS) * QUARTER_MS;
        // Further clip to the current hour-window zoom (a no-op, same as
        // [dayStart, dayEnd], when unzoomed) - a block entirely outside the
        // visible window doesn't get a lane (or count toward laneCount) at
        // all, and one straddling the edge is clipped to it, same idea as
        // the day-boundary clip above.
        const visibleStart = Math.max(snappedStart, windowStartMs);
        const visibleEnd = Math.min(snappedEnd, windowEndMs);
        if (visibleEnd <= visibleStart) return;
        blocks.push({
          startMs: visibleStart,
          endMs: visibleEnd,
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
          sessionCwd: session.cwd,
          projectLabel: projectLabelForCwd?.(session.cwd),
          live: session.ended_at == null && i === segCount - 1,
          chunks: seg.chunks ?? [],
        });
      });
    }

    const scratchBundles: ScratchBundle[] = Array.from(bundlesByQuarter.entries())
      .map(([q, sessionsMap]) => ({
        startMs: Math.max(dayStart + q * QUARTER_MS, windowStartMs),
        endMs: Math.min(dayStart + (q + 1) * QUARTER_MS, windowEndMs),
        sessions: Array.from(sessionsMap.values()),
      }))
      .sort((a, b) => a.startMs - b.startMs);

    // The Scratch Work lane, when there's anything to put in it, is always
    // lane 0 - every normal lane shifts over by one to make room, rather
    // than competing for placement via assignLanes (a bundle box spans a
    // fixed 15-minute grid slot, not a real segment's span, so it isn't a
    // genuine interval-overlap candidate the algorithm should reason about).
    const laneOffset = scratchBundles.length > 0 ? 1 : 0;
    const assigned = assignLanes(blocks);
    const lanes = assigned.items.map((item) => ({ ...item, lane: item.lane + laneOffset }));
    // Only floors the COMBINED total to 1 (never a wasted extra "normal"
    // lane on a day with scratch activity but zero normal blocks).
    const laneCount = Math.max(assigned.laneCount + laneOffset, 1);
    return { lanes, laneCount, scratchBundles };
  }, [report.sessions, dayStart, dayEnd, windowStartMs, windowEndMs, projectLabelForCwd]);

  const hourLabels = useMemo(
    () =>
      HOURS.map((h) =>
        new Date(dayStart + h * 60 * 60_000).toLocaleTimeString(getCurrentLocale(), {
          hour: "numeric",
        })
      ),
    [dayStart]
  );

  // Which of the 24 on-the-hour ticks/labels actually fall within the
  // current visible window - always all 24 when unzoomed, a narrower slice
  // when zoomed. Clamped to 23 at the top end so a window edge landing
  // exactly on the day's own midnight boundary never renders a redundant
  // "hour 24" tick.
  const visibleHours = useMemo(() => {
    const first = Math.max(0, Math.ceil((windowStartMs - dayStart) / 3_600_000));
    const last = Math.min(23, Math.floor((windowEndMs - dayStart) / 3_600_000));
    const result: number[] = [];
    for (let h = first; h <= last; h++) result.push(h);
    return result;
  }, [dayStart, windowStartMs, windowEndMs]);

  // Same idea, one per 15-minute slot, for the finer tick grid.
  const visibleQuarters = useMemo(() => {
    const first = Math.max(0, Math.ceil((windowStartMs - dayStart) / QUARTER_MS));
    const last = Math.min(QUARTERS_PER_DAY - 1, Math.floor((windowEndMs - dayStart) / QUARTER_MS));
    const result: number[] = [];
    for (let q = first; q <= last; q++) result.push(q);
    return result;
  }, [dayStart, windowStartMs, windowEndMs]);

  const nowPct = isToday ? ((Date.now() - windowStartMs) / windowMs) * 100 : null;
  // Container height scales with the visible window's own share of a full
  // day, at the same fixed per-minute density DAY_HEIGHT_PX/DAY_MS
  // establishes for the unzoomed case - zooming in shows fewer hours in a
  // proportionally shorter box, not the same box with everything squeezed
  // to fit or stretched to fill it.
  const visibleHeightPx = (windowMs / DAY_MS) * DAY_HEIGHT_PX;

  const dateLabel = selectedDate.toLocaleDateString(getCurrentLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {!hideDateNav && (
          <>
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
          </>
        )}
        {/* Hour-window zoom - always shown regardless of `hideDateNav`
            (board mode wants it too), pushed to the far right independent
            of whatever else this row renders. Only actually narrows
            anything on today's view (`isZoomed`) - selecting a zoom size on
            a past/future day just sets the preference for whenever the
            user does land back on today, per DEFAULT_HOUR_WINDOW's own
            "resets to today's default on remount, not persisted" scope. */}
        <div
          role="group"
          aria-label={t("report.calendar.hourWindow.groupLabel")}
          className="flex items-center gap-1 ml-auto"
        >
          {HOUR_WINDOW_OPTIONS.map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => setHourWindow(hours)}
              aria-pressed={hourWindow === hours}
              title={
                hours === 24
                  ? t("report.calendar.hourWindow.fullDayTitle")
                  : t("report.calendar.hourWindow.optionTitle", { hours })
              }
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                hourWindow === hours
                  ? "bg-accent text-white"
                  : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"
              }`}
            >
              {t("report.calendar.hourWindow.option", { hours })}
            </button>
          ))}
        </div>
      </div>

      {lanes.length === 0 && scratchBundles.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-10 text-center">
          {t("report.calendar.empty")}
        </p>
      ) : (
        <div className="flex gap-2">
          {/* Fixed time axis - a sibling of the scroll wrapper below, not
              inside it, so it never scrolls out of view horizontally as the
              (now much wider) lanes area does. Only the hours that fall
              inside the current (possibly zoomed) window get a label. */}
          <div className="relative flex-shrink-0 w-11" style={{ height: visibleHeightPx }}>
            {visibleHours.map((h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] font-mono text-gray-600 whitespace-nowrap"
                style={{ top: `${((dayStart + h * 3_600_000 - windowStartMs) / windowMs) * 100}%` }}
              >
                {hourLabels[h]}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto flex-1">
            <div
              className="relative bg-surface-2 rounded-md border border-border overflow-hidden"
              style={{ height: visibleHeightPx, width: laneCount * LANE_WIDTH_PX }}
            >
              {visibleQuarters.map((q) => (
                <div
                  key={q}
                  className={`absolute inset-x-0 border-t ${
                    q % 4 === 0 ? "border-border/60" : "border-border/25"
                  }`}
                  style={{
                    top: `${((dayStart + q * QUARTER_MS - windowStartMs) / windowMs) * 100}%`,
                  }}
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

              {/* Scratch Work bundles - always lane 0, one block per
                  15-minute grid window with any temp-dir session activity.
                  Not a Link (no single session to navigate to), no idle
                  stripes/events icon (no single segment's chunks/window to
                  show) - hover-only, listing every bundled session's brief
                  detail in the shared popup below. */}
              {scratchBundles.map((bundle) => {
                const topPct = ((bundle.startMs - windowStartMs) / windowMs) * 100;
                const heightPct = ((bundle.endMs - bundle.startMs) / windowMs) * 100;
                return (
                  <div
                    key={bundle.startMs}
                    data-testid="scratch-bundle"
                    onMouseEnter={(e) => {
                      clearCloseTimer();
                      setAnchorRect(e.currentTarget.getBoundingClientRect());
                      setHoveredBlock(null);
                      setHoveredBundle(bundle);
                    }}
                    onMouseLeave={scheduleClose}
                    className="absolute rounded-md border border-dashed border-slate-500/50 bg-slate-600/30 px-1.5 py-1 overflow-hidden hover:brightness-125 transition-[filter]"
                    style={{
                      top: `${topPct}%`,
                      height: `max(${heightPct}%, 3px)`,
                      left: 2,
                      width: LANE_WIDTH_PX - 4,
                    }}
                  >
                    <div className="text-[10px] font-semibold text-gray-100 truncate leading-tight">
                      {t("report.calendar.scratchWork.title")}
                    </div>
                    <div className="text-[9px] truncate leading-tight text-gray-400">
                      {t("report.calendar.scratchWork.sessionCount", {
                        count: bundle.sessions.length,
                      })}
                    </div>
                  </div>
                );
              })}

              {lanes.map((block, i) => {
                const cfg = FOCUS_KIND_CONFIG[block.kind];
                const topPct = ((block.startMs - windowStartMs) / windowMs) * 100;
                const heightPct = ((block.endMs - block.startMs) / windowMs) * 100;
                // A single 15-minute (one quarter-grid slot) block is too
                // short to spare the extra line height wrapping would need,
                // so it keeps the old single-line ellipsis truncation.
                // Anything longer already has the room (block height scales
                // with duration), so the name wraps instead of getting cut
                // off - the point is to actually see the full text.
                const spansMultipleQuarters = block.endMs - block.startMs > QUARTER_MS;
                const laneLeftPx = block.lane * LANE_WIDTH_PX;
                const stripColor = sessionStripColor.get(block.sessionId) ?? sessionColorAt(0);
                const kindLabel =
                  block.kind === "item" && block.itemNumber != null
                    ? t("focus.itemLabel", { number: block.itemNumber })
                    : t(cfg.labelKey);
                const inferredSuffix = block.inferred
                  ? ` — ≈ ${t("report.inferred")}${
                      block.inferredReason ? `: ${block.inferredReason}` : ""
                    }`
                  : "";
                // A session with no declared name reads as "No-name" rather
                // than a truncated session id - used consistently for the
                // card's own name line, its aria-label/title, and the hover
                // popup below (never a bare id fragment in any of the three).
                const displayName = block.sessionName?.trim() || t("report.calendar.noName");
                const title = `${displayName} — ${kindLabel}${
                  block.label ? `: ${block.label}` : ""
                } (${formatTime(block.realStart)}–${formatTime(block.realEnd)}, ${formatMs(
                  block.wallMs
                )})${inferredSuffix}`;
                // Built once per block, per render - shared by the hover
                // popup (onMouseEnter below) and the "</>" icon's click
                // handler so both read the exact same snapshot.
                const popupInfo: BlockPopupInfo = {
                  sessionName: block.sessionName,
                  sessionCwd: block.sessionCwd,
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
                        setHoveredBundle(null);
                        setHoveredBlock(popupInfo);
                      }}
                      onMouseLeave={scheduleClose}
                      className={`absolute rounded-md border pl-[26px] pr-1.5 py-1 overflow-hidden hover:brightness-125 transition-[filter] ${cfg.bg} ${
                        block.inferred ? "border-dashed" : ""
                      }`}
                      style={{
                        top: `${topPct}%`,
                        height: `max(${heightPct}%, 3px)`,
                        left: laneLeftPx + 2,
                        width: LANE_WIDTH_PX - 4,
                      }}
                    >
                      {/* Solid session-identity bar, left edge - same color
                          for every block this session owns (see
                          `sessionStripColor`), so adjacent-in-time blocks
                          from two different sessions read as visually
                          distinct at a glance regardless of kind color. Drawn
                          before the idle overlays/text below, which are all
                          inset past it (`left-[26px]`/`pl-[26px]`), so
                          nothing ever dims or covers this strip. */}
                      <div
                        data-testid="session-color-strip"
                        className={`absolute inset-y-0 left-0 ${stripColor}`}
                        style={{ width: SESSION_STRIP_WIDTH_PX }}
                      >
                        {/* "Power light" - a steady (not pulsing) red LED
                            fixed to the top of this session's own color
                            strip, present only while the session is still
                            open. Replaces the old whole-block opacity pulse,
                            which read too subtle to notice at a glance;
                            on/off is a much clearer live/not-live signal than
                            an animation. Dark ring + white halo + red glow
                            makes it read like a physical status LED rather
                            than a flat UI dot. */}
                        {block.live && (
                          <span
                            data-testid="live-power-light"
                            aria-hidden="true"
                            className="absolute top-1 left-1/2 -translate-x-1/2 rounded-full"
                            style={{
                              width: 12,
                              height: 12,
                              background: "#ff1f2e",
                              border: "2px solid #071018",
                              boxShadow:
                                "0 0 0 1.5px rgba(255, 255, 255, 0.75), 0 0 6px rgba(255, 31, 46, 0.8)",
                            }}
                          />
                        )}
                      </div>
                      {/* Idle-chunk overlays - drawn first so the text
                          labels below (made `relative` to share this same
                          z-index:auto paint step, ordered by DOM position)
                          paint on top of them rather than being covered. An
                          active chunk needs no overlay at all: the block's
                          own kind-color background already reads correctly
                          for it. Inset past the session-color strip (left
                          edge), never dimming it. */}
                      {idleStripes.map((stripe, si) => (
                        <div
                          key={si}
                          data-testid="idle-stripe"
                          className="absolute left-[26px] right-0 bg-stone-100/60"
                          style={{ top: `${stripe.offsetPct}%`, height: `${stripe.spanPct}%` }}
                        />
                      ))}
                      {/* Exactly two lines of always-visible card text: the
                          session's name (or "No-name") and which project it
                          belongs to - the kind/label/timing detail lives in
                          the hover popup and events modal instead, not
                          duplicated here. No "≈ inferred" prefix here (unlike
                          the popup/events-modal) - the card shows no kind/
                          focus label text at all, only the block's kind
                          color, so gluing "≈" onto the session NAME read as
                          "we're unsure of the name" rather than what's
                          actually inferred. The dashed border (already
                          explained in the legend below) is the card face's
                          only inferred signal. */}
                      <div
                        data-testid="block-name"
                        className={`relative text-[10px] font-semibold text-gray-100 leading-tight ${
                          spansMultipleQuarters ? "whitespace-normal break-words" : "truncate"
                        }`}
                      >
                        {displayName}
                      </div>
                      <div className="relative text-[9px] truncate leading-tight text-gray-400">
                        {block.projectLabel || t("projects:unassigned")}
                      </div>
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
                        left: laneLeftPx + LANE_WIDTH_PX - 15,
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
          {(["item", "detour", "feature", "bug", "none"] as const).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${FOCUS_KIND_SOLID[kind]}`} />
              {t(FOCUS_KIND_CONFIG[kind].labelKey)}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-stone-100/60" />
            {t("report.calendar.idle")}
          </span>
          {scratchBundles.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="w-2 h-2 rounded-sm flex-shrink-0 border border-dashed border-slate-500/50 bg-slate-600/30" />
              {t("report.calendar.scratchWork.title")}
            </span>
          )}
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
                {hoveredBlock.sessionName?.trim() || t("report.calendar.noName")}
              </p>
              {hoveredBlock.sessionCwd && (
                <p
                  className="text-gray-500 font-mono text-[11px] break-all"
                  title={hoveredBlock.sessionCwd}
                >
                  cwd: {hoveredBlock.sessionCwd}
                </p>
              )}
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

      {hoveredBundle &&
        anchorRect &&
        createPortal(
          <div
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            style={computeBlockPopupStyle(anchorRect)}
            className="flex flex-col rounded-lg border border-border bg-surface-2 shadow-2xl overflow-hidden animate-fade-in"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 text-gray-400">
              {t("report.calendar.scratchWork.title")}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 text-xs text-gray-300 leading-relaxed">
              {hoveredBundle.sessions.map((s, i) => {
                const cfg = FOCUS_KIND_CONFIG[s.kind];
                const kindLabel =
                  s.kind === "item" && s.itemNumber != null
                    ? t("focus.itemLabel", { number: s.itemNumber })
                    : t(cfg.labelKey);
                return (
                  <div key={s.sessionId} className={i > 0 ? "pt-3 border-t border-border/40" : ""}>
                    <p className="font-medium text-gray-100">
                      {s.inferred ? "≈ " : ""}
                      {s.sessionName?.trim() || t("report.calendar.noName")}
                    </p>
                    <p className={cfg.color}>
                      {kindLabel}
                      {s.label ? `: ${s.label}` : ""}
                    </p>
                    {s.sessionCwd && (
                      <p
                        className="text-gray-500 font-mono text-[11px] break-all"
                        title={s.sessionCwd}
                      >
                        cwd: {s.sessionCwd}
                      </p>
                    )}
                    <p className="text-gray-500">
                      {formatTime(s.realStart)}–{formatTime(s.realEnd)}
                    </p>
                  </div>
                );
              })}
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
