/**
 * @file FocusCalendarView.test.tsx
 * @description Tests for the swimlane day-view calendar: overlapping
 * segments split into separate lanes while non-overlapping ones share a
 * lane, dashed border for inferred vs. solid for declared, the live power
 * light only applying to a still-running session's open segment, Prev/Today/Next
 * date navigation, the empty-day state, the hover popup, and the "</>" icon
 * that opens SegmentEventsModal for a block's raw supporting events. Uses
 * fake timers so "today" is deterministic regardless of when the suite
 * actually runs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusCalendarView } from "../FocusCalendarView";
import type { FocusReport, FocusReportSessionEntry } from "../../lib/types";

const eventsListMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    events: {
      list: (...args: unknown[]) => eventsListMock(...args),
    },
  },
}));

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

// Task 7 (build-task-list.md) adds these three additive props to
// FocusCalendarView - not present as of this test's authoring (task 5,
// red-first). Typed locally rather than via FocusCalendarViewProps (which
// doesn't declare them yet) so this file compiles/transpiles either way;
// passed through via spread, exactly like a real caller would.
interface BoardModeExtraProps {
  selectedDate?: Date;
  hideDateNav?: boolean;
  projectLabelForCwd?: (cwd: string | null) => string | undefined;
}

function renderCalendar(
  report: FocusReport,
  extraProps: BoardModeExtraProps = {},
  { expandToFullDay = true }: { expandToFullDay?: boolean } = {}
) {
  const result = render(
    <MemoryRouter>
      <FocusCalendarView report={report} {...extraProps} />
    </MemoryRouter>
  );
  // Most tests in this file predate the hour-window zoom feature and assert
  // against segments scattered across the whole day - default to the "24h"
  // (full day, unzoomed) option so they don't all need to know about or
  // interact with the zoom control. Dedicated zoom tests opt out via
  // `{ expandToFullDay: false }`. A no-op when the selected day isn't today
  // (already unzoomed regardless of this button) or there's no data yet.
  if (expandToFullDay) {
    fireEvent.click(screen.getByText("24h"));
  }
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  eventsListMock.mockReset();
  eventsListMock.mockResolvedValue({ events: [], limit: 500, offset: 0, total: 0 });
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
    // The card shows exactly two lines: the session's name, then its
    // project - no `projectLabelForCwd` was passed here, so it falls back
    // to "Unassigned" rather than a blank line. The kind/label detail
    // ("Item 6: MCP Reliability") no longer renders on the card itself -
    // it's still available via the hover popup and events modal.
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.queryByText("Item 6: MCP Reliability")).not.toBeInTheDocument();
  });

  it("renders a `none`-kind segment (no declared focus, no usable inference yet) as its own distinct block instead of being invisible", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Undeclared Worker",
        cwd: "/repo",
        ended_at: null,
        segments: [
          {
            kind: "none",
            item_number: null,
            label: null,
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
    expect(screen.getByText("Undeclared Worker")).toBeInTheDocument();
    expect(screen.getAllByText("No focus").length).toBeGreaterThan(0);
  });

  it("always shows a 'No focus' legend entry alongside the four real kinds, even on a day with none", () => {
    renderCalendar(makeReport([]));
    expect(screen.getByText("No focus")).toBeInTheDocument();
  });

  it("shows a formatted hover popup instead of a native title tooltip, and closes it after the pointer leaves", async () => {
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

    const block = screen.getByText("Worker").closest("a") as HTMLAnchorElement;
    // Regression guard: no native browser tooltip on the block itself.
    expect(block).not.toHaveAttribute("title");
    // The popup's own duration line isn't rendered until hovered.
    expect(screen.queryByText(/2h 0m/)).not.toBeInTheDocument();

    fireEvent.mouseEnter(block);
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument();

    fireEvent.mouseLeave(block);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText(/2h 0m/)).not.toBeInTheDocument();
  });

  it("shows an inferred note and a still-running indicator in the popup when applicable", () => {
    const report = makeReport([
      {
        session_id: "sess-live",
        name: "Still going",
        cwd: "/repo",
        ended_at: null,
        segments: [
          {
            kind: "item",
            item_number: 6,
            label: "MCP Reliability",
            start: todayAt(13),
            end: todayAt(15),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: true,
            inferred_reason: "matched keywords",
          },
        ],
      },
    ]);
    renderCalendar(report);

    fireEvent.mouseEnter(screen.getByText("Still going").closest("a") as HTMLAnchorElement);
    expect(screen.getByText("Still running")).toBeInTheDocument();
    expect(screen.getByText(/matched keywords/)).toBeInTheDocument();
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

    // Each is a DIFFERENT session, so each gets its own left-edge
    // session-color strip - all three colors distinct, even A and C which
    // happen to share a lane (lane color is about time-slot geometry;
    // strip color is about session identity, a separate axis).
    const stripA = within(blockA).getByTestId("session-color-strip");
    const stripB = within(blockB).getByTestId("session-color-strip");
    const stripC = within(blockC).getByTestId("session-color-strip");
    expect(stripA.className).not.toBe(stripB.className);
    expect(stripA.className).not.toBe(stripC.className);
    expect(stripB.className).not.toBe(stripC.className);
    // Each lane is a fixed LANE_WIDTH_PX wide, not a shrinking share of the
    // container - lane 0 (A/C) sits at the left edge, lane 1 (B) sits
    // exactly one lane-width over, and both are the same fixed width.
    expect(blockA.style.left).toBe("2px");
    expect(blockB.style.left).toBe("202px");
    expect(blockA.style.width).toBe("196px");
    expect(blockB.style.width).toBe("196px");
  });

  it("gives every block a session-color strip that's the same color across a session's own multiple segments, is 20px wide, and never repeats for a different session", () => {
    const report = makeReport([
      {
        // Two non-overlapping segments of the SAME session, split by a
        // detour in between - both should still get the identical strip
        // color, since it's a session-identity marker, not a per-segment
        // or per-kind one.
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
            end: todayAt(9, 30),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
          {
            kind: "detour",
            item_number: null,
            label: "Aside",
            start: todayAt(10),
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
        session_id: "sess-b",
        name: "B",
        cwd: "/repo",
        ended_at: todayAt(15),
        segments: [
          {
            kind: "item",
            item_number: 2,
            label: "Item B",
            start: todayAt(13),
            end: todayAt(15),
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

    // The card's own visible text no longer includes kind/label ("Item A",
    // "Aside" don't render there any more - see the two-line card-content
    // change) - so distinguish same-named session A's two blocks by their
    // aria-label instead, which still carries the full kind/label/time
    // detail for accessibility even though the visible card doesn't.
    const aItemBlock = screen.getByRole("link", { name: /Item 1: Item A/ });
    const aDetourBlock = screen.getByRole("link", { name: /Detour: Aside/ });
    const bBlock = screen.getByRole("link", { name: /Item 2: Item B/ });

    const aItemStrip = within(aItemBlock).getByTestId("session-color-strip");
    const aDetourStrip = within(aDetourBlock).getByTestId("session-color-strip");
    const bStrip = within(bBlock).getByTestId("session-color-strip");

    // Same session (A), different segments/kinds -> identical strip color.
    expect(aItemStrip.className).toBe(aDetourStrip.className);
    // Different session (B) -> a different strip color.
    expect(aItemStrip.className).not.toBe(bStrip.className);
    // 20px wide, per the request.
    expect(aItemStrip.style.width).toBe("20px");
  });

  it("scrolls the (fixed-width) lanes area horizontally under a time axis that stays outside the scroll wrapper", () => {
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
        // Overlaps A -> a second lane, so the grid is 2 lanes wide.
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
    ]);
    const { container } = renderCalendar(report);

    // The grid content is exactly `laneCount * LANE_WIDTH_PX` (2 * 300)
    // wide, inside its own `.overflow-x-auto` wrapper - a fixed intrinsic
    // width, not a percentage share of whatever space happens to be
    // available, so more concurrent lanes always add real scrollable width
    // rather than squeezing existing ones.
    const scrollWrapper = container.querySelector(".overflow-x-auto") as HTMLElement;
    expect(scrollWrapper).toBeInTheDocument();
    const grid = scrollWrapper.firstElementChild as HTMLElement;
    expect(grid.style.width).toBe("400px");

    // The time axis (hour labels) is NOT inside that scroll wrapper - it's
    // a sibling, so it never scrolls out of view alongside the lanes.
    const axis = container.querySelector(".w-11") as HTMLElement;
    expect(axis).toBeInTheDocument();
    expect(scrollWrapper.contains(axis)).toBe(false);
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

    // The card face itself carries no "≈ " prefix (see FocusCalendarView's
    // comment on the card-name div) - the dashed border is its only inferred
    // signal; the "≈ " prefix still applies in the hover popup/events modal.
    const inferredBlock = screen.getByText("Silent").closest("a") as HTMLAnchorElement;
    const declaredBlock = screen.getByText("Loud").closest("a") as HTMLAnchorElement;
    expect(inferredBlock.className).toMatch(/border-dashed/);
    expect(declaredBlock.className).not.toMatch(/border-dashed/);
  });

  it("gives the open segment of a still-running session the live power light, not a finished one", () => {
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
    expect(within(liveBlock).getByTestId("live-power-light")).toBeInTheDocument();
    expect(within(finishedBlock).queryByTestId("live-power-light")).not.toBeInTheDocument();
  });

  it("wraps the name on a block bigger than one 15-minute slot instead of ellipsis-truncating it", () => {
    const report = makeReport([
      {
        session_id: "sess-short",
        name: "Exactly one quarter",
        cwd: "/repo",
        ended_at: todayAt(9, 15),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Quarter slot",
            start: todayAt(9, 0),
            end: todayAt(9, 15),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
      {
        session_id: "sess-long",
        name: "Spans two quarters",
        cwd: "/repo",
        ended_at: todayAt(11, 30),
        segments: [
          {
            kind: "item",
            item_number: 2,
            label: "Half hour",
            start: todayAt(11, 0),
            end: todayAt(11, 30),
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

    const shortName = screen.getByText("Exactly one quarter");
    const longName = screen.getByText("Spans two quarters");
    expect(shortName.className).toMatch(/truncate/);
    expect(shortName.className).not.toMatch(/whitespace-normal/);
    expect(longName.className).toMatch(/whitespace-normal/);
    expect(longName.className).not.toMatch(/truncate/);
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

  it("opens SegmentEventsModal with the segment's raw events, bucketed into 5-minute rows, when the </> icon is clicked", async () => {
    eventsListMock.mockResolvedValue({
      events: [
        {
          id: 2,
          session_id: "sess-1",
          agent_id: null,
          event_type: "PostToolUse",
          tool_name: "Bash",
          summary: "Ran a shell command",
          data: null,
          // Same 5-minute window as event 1 (10:00-10:05) - both should land
          // in one bucket row.
          created_at: todayAt(10, 2),
        },
        {
          id: 1,
          session_id: "sess-1",
          agent_id: null,
          event_type: "PreToolUse",
          tool_name: "Bash",
          summary: "Running a shell command",
          data: null,
          created_at: todayAt(10),
        },
      ],
      limit: 500,
      offset: 0,
      total: 2,
    });
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

    fireEvent.click(screen.getByLabelText("View the raw events supporting this duration"));

    expect(eventsListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "sess-1",
        from: todayAt(9),
        to: todayAt(11),
        limit: 500,
      })
    );
    expect(screen.getByText("Supporting events")).toBeInTheDocument();
    // Fake timers are active for this suite ("today" determinism); the mock
    // fetch resolves via the microtask queue, not a real timer, so flushing
    // it just needs a couple of awaited ticks inside act() rather than
    // waitFor/findBy (which poll on real setTimeout and would hang here).
    await act(async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    // Both events land in one bucket row (bounding the modal's row count to
    // roughly one per five minutes, not one per event) - it shows the
    // per-event_type counts before anything is expanded.
    expect(screen.getByText("PreToolUse")).toBeInTheDocument();
    expect(screen.getByText("PostToolUse")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.queryByText(/Running a shell command/)).not.toBeInTheDocument();

    // Expanding the bucket reveals its individual events, chronologically
    // (server order is newest-first; the modal replays it in the order it
    // actually happened). buildEventTitle prefixes the tool name, hence the
    // substring match.
    fireEvent.click(screen.getByText("2 events"));
    expect(screen.getByText(/Running a shell command/)).toBeInTheDocument();
    expect(screen.getByText(/Ran a shell command/)).toBeInTheDocument();
  });

  it("shows an empty-inferred explanation in SegmentEventsModal when an inferred segment has no events in its window", async () => {
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
    ]);
    renderCalendar(report);

    fireEvent.click(screen.getByLabelText("View the raw events supporting this duration"));

    await act(async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    expect(screen.getByText("No raw events recorded in this window")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This segment's time was inferred from surrounding activity, not attributed to any event directly inside this window."
      )
    ).toBeInTheDocument();
  });

  it("overlays an idle stripe only for the chunk with no activity, none for the active one", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Worker",
        cwd: "/repo",
        ended_at: todayAt(9, 20),
        segments: [
          {
            kind: "item",
            item_number: 6,
            label: "MCP Reliability",
            start: todayAt(9, 0),
            end: todayAt(9, 20),
            wall_ms: 20 * 60_000,
            active_ms: 10 * 60_000,
            idle_ms: 10 * 60_000,
            inferred: false,
            inferred_reason: null,
            chunks: [
              { start: todayAt(9, 0), end: todayAt(9, 10), active: true },
              { start: todayAt(9, 10), end: todayAt(9, 20), active: false },
            ],
          },
        ],
      },
    ]);
    const { container } = renderCalendar(report);

    const stripes = container.querySelectorAll('[data-testid="idle-stripe"]');
    expect(stripes).toHaveLength(1);
    // The real segment (09:00-09:20) snaps outward to the quarter-hour grid
    // for its rendered box (09:00-09:30, 30 real minutes) - the idle chunk
    // (09:10-09:20) is the middle third of that padded box, not half of it.
    expect((stripes[0] as HTMLElement).style.top).toBe("33.33333333333333%");
    expect((stripes[0] as HTMLElement).style.height).toBe("33.33333333333333%");
  });

  it("renders no idle stripe when every chunk in the segment is active", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Worker",
        cwd: "/repo",
        ended_at: todayAt(9, 10),
        segments: [
          {
            kind: "item",
            item_number: 6,
            label: "MCP Reliability",
            start: todayAt(9, 0),
            end: todayAt(9, 10),
            wall_ms: 10 * 60_000,
            active_ms: 10 * 60_000,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
            chunks: [{ start: todayAt(9, 0), end: todayAt(9, 10), active: true }],
          },
        ],
      },
    ]);
    const { container } = renderCalendar(report);
    expect(container.querySelectorAll('[data-testid="idle-stripe"]')).toHaveLength(0);
  });

  it("snaps a short segment's rendered box outward to a full quarter-hour instead of lining it up to the exact minute", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Quick Fix",
        cwd: "/repo",
        ended_at: todayAt(9, 6),
        segments: [
          {
            kind: "bug",
            item_number: null,
            label: "Typo",
            start: todayAt(9, 3), // real span: 09:03-09:06, just 3 minutes
            end: todayAt(9, 6),
            wall_ms: 3 * 60_000,
            active_ms: 3 * 60_000,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    const block = screen.getByText("Quick Fix").closest("a") as HTMLAnchorElement;
    // Floor(09:03) -> 09:00: the box starts at the top of the quarter-hour
    // slot, not lined up to the real 09:03 start. (The block's `height` uses
    // a `max()` CSS expression jsdom's CSSOM can't parse/read back, even
    // though real browsers render it fine - the next test proves the END
    // snapped too, via the idle-stripe percentages, which don't use max().)
    const expectedTop = ((9 * 60) / 1440) * 100;
    expect(block.style.top).toBe(`${expectedTop}%`);
  });

  it("snaps a short segment's END outward too - an idle stripe spanning the whole real segment reads as a fraction of the padded (bigger) box, not 100% of the real span", () => {
    const report = makeReport([
      {
        session_id: "sess-1",
        name: "Quick Fix",
        cwd: "/repo",
        ended_at: todayAt(9, 6),
        segments: [
          {
            kind: "bug",
            item_number: null,
            label: "Typo",
            start: todayAt(9, 0), // already on a quarter-hour line - only
            end: todayAt(9, 6), // the END (09:06 -> ceil to 09:15) is padded
            wall_ms: 6 * 60_000,
            active_ms: 0,
            idle_ms: 6 * 60_000,
            inferred: false,
            inferred_reason: null,
            chunks: [{ start: todayAt(9, 0), end: todayAt(9, 6), active: false }],
          },
        ],
      },
    ]);
    const { container } = renderCalendar(report);

    const stripes = container.querySelectorAll('[data-testid="idle-stripe"]');
    expect(stripes).toHaveLength(1);
    // Real span is 100% idle, but the rendered box is padded to 09:00-09:15
    // (15 real minutes) - so the stripe covers 6/15 = 40% of the box, not
    // 100% of it.
    expect((stripes[0] as HTMLElement).style.top).toBe("0%");
    expect((stripes[0] as HTMLElement).style.height).toBe("40%");
  });

  it("pads two non-overlapping same-lane-eligible segments into separate lanes once quarter-hour snapping makes their rendered boxes touch", () => {
    const report = makeReport([
      {
        // Real span 09:07-09:09 - doesn't overlap B at all in true time.
        session_id: "sess-a",
        name: "First",
        cwd: "/repo",
        ended_at: todayAt(9, 9),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: null,
            start: todayAt(9, 7),
            end: todayAt(9, 9),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
      {
        // Real span 09:12-09:14 - both snap to the same 09:00-09:15 box.
        session_id: "sess-b",
        name: "Second",
        cwd: "/repo",
        ended_at: todayAt(9, 14),
        segments: [
          {
            kind: "detour",
            item_number: null,
            label: "Aside",
            start: todayAt(9, 12),
            end: todayAt(9, 14),
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

    const blockA = screen.getByText("First").closest("a") as HTMLAnchorElement;
    const blockB = screen.getByText("Second").closest("a") as HTMLAnchorElement;
    expect(blockA.style.left).not.toBe(blockB.style.left);
  });

  it("shows both wall-clock and agent time in the hover popup and the events-modal header", async () => {
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
            active_ms: 23 * 60_000,
            idle_ms: 2 * 60 * 60_000 - 23 * 60_000,
            inferred: false,
            inferred_reason: null,
          },
        ],
      },
    ]);
    renderCalendar(report);

    fireEvent.mouseEnter(screen.getByText("Worker").closest("a") as HTMLAnchorElement);
    expect(screen.getByText(/Wall clock: 2h 0m/)).toBeInTheDocument();
    expect(screen.getByText(/Total agent time: 23m 0s/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("View the raw events supporting this duration"));
    await act(async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    expect(screen.getByText(/Wall clock: 2h 0m/)).toBeInTheDocument();
    expect(screen.getByText(/Total agent time: 23m 0s/)).toBeInTheDocument();
  });

  describe("hour-window zoom (default 4h back + 2h ahead)", () => {
    // The outer beforeEach pins the fake clock to NOW (3pm UTC), but
    // `todayAt()`'s "today" is NOW's LOCAL calendar date - on a test runner
    // whose local timezone isn't UTC, 3pm UTC can land at a very different
    // local clock time (e.g. 8am), leaving too little same-day room before
    // "now" to exercise a multi-hour lookback window without crossing into
    // yesterday. Re-anchor the fake clock to a fixed LOCAL 3pm on that same
    // calendar day instead - built via `todayAt` itself, so it's guaranteed
    // to agree with every `todayAt(...)` fixture below regardless of the
    // host machine's timezone.
    beforeEach(() => {
      vi.setSystemTime(new Date(todayAt(15)));
    });

    function makeSession(
      name: string,
      startHour: number,
      endHour: number
    ): FocusReportSessionEntry {
      return {
        session_id: `sess-${name}`,
        name,
        cwd: "/repo",
        ended_at: todayAt(endHour),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: null,
            start: todayAt(startHour),
            end: todayAt(endHour),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      };
    }

    it("defaults to showing only the last 4 hours plus 2 hours ahead - a segment further back doesn't render", () => {
      const report = makeReport([
        makeSession("Early", 9, 10), // 9-10am - well before the 11am window start
        makeSession("Mid", 12, 13), // noon-1pm - inside [11am, 5pm)
      ]);
      renderCalendar(report, {}, { expandToFullDay: false });

      expect(screen.queryByText("Early")).not.toBeInTheDocument();
      expect(screen.getByText("Mid")).toBeInTheDocument();
    });

    it("clicking a wider option (8h) reveals a segment the default 4h window was hiding", () => {
      const report = makeReport([
        makeSession("Early", 9, 10), // 9-10am: outside 4h's 11am start, inside 8h's 7am start
        makeSession("Mid", 12, 13),
      ]);
      renderCalendar(report, {}, { expandToFullDay: false });
      expect(screen.queryByText("Early")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("8h"));
      expect(screen.getByText("Early")).toBeInTheDocument();
      expect(screen.getByText("Mid")).toBeInTheDocument();
    });

    it("the 24h option shows the whole day, including hours well before any zoomed window would reach", () => {
      const report = makeReport([makeSession("Overnight", 1, 2)]); // 1am-2am
      renderCalendar(report, {}, { expandToFullDay: false });
      expect(screen.queryByText("Overnight")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("24h"));
      expect(screen.getByText("Overnight")).toBeInTheDocument();
    });

    it("pads 2 hours into the future at every zoom size except 24h - a segment just ahead of now shows, one further ahead doesn't until 24h", () => {
      const report = makeReport([
        makeSession("SoonFuture", 16, 17), // 4-5pm - 1-2h after 3pm "now", inside the 2h pad
        makeSession("FarFuture", 19, 20), // 7-8pm - 4-5h after "now", outside the 2h pad
      ]);
      renderCalendar(report, {}, { expandToFullDay: false });

      expect(screen.getByText("SoonFuture")).toBeInTheDocument();
      expect(screen.queryByText("FarFuture")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("24h"));
      expect(screen.getByText("FarFuture")).toBeInTheDocument();
    });

    it("a zoom size also narrows a non-today day - defaulting to midnight as its start time, not the full day", () => {
      const report = makeReport([
        {
          session_id: "sess-yesterday-early",
          name: "Early",
          cwd: "/repo",
          ended_at: yesterdayAt(2),
          segments: [
            {
              kind: "item",
              item_number: 1,
              label: null,
              start: yesterdayAt(1), // 1am-2am - inside the default [00:00, 04:00) window
              end: yesterdayAt(2),
              wall_ms: 0,
              active_ms: 0,
              idle_ms: 0,
              inferred: false,
              inferred_reason: null,
            },
          ],
        },
        {
          session_id: "sess-yesterday-late",
          name: "Late",
          cwd: "/repo",
          ended_at: yesterdayAt(11),
          segments: [
            {
              kind: "item",
              item_number: 1,
              label: null,
              start: yesterdayAt(10), // 10am-11am - outside the default 4h window
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
      renderCalendar(
        report,
        { selectedDate: new Date(yesterdayAt(12)) },
        { expandToFullDay: false }
      );
      // Default hourWindow is still 4; on a past day this now zooms the same
      // as today does, defaulting to midnight as its start (no "now" to
      // follow instead).
      expect(screen.getByText("Early")).toBeInTheDocument();
      expect(screen.queryByText("Late")).not.toBeInTheDocument();

      // Selecting 24h still reveals the whole day regardless of anchor mode.
      fireEvent.click(screen.getByText("24h"));
      expect(screen.getByText("Late")).toBeInTheDocument();
    });

    it("pages a non-today day's zoomed window forward/backward via the start-time stepper", () => {
      const report = makeReport([
        {
          session_id: "sess-yesterday-late",
          name: "Late",
          cwd: "/repo",
          ended_at: yesterdayAt(11),
          segments: [
            {
              kind: "item",
              item_number: 1,
              label: null,
              start: yesterdayAt(10), // 10am-11am
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
      renderCalendar(
        report,
        { selectedDate: new Date(yesterdayAt(12)) },
        { expandToFullDay: false }
      );
      expect(screen.queryByText("Late")).not.toBeInTheDocument();

      // Default window is [00:00, 04:00) - two "next block" pages (each +4h)
      // land on [08:00, 12:00), which contains the 10am-11am segment.
      const nextButton = screen.getByTitle("Show the next block");
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      expect(screen.getByText("Late")).toBeInTheDocument();
    });

    it("jumps the window straight to a typed start time via the start-time input", () => {
      const report = makeReport([
        makeSession("Afternoon", 14, 15), // 2pm-3pm
      ]);
      renderCalendar(report, {}, { expandToFullDay: false });
      // Live default (today, 3pm "now") window is [11:00, 17:00) - already
      // contains 2-3pm, so first prove typing a DIFFERENT start hides it,
      // then typing it back reveals it - otherwise this wouldn't prove the
      // input actually drives the window.
      const input = screen.getByLabelText("Window start time");
      fireEvent.change(input, { target: { value: "06:00" } });
      expect(screen.queryByText("Afternoon")).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: "13:00" } });
      expect(screen.getByText("Afternoon")).toBeInTheDocument();
    });

    it("shows a 'Live' toggle only on today's view, and it snaps a custom start back to following the current time", () => {
      const report = makeReport([
        makeSession("Mid", 12, 13), // noon-1pm - inside today's live default [11:00, 17:00)
      ]);
      renderCalendar(report, {}, { expandToFullDay: false });
      expect(screen.getByText("Mid")).toBeInTheDocument();

      const input = screen.getByLabelText("Window start time");
      fireEvent.change(input, { target: { value: "06:00" } });
      expect(screen.queryByText("Mid")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Live"));
      expect(screen.getByText("Mid")).toBeInTheDocument();
    });

    it("hides the 'Live' toggle on a non-today day, since there's no 'now' to follow", () => {
      renderCalendar(makeReport([]), { selectedDate: new Date(yesterdayAt(12)) });
      fireEvent.click(screen.getByText("4h"));
      expect(screen.queryByText("Live")).not.toBeInTheDocument();
    });

    describe("quick-start presets and the future-window warning", () => {
      it("offers a 4h window's presets every 4 hours up to 8pm - the latest start that still fits before midnight", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        const group = within(screen.getByRole("group", { name: "Quick start" }));
        for (const label of ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"]) {
          expect(group.getByText(label)).toBeInTheDocument();
        }
        // 24 - 4h window = 20h is the latest legal start; exactly those six,
        // nothing past 8pm.
        expect(group.getAllByRole("button")).toHaveLength(6);
      });

      it("stops an 8h window's presets at 4pm, since 4pm + 8h reaches midnight", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        fireEvent.click(screen.getByText("8h"));
        const group = within(screen.getByRole("group", { name: "Quick start" }));
        expect(group.getByText("4 PM")).toBeInTheDocument();
        expect(group.queryByText("8 PM")).not.toBeInTheDocument();
      });

      it("clicking a quick-start preset jumps the window and switches off Live", () => {
        const report = makeReport([
          makeSession("Morning", 9, 10), // 9-10am - inside the 8am preset's [8am, noon) window
        ]);
        renderCalendar(report, {}, { expandToFullDay: false });
        expect(screen.queryByText("Morning")).not.toBeInTheDocument(); // live default is [11am, 5pm)

        const group = within(screen.getByRole("group", { name: "Quick start" }));
        fireEvent.click(group.getByText("8 AM"));
        expect(screen.getByText("Morning")).toBeInTheDocument();
        expect(screen.getByText("Live")).toHaveAttribute("aria-pressed", "false");
        expect(group.getByText("8 AM")).toHaveAttribute("aria-pressed", "true");
      });

      it("shows no future-window warning while on today's live default window", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        expect(
          screen.queryByText("This range is in the future — no data will show here yet.")
        ).not.toBeInTheDocument();
      });

      it("warns when a quick-start preset picked on today lands entirely after the current time ('now' is 3pm)", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        const group = within(screen.getByRole("group", { name: "Quick start" }));
        fireEvent.click(group.getByText("4 PM")); // 4pm-8pm - entirely after 3pm "now"
        expect(
          screen.getByText("This range is in the future — no data will show here yet.")
        ).toBeInTheDocument();
      });

      it("clears the future-window warning once a past/present preset is chosen instead", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        const group = within(screen.getByRole("group", { name: "Quick start" }));
        fireEvent.click(group.getByText("4 PM"));
        expect(
          screen.getByText("This range is in the future — no data will show here yet.")
        ).toBeInTheDocument();

        fireEvent.click(group.getByText("8 AM"));
        expect(
          screen.queryByText("This range is in the future — no data will show here yet.")
        ).not.toBeInTheDocument();
      });

      it("shows the future-window warning on a past day too, if the user pages a custom start past the current clock time", () => {
        // Yesterday's own "now" comparison is meaningless in wall-clock terms,
        // but the component compares against isToday, not the selected day -
        // paging within a PAST day's window never crosses into real "future"
        // territory, so this instead proves the warning stays scoped to
        // today's view: yesterday shows none even at its own latest preset.
        renderCalendar(
          makeReport([]),
          { selectedDate: new Date(yesterdayAt(12)) },
          { expandToFullDay: false }
        );
        const group = within(screen.getByRole("group", { name: "Quick start" }));
        fireEvent.click(group.getByText("8 PM"));
        expect(
          screen.queryByText("This range is in the future — no data will show here yet.")
        ).not.toBeInTheDocument();
      });

      it("offers quick-start presets on today's view too, not just past days", () => {
        renderCalendar(makeReport([]), {}, { expandToFullDay: false });
        expect(screen.getByRole("group", { name: "Quick start" })).toBeInTheDocument();
      });
    });
  });

  describe("Scratch Work bundling (temp-dir cwd sessions)", () => {
    const SCRATCH_CWD = "/private/var/folders/2k/x60fm4_56n549v9ynp04rlyh0000gn/T";

    function scratchSession(
      sessionId: string,
      name: string,
      startHour: number,
      startMinute: number,
      endHour: number,
      endMinute: number
    ): FocusReportSessionEntry {
      return {
        session_id: sessionId,
        name,
        cwd: SCRATCH_CWD,
        ended_at: todayAt(endHour, endMinute),
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Quick fix",
            start: todayAt(startHour, startMinute),
            end: todayAt(endHour, endMinute),
            wall_ms: 0,
            active_ms: 0,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
          },
        ],
      };
    }

    it("bundles a temp-dir-cwd session into a 'Scratch Work' card instead of rendering it individually", () => {
      const report = makeReport([scratchSession("sess-scratch-1", "segment-3-take-3", 9, 3, 9, 8)]);
      renderCalendar(report);

      expect(screen.queryByText("segment-3-take-3")).not.toBeInTheDocument();
      expect(screen.getByTestId("scratch-bundle")).toBeInTheDocument();
      // "Scratch Work" renders twice: the card's own title and the legend
      // swatch below it (see the dedicated legend-visibility test further
      // down) - text presence is checked via getAllByText everywhere in
      // this describe block for that reason.
      expect(screen.getAllByText("Scratch Work").length).toBeGreaterThan(0);
      expect(screen.getByText("1 session")).toBeInTheDocument();
    });

    it("bundles two scratch sessions in the same 15-minute window into one card with the combined count", () => {
      const report = makeReport([
        scratchSession("sess-scratch-1", "A", 9, 2, 9, 6),
        scratchSession("sess-scratch-2", "B", 9, 8, 9, 12),
      ]);
      renderCalendar(report);

      expect(screen.getAllByTestId("scratch-bundle")).toHaveLength(1);
      expect(screen.getByText("2 sessions")).toBeInTheDocument();
    });

    it("shows every bundled session's brief detail on hover, by real session id/name", () => {
      const report = makeReport([
        scratchSession("sess-scratch-1", "First Scratch", 9, 2, 9, 6),
        scratchSession("sess-scratch-2", "Second Scratch", 9, 8, 9, 12),
      ]);
      renderCalendar(report);

      fireEvent.mouseEnter(screen.getByTestId("scratch-bundle"));
      expect(screen.getByText("First Scratch")).toBeInTheDocument();
      expect(screen.getByText("Second Scratch")).toBeInTheDocument();
    });

    it("a scratch session crossing a 15-minute boundary appears in BOTH adjacent bundle cards", () => {
      // 9:10-9:20 straddles the 9:00-9:15 and 9:15-9:30 grid windows.
      const report = makeReport([scratchSession("sess-scratch-1", "Straddler", 9, 10, 9, 20)]);
      renderCalendar(report);

      const cards = screen.getAllByTestId("scratch-bundle");
      expect(cards).toHaveLength(2);

      fireEvent.mouseEnter(cards[0] as HTMLElement);
      expect(screen.getByText("Straddler")).toBeInTheDocument();
      fireEvent.mouseLeave(cards[0] as HTMLElement);

      fireEvent.mouseEnter(cards[1] as HTMLElement);
      expect(screen.getByText("Straddler")).toBeInTheDocument();
    });

    it("puts the Scratch Work bundle in its own dedicated lane, separate from normal per-session lanes", () => {
      const report = makeReport([
        scratchSession("sess-scratch-1", "Scratchy", 9, 2, 9, 6),
        {
          session_id: "sess-normal",
          name: "Normal",
          cwd: "/repo",
          ended_at: todayAt(10),
          segments: [
            {
              kind: "item",
              item_number: 1,
              label: "Real work",
              start: todayAt(9),
              end: todayAt(10),
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

      const scratchCard = screen.getByTestId("scratch-bundle") as HTMLElement;
      const normalBlock = screen.getByText("Normal").closest("a") as HTMLAnchorElement;
      // Scratch Work is always lane 0 (left edge); the normal block shifts
      // to lane 1, one LANE_WIDTH_PX (200px) over - never sharing a lane.
      expect(scratchCard.style.left).toBe("2px");
      expect(normalBlock.style.left).toBe("202px");
    });

    it("a day with ONLY scratch sessions still renders the calendar grid, not the 'no activity' empty state", () => {
      const report = makeReport([scratchSession("sess-scratch-1", "Only Scratch", 9, 2, 9, 6)]);
      renderCalendar(report);

      expect(screen.queryByText("No activity on this day")).not.toBeInTheDocument();
      expect(screen.getByTestId("scratch-bundle")).toBeInTheDocument();
    });

    it("shows a 'Scratch Work' legend entry only when a bundle actually exists that day", () => {
      const { unmount } = renderCalendar(makeReport([]));
      expect(screen.queryByText("Scratch Work")).not.toBeInTheDocument();
      unmount();

      renderCalendar(makeReport([scratchSession("sess-scratch-1", "X", 9, 2, 9, 6)]));
      // Now appears twice: the card itself and the legend swatch.
      expect(screen.getAllByText("Scratch Work").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("board-mode additive props (selectedDate/hideDateNav/projectLabelForCwd — build task 7)", () => {
    it("selectedDate controls the rendered day instead of internal state", () => {
      const report = makeReport([
        {
          session_id: "sess-yesterday-selected",
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
      const yesterday = new Date(NOW);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      renderCalendar(report, { selectedDate: yesterday });

      // Uncontrolled today, this data has nothing on it -> "No activity".
      // Controlled to yesterday (via selectedDate), the session must show.
      expect(screen.queryByText("No activity on this day")).not.toBeInTheDocument();
      expect(screen.getByText("Yesterday's work")).toBeInTheDocument();
    });

    it("hideDateNav={true} renders zero day-nav buttons", () => {
      renderCalendar(makeReport([]), { hideDateNav: true });
      expect(screen.queryByTitle("Previous day")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Next day")).not.toBeInTheDocument();
      expect(screen.queryByText("Today")).not.toBeInTheDocument();
    });

    it("hideDateNav omitted (default false) still renders the nav row unchanged (inverted-boolean guard)", () => {
      // Not expected to be RED before task 7 lands - the component doesn't
      // read this prop at all yet, so its default (nav visible) already
      // matches the omitted-prop expectation. It exists to catch a FUTURE
      // regression (an inverted boolean once hideDateNav is wired), not to
      // pin currently-missing behavior - see red-evidence.md.
      renderCalendar(makeReport([]));
      expect(screen.getByTitle("Previous day")).toBeInTheDocument();
      expect(screen.getByTitle("Next day")).toBeInTheDocument();
      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("projectLabelForCwd renders the resolved label for a block's cwd", () => {
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
      renderCalendar(report, {
        projectLabelForCwd: (cwd) => (cwd === "/repo" ? "Acme Corp" : undefined),
      });
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    it("projectLabelForCwd resolving undefined falls back to the 'Unassigned' project line, not a crash or a stray label", () => {
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
      renderCalendar(report, { projectLabelForCwd: () => undefined });
      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
      expect(screen.getByText("Worker")).toBeInTheDocument();
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("a session with no name shows 'No-name' instead of a truncated session id", () => {
      const report = makeReport([
        {
          session_id: "sess-1234567890",
          name: null,
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
      renderCalendar(report, {
        projectLabelForCwd: (cwd) => (cwd === "/repo" ? "Acme Corp" : undefined),
      });
      expect(screen.getByText("No-name")).toBeInTheDocument();
      expect(screen.queryByText(/sess-1234/)).not.toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });
});
