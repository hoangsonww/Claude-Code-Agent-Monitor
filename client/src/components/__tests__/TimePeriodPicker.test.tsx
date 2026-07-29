/**
 * @file TimePeriodPicker.test.tsx
 * @description Unit tests for the page-level time-period filter control
 * (`client/src/components/TimePeriodPicker.tsx`, not yet built as of this
 * test's authoring — build task 12) — the board's own day-nav/custom-range
 * selector, visually mirroring FocusCalendarView's internal prev/today/next
 * row but triggering a server fetch rather than re-slicing already-fetched
 * data. Pure/controlled: `value`/`onChange` only, no fetching. Also covers
 * day mode's jump-to-date affordance: the clickable weekday/date label's
 * hidden native date input emits the picked day directly (staying in day
 * mode), and a cleared/malformed value no-ops instead of emitting garbage.
 *
 * Expected values are always derived through `calendarWindow.ts`'s shared
 * `startOfDay`/`DAY_MS` (build task 6), never a hand-derived literal — this
 * is the guardrail against a second, slightly-different "what is a day"
 * calculation living in this component (`DERIVED-DUAL-VIEW`, per
 * technical-plan.md §5).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// Neither of these exist yet as of this test's authoring (build tasks 6/12) -
// the import itself fails to resolve, which is this file's expected RED
// reason before those tasks land. See red-evidence.md.
import { TimePeriodPicker } from "../TimePeriodPicker";
import { startOfDay, DAY_MS } from "../../lib/calendarWindow";

type TimePeriodValue = { mode: "day"; date: Date } | { mode: "range"; start: Date; end: Date };

function renderPicker(value: TimePeriodValue, onChange = vi.fn()) {
  render(<TimePeriodPicker value={value} onChange={onChange} />);
  return { onChange };
}

describe("TimePeriodPicker", () => {
  it("day mode default highlights Today", () => {
    renderPicker({ mode: "day", date: startOfDay(new Date()) });
    const todayButton = screen.getByText("Today");
    expect(todayButton.className).toMatch(/bg-accent/);
  });

  it("prev emits the adjacent (previous) day, computed via calendarWindow.ts's DAY_MS, not a hand-derived literal", () => {
    const date = startOfDay(new Date("2026-03-10T00:00:00.000Z"));
    const { onChange } = renderPicker({ mode: "day", date });

    fireEvent.click(screen.getByTitle("Previous day"));

    expect(onChange).toHaveBeenCalledWith({
      mode: "day",
      date: new Date(date.getTime() - DAY_MS),
    });
  });

  it("next emits the adjacent (next) day, computed via calendarWindow.ts's DAY_MS", () => {
    const date = startOfDay(new Date("2026-03-10T00:00:00.000Z"));
    const { onChange } = renderPicker({ mode: "day", date });

    fireEvent.click(screen.getByTitle("Next day"));

    expect(onChange).toHaveBeenCalledWith({
      mode: "day",
      date: new Date(date.getTime() + DAY_MS),
    });
  });

  it("Today always resolves to startOfDay(new Date()), regardless of the currently-viewed date — not a no-op, not the last-viewed date", () => {
    vi.useFakeTimers();
    try {
      const NOW = new Date("2026-05-01T12:34:56.000Z");
      vi.setSystemTime(NOW);
      const farAwayDate = startOfDay(new Date("2020-01-01T00:00:00.000Z"));
      const { onChange } = renderPicker({ mode: "day", date: farAwayDate });

      fireEvent.click(screen.getByText("Today"));

      expect(onChange).toHaveBeenCalledWith({ mode: "day", date: startOfDay(new Date()) });
      expect(onChange).not.toHaveBeenCalledWith({ mode: "day", date: farAwayDate });
    } finally {
      vi.useRealTimers();
    }
  });

  it("jump-to-date: picking a date via day mode's label input emits that day directly, staying in day mode", () => {
    const date = startOfDay(new Date(2026, 2, 10)); // 2026-03-10 local
    const { onChange } = renderPicker({ mode: "day", date });

    // The clickable label hosts an invisible native date input; changing it
    // (what the native calendar popup does) jumps straight to that day.
    const jumpInput = screen
      .getByTitle("Jump to a date")
      .parentElement!.querySelector('input[type="date"]') as HTMLInputElement;
    expect(jumpInput.value).toBe("2026-03-10"); // prefilled with the current day

    fireEvent.change(jumpInput, { target: { value: "2026-01-05" } });
    expect(onChange).toHaveBeenCalledWith({
      mode: "day",
      date: startOfDay(new Date(2026, 0, 5)),
    });
  });

  it("jump-to-date: a cleared/malformed date input is a no-op, never a garbage date", () => {
    const date = startOfDay(new Date(2026, 2, 10));
    const { onChange } = renderPicker({ mode: "day", date });

    const jumpInput = screen
      .getByTitle("Jump to a date")
      .parentElement!.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(jumpInput, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("switching to range mode emits {mode:'range', start, end}", () => {
    const { onChange } = renderPicker({ mode: "day", date: startOfDay(new Date()) });

    fireEvent.click(screen.getByText("Custom range"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const call = onChange.mock.calls[0]![0] as TimePeriodValue;
    expect(call.mode).toBe("range");
    if (call.mode === "range") {
      expect(call.start instanceof Date).toBe(true);
      expect(call.end instanceof Date).toBe(true);
    }
  });

  it("firing real change events on both the start and end date inputs in range mode emits a {mode:'range', start, end} value covering the full selected range (T7)", () => {
    const initialStart = startOfDay(new Date(2026, 2, 5)); // 2026-03-05, local
    const initialEnd = startOfDay(new Date(2026, 2, 10)); // 2026-03-10, local
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePeriodPicker
        value={{ mode: "range", start: initialStart, end: initialEnd }}
        onChange={onChange}
      />
    );

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-03-01" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const afterStartChange = onChange.mock.calls[0]![0] as TimePeriodValue;
    expect(afterStartChange.mode).toBe("range");
    if (afterStartChange.mode !== "range") throw new Error("expected range value");
    expect(afterStartChange.start).toEqual(startOfDay(new Date(2026, 2, 1)));
    // Editing the start field alone must leave the end date untouched.
    expect(afterStartChange.end).toEqual(initialEnd);

    // Apply the emitted value back down as props - the real controlled-component
    // flow the board (FocusCalendarBoard) actually uses - then edit the end date.
    rerender(<TimePeriodPicker value={afterStartChange} onChange={onChange} />);

    const toInput = screen.getByLabelText("To") as HTMLInputElement;
    fireEvent.change(toInput, { target: { value: "2026-03-15" } });

    expect(onChange).toHaveBeenCalledTimes(2);
    const afterEndChange = onChange.mock.calls[1]![0] as TimePeriodValue;
    expect(afterEndChange.mode).toBe("range");
    if (afterEndChange.mode !== "range") throw new Error("expected range value");
    // The FINAL emitted value must cover the FULL selected range: the new
    // start from the first edit AND the new end from the second edit - not
    // just whichever field was edited most recently.
    expect(afterEndChange.start).toEqual(startOfDay(new Date(2026, 2, 1)));
    expect(afterEndChange.end).toEqual(startOfDay(new Date(2026, 2, 15)));
  });

  it("clearing the start date input to an empty string does not silently emit a garbage fallback date such as 1900-01-01 (parseDateInputValue nullish-coalescing bug: Number('') is 0, not NaN, so the ?? fallbacks never fire)", () => {
    const start = startOfDay(new Date(2026, 2, 5)); // 2026-03-05
    const end = startOfDay(new Date(2026, 2, 10)); // 2026-03-10
    const onChange = vi.fn();
    render(<TimePeriodPicker value={{ mode: "range", start, end }} onChange={onChange} />);

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    // Simulates the user clearing the date field (e.g. selecting all + Delete),
    // which fires a `change` event with `raw === ""`.
    fireEvent.change(fromInput, { target: { value: "" } });

    // The component must not silently accept the cleared field as if it were
    // a real date. Whether it chooses to ignore the edit entirely (no
    // onChange call) or handle it some other explicit way, it must never
    // propagate a nonsensical century-off date like 1900-01-01 as though the
    // user had actually selected it.
    const emittedGarbageDate = onChange.mock.calls.some((call) => {
      const next = call[0] as TimePeriodValue;
      if (next.mode !== "range") return false;
      return next.start.getFullYear() < 2000;
    });
    expect(emittedGarbageDate).toBe(false);
  });

  it("switching back to day mode from range mode defaults to today, not the last-viewed range day (DEC-3 'today' default regression guard)", () => {
    vi.useFakeTimers();
    try {
      const NOW = new Date("2026-05-01T12:34:56.000Z");
      vi.setSystemTime(NOW);
      const rangeStart = startOfDay(new Date("2020-06-01T00:00:00.000Z"));
      const rangeEnd = startOfDay(new Date("2020-06-05T00:00:00.000Z"));
      const { onChange } = renderPicker({ mode: "range", start: rangeStart, end: rangeEnd });

      fireEvent.click(screen.getByText("Single day"));

      expect(onChange).toHaveBeenCalledWith({ mode: "day", date: startOfDay(new Date()) });
      expect(onChange).not.toHaveBeenCalledWith({ mode: "day", date: rangeStart });
      expect(onChange).not.toHaveBeenCalledWith({ mode: "day", date: rangeEnd });
    } finally {
      vi.useRealTimers();
    }
  });
});
