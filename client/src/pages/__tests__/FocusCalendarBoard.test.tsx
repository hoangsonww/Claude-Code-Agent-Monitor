/**
 * @file FocusCalendarBoard.test.tsx
 * @description Tests for the new cross-project Focus Calendar board page
 * (`client/src/pages/FocusCalendarBoard.tsx`, not yet built as of this
 * test's authoring — build task 17): default state on first load (today,
 * all projects, no session), the three independent filters (project /
 * session / time-period) never clearing one another (DEC-2, asserted on
 * the project filter's rendered chip `aria-pressed` state / the session
 * `<select>`'s value — not just mocked fetch-call arguments, per
 * `qa-assessment.md` must-fix #3 / `risk.md` §4e), zero-result edge cases
 * rendering the existing empty state rather than a crash, and the DEC-6
 * aggregate-view concurrency relabel resolving via `i18n.t(...)`, distinct
 * from the modal's own per-project copy.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import i18n from "i18next";
// New page (build task 17) - does not exist yet as of this test's authoring.
// This import fails to resolve until it's built - the expected RED reason
// for this entire file. See red-evidence.md.
import { FocusCalendarBoard } from "../FocusCalendarBoard";
import type { FocusReport, Project, Session } from "../../lib/types";

const projectsListMock = vi.fn();
const sessionsListMock = vi.fn();
const focusReportMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    projects: { list: (...args: unknown[]) => projectsListMock(...args) },
    sessions: { list: (...args: unknown[]) => sessionsListMock(...args) },
    // Top-level GET /api/focus-report client (build task 13) - not nested
    // under `projects` (that's the existing per-project modal's own method).
    focusReport: (...args: unknown[]) => focusReportMock(...args),
  },
}));

const PROJECT_ACME: Project = {
  id: "proj-acme",
  name: "Acme Corp",
  paths: [{ id: 1, cwd: "/repo-a" }],
  session_count: 2,
  active_count: 1,
  last_activity: "2026-05-01T10:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const PROJECT_EMPTY: Project = {
  id: "proj-empty",
  name: "Empty Co",
  paths: [{ id: 2, cwd: "/repo-empty" }],
  session_count: 0,
  active_count: 0,
  last_activity: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SESSION_1: Session = {
  id: "sess-1",
  name: "Worker One",
  status: "active",
  cwd: "/repo-a",
  model: null,
  started_at: "2026-05-01T09:00:00.000Z",
  ended_at: null,
  metadata: null,
};

const SESSION_2: Session = {
  id: "sess-2",
  name: "Worker Two",
  status: "completed",
  cwd: "/repo-b",
  model: null,
  started_at: "2026-05-01T09:00:00.000Z",
  ended_at: "2026-05-01T10:00:00.000Z",
  metadata: null,
};

const SESSION_EMPTY: Session = {
  id: "sess-empty",
  name: "No History",
  status: "completed",
  cwd: "/repo-a",
  model: null,
  started_at: "2026-05-01T09:00:00.000Z",
  ended_at: "2026-05-01T09:05:00.000Z",
  metadata: null,
};

function makeEmptyReport(overrides: Partial<FocusReport> = {}): FocusReport {
  return {
    // `project_id`/`session_id` are typed `string` on FocusReport as of this
    // test's authoring - build task 3 widens both to allow `null`, matching
    // the board's own "unfiltered" default. Harmless at test-run time
    // (Vitest transpiles via esbuild, no type-check gate).
    project_id: null as unknown as string,
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
  } as FocusReport;
}

function makeNonEmptyReport(): FocusReport {
  return makeEmptyReport({
    sessions: [
      {
        session_id: "sess-1",
        name: "Worker One",
        cwd: "/repo-a",
        ended_at: null,
        segments: [
          {
            kind: "item",
            item_number: 1,
            label: "Ship the board",
            start: "2026-05-01T09:00:00.000Z",
            end: "2026-05-01T10:00:00.000Z",
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
      wall_ms: 60 * 60_000,
      active_ms: 60 * 60_000,
      idle_ms: 0,
      by_kind: {
        item: { wall_ms: 60 * 60_000, active_ms: 60 * 60_000, idle_ms: 0 },
        detour: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        feature: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
        bug: { wall_ms: 0, active_ms: 0, idle_ms: 0 },
      },
    },
    wall_clock_ms: 60 * 60_000,
    concurrency_ratio: 1,
  });
}

function renderBoard() {
  return render(
    <MemoryRouter>
      <FocusCalendarBoard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  projectsListMock.mockReset();
  sessionsListMock.mockReset();
  focusReportMock.mockReset();
  projectsListMock.mockResolvedValue({
    projects: [PROJECT_ACME, PROJECT_EMPTY],
    unassigned: { cwds: [], session_count: 0, active_count: 0, last_activity: null },
  });
  sessionsListMock.mockResolvedValue({
    sessions: [SESSION_1, SESSION_2, SESSION_EMPTY],
    total: 3,
    limit: 10000,
    offset: 0,
  });
  // Default: non-empty, unfiltered. Individual tests override per-combo via
  // mockImplementation to exercise zero-result edge cases.
  focusReportMock.mockResolvedValue(makeNonEmptyReport());
});

describe("FocusCalendarBoard", () => {
  it("defaults to today, all projects, no session on first load; fetches the global session list once with {limit:10000} and no cwd", async () => {
    renderBoard();
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(1));

    expect(sessionsListMock).toHaveBeenCalledTimes(1);
    expect(sessionsListMock).toHaveBeenCalledWith({ limit: 10000 });
    // Never a `cwd` filter - the session list must be genuinely global.
    const sessionsListArgs = sessionsListMock.mock.calls[0]?.[0] ?? {};
    expect(sessionsListArgs.cwd).toBeUndefined();

    const allProjectsChip = screen.getByRole("button", { name: "All projects" });
    const sessionSelect = screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement;
    expect(allProjectsChip.getAttribute("aria-pressed")).toBe("true");
    expect(sessionSelect.value).toBe(""); // no session

    // Every request the client sends has an explicit from/to - no hidden
    // server-side default window (DEC-3).
    const firstCallArgs = focusReportMock.mock.calls[0]?.[0] ?? {};
    expect(typeof firstCallArgs.from).toBe("string");
    expect(typeof firstCallArgs.to).toBe("string");
    expect(firstCallArgs.projectId).toBeUndefined();
    expect(firstCallArgs.sessionId).toBeUndefined();
  });

  it("selecting a project does not clear an already-selected session (DEC-2)", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "Worker One");
    expect((screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement).value).toBe(
      "sess-1"
    );

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));

    // The REJECTED original draft cleared the session on project change -
    // DEC-2 requires it persist. Checked on the rendered chip's/select's
    // displayed state, not only the next fetch's arguments.
    expect((screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement).value).toBe(
      "sess-1"
    );
    expect(screen.getByRole("button", { name: "Acme Corp" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("selecting a session does not clear an already-selected project (DEC-2)", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));
    expect(screen.getByRole("button", { name: "Acme Corp" }).getAttribute("aria-pressed")).toBe(
      "true"
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "Worker Two");

    expect(screen.getByRole("button", { name: "Acme Corp" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect((screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement).value).toBe(
      "sess-2"
    );
  });

  it("selecting 'Unassigned' fetches with unassigned=true and no projectId, and is mutually exclusive with a real project", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Unassigned" }));
    expect(screen.getByRole("button", { name: "Unassigned" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "All projects" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    await waitFor(() => {
      const calls = focusReportMock.mock.calls;
      const lastCall = calls[calls.length - 1]?.[0] ?? {};
      expect(lastCall.unassigned).toBe(true);
      expect(lastCall.projectId).toBeUndefined();
    });

    // Selecting a real project afterward clears "Unassigned" - the two are
    // mutually exclusive (the server 400s if both were ever sent together).
    await user.click(screen.getByRole("button", { name: "Acme Corp" }));
    expect(screen.getByRole("button", { name: "Unassigned" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    await waitFor(() => {
      const calls = focusReportMock.mock.calls;
      const lastCall = calls[calls.length - 1]?.[0] ?? {};
      expect(lastCall.projectId).toBe("proj-acme");
      expect(lastCall.unassigned).toBe(false);
    });
  });

  it("selecting 'Unassigned' does not clear an already-selected session (DEC-2)", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "Worker One");
    await user.click(screen.getByRole("button", { name: "Unassigned" }));

    expect((screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement).value).toBe(
      "sess-1"
    );
    expect(screen.getByRole("button", { name: "Unassigned" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("navigating to the next day does not reset the project/session filters", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "Worker One");

    await user.click(screen.getByTitle("Next day"));

    expect(screen.getByRole("button", { name: "Acme Corp" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect((screen.getByRole("combobox", { name: "Session" }) as HTMLSelectElement).value).toBe(
      "sess-1"
    );
  });

  it("changing the project filter does not reset the currently-selected time period", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(1));
    const firstCallArgs = focusReportMock.mock.calls[0]?.[0] ?? {};

    await user.click(screen.getByTitle("Next day"));
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(2));
    const afterNextDayArgs = focusReportMock.mock.calls[1]?.[0] ?? {};
    expect(afterNextDayArgs.from).not.toBe(firstCallArgs.from);
    expect(screen.getByText("Today").className).not.toMatch(/bg-accent/);

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(3));
    const afterProjectChangeArgs = focusReportMock.mock.calls[2]?.[0] ?? {};

    // The time window carried over from the Next-day navigation - it must
    // NOT silently reset back to today's default just because a different,
    // independent filter changed.
    expect(afterProjectChangeArgs.from).toBe(afterNextDayArgs.from);
    expect(afterProjectChangeArgs.to).toBe(afterNextDayArgs.to);
    expect(screen.getByText("Today").className).not.toMatch(/bg-accent/);
  });

  it("switching to custom-range mode and picking a start/end re-fetches with from/to spanning the full selected range (T3g)", async () => {
    const user = userEvent.setup();
    renderBoard();
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText("Custom range"));
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(2));

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    const toInput = screen.getByLabelText("To") as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: "2026-03-01" } });
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(3));

    fireEvent.change(toInput, { target: { value: "2026-03-10" } });
    await waitFor(() => expect(focusReportMock).toHaveBeenCalledTimes(4));

    const lastCallArgs = focusReportMock.mock.calls[3]?.[0] ?? {};
    const expectedFrom = new Date(2026, 2, 1).toISOString();
    // windowBounds' "to" bound is exclusive of the day AFTER the range's last
    // day, so the fetched window fully covers every day the user selected.
    const expectedTo = new Date(
      new Date(2026, 2, 10).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    expect(lastCallArgs.from).toBe(expectedFrom);
    expect(lastCallArgs.to).toBe(expectedTo);
  });

  it("a project with zero sessions renders the existing empty state, not a crash", async () => {
    const user = userEvent.setup();
    focusReportMock.mockImplementation((params: { projectId?: string; sessionId?: string }) => {
      if (params.projectId === "proj-empty") return Promise.resolve(makeEmptyReport());
      return Promise.resolve(makeNonEmptyReport());
    });
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    // Empty Co has no activity in the default (unfiltered) report, so its
    // chip starts hidden behind "show more" - expand before selecting it.
    await user.click(screen.getByRole("button", { name: /show more/i }));
    await user.click(screen.getByRole("button", { name: "Empty Co" }));

    expect(
      await screen.findByText("No focus history yet for this project's sessions")
    ).toBeInTheDocument();
  });

  it("a session with no focus history in the current window renders the existing empty state, not a crash", async () => {
    const user = userEvent.setup();
    focusReportMock.mockImplementation((params: { sessionId?: string }) => {
      if (params.sessionId === "sess-empty") return Promise.resolve(makeEmptyReport());
      return Promise.resolve(makeNonEmptyReport());
    });
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "No History");

    expect(
      await screen.findByText("No focus history yet for this project's sessions")
    ).toBeInTheDocument();
  });

  it("a project+session combination with no overlap renders the existing empty state, not an error", async () => {
    const user = userEvent.setup();
    focusReportMock.mockImplementation((params: { projectId?: string; sessionId?: string }) => {
      // Worker Two's cwd (/repo-b) doesn't belong to Acme Corp (/repo-a) -
      // a legitimate, non-crashing empty combination per DEC-2.
      if (params.projectId === "proj-acme" && params.sessionId === "sess-2") {
        return Promise.resolve(makeEmptyReport());
      }
      return Promise.resolve(makeNonEmptyReport());
    });
    renderBoard();
    await waitFor(() => expect(sessionsListMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Acme Corp" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Session" }), "Worker Two");

    expect(
      await screen.findByText("No focus history yet for this project's sessions")
    ).toBeInTheDocument();
    // Not a crash / error UI.
    expect(screen.queryByText("Couldn't load the focus report")).not.toBeInTheDocument();
  });

  it("renders the DEC-6 board-specific concurrency relabel via i18n.t(...), distinct from the modal's own per-project copy", async () => {
    renderBoard();
    await waitFor(() => expect(focusReportMock).toHaveBeenCalled());

    const boardLabel = i18n.t("plan:report.board.concurrentSessions");
    const modalLabel = i18n.t("plan:report.concurrency");
    expect(await screen.findByText(boardLabel)).toBeInTheDocument();
    expect(screen.queryByText(modalLabel)).not.toBeInTheDocument();
  });
});
