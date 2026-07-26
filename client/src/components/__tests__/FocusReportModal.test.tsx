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
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
            wall_ms: 30 * 60_000,
            active_ms: 30 * 60_000,
            idle_ms: 0,
            inferred: false,
            inferred_reason: null,
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
          active_ms: 40 * 60_000,
          idle_ms: 0,
          by_kind: {
            item: { wall_ms: 30 * 60_000, active_ms: 30 * 60_000, idle_ms: 0 },
            detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            bug: { wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 0 },
          },
        },
      },
    ],
    totals: {
      wall_ms: 50 * 60_000,
      active_ms: 40 * 60_000,
      idle_ms: 10 * 60_000,
      by_kind: {
        item: { wall_ms: 30 * 60_000, active_ms: 30 * 60_000, idle_ms: 0 },
        detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        bug: { wall_ms: 10 * 60_000, active_ms: 10 * 60_000, idle_ms: 10 * 60_000 },
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

    // 30m item / 40m total active = 75% on-item, 25% off-plan.
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
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
});
