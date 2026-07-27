/**
 * @file useHourWindowZoom.ts
 * @description Reusable "hour-window zoom" state/logic for a single
 * selected day, extracted out of `FocusCalendarView.tsx` so a second
 * consumer (`FocusPage.tsx`) can offer the exact same start+duration
 * windowing without a calendar grid attached. Given just a `selectedDate`,
 * manages the zoom size (`hourWindow`: 4/8/12/24 hours, `24` meaning the
 * full, unzoomed day) and the window's anchor:
 *  - `"live"` (default, today only) — follows `hourWindow` hours behind the
 *    real current time plus a fixed 2h look-ahead, re-anchoring to "now"
 *    every `ZOOM_REFRESH_MS` via a forced re-render.
 *  - `"custom"` — an explicit start time the caller picked via the stepper,
 *    the typed `<input type="time">`, or a quick-start preset. The only
 *    mode a non-today day can render in, regardless of the stored
 *    `windowAnchorMode` (see `effectiveAnchorMode`).
 *
 * `FocusCalendarView.tsx` and `FocusPage.tsx` both call this with their own
 * `selectedDate` and render `HourWindowZoomBar` with the result — see that
 * component for the presentational half of this split.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentLocale } from "../lib/format";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";

/** Selectable hour-window "zoom" sizes - `24` means the full, unzoomed day. */
export const HOUR_WINDOW_OPTIONS = [4, 8, 12, 24] as const;
export type HourWindowOption = (typeof HOUR_WINDOW_OPTIONS)[number];
const DEFAULT_HOUR_WINDOW: HourWindowOption = 4;
/** Every LIVE zoomed window (anything under the full 24h, anchored to "now"
 *  rather than a custom start time) shows this many hours PAST "now" on top
 *  of its own selected size, plus this many hours of empty future headroom -
 *  e.g. the "4" option shows 4h in the past + 2h ahead (6h total), "8" shows
 *  8h past + 2h ahead (10h total). The "24" option gets none of this: it's
 *  already the whole day, so there's no "ahead" left to pad with (and the
 *  total across every option therefore never exceeds the nominal 24h max).
 *  Never applies to a "custom"-anchored window (see `windowAnchorMode`
 *  above) - there's no "now" to pad ahead of once the window's start time is
 *  an explicit pick rather than a live follow of the current time. */
const FUTURE_PAD_MS = 2 * 60 * 60_000;
/** One hour, in ms - shared by every hour-window/offset computation below. */
const HOUR_MS = 60 * 60_000;
/** Spacing between the quick-start preset buttons (see `quickStartOptions`)
 *  - 12am, 4am, 8am, 12pm, 4pm, 8pm, matching every `HOUR_WINDOW_OPTIONS`
 *  size evenly (4/8/12 all divide cleanly by 4). */
const QUICK_START_STEP_HOURS = 4;
/** How often a LIVE zoomed window re-anchors to the real current time - the
 *  block list and now-line already recompute from `Date.now()` on every
 *  render, but nothing here otherwise forces a render as real time passes,
 *  so a live zoomed view would otherwise look static/stale until some
 *  unrelated interaction happened to re-render it. A "custom"-anchored
 *  window needs no such refresh - its start time doesn't move on its own. */
const ZOOM_REFRESH_MS = 60_000;

export interface HourWindowZoom {
  hourWindow: HourWindowOption;
  setHourWindow: (hours: HourWindowOption) => void;
  /** `false` only at the full 24h size - there's no separate "start" to pick
   *  once the window IS the whole day. */
  zoomable: boolean;
  isToday: boolean;
  effectiveAnchorMode: "live" | "custom";
  setWindowAnchorMode: (mode: "live" | "custom") => void;
  dayStart: number;
  windowStartMs: number;
  windowEndMs: number;
  maxWindowStartMs: number;
  /** "HH:MM" (24h, zero-padded) rendering of the window's own current start
   *  time - drives the start-time `<input type="time">`'s value whether the
   *  window is live or custom. */
  windowStartTimeValue: string;
  /** Pages the window backward/forward by its own `hourWindow` size, clamped
   *  to this day's bounds - switches to "custom" anchoring since the result
   *  is now an explicit pick, not "now". */
  stepWindowStart: (deltaHours: number) => void;
  handleWindowStartInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Jumps straight to a quick-start preset - same "explicit pick -> custom
   *  anchoring" behavior as the stepper/typed input. */
  handleQuickStartClick: (offsetMs: number) => void;
  /** Every QUICK_START_STEP_HOURS-aligned start time from midnight up to the
   *  latest legal window start for the current `hourWindow` size. */
  quickStartOptions: number[];
  /** On-the-hour locale label for a quick-start offset (e.g. "12 AM"). */
  quickStartLabel: (offsetMs: number) => string;
  /** Whether the window ACTUALLY showing right now starts after the real
   *  current time - only possible on today's own view. */
  windowIsFuture: boolean;
}

export interface UseHourWindowZoomOptions {
  /** Initial `hourWindow` size - defaults to `4` (a live, recent-activity
   *  zoom), matching `FocusCalendarView`'s own long-established default.
   *  `FocusPage.tsx` passes `24` instead (unzoomed/full-period) so adding
   *  this control there doesn't silently narrow what it shows by default -
   *  the zoom is purely an opt-in refinement there, not a changed default. */
  defaultHourWindow?: HourWindowOption;
}

/** Manages the hour-window "zoom" size/anchor for one selected day - see
 *  file header. `selectedDate` is normalized to its own local midnight
 *  internally, so a caller passing a non-midnight Date still lines up with
 *  this hook's own day-boundary math. */
export function useHourWindowZoom(
  selectedDate: Date,
  { defaultHourWindow = DEFAULT_HOUR_WINDOW }: UseHourWindowZoomOptions = {}
): HourWindowZoom {
  const dayStart = startOfDay(selectedDate).getTime();
  const dayEnd = dayStart + DAY_MS;
  const isToday = dayStart === startOfDay(new Date()).getTime();

  const [hourWindow, setHourWindow] = useState<HourWindowOption>(defaultHourWindow);
  // "live" (the default) follows the real current time; "custom" freezes the
  // window at an explicit start time the user picked (`customOffsetMs`,
  // below). Only "live" ever re-anchors to "now" - see `effectiveAnchorMode`.
  const [windowAnchorMode, setWindowAnchorMode] = useState<"live" | "custom">("live");
  // Explicit window start, as an offset from THIS DAY's own local midnight
  // (not an absolute timestamp) - so paging through past days keeps looking
  // at the same clock-time window on each one instead of the offset meaning
  // a different time of day every time `dayStart` changes. Only read while
  // `effectiveAnchorMode === "custom"`; defaults to midnight.
  const [customOffsetMs, setCustomOffsetMs] = useState(0);

  const zoomable = hourWindow < 24;
  // A past/future day has no meaningful "now" to live-follow, so it always
  // renders in "custom" mode (starting at whatever `customOffsetMs` already
  // is, i.e. midnight until the user moves it) regardless of the stored
  // `windowAnchorMode` - that state only actually takes effect once the user
  // is back on today's own view.
  const effectiveAnchorMode: "live" | "custom" =
    windowAnchorMode === "live" && isToday ? "live" : "custom";
  const isLiveZoom = zoomable && effectiveAnchorMode === "live";

  // Forces a re-render every ZOOM_REFRESH_MS while live-zoomed so the window
  // keeps re-anchoring to the real current time instead of freezing at
  // whatever moment it was last (re)computed. A "custom"-anchored window
  // needs no such refresh - its start time doesn't move on its own.
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    if (!isLiveZoom) return;
    const id = setInterval(() => forceRefresh((n) => n + 1), ZOOM_REFRESH_MS);
    return () => clearInterval(id);
  }, [isLiveZoom]);

  // The latest legal window start - exactly `hourWindow` hours before this
  // day's own end - shared by the custom-window clamp below and the
  // start-time stepper's own "already at the end" disabled state.
  const maxWindowStartMs = dayEnd - hourWindow * HOUR_MS;
  let windowStartMs: number;
  let windowEndMs: number;
  if (!zoomable) {
    windowStartMs = dayStart;
    windowEndMs = dayEnd;
  } else if (isLiveZoom) {
    windowStartMs = Math.max(dayStart, Date.now() - hourWindow * HOUR_MS);
    windowEndMs = Math.min(dayEnd, Date.now() + FUTURE_PAD_MS);
  } else {
    // Clamped so the window never starts before midnight or spills past it.
    windowStartMs = Math.min(Math.max(dayStart + customOffsetMs, dayStart), maxWindowStartMs);
    windowEndMs = windowStartMs + hourWindow * HOUR_MS;
  }

  const windowStartTimeValue = useMemo(() => {
    const totalMin = Math.round((windowStartMs - dayStart) / 60_000);
    const hh = Math.floor(totalMin / 60)
      .toString()
      .padStart(2, "0");
    const mm = (totalMin % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }, [windowStartMs, dayStart]);

  const stepWindowStart = useCallback(
    (deltaHours: number) => {
      const newOffset = Math.min(
        Math.max(windowStartMs - dayStart + deltaHours * HOUR_MS, 0),
        maxWindowStartMs - dayStart
      );
      setCustomOffsetMs(newOffset);
      setWindowAnchorMode("custom");
    },
    [windowStartMs, dayStart, maxWindowStartMs]
  );

  const handleWindowStartInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const [hh, mm] = e.target.value.split(":");
    const hours = Number(hh);
    const minutes = Number(mm);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return; // input mid-edit/cleared
    setCustomOffsetMs(hours * HOUR_MS + minutes * 60_000);
    setWindowAnchorMode("custom");
  }, []);

  const handleQuickStartClick = useCallback((offsetMs: number) => {
    setCustomOffsetMs(offsetMs);
    setWindowAnchorMode("custom");
  }, []);

  // Every QUICK_START_STEP_HOURS-aligned start time from midnight up to the
  // latest legal window start for the current `hourWindow` size (a 4h window
  // -> 12am/4am/8am/12pm/4pm/8pm; an 8h window stops at 4pm). Available on
  // any day, zoomed or not - empty (renders nothing) once unzoomed, since a
  // 24h window IS the day and has no separate start to offer presets for.
  const quickStartOptions = useMemo(() => {
    if (!zoomable) return [];
    const stepMs = QUICK_START_STEP_HOURS * HOUR_MS;
    const lastOffset = maxWindowStartMs - dayStart;
    const options: number[] = [];
    for (let offset = 0; offset <= lastOffset; offset += stepMs) {
      options.push(offset);
    }
    return options;
  }, [zoomable, maxWindowStartMs, dayStart]);

  const quickStartLabel = useCallback(
    (offsetMs: number) =>
      new Date(dayStart + offsetMs).toLocaleTimeString(getCurrentLocale(), { hour: "numeric" }),
    [dayStart]
  );

  // Whether the window ACTUALLY on screen right now starts after the real
  // current time - only possible on today's own view (a past/future day's
  // "now" comparison would be meaningless) - regardless of how that start
  // was picked (a quick-start preset, the stepper, or the typed input).
  const windowIsFuture = isToday && windowStartMs > Date.now();

  return {
    hourWindow,
    setHourWindow,
    zoomable,
    isToday,
    effectiveAnchorMode,
    setWindowAnchorMode,
    dayStart,
    windowStartMs,
    windowEndMs,
    maxWindowStartMs,
    windowStartTimeValue,
    stepWindowStart,
    handleWindowStartInputChange,
    handleQuickStartClick,
    quickStartOptions,
    quickStartLabel,
    windowIsFuture,
  };
}
