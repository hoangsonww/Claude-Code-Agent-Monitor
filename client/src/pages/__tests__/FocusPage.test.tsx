/**
 * @file FocusPage.test.tsx
 * @description Tests for the new Focus report page (`client/src/pages/FocusPage.tsx`):
 * default fetch on first load (today, all projects, no session — mirroring
 * `FocusCalendarBoard.test.tsx`'s own first-load assertions), loading/empty/
 * error states, the stat tiles reflecting `report.totals` with the same
 * on-item/off-plan formula as `FocusReportBody`, the activity card actually
 * rendering item/detour rows end-to-end, `showProjectLabel` following
 * the project-chip selection (true only in "all projects" scope), and the
 * hour-window zoom (`HourWindowZoomBar`/`useHourWindowZoom`, shared with
 * `FocusCalendarView`) — defaults to unzoomed (24h) so this page's existing
 * full-period default is unchanged, and scopes BOTH the stat tiles and the
 * activity card together once narrowed, never just one.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusPage } from "../FocusPage";
import type { FocusReport, Project } from "../../lib/types";

const projectsListMock = vi.fn();
const sessionsListMock = vi.fn();
const focusReportMock = vi.fn();
const focusReportSummaryMock = vi.fn();
const focusReportSummaryConfigMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    projects: { list: (...args: unknown[]) => projectsListMock(...args) },
    sessions: { list: (...args: unknown[]) => sessionsListMock(...args) },
    focusReport: (...args: unknown[]) => focusReportMock(...args),
    focusReportSummary: (...args: unknown[]) => focusReportSummaryMock(...args),
    focusReportSummaryConfig: (...args: unknown[]) => focusReportSummaryConfigMock(...args),
  },
}));

const PROJECT_GAME: Project = {
  id: "proj-game",
  name: "Game",
  paths: [{ id: 1, cwd: "/repo-game" }],
  session_count: 1,
  active_count: 1,
  last_activity: "2026-07-27T10:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function makeEmptyReport(overrides: Partial<FocusReport> = {}): FocusReport {
  return {
    project_id: null,
    session_id: null,
    sessions: [],
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
    ...overrides,
  };
}

function makeNonEmptyReport(): FocusReport {
  return makeEmptyReport({
    sessions: [
      {
        session_id: "sess-1",
        name: "Worker One",
        cwd: "/repo-game",
        ended_at: "2026-07-27T10:00:00.000Z",
        segments: [
          {
            kind: "item",
            item_number: 8,
            label: "Quality Pass",
            start: "2026-07-27T06:00:00.000Z",
            end: "2026-07-27T08:00:00.000Z",
            wall_ms: 2 * 60 * 60_000,
            active_ms: 1 * 60 * 60_000,
            idle_ms: 1 * 60 * 60_000,
            inferred: false,
            inferred_reason: null,
          },
          {
            kind: "detour",
            item_number: null,
            label: "Disk Space Monitoring",
            start: "2026-07-27T08:00:00.000Z",
            end: "2026-07-27T08:30:00.000Z",
            wall_ms: 30 * 60_000,
            active_ms: 20 * 60_000,
            idle_ms: 10 * 60_000,
            inferred: true,
            inferred_reason: "Added a disk space stats icon to the editor UI.",
          },
        ],
      },
    ],
    totals: {
      wall_ms: 2.5 * 60 * 60_000,
      active_ms: 1.333 * 60 * 60_000,
      idle_ms: 1.167 * 60 * 60_000,
      by_kind: {
        item: { wall_ms: 2 * 60 * 60_000, active_ms: 1 * 60 * 60_000, idle_ms: 1 * 60 * 60_000 },
        detour: { wall_ms: 30 * 60_000, active_ms: 20 * 60_000, idle_ms: 10 * 60_000 },
        feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
      },
    },
    wall_clock_ms: 2.5 * 60 * 60_000,
    concurrency_ratio: 1,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FocusPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  projectsListMock.mockReset();
  sessionsListMock.mockReset();
  focusReportMock.mockReset();
  focusReportSummaryMock.mockReset();
  focusReportSummaryMock.mockResolvedValue({ summary: null }); // default: block hidden
  focusReportSummaryConfigMock.mockReset();
  focusReportSummaryConfigMock.mockResolvedValue({ model: "sonnet" });
  projectsListMock.mockResolvedValue({
    projects: [PROJECT_GAME],
    unassigned: { cwds: [], session_count: 0, active_count: 0, last_activity: null },
  });
  sessionsListMock.mockResolvedValue({
    sessions: [],
    total: 0,
    limit: 10000,
    offset: 0,
  });
  focusReportMock.mockResolvedValue(makeNonEmptyReport());
});

describe("FocusPage", () => {
  it("defaults to today, all projects, no session on first load", async () => {
    renderPage();
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(1));

    const call = focusReportMock.mock.calls[0]?.[0] ?? {};
    expect(call.projectId).toBeUndefined();
    expect(call.sessionId).toBeUndefined();
    expect(call.unassigned).toBe(false);
    expect(typeof call.from).toBe("string");
    expect(typeof call.to).toBe("string");

    const allProjectsChip = screen.getByRole("button", { name: "All projects" });
    expect(allProjectsChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the loading state, then the empty state when there are no sessions", async () => {
    focusReportMock.mockResolvedValue(makeEmptyReport());
    renderPage();
    expect(screen.getByText("Crunching the numbers…")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText("No focus history yet for this project's sessions")).toBeTruthy()
    );
  });

  it("shows the error state when the fetch fails", async () => {
    focusReportMock.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Couldn't load the focus report")).toBeTruthy());
  });

  it("renders stat tiles matching FocusReportBody's on-item/off-plan formula", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("On declared item")).toBeTruthy());
    // active_ms.item (1h) / totals.active_ms (~1.333h) rounds to 75%.
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("renders the activity card's item and detour rows end-to-end, with the inferred reason", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Quality Pass")).toBeTruthy());
    expect(screen.getByText("Item 8")).toBeTruthy();
    expect(screen.getByText("Disk Space Monitoring")).toBeTruthy();
    expect(screen.getByText("Added a disk space stats icon to the editor UI.")).toBeTruthy();
  });

  it("shows a project label prefix in all-projects scope, and hides it once scoped to one project", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByTestId("focus-activity-project-label").length).toBeGreaterThan(0)
    );
    expect(screen.getAllByTestId("focus-activity-project-label")[0]?.textContent).toContain("Game");

    fireEvent.click(screen.getByRole("button", { name: "Game" }));
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("focus-activity-project-label")).toBeNull();
  });

  describe("window summary block", () => {
    it("renders the synthesized bullets (same window params as the report fetch) with the AI note", async () => {
      focusReportSummaryMock.mockResolvedValue({
        summary: {
          bullets: ["Completed intake docs for five security issues.", "Packaged the IDOR fix."],
          generated_at: "2026-07-28T12:00:00.000Z",
          cached: true,
          model: "haiku",
        },
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByText("Completed intake docs for five security issues.")).toBeTruthy()
      );
      expect(screen.getByText("Packaged the IDOR fix.")).toBeTruthy();
      expect(screen.getByText("What happened in this window")).toBeTruthy();
      expect(screen.getByTestId("focus-window-summary")).toBeTruthy();
      // The AI note names the model that wrote the bullets (formatted with
      // the Claude prefix - "haiku" from the response renders "Claude Haiku")
      // and, for this cached response, says so instead of a generation time.
      expect(
        screen.getByText(
          /AI-generated by Claude Haiku from each session’s activity — verify important details in the rows below\. · Served from cache/
        )
      ).toBeTruthy();

      // Same window/scope as the report fetch - never a different from/to.
      const reportCall = focusReportMock.mock.calls[0]?.[0] ?? {};
      const summaryCall = focusReportSummaryMock.mock.calls[0]?.[0] ?? {};
      expect(summaryCall.from).toBe(reportCall.from);
      expect(summaryCall.to).toBe(reportCall.to);
      expect(summaryCall.projectId).toBe(reportCall.projectId);
    });

    it("shows the model, a live elapsed clock, and the duration-expectation note while loading", async () => {
      // Keep the summary fetch pending so the loading state stays visible.
      focusReportSummaryMock.mockReturnValue(new Promise(() => {}));
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/Summarizing this window using Claude Sonnet…/)).toBeTruthy()
      );
      // The elapsed clock starts at 0s (formatMs) and sits beside the text.
      expect(screen.getByText("0s")).toBeTruthy();
      // The expectation-setting note explains first-view cost vs cached views.
      expect(
        screen.getByText(
          "First look at a range summarizes each day once and caches it — a multi-week window can take a minute or two. Repeat views are instant."
        )
      ).toBeTruthy();
    });

    it("shows how long generation took once a freshly-generated summary lands", async () => {
      focusReportSummaryMock.mockResolvedValue({
        summary: {
          bullets: ["Fresh bullets."],
          generated_at: "2026-07-28T12:00:00.000Z",
          cached: false,
          model: "sonnet",
        },
      });
      renderPage();
      await waitFor(() => expect(screen.getByText("Fresh bullets.")).toBeTruthy());
      // Freshly generated (cached: false) -> "Generated in <duration>", not
      // the served-from-cache wording. The mock resolves instantly, so the
      // frozen elapsed figure is 0s.
      expect(screen.getByText(/· Generated in 0s/)).toBeTruthy();
      expect(screen.queryByText(/Served from cache/)).toBeNull();
    });

    it("hides the block entirely when the summary is null (unavailable) or the fetch fails", async () => {
      renderPage(); // default mock: { summary: null }
      await waitFor(() => expect(screen.getByText("Quality Pass")).toBeTruthy());
      await waitFor(() => expect(screen.queryByTestId("focus-window-summary")).toBeNull());

      focusReportSummaryMock.mockRejectedValue(new Error("boom"));
      fireEvent.click(screen.getByRole("button", { name: "Game" }));
      await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByTestId("focus-window-summary")).toBeNull());
    });
  });

  describe("hour-window zoom", () => {
    // Fixed local "now" so the live 4h-zoom window is deterministic - built
    // via LOCAL Date methods (mirrors FocusCalendarView.test.tsx's own
    // `todayAt`) so it lines up regardless of the test runner's timezone.
    const ZOOM_NOW = new Date();
    ZOOM_NOW.setHours(15, 0, 0, 0);

    function todayAt(hour: number): string {
      const d = new Date(ZOOM_NOW);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    }

    function makeZoomReport(): FocusReport {
      return makeEmptyReport({
        sessions: [
          {
            session_id: "sess-1",
            name: "Worker One",
            cwd: "/repo-game",
            ended_at: todayAt(14),
            segments: [
              // Outside the live 4h window ([11:00, 17:00) at "now" 15:00) -
              // should disappear once zoomed to 4h.
              {
                kind: "detour",
                item_number: null,
                label: "Old Detour",
                start: todayAt(6),
                end: todayAt(7),
                wall_ms: 60 * 60_000,
                active_ms: 60 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
              },
              // Inside the live 4h window - should still show once zoomed.
              {
                kind: "item",
                item_number: 8,
                label: "Quality Pass",
                start: todayAt(13),
                end: todayAt(14),
                wall_ms: 60 * 60_000,
                active_ms: 60 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
              },
            ],
          },
        ],
        totals: {
          wall_ms: 2 * 60 * 60_000,
          active_ms: 2 * 60 * 60_000,
          idle_ms: 0,
          by_kind: {
            item: { wall_ms: 60 * 60_000, active_ms: 60 * 60_000, idle_ms: 0 },
            detour: { wall_ms: 60 * 60_000, active_ms: 60 * 60_000, idle_ms: 0 },
            feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
          },
        },
        wall_clock_ms: 2 * 60 * 60_000,
        concurrency_ratio: 1,
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(ZOOM_NOW);
      focusReportMock.mockResolvedValue(makeZoomReport());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Fake timers are active for this describe block (deterministic "now"),
    // so `waitFor` (real-timer polling) would hang - flush the mock fetch's
    // microtask queue directly instead, same pattern as
    // FocusCalendarView.test.tsx's own fake-timer suite.
    async function flush() {
      await act(async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });
    }

    it("defaults to the unzoomed 24h option, showing every segment in the fetched report", async () => {
      renderPage();
      await flush();
      expect(screen.getByText("Quality Pass")).toBeTruthy();
      expect(screen.getByText("Old Detour")).toBeTruthy();
      expect(screen.getByText("24h")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("2h 0m")).toBeTruthy(); // full, unwindowed active time
    });

    it("narrows the stat tiles and the activity card together when a duration preset is clicked", async () => {
      renderPage();
      await flush();
      expect(screen.getByText("Old Detour")).toBeTruthy();

      fireEvent.click(screen.getByText("4h"));
      await flush();

      // The out-of-window segment drops from the activity card...
      expect(screen.queryByText("Old Detour")).not.toBeInTheDocument();
      // ...while the in-window one stays, and the stat tile above recomputes
      // to match (1h, not the full 2h) - never one changing without the
      // other. ("1h 0m" now matches both the stat tile AND the activity
      // row's own time, since the row's wall/active time is identical to
      // the tile's once "Old Detour" is the only thing excluded.)
      expect(screen.getByText("Quality Pass")).toBeTruthy();
      expect(screen.getAllByText("1h 0m").length).toBeGreaterThan(0);
      expect(screen.queryByText("2h 0m")).not.toBeInTheDocument();
      // The "4h" preset's LIVE window actually spans 6h (4h back + the 2h
      // future pad every live zoom size under 24h adds - see
      // useHourWindowZoom's own FUTURE_PAD_MS doc), so the note reports the
      // real visible span, not the nominal preset size.
      expect(
        screen.getByText("Stats reflect the visible 6h window, not the full day")
      ).toBeTruthy();
    });

    it("restores the full report when zooming back out to 24h", async () => {
      renderPage();
      await flush();

      fireEvent.click(screen.getByText("4h"));
      await flush();
      expect(screen.queryByText("Old Detour")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("24h"));
      await flush();
      expect(screen.getByText("Old Detour")).toBeTruthy();
      expect(screen.getByText("2h 0m")).toBeTruthy();
    });
  });
});
