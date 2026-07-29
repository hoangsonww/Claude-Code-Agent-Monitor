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
// Extraction target of build task 9 - does not exist yet as of this test's
// authoring (task 8, red-first). Once FocusReportBody.tsx is built, this
// import resolves and the test below exercises it directly, mounted twice
// with modal-shaped vs. board-shaped props - the client-side half of the
// "one rendering-chrome implementation, two consumers" guarantee (T1's
// split parity check on the new route is the server-side half).
import { FocusReportBody } from "../FocusReportBody";
import { CONCURRENCY_PRIMARY_KEY } from "../ConcurrencyStatTile";
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
    // The Concurrency tile's primary-ratio choice persists across mounts by
    // design - reset it so each test starts from the "open" default.
    localStorage.removeItem(CONCURRENCY_PRIMARY_KEY);
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
    const idleTile = screen.getByText("Total idle agent time").closest("div") as HTMLElement;
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
    const activeTile = screen.getByText("Total active agent time").closest("div") as HTMLElement;
    expect(within(activeTile).getByText("of 25m 0s wall-clock")).toBeInTheDocument();
  });

  it("shows the while-active concurrency sub-line when the report carries active_concurrency_ratio, and omits it when absent", async () => {
    focusReportMock.mockResolvedValue(
      makeReport({
        wall_clock_ms: 50 * 60_000,
        concurrency_ratio: 0.6, // diluted by open-but-idle stretches...
        active_wall_clock_ms: 15 * 60_000,
        active_concurrency_ratio: 2, // ...while the active-window ratio isn't
      })
    );
    const { unmount } = renderModal();
    await screen.findByText("Per-session breakdown");
    // .closest("div") is the label row (label + swap button); its parent is
    // the tile itself, which holds the value and sub-line.
    const concurrencyTile = screen.getByText("Concurrency").closest("div")!
      .parentElement as HTMLElement;
    expect(within(concurrencyTile).getByText("2.00x while active")).toBeInTheDocument();
    unmount();

    // A report without the (optional) field - e.g. an older server - renders
    // the tile exactly as before, no sub-line.
    focusReportMock.mockResolvedValue(makeReport());
    renderModal();
    await screen.findByText("Per-session breakdown");
    expect(screen.queryByText(/while active/)).not.toBeInTheDocument();
  });

  it("swaps which concurrency ratio is primary via the tile's toggle, persists the choice, and restores it on a fresh mount", async () => {
    const report = makeReport({
      wall_clock_ms: 50 * 60_000,
      concurrency_ratio: 0.6,
      active_wall_clock_ms: 15 * 60_000,
      active_concurrency_ratio: 2,
    });
    focusReportMock.mockResolvedValue(report);
    const { unmount } = renderModal();
    await screen.findByText("Per-session breakdown");

    // Default: open-session ratio is primary - shown over ITS total (the
    // 50m open-session wall clock) - with the active ratio as the sub-line.
    const tile = () => screen.getByText("Concurrency").closest("div")!.parentElement as HTMLElement;
    expect(within(tile()).getByText("0.60x")).toBeInTheDocument();
    expect(within(tile()).getByText("of 50m 0s open-session time")).toBeInTheDocument();
    expect(within(tile()).getByText("2.00x while active")).toBeInTheDocument();

    // Toggle: the two swap places - the primary's total swaps with them (now
    // the 15m active wall clock) - the tooltip describes the active ratio,
    // and the choice lands in localStorage.
    fireEvent.click(screen.getByLabelText("Swap primary concurrency ratio"));
    expect(within(tile()).getByText("2.00x")).toBeInTheDocument();
    expect(within(tile()).getByText("of 15m 0s active time")).toBeInTheDocument();
    expect(within(tile()).getByText("0.60x across open sessions")).toBeInTheDocument();
    expect(tile().getAttribute("title")).toMatch(/active wall-clock/);
    expect(localStorage.getItem(CONCURRENCY_PRIMARY_KEY)).toBe("active");
    unmount();

    // A fresh mount (same as a page refresh) restores the inverted choice.
    renderModal();
    await screen.findByText("Per-session breakdown");
    expect(within(tile()).getByText("2.00x")).toBeInTheDocument();
    expect(within(tile()).getByText("0.60x across open sessions")).toBeInTheDocument();
  });

  it("falls back to a dash when there's no wall-clock time for a concurrency ratio", async () => {
    focusReportMock.mockResolvedValue(makeReport({ wall_clock_ms: 0, concurrency_ratio: null }));
    renderModal();
    await screen.findByText("Per-session breakdown");

    const concurrencyTile = screen.getByText("Concurrency").closest("div")!
      .parentElement as HTMLElement;
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
    expect(screen.getByText("Total active agent time")).toBeInTheDocument();
    expect(focusReportMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("List"));
    expect(screen.getByText("Per-session breakdown")).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("shows the modal's own project name (not just the session name) on each Calendar card, even though this modal is single-project and never passed projectLabelForCwd before", async () => {
    vi.useFakeTimers();
    try {
      const NOW = new Date("2026-07-26T15:00:00.000Z");
      vi.setSystemTime(NOW);

      const report = makeReport({
        sessions: [
          {
            session_id: "sess-project-line",
            name: "Worker",
            cwd: "/repo",
            ended_at: "2026-07-26T10:00:00.000Z",
            segments: [
              {
                kind: "item",
                item_number: 4,
                label: "Migrate auth",
                start: "2026-07-26T09:00:00.000Z",
                end: "2026-07-26T10:00:00.000Z",
                wall_ms: 60 * 60_000,
                active_ms: 60 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
              },
            ],
          },
        ],
      });
      focusReportMock.mockResolvedValue(report);
      renderModal();
      await act(async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });

      fireEvent.click(screen.getByTitle("Calendar"));
      // The segment (9-10am local) can fall outside the calendar's default
      // 4-hour zoom window relative to this test's fake "now" - expand to
      // the full day so this test's own concern (the project line) doesn't
      // depend on that unrelated default.
      fireEvent.click(screen.getByText("24h"));
      expect(screen.getByText("Worker")).toBeInTheDocument();
      // "Agent Monitor" is the `projectName` renderModal() passes to
      // FocusReportModal - the card's own second line, not anything the
      // segment data itself carries.
      expect(screen.getByText("Agent Monitor")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it("[standing template] List and Calendar views render the same wall-clock/agent-time numbers for the same segment, and each renders internally consistent idle-stripe geometry (List: proportional to the real span; Calendar: proportional to its quarter-hour-snapped box) — extend THIS test, not a view-local one, for any future FocusReportSegment field either view renders", async () => {
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
      // The segment (9-9:20am) can fall outside the calendar's default
      // 4-hour zoom window relative to this test's fake "now" - expand to
      // the full day so this test's own geometry comparison doesn't depend
      // on that unrelated default.
      fireEvent.click(screen.getByText("24h"));

      const block = screen.getByText("CrossView").closest("a") as HTMLAnchorElement;
      fireEvent.mouseEnter(block);
      expect(screen.getByText(/Wall clock: 20m 0s/)).toBeInTheDocument();
      expect(screen.getByText(/Total agent time: 10m 0s/)).toBeInTheDocument();
      // Calendar's box isn't the real 09:00-09:20 span - FocusCalendarView
      // snaps it outward to the quarter-hour grid (09:00-09:30, 30 real
      // minutes) so even a short segment stays comfortably clickable. The
      // idle chunk (09:10-09:20) is therefore a third of the padded box,
      // not half of the real one like List's unpadded 50/50 above.
      const calendarStripes = container.querySelectorAll('[data-testid="idle-stripe"]');
      expect(calendarStripes).toHaveLength(1);
      expect(parseFloat((calendarStripes[0] as HTMLElement).style.top)).toBeCloseTo(33.33);
      expect(parseFloat((calendarStripes[0] as HTMLElement).style.height)).toBeCloseTo(33.33);
    } finally {
      vi.useRealTimers();
    }
  });

  it("[board-mode extension of the standing template] FocusReportBody renders modal-shaped and board-shaped props with identical stat-tile numbers and idle-stripe geometry for the same segment, but only the board-shaped render suppresses day-nav and shows a project label — extend THIS test, not a page-local one, for any future FocusReportBody consumer", async () => {
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
            session_id: "sess-shared-chrome",
            name: "SharedChrome",
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
        // Kept consistent with the lone overridden session/segment above
        // (20m wall / 10m active / 10m idle) - the "Total active agent time" stat tile
        // reads report.totals.active_ms verbatim (never re-derived from
        // segments), so an unrelated default here would silently pass a
        // stale number rather than actually exercise the tile.
        wall_clock_ms: 20 * 60_000,
        totals: {
          wall_ms: 20 * 60_000,
          active_ms: 10 * 60_000,
          idle_ms: 10 * 60_000,
          by_kind: {
            item: { wall_ms: 20 * 60_000, active_ms: 10 * 60_000, idle_ms: 10 * 60_000 },
            detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
          },
        },
      });

      // --- Modal-shaped: exactly what FocusReportModal passes today - no
      // projectLabelForCwd/selectedDate/hideDateNav.
      const { container: modalContainer } = render(
        <MemoryRouter>
          <FocusReportBody report={report} viewMode="calendar" />
        </MemoryRouter>
      );
      expect(within(modalContainer).getByTitle("Previous day")).toBeInTheDocument();
      expect(within(modalContainer).getByTitle("Next day")).toBeInTheDocument();
      expect(within(modalContainer).getByText("Today")).toBeInTheDocument();
      expect(within(modalContainer).queryByText("Acme Corp")).not.toBeInTheDocument();
      // The segment can fall outside the calendar's default 4-hour zoom
      // window relative to this test's fake "now" - expand to the full day
      // so this test's own geometry comparison doesn't depend on that
      // unrelated default (present regardless of hideDateNav).
      fireEvent.click(within(modalContainer).getByText("24h"));
      const modalActiveTile = within(modalContainer)
        .getByText("Total active agent time")
        .closest("div") as HTMLElement;
      const modalActiveValue = within(modalActiveTile).getByText(/10m 0s/).textContent;
      const modalStripes = modalContainer.querySelectorAll('[data-testid="idle-stripe"]');
      expect(modalStripes).toHaveLength(1);
      const modalTop = parseFloat((modalStripes[0] as HTMLElement).style.top);
      const modalHeight = parseFloat((modalStripes[0] as HTMLElement).style.height);

      // --- Board-shaped: projectLabelForCwd resolves "/repo", a fixed
      // selectedDate (today, same day the modal-shaped render defaults to
      // internally), and hideDateNav={true}.
      const boardSelectedDate = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
      const { container: boardContainer } = render(
        <MemoryRouter>
          <FocusReportBody
            report={report}
            viewMode="calendar"
            projectLabelForCwd={(cwd) => (cwd === "/repo" ? "Acme Corp" : undefined)}
            selectedDate={boardSelectedDate}
            hideDateNav={true}
          />
        </MemoryRouter>
      );
      // Zero day-nav controls - not one suppressed, not two stacked.
      expect(within(boardContainer).queryByTitle("Previous day")).not.toBeInTheDocument();
      expect(within(boardContainer).queryByTitle("Next day")).not.toBeInTheDocument();
      expect(within(boardContainer).queryByText("Today")).not.toBeInTheDocument();
      // The segment can fall outside the calendar's default 4-hour zoom
      // window relative to this test's fake "now" - expand to the full day
      // first, or the block (and its project label) may not render at all.
      fireEvent.click(within(boardContainer).getByText("24h"));
      // The project label IS shown for the board-shaped render.
      expect(within(boardContainer).getByText("Acme Corp")).toBeInTheDocument();

      // Non-relabeled stat-tile numbers are identical between the two -
      // same underlying report, same segment, only chrome differs.
      const boardActiveTile = within(boardContainer)
        .getByText("Total active agent time")
        .closest("div") as HTMLElement;
      const boardActiveValue = within(boardActiveTile).getByText(/10m 0s/).textContent;
      expect(boardActiveValue).toBe(modalActiveValue);

      // Idle-stripe geometry (top/height, calendar view) is identical for
      // the same segment on the same day.
      const boardStripes = boardContainer.querySelectorAll('[data-testid="idle-stripe"]');
      expect(boardStripes).toHaveLength(1);
      expect(parseFloat((boardStripes[0] as HTMLElement).style.top)).toBeCloseTo(modalTop);
      expect(parseFloat((boardStripes[0] as HTMLElement).style.height)).toBeCloseTo(modalHeight);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Calendar view's stat tiles scope to the visible hour-window zoom, not the full fetched report — the two standing-template tests above sidestep this by clicking '24h' first", async () => {
    vi.useFakeTimers();
    try {
      const NOW = new Date("2026-07-26T15:00:00.000Z");
      vi.setSystemTime(NOW);

      // Session A: 06:00-07:00 today, fully active - well before the
      // calendar's default 4h zoom window ([now-4h, now+2h) = [11:00, 17:00)
      // clamped to today, per FocusCalendarView's own `windowStartMs`/
      // `windowEndMs`), so it must be EXCLUDED from the zoomed stat tiles.
      // Session B: 12:00-12:30 today, fully active - inside that window, so
      // it must be the ONLY contributor while zoomed.
      const report = makeReport({
        sessions: [
          {
            session_id: "sess-early",
            name: "Early",
            cwd: "/repo",
            ended_at: "2026-07-26T07:00:00.000Z",
            segments: [
              {
                kind: "item",
                item_number: 4,
                label: "Migrate auth",
                start: "2026-07-26T06:00:00.000Z",
                end: "2026-07-26T07:00:00.000Z",
                wall_ms: 60 * 60_000,
                active_ms: 60 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
                chunks: [
                  {
                    start: "2026-07-26T06:00:00.000Z",
                    end: "2026-07-26T07:00:00.000Z",
                    active: true,
                  },
                ],
              },
            ],
          },
          {
            session_id: "sess-recent",
            name: "Recent",
            cwd: "/repo",
            ended_at: "2026-07-26T12:30:00.000Z",
            segments: [
              {
                kind: "detour",
                item_number: null,
                label: "Quick check",
                start: "2026-07-26T12:00:00.000Z",
                end: "2026-07-26T12:30:00.000Z",
                wall_ms: 30 * 60_000,
                active_ms: 30 * 60_000,
                idle_ms: 0,
                inferred: false,
                inferred_reason: null,
                chunks: [
                  {
                    start: "2026-07-26T12:00:00.000Z",
                    end: "2026-07-26T12:30:00.000Z",
                    active: true,
                  },
                ],
              },
            ],
          },
        ],
        // Full-report totals: both sessions summed (90m active, no overlap
        // so wall-clock is also 90m) - what the stat tiles show once
        // unzoomed to 24h, and what they must NOT show while still zoomed.
        wall_clock_ms: 90 * 60_000,
        concurrency_ratio: 1,
        totals: {
          wall_ms: 90 * 60_000,
          active_ms: 90 * 60_000,
          idle_ms: 0,
          by_kind: {
            item: { wall_ms: 60 * 60_000, active_ms: 60 * 60_000, idle_ms: 0 },
            detour: { wall_ms: 30 * 60_000, active_ms: 30 * 60_000, idle_ms: 0 },
            feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
            bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
          },
        },
      });
      focusReportMock.mockResolvedValue(report);
      const { container } = renderModal();
      await act(async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });
      fireEvent.click(screen.getByTitle("Calendar"));
      await act(async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      });

      // Default zoom is 4h - only "Recent" (30m) should count. Exact text
      // match (not a substring regex) on the value span specifically, since
      // the tile's own sub-label ("of 30m 0s wall-clock") also contains this
      // string once windowed wall-clock equals windowed active time.
      const activeTile = () =>
        screen.getByText("Total active agent time").closest("div") as HTMLElement;
      expect(within(activeTile()).getByText("30m 0s")).toBeInTheDocument();
      expect(within(activeTile()).queryByText("1h 30m")).not.toBeInTheDocument();
      // A visible cue that the tiles are scoped to the zoom, not the day -
      // 6h (not the "4h" zoom label) since the visible window is the 4h
      // look-back PLUS FocusCalendarView's own fixed 2h future pad (11:00 AM
      // to 5:00 PM here), and the note reports the actual visible span, not
      // just the hourWindow setting's name.
      expect(container.textContent).toMatch(/visible 6h window/);

      // Expanding to the full day restores the full 90m report total and
      // drops the scoped-window note.
      fireEvent.click(screen.getByText("24h"));
      expect(within(activeTile()).getByText("1h 30m")).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/visible \d+h window/);
    } finally {
      vi.useRealTimers();
    }
  });
});
