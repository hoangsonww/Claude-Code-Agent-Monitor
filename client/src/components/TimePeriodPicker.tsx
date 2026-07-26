/**
 * @file TimePeriodPicker.tsx
 * @description Page-level time-period filter control for the new
 * cross-project Focus Calendar board (`FocusCalendarBoard.tsx`) — visually
 * mirrors `FocusCalendarView`'s existing internal prev/today/next day-nav
 * row (reusing its `report.calendar.prevDay`/`today`/`nextDay` i18n keys, no
 * new keys needed for day mode), plus a "custom range" toggle exposing two
 * `<input type="date">` fields. Pure/controlled — no fetching, no knowledge
 * of `FocusReport` — mirroring `FocusCalendarView`'s own "no fetch" contract;
 * the board owns turning this value into `from`/`to` and re-fetching.
 *
 * Different responsibility from `FocusCalendarView`'s internal day-nav:
 * that one re-slices an already-fully-fetched report client-side; this one
 * is a data-window selector whose `onChange` drives a new server fetch. Kept
 * as two small, separate implementations per `technical-plan.md` §2, sharing
 * only the genuinely pure day-boundary helpers (`startOfDay`/`DAY_MS`) via
 * `calendarWindow.ts` — never a second, slightly-different "what is a day"
 * calculation.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAY_MS, startOfDay } from "../lib/calendarWindow";

export type TimePeriodValue =
  | { mode: "day"; date: Date }
  | { mode: "range"; start: Date; end: Date };

export interface TimePeriodPickerProps {
  value: TimePeriodValue;
  onChange: (next: TimePeriodValue) => void;
}

/** Formats a Date as the local `YYYY-MM-DD` string `<input type="date">`
 *  expects/emits — deliberately NOT `toISOString()` (which is UTC-based and
 *  can roll over to the adjacent day in a non-UTC timezone). */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses an `<input type="date">` value back into a local-midnight Date,
 *  via the one shared `startOfDay` — never a hand-derived literal. Returns
 *  `null` for empty/malformed input (e.g. the field cleared by the user)
 *  instead of silently substituting a fallback date: `Number("")` is `0`,
 *  not `NaN`, so a `??` guard would never catch a cleared field and would
 *  quietly emit `1900-01-01`. Callers must no-op (keep the last valid
 *  value) when this returns `null`. */
function parseDateInputValue(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return startOfDay(new Date(y, m - 1, d));
}

/** Independent, controlled time-period filter: day-by-day navigation
 *  (prev/today/next, default) or a custom date range. See file header. */
export function TimePeriodPicker({ value, onChange }: TimePeriodPickerProps) {
  const { t } = useTranslation("plan");

  if (value.mode === "range") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          {t("report.board.from")}
          <input
            type="date"
            value={toDateInputValue(value.start)}
            onChange={(e) => {
              const parsed = parseDateInputValue(e.target.value);
              if (!parsed) return; // empty/malformed: keep last valid value, no fallback date
              onChange({ mode: "range", start: parsed, end: value.end });
            }}
            className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs text-gray-200"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          {t("report.board.to")}
          <input
            type="date"
            value={toDateInputValue(value.end)}
            onChange={(e) => {
              const parsed = parseDateInputValue(e.target.value);
              if (!parsed) return; // empty/malformed: keep last valid value, no fallback date
              onChange({ mode: "range", start: value.start, end: parsed });
            }}
            className="bg-surface-2 border border-border rounded-md px-2 py-1 text-xs text-gray-200"
          />
        </label>
        <button
          type="button"
          // Switching back to day mode always defaults to today, never the
          // last-viewed range day (DEC-3's "today" default framing) - the
          // range being viewed is not a meaningful "single day" to resume.
          onClick={() => onChange({ mode: "day", date: startOfDay(new Date()) })}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md text-gray-400 hover:bg-surface-2 hover:text-gray-200 transition-colors"
        >
          {t("report.board.dayView")}
        </button>
      </div>
    );
  }

  const dayStart = value.date.getTime();
  const isToday = dayStart === startOfDay(new Date()).getTime();

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        type="button"
        onClick={() => onChange({ mode: "day", date: new Date(dayStart - DAY_MS) })}
        title={t("report.calendar.prevDay")}
        className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange({ mode: "day", date: startOfDay(new Date()) })}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
          isToday ? "bg-accent text-white" : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"
        }`}
      >
        {t("report.calendar.today")}
      </button>
      <button
        type="button"
        onClick={() => onChange({ mode: "day", date: new Date(dayStart + DAY_MS) })}
        title={t("report.calendar.nextDay")}
        className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-surface-2 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange({ mode: "range", start: value.date, end: value.date })}
        className="px-2.5 py-1 text-[11px] font-medium rounded-md text-gray-400 hover:bg-surface-2 hover:text-gray-200 transition-colors"
      >
        {t("report.board.customRange")}
      </button>
    </div>
  );
}
