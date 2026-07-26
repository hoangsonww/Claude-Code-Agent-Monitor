/**
 * @file FocusCalendarView.test.tsx
 * @description Tests for the swimlane day-view calendar: overlapping
 * segments split into separate lanes while non-overlapping ones share a
 * lane, dashed border for inferred vs. solid for declared, the live pulse
 * only applying to a still-running session's open segment, Prev/Today/Next
 * date navigation, and the empty-day state. Uses fake timers so "today" is
 * deterministic regardless of when the suite actually runs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusCalendarView } from "../FocusCalendarView";
import type { FocusReport, FocusReportSessionEntry } from "../../lib/types";

const NOW = new Date("2026-03-05T15:00:00.000Z");

/** ISO timestamp for `hour:minute` on the fake "today", constructed via
 *  LOCAL Date methods so it lines up with the component's own local-day
 *  math regardless of which timezone the test runner is in. */
function todayAt(hour: number, minute = 0): string {
  const d = new Date(NOW);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function yesterdayAt(hour: number, minute = 0): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function makeReport(sessions: FocusReportSessionEntry[]): FocusReport {
  return {
    project_id: "proj-1",
    sessions,
    items: [],
    totals: {
      wall_ms: 0,
      active_ms: 0,
      idle_ms: 0,
      by_kind: {
        item: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
      },
    },
    idle_grace_seconds: 300,
    wall_clock_ms: 0,
    concurrency_ratio: null,
  };
}

function renderCalendar(report: FocusReport) {
  return render(
    <MemoryRouter>
      <FocusCalendarView report={report} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FocusCalendarView", () => {
  it("shows the empty state when nothing falls on the selected day", () => {
    renderCalendar(makeReport([]));
    expect(screen.getByText("No activity on this day")).toBeInTheDocument();
  });

  it("renders a block for a segment on today's date", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Worker",
        cwd: "/repo",
        ended_at: todayAt(11),
        segments: [
          {
            kind: "item",
            item_number: 6,
            label: "MCP Reliability",
            start: todayAt(9),
            end: todayAt(11),
            wall_ms: 2 * 60 * 60_000,
            active_ms: 2 * 60 * 60_000,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);
    expect(screen.queryByText("No activity on this day")).not.toBeInTheDocument();
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByText("Item 6: MCP Reliability")).toBeInTheDocument();
  });

  it("puts overlapping sessions in separate lanes and non-overlapping ones in the same lane", () => {
    const report = makeReport([
      {
        session_id: "sess-a",
        name: "A",
        cwd: "/repo",
        ended_at: todayAt(11),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Item A",
            start: todayAt(9),
            end: todayAt(11),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
      {
        // Overlaps A (10:00-12:00 vs A's 09:00-11:00) -> needs its own lane.
        session_id: "sess-b",
        name: "B",
        cwd: "/repo",
        ended_at: todayAt(12),
        segments: [
          {
            kind: "detour",
            item_number: null,
            label: "Detour B",
            start: todayAt(10),
            end: todayAt(12),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
      {
        // Starts after A ends -> can safely reuse A's lane.
        session_id: "sess-c",
        name: "C",
        cwd: "/repo",
        ended_at: todayAt(14),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Item A",
            start: todayAt(13),
            end: todayAt(14),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    const blockA = screen.getByText("A").closest("a") as HTMLAnchorElement;
    const blockB = screen.getByText("B").closest("a") as HTMLAnchorElement;
    const blockC = screen.getByText("C").closest("a") as HTMLAnchorElement;

    // A and C share a lane (same computed `left`); B, which overlaps A,
    // must sit in a visually distinct lane (different `left`).
    expect(blockA.style.left).toBe(blockC.style.left);
    expect(blockA.style.left).not.toBe(blockB.style.left);
  });

  it("marks an inferred segment's block with a dashed border and a declared one without", () => {
    const report = makeReport([
      {
        session_id: "sess-inferred",
        name: "Silent",
        cwd: "/repo",
        ended_at: todayAt(10),
        segments: [
          {
            kind: "item",
            item_number: 2,
            label: "Inferred item",
            start: todayAt(9),
            end: todayAt(10),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: true,
            inferred_reason: "matched keywords",
          },
        ],
      },
      {
        session_id: "sess-declared",
        name: "Loud",
        cwd: "/repo",
        ended_at: todayAt(13),
        segments: [
          {
            kind: "item",
            item_number: 3,
            label: "Declared item",
            start: todayAt(12),
            end: todayAt(13),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    // Inferred blocks get an "≈ " prefix on the session name (mirrors the
    // list view's provenance convention), so the full rendered text differs.
    const inferredBlock = screen.getByText("≈ Silent").closest("a") as HTMLAnchorElement;
    const declaredBlock = screen.getByText("Loud").closest("a") as HTMLAnchorElement;
    expect(inferredBlock.className).toMatch(/border-dashed/);
    expect(declaredBlock.className).not.toMatch(/border-dashed/);
  });

  it("gives the open segment of a still-running session the live pulse, not a finished one", () => {
    const report = makeReport([
      {
        session_id: "sess-live",
        name: "Still going",
        cwd: "/repo",
        ended_at: null, // still active
        segments: [
          {
            kind: "item",
            item_number: 6,
            label: "MCP Reliability",
            start: todayAt(13),
            end: todayAt(15), // clipped to "now" (15:00) by the component
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
      {
        session_id: "sess-finished",
        name: "Wrapped up",
        cwd: "/repo",
        ended_at: todayAt(9),
        segments: [
          {
            kind: "item",
            item_number: 4,
            label: "Cost Tracking",
            start: todayAt(8),
            end: todayAt(9),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    const liveBlock = screen.getByText("Still going").closest("a") as HTMLAnchorElement;
    const finishedBlock = screen.getByText("Wrapped up").closest("a") as HTMLAnchorElement;
    expect(liveBlock.className).toMatch(/animate-pulse-slow/);
    expect(finishedBlock.className).not.toMatch(/animate-pulse-slow/);
  });

  it("navigates to the previous day and finds a session that only happened then", () => {
    const report = makeReport([
      {
        session_id: "sess-yesterday",
        name: "Yesterday's work",
        cwd: "/repo",
        ended_at: yesterdayAt(11),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Old item",
            start: yesterdayAt(9),
            end: yesterdayAt(11),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    expect(screen.getByText("No activity on this day")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Previous day"));
    expect(screen.queryByText("No activity on this day")).not.toBeInTheDocument();
    expect(screen.getByText("Yesterday's work")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Today"));
    expect(screen.getByText("No activity on this day")).toBeInTheDocument();
  });
});
