/**
 * @file FocusPage.test.tsx
 * @description Tests for the new Focus report page (`client/src/pages/FocusPage.tsx`):
 * default fetch on first load (today, all projects, no session — mirroring
 * `FocusCalendarBoard.test.tsx`'s own first-load assertions), loading/empty/
 * error states, the stat tiles reflecting `report.totals` with the same
 * on-item/off-plan formula as `FocusReportBody`, the activity card actually
 * rendering item/detour rows end-to-end, and `showProjectLabel` following
 * the project-chip selection (true only in "all projects" scope).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusPage } from "../FocusPage";
import type { FocusReport, Project } from "../../lib/types";

const projectsListMock = vi.fn();
const sessionsListMock = vi.fn();
const focusReportMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    projects: { list: (...args: unknown[]) => projectsListMock(...args) },
    sessions: { list: (...args: unknown[]) => sessionsListMock(...args) },
    focusReport: (...args: unknown[]) => focusReportMock(...args),
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
});
