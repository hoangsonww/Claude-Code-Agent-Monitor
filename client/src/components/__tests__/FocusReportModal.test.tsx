/**
 * @file FocusReportModal.test.tsx
 * @description Tests for the project-scoped focus-time report popup: the
 * loading/error/empty states, stat-tile math (on-item percentage, idle
 * excluded), the per-session and per-item segmented bars, the "≈ inferred"
 * chip on sessions whose attribution came from the background classifier
 * rather than a declaration, and close behavior (Escape, backdrop click,
 * close button).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusReportModal } from "../FocusReportModal";
import type { FocusReport } from "../../lib/types";

const focusReportMock = vi.fn();
vi.mock("../../lib/api", () => ({
  api: { projects: { focusReport: (...args: unknown[]) => focusReportMock(...args) } },
}));

function makeReport(overrides: Partial<FocusReport> = {}): FocusReport {
  return {
    project_id: "proj-1",
    sessions: [
      {
        session_id: "sess-1",
        name: "Worker",
        cwd: "/repo",
        ended_at: "2026-06-10T09:40:00.000Z",
        segments: [
          {
            kind: "item",
            item_number: 4,
            label: "Migrate auth",
            start: "2026-06-10T09:00:00.000Z",
            end: "2026-06-10T09:30:00.000Z",
            // active_ms < wall_ms (20m of 30m) - the round-3-shaped idle
            // gap this whole build closes List-view parity on. 3 chunks
            // covering the full 30m span: first two active (0-20m), last
            // idle (20-30m), matching active_ms/idle_ms above.
            wall_ms: 30 * 60_000,
            active_ms: 20 * 60_000,
            idle_ms: 10 * 60_000,
            inferred: false,
            inferred_reason: null,
            chunks: [
              { start: "2026-06-10T09:00:00.000Z", end: "2026-06-10T09:10:00.000Z", active: true },
              { start: "2026-06-10T09:10:00.000Z", end: "2026-06-10T09:20:00.000Z", active: true },
              {
                start: "2026-06-10T09:20:00.000Z",
                end: "2026-06-10T09:30:00.000Z",
                active: false,
              },
            ],
          },
          {
            kind: "bug",
            item_number: 4,
            label: "npm conflict",
            start: "2026-06-10T09:30:00.000Z",
            end: "2026-06-10T09:40:00.000Z",
            wall_ms: 10 * 60_000,
            active_ms: 10 * 60_000,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
            // Deliberately no `chunks` field - exercises the "no chunks ->
            // no stripe" guard on the per-session bar.
          },
        ],
      },
    ],
    items: [
      {
        cwd: "/repo",
        item_number: 4,
        text: "Migrate auth",
        totals: {
          wall_ms: 40 * 60_000,
          active_ms: 30 * 60_000,
          idle_ms: 10 * 60_000,
          by_kind: {
            item: { wall_ms: 30 * 60_000, active_ms: 20 * 60_000, idle_ms: 10 * 60_000 },
            detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            bug: { wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 0 },
          },
        },
      },
    ],
    totals: {
      wall_ms: 50 * 60_000,
      active_ms: 30 * 60_000,
      idle_ms: 10 * 60_000,
      by_kind: {
        item: { wall_ms: 30 * 60_000, active_ms: 20 * 60_000, idle_ms: 10 * 60_000 },
        detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        bug: { wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 0 },
      },
    },
    idle_grace_seconds: 300,
    wall_clock_ms: 50 * 60_000,
    concurrency_ratio: 1,
    ...overrides,
  };
}

function renderModal(onClose = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <FocusReportModal projectId="proj-1" projectName="Agent Monitor" onClose={onClose} />
    </MemoryRouter>
  );
  return { onClose, ...utils };
}

describe("FocusReportModal", () => {
  beforeEach(() => {
    focusReportMock.mockReset();
  });

  it("fetches the report scoped to the given project id and shows a loading state first", async () => {
    let resolve!: (v: FocusReport) => void;
    focusReportMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderModal();

    expect(focusReportMock).toHaveBeenCalledWith("proj-1");
    expect(screen.getByText("Crunching the numbers…")).toBeInTheDocument();

    resolve(makeReport());
    await waitFor(() =>
      expect(screen.queryByText("Crunching the numbers…")).not.toBeInTheDocument()
    );
  });

  it("shows an error state when the fetch fails", async () => {
    focusReportMock.mockRejectedValue(new Error("boom"));
    renderModal();
    expect(await screen.findByText("Couldn't load the focus report")).toBeInTheDocument();
  });

  it("shows an empty state for a project with no session focus history", async () => {
    focusReportMock.mockResolvedValue(makeReport({ sessions: [] }));
    renderModal();
    expect(
      await screen.findByText("No focus history yet for this project's sessions")
    ).toBeInTheDocument();
  });

  it("computes the on-item percentage from active time and surfaces idle time separately", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    renderModal();
    await screen.findByText("Per-session breakdown");

    // 20m item active / 30m total active = 67% on-item, 33% off-plan
    // (Math.round(20/30*100)=67, 100-67=33).
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    // idle_ms totals 10m, excluded from active time.
    const idleTile = screen.getByText("Idle excluded").closest("div") as HTMLElement;
    expect(within(idleTile).getByText("10m 0s")).toBeInTheDocument();
  });

  it("shows the concurrency ratio and the real wall-clock span (not the per-segment sum)", async () => {
    focusReportMock.mockResolvedValue(
      makeReport({
        wall_clock_ms: 25 * 60_000, // sessions overlapped: less than totals.wall_ms (50m)
        concurrency_ratio: 1.6,
      })
    );
    renderModal();
    await screen.findByText("Per-session breakdown");

    expect(screen.getByText("1.60x")).toBeInTheDocument();
    const activeTile = screen.getByText("Active time").closest("div") as HTMLElement;
    expect(within(activeTile).getByText("of 25m 0s wall-clock")).toBeInTheDocument();
  });

  it("falls back to a dash when there's no wall-clock time for a concurrency ratio", async () => {
    focusReportMock.mockResolvedValue(makeReport({ wall_clock_ms: 0, concurrency_ratio: null }));
    renderModal();
    await screen.findByText("Per-session breakdown");

    const concurrencyTile = screen.getByText("Concurrency").closest("div") as HTMLElement;
    expect(within(concurrencyTile).getByText("—")).toBeInTheDocument();
  });

  it("renders the session's name linking to its detail page and the per-item rollup", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    renderModal();
    await screen.findByText("Per-session breakdown");

    const link = screen.getByText("Worker").closest("a");
    expect(link?.getAttribute("href")).toBe("/sessions/sess-1");

    expect(screen.getByText("Time by plan item")).toBeInTheDocument();
    expect(screen.getByText("Migrate auth")).toBeInTheDocument();
  });

  it("badges sessions whose segments are inferred, and leaves declared sessions unbadged", async () => {
    const report = makeReport();
    report.sessions.push({
      session_id: "sess-2",
      name: "Silent",
      cwd: "/repo",
      ended_at: "2026-06-10T10:20:00.000Z",
      segments: [
        {
          kind: "item",
          item_number: 4,
          label: "Migrate auth",
          start: "2026-06-10T10:00:00.000Z",
          end: "2026-06-10T10:20:00.000Z",
          wall_ms: 20 * 60_000,
          active_ms: 20 * 60_000,
          idle_ms: 0,
          inferred: true,
          inferred_reason: "Session edited auth/sso.ts and referenced SSO migration steps",
        },
      ],
    });
    focusReportMock.mockResolvedValue(report);
    renderModal();
    await screen.findByText("Per-session breakdown");

    // Exactly one chip: the inferred session's row, not the declared one's.
    const chips = screen.getAllByText(/≈ inferred/);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.closest("div")?.textContent).toContain("Silent");
    expect(screen.getByText("Worker").closest("div")?.textContent).not.toContain("inferred");

    // The chip's tooltip surfaces the classifier's own one-sentence
    // justification, not just the generic "no focus declared" boilerplate.
    expect(chips[0]?.getAttribute("title")).toBe(
      "No focus was declared — attributed automatically from this session's activity: Session edited auth/sso.ts and referenced SSO migration steps"
    );

    // What the session was actually attributed to is visible without
    // hovering anything — a session name like "Silent" alone (or a bare "≈
    // inferred" chip) doesn't say what the inferred item/detour actually was.
    expect(screen.getByText("Item 4: Migrate auth")).toBeInTheDocument();
  });

  it("shows a visible caption naming an inferred detour, not just a hover-only bar", async () => {
    const report = makeReport();
    report.sessions.push({
      session_id: "sess-2",
      name: "ungrouped",
      cwd: "/repo",
      ended_at: "2026-06-10T10:20:00.000Z",
      segments: [
        {
          kind: "detour",
          item_number: null,
          label: "Time tracking investigation",
          start: "2026-06-10T10:00:00.000Z",
          end: "2026-06-10T10:20:00.000Z",
          wall_ms: 20 * 60_000,
          active_ms: 20 * 60_000,
          idle_ms: 0,
          inferred: true,
          inferred_reason: "Investigated a time-tracking dashboard unrelated to the plan",
        },
      ],
    });
    focusReportMock.mockResolvedValue(report);
    renderModal();
    await screen.findByText("Per-session breakdown");

    expect(screen.getByText("Detour: Time tracking investigation")).toBeInTheDocument();
  });

  it("falls back to the generic inferred note when the classifier left no reason", async () => {
    const report = makeReport();
    report.sessions.push({
      session_id: "sess-2",
      name: "Silent",
      cwd: "/repo",
      ended_at: "2026-06-10T10:20:00.000Z",
      segments: [
        {
          kind: "item",
          item_number: 4,
          label: "Migrate auth",
          start: "2026-06-10T10:00:00.000Z",
          end: "2026-06-10T10:20:00.000Z",
          wall_ms: 20 * 60_000,
          active_ms: 20 * 60_000,
          idle_ms: 0,
          inferred: true,
          inferred_reason: null,
        },
      ],
    });
    focusReportMock.mockResolvedValue(report);
    renderModal();
    await screen.findByText("Per-session breakdown");

    const chip = screen.getByText(/≈ inferred/);
    expect(chip.getAttribute("title")).toBe(
      "No focus was declared — attributed automatically from this session's activity"
    );
  });

  it("closes on Escape, backdrop click, and the close button", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    const { onClose } = renderModal();
    await screen.findByText("Per-session breakdown");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.click(screen.getByText("Per-session breakdown")); // inside the panel, not the backdrop
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to the calendar view and back without a second fetch, keeping stat tiles visible", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    renderModal();
    await screen.findByText("Per-session breakdown");
    expect(focusReportMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Calendar"));
    expect(screen.queryByText("Per-session breakdown")).not.toBeInTheDocument();
    // Calendar-specific chrome (date nav) is now showing.
    expect(screen.getByText("Today")).toBeInTheDocument();
    // Stat tiles are shared between both view modes, not re-fetched.
    expect(screen.getByText("Active time")).toBeInTheDocument();
    expect(focusReportMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("List"));
    expect(screen.getByText("Per-session breakdown")).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("hides the List/Calendar toggle when there is no focus history to show", async () => {
    focusReportMock.mockResolvedValue(makeReport({ sessions: [] }));
    renderModal();
    await screen.findByText("No focus history yet for this project's sessions");
    expect(screen.queryByTitle("Calendar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("List")).not.toBeInTheDocument();
  });

  // --- List-view parity with Calendar (focus-report-fidelity build) -------
  // The List view currently sizes/labels its three duration bars by
  // wall_ms, the raw un-idle-aware span (round-3's bug, fixed for Calendar
  // only in round 4). These tests pin List view's idle-stripe overlay,
  // dual wall-clock/agent-time header, and active_ms-based aggregate-bar
  // sizing - see build-brief.md / technical-plan.md for the full context.

  it("shows a labeled wall-clock/agent-time split in the per-session header when they diverge, a plain single number when they don't", async () => {
    const report = makeReport();
    report.sessions.push({
      session_id: "sess-noidle",
      name: "NoIdle",
      cwd: "/repo",
      ended_at: "2026-06-10T11:15:00.000Z",
      segments: [
        {
          kind: "feature",
          item_number: null,
          label: "Docs pass",
          start: "2026-06-10T11:00:00.000Z",
          end: "2026-06-10T11:15:00.000Z",
          wall_ms: 15 * 60_000,
          active_ms: 15 * 60_000,
          idle_ms: 0,
          inferred: false,
          inferred_reason: null,
        },
      ],
    });
    focusReportMock.mockResolvedValue(report);
    renderModal();
    await screen.findByText("Per-session breakdown");

    // "Worker" (wall 40m / active 30m, diverges) - both numbers, labeled.
    const workerRow = screen.getByText("Worker").closest("div") as HTMLElement;
    expect(within(workerRow).getByText(/40m 0s/)).toBeInTheDocument();
    expect(within(workerRow).getByText(/30m 0s/)).toBeInTheDocument();

    // "NoIdle" (wall === active === 15m, no divergence) - one plain number,
    // never the dual-split rendering.
    const noIdleRow = screen.getByText("NoIdle").closest("div") as HTMLElement;
    expect(within(noIdleRow).getByText("15m 0s")).toBeInTheDocument();
    expect(within(noIdleRow).queryByText(/30m 0s|40m 0s/)).not.toBeInTheDocument();
  });

  it("overlays exactly one idle stripe on the per-session bar, only for the segment carrying chunks", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    const { container } = renderModal();
    await screen.findByText("Per-session breakdown");

    // Segment 1 (item, 30m wall / 20m active / 10m idle, has chunks) gets
    // exactly one stripe; segment 2 (bug, no chunks field) gets none.
    const stripes = container.querySelectorAll('[data-testid="idle-stripe"]');
    expect(stripes).toHaveLength(1);
    const stripe = stripes[0] as HTMLElement;
    // This fixture's 1/3 split produces a repeating decimal - toBeCloseTo,
    // not string equality.
    expect(parseFloat(stripe.style.left)).toBeCloseTo((20 / 30) * 100);
    expect(parseFloat(stripe.style.width)).toBeCloseTo((10 / 30) * 100);
  });

  it("renders no idle stripe on the per-session bar for a single segment with no chunks", async () => {
    focusReportMock.mockResolvedValue(
      makeReport({
        sessions: [
          {
            session_id: "sess-1",
            name: "Worker",
            cwd: "/repo",
            ended_at: "2026-06-10T09:10:00.000Z",
            segments: [
              {
                kind: "item",
                item_number: 4,
                label: "Migrate auth",
                start: "2026-06-10T09:00:00.000Z",
                end: "2026-06-10T09:10:00.000Z",
                wall_ms: 10 * 60_000,
                active_ms: 10 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
                // No chunks field at all.
              },
            ],
          },
        ],
      })
    );
    const { container } = renderModal();
    await screen.findByText("Per-session breakdown");

    expect(container.querySelectorAll('[data-testid="idle-stripe"]')).toHaveLength(0);
  });

  it("sizes the per-item rollup and project-split bars by active_ms, not wall_ms (the embedded-bug regression)", async () => {
    const report = makeReport();
    // Inject a third kind with a large wall_ms but near-zero active_ms -
    // a wall_ms-proportional bar would render this ~40% wide; an
    // active_ms-sized one must render it near-0. Without this case, a
    // future revert to wall_ms sizing would still pass every other
    // assertion in this file.
    report.items[0]!.totals.by_kind.detour = {
      wall_ms: 20 * 60_000,
      active_ms: 1000,
      idle_ms: 20 * 60_000 - 1000,
    };
    report.items[0]!.totals.wall_ms += 20 * 60_000;
    report.items[0]!.totals.active_ms += 1000;
    report.items[0]!.totals.idle_ms += 20 * 60_000 - 1000;
    report.totals.by_kind.detour = {
      wall_ms: 20 * 60_000,
      active_ms: 1000,
      idle_ms: 20 * 60_000 - 1000,
    };
    report.totals.wall_ms += 20 * 60_000;
    report.totals.active_ms += 1000;
    report.totals.idle_ms += 20 * 60_000 - 1000;

    focusReportMock.mockResolvedValue(report);
    const { container } = renderModal();
    await screen.findByText("Per-session breakdown");

    // Per-item rollup bar (the `h-3` height class) and project-split bar
    // (the `h-6` height class) - structural selectors that exist regardless
    // of whether the data-testid hooks from task 9 have landed yet.
    const rollupBar = container.querySelector(".h-3") as HTMLElement;
    const splitBar = container.querySelector(".h-6") as HTMLElement;

    // `kindTotalsAsSegments()` renders in ALL_KINDS' fixed order
    // (item, detour, feature, bug), filtered to non-zero kinds - this
    // fixture has item/detour/bug all non-zero (feature stays 0 and is
    // dropped), so the rendered order is deterministically
    // [item, detour, bug] both before and after the fix. Prefer the
    // `data-kind` hook (task 9) when present so this isn't purely
    // position-dependent once that hook exists; fall back to the known
    // position otherwise (documented in the PR per the test-plan's own
    // fallback-selector guidance).
    function widthForKind(bar: HTMLElement, kind: string, fallbackIndex: number): number {
      const byKind = bar.querySelector(`[data-kind="${kind}"]`) as HTMLElement | null;
      const slices = Array.from(bar.querySelectorAll(":scope > div")) as HTMLElement[];
      const el = byKind ?? slices[fallbackIndex];
      if (!el) throw new Error(`No rendered slice found for kind "${kind}"`);
      return parseFloat(el.style.width);
    }

    for (const bar of [rollupBar, splitBar]) {
      const itemWidth = widthForKind(bar, "item", 0);
      const bugWidth = widthForKind(bar, "bug", 2);
      const detourWidth = widthForKind(bar, "detour", 1);
      // active_ms-proportional: item 20/30, bug 10/30 - never the
      // wall_ms-based 75/25 (item 30/60, bug 10/60) split.
      expect(itemWidth).toBeCloseTo((20 / 30) * 100, 0);
      expect(bugWidth).toBeCloseTo((10 / 30) * 100, 0);
      // The near-zero-active_ms pin: detour has a large wall_ms (20m) but
      // only 1000ms active_ms - a wall_ms-proportional bar would render
      // this ~33% wide; an active_ms-sized one must render it near-0.
      // Without this case, a future revert to wall_ms sizing would still
      // pass every other assertion in this file.
      expect(detourWidth).toBeLessThan(2);
    }
  });

  it("[standing template] List and Calendar views render the same wall-clock/agent-time numbers and proportionally equivalent idle-stripe geometry for the same segment — extend THIS test, not a view-local one, for any future FocusReportSegment field either view renders", async () => {
    vi.useFakeTimers();
    try {
      const NOW = new Date("2026-07-26T15:00:00.000Z");
      vi.setSystemTime(NOW);

      const todayStart = "2026-07-26T09:00:00.000Z";
      const todayMid = "2026-07-26T09:10:00.000Z";
      const todayEnd = "2026-07-26T09:20:00.000Z";
      const report = makeReport({
        sessions: [
          {
            session_id: "sess-cross-view",
            name: "CrossView",
            cwd: "/repo",
            ended_at: todayEnd,
            segments: [
              {
                kind: "item",
                item_number: 4,
                label: "Migrate auth",
                start: todayStart,
                end: todayEnd,
                wall_ms: 20 * 60_000,
                active_ms: 10 * 60_000,
                idle_ms: 10 * 60_000,
                inferred: false,
                inferred_reason: null,
                chunks: [
                  { start: todayStart, end: todayMid, active: true },
                  { start: todayMid, end: todayEnd, active: false },
                ],
              },
            ],
          },
        ],
      });
      focusReportMock.mockResolvedValue(report);
      const { container } = renderModal();
      // Not `await screen.findByText(...)` - waitFor/findBy poll on real
      // timers, which are frozen here (this test alone runs under fake
      // timers so "today" is deterministic for the Calendar view). Flush
      // the mock fetch's own microtask queue manually instead, same
      // technique FocusCalendarView.test.tsx uses for its async fetches
      // under fake timers.
      await act(async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });
      expect(screen.getByText("Per-session breakdown")).toBeInTheDocument();

      // --- List view ---
      const listRow = screen.getByText("CrossView").closest("div") as HTMLElement;
      expect(within(listRow).getByText(/20m 0s/)).toBeInTheDocument();
      expect(within(listRow).getByText(/10m 0s/)).toBeInTheDocument();
      const listStripes = container.querySelectorAll('[data-testid="idle-stripe"]');
      expect(listStripes).toHaveLength(1);
      expect(parseFloat((listStripes[0] as HTMLElement).style.left)).toBeCloseTo(50);
      expect(parseFloat((listStripes[0] as HTMLElement).style.width)).toBeCloseTo(50);

      // --- Switch to Calendar view - same already-fetched report, no
      // second fetch.
      fireEvent.click(screen.getByTitle("Calendar"));
      expect(focusReportMock).toHaveBeenCalledTimes(1);

      const block = screen.getByText("CrossView").closest("a") as HTMLAnchorElement;
      fireEvent.mouseEnter(block);
      expect(screen.getByText(/Wall clock: 20m 0s/)).toBeInTheDocument();
      expect(screen.getByText(/Agent time: 10m 0s/)).toBeInTheDocument();
      const calendarStripes = container.querySelectorAll('[data-testid="idle-stripe"]');
      expect(calendarStripes).toHaveLength(1);
      expect(parseFloat((calendarStripes[0] as HTMLElement).style.top)).toBeCloseTo(50);
      expect(parseFloat((calendarStripes[0] as HTMLElement).style.height)).toBeCloseTo(50);
    } finally {
      vi.useRealTimers();
    }
  });
});
