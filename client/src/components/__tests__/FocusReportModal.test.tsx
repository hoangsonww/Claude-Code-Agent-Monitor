/**
 * @file FocusReportModal.test.tsx
 * @description Tests for the project-scoped focus-time report popup: the
 * loading/error/empty states, stat-tile math (on-item percentage, idle
 * excluded), the per-session and per-item segmented bars, and close
 * behavior (Escape, backdrop click, close button).
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

  it("renders the session's name linking to its detail page and the per-item rollup", async () => {
    focusReportMock.mockResolvedValue(makeReport());
    renderModal();
    await screen.findByText("Per-session breakdown");

    const link = screen.getByText("Worker").closest("a");
    expect(link?.getAttribute("href")).toBe("/sessions/sess-1");

    expect(screen.getByText("Time by plan item")).toBeInTheDocument();
    expect(screen.getByText("Migrate auth")).toBeInTheDocument();
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
});
