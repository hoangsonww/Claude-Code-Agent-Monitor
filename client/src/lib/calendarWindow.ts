/**
 * @file calendarWindow.ts
 * @description The one shared "what is a day" implementation for this
 * project's focus-time calendar surfaces: a fixed millisecond-length day
 * (`DAY_MS`) and a pure local-midnight boundary function (`startOfDay`).
 * Extracted out of `FocusCalendarView.tsx` (its internal prev/today/next day
 * nav used to define these locally) so `TimePeriodPicker.tsx`'s page-level
 * time-period control and `FocusCalendarBoard.tsx`'s default time window can
 * import the exact same day-boundary math instead of each defining a second,
 * possibly-subtly-different one. Never redefine `startOfDay`/`DAY_MS` in any
 * other file — import them from here.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Fixed 24-hour day length, in milliseconds. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight for the given date (year/month/day preserved, time zeroed
 *  out) — the start-of-day boundary every day-nav/time-window control in
 *  this project must agree on. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
