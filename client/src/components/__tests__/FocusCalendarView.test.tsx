/**
 * @file FocusCalendarView.test.tsx
 * @description Tests for the swimlane day-view calendar: overlapping
 * segments split into separate lanes while non-overlapping ones share a
 * lane, dashed border for inferred vs. solid for declared, the live pulse
 * only applying to a still-running session's open segment, Prev/Today/Next
 * date navigation, the empty-day state, the hover popup, and the "</>" icon
 * that opens SegmentEventsModal for a block's raw supporting events. Uses
 * fake timers so "today" is deterministic regardless of when the suite
 * actually runs.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

function renderCalendar(report: FocusReport, extraProps: BoardModeExtraProps = {}) {
  return render(
    <MemoryRouter>
      <FocusCalendarView report={report} {...extraProps} />
    </MemoryRouter>
  );
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
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByText("Item 6: MCP Reliability")).toBeInTheDocument();
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

    fireEvent.mouseEnter(screen.getByText("≈ Still going").closest("a") as HTMLAnchorElement);
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
    // The idle chunk is the second half of the block (10:00-10:10 out of
    // 09:00-09:20), so its overlay should start halfway down the block and
    // cover the remaining half.
    expect((stripes[0] as HTMLElement).style.top).toBe("50%");
    expect((stripes[0] as HTMLElement).style.height).toBe("50%");
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
    expect(screen.getByText(/Agent time: 23m 0s/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("View the raw events supporting this duration"));
    await act(async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    expect(screen.getByText(/Wall clock: 2h 0m/)).toBeInTheDocument();
    expect(screen.getByText(/Agent time: 23m 0s/)).toBeInTheDocument();
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

    it("projectLabelForCwd resolving undefined renders nothing extra (no crash, no stray label)", () => {
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
    });
  });
});
