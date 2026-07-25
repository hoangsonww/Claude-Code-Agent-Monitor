/**
 * @file KanbanBoard.projectsView.test.tsx
 * @description Tests for the Kanban Board's third "Projects" view toggle:
 * switching to it renders one column per project (grouping sessions by
 * folder via each project's mapped cwds) plus an Unassigned column for
 * sessions whose cwd isn't mapped to any project. Also covers the "Hide
 * completed" toggle, which filters completed sessions out of every column
 * and drops any column left empty by that filter.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { KanbanBoard } from "../KanbanBoard";
import type { Project, Session, UnassignedProjectBucket } from "../../lib/types";

const mockProject: Project = {
  id: "proj-1",
  name: "Agent Monitor",
  paths: [{ id: 1, cwd: "/repo/agent-monitor" }],
  session_count: 1,
  active_count: 1,
  last_activity: "2026-06-10T12:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T12:00:00.000Z",
};

const mockProject2: Project = {
  id: "proj-2",
  name: "Coaching Assistant",
  paths: [{ id: 2, cwd: "/repo/coaching-assistant" }],
  session_count: 1,
  active_count: 0,
  last_activity: "2026-06-08T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-08T00:00:00.000Z",
};

const mockUnassigned: UnassignedProjectBucket = {
  cwds: ["/repo/scratch"],
  session_count: 1,
  active_count: 0,
  last_activity: "2026-06-09T00:00:00.000Z",
};

const mockSessions: Session[] = [
  {
    id: "sess-1",
    name: "In project",
    status: "active",
    cwd: "/repo/agent-monitor",
    model: "claude-opus-4-6",
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
  } as Session,
  {
    id: "sess-2",
    name: "Not in project",
    status: "completed",
    cwd: "/repo/scratch",
    model: "claude-opus-4-6",
    started_at: "2026-06-09T00:00:00.000Z",
    ended_at: "2026-06-09T00:30:00.000Z",
    metadata: null,
  } as Session,
];

const projectsListMock = vi.fn();
const sessionsListMock = vi.fn();
const agentsListMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    agents: { list: (...args: unknown[]) => agentsListMock(...args) },
    sessions: { list: (...args: unknown[]) => sessionsListMock(...args) },
    projects: { list: (...args: unknown[]) => projectsListMock(...args) },
  },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: vi.fn(() => () => {}),
    onConnection: () => () => {},
    connected: true,
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <KanbanBoard />
    </MemoryRouter>
  );
}

describe("Kanban Board - Projects view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {
      /* jsdom always has localStorage; guard only for odd environments */
    }
    agentsListMock.mockResolvedValue({ agents: [] });
    // The real server filters by `?status=`; KanbanBoard fetches once per
    // persisted status and unions the results, so the mock must filter too -
    // otherwise every status-scoped call returns every session and the union
    // duplicates each one (React key collisions on re-render).
    sessionsListMock.mockImplementation((params?: { status?: string }) => {
      const filtered = params?.status
        ? mockSessions.filter((s) => s.status === params.status)
        : mockSessions;
      return Promise.resolve({ sessions: filtered, total: filtered.length });
    });
    projectsListMock.mockResolvedValue({ projects: [mockProject], unassigned: mockUnassigned });
  });

  it("renders a Projects column with its session and an Unassigned column with the rest", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));

    await waitFor(() => expect(projectsListMock).toHaveBeenCalled());

    const projectColumn = (await screen.findByText("Agent Monitor")).closest("div.bg-surface-1");
    expect(projectColumn).not.toBeNull();
    expect(within(projectColumn as HTMLElement).getByText("In project")).toBeInTheDocument();

    const unassignedColumn = screen.getByText("Unassigned").closest("div.bg-surface-1");
    expect(unassignedColumn).not.toBeNull();
    expect(within(unassignedColumn as HTMLElement).getByText("Not in project")).toBeInTheDocument();
  });

  it("hides completed sessions and drops any column left empty by the filter", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
    await screen.findByText("Agent Monitor");
    // Sanity: both columns present before filtering - the Unassigned column's
    // only session ("Not in project") is completed, so it's the one that
    // should vanish once the filter is on.
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("Not in project")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide completed" }));

    await waitFor(() => expect(screen.queryByText("Not in project")).not.toBeInTheDocument());
    // The whole Unassigned column is gone, not just the card inside it - its
    // only session was completed, so filtering left it with zero items.
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    // The Agent Monitor project's session is active, not completed, so its
    // column survives the filter untouched.
    expect(screen.getByText("Agent Monitor")).toBeInTheDocument();
    expect(screen.getByText("In project")).toBeInTheDocument();

    // Toggling back off restores both.
    fireEvent.click(screen.getByRole("button", { name: "Show completed" }));
    await waitFor(() => expect(screen.getByText("Unassigned")).toBeInTheDocument());
    expect(screen.getByText("Not in project")).toBeInTheDocument();
  });

  it("persists the Projects view choice across remounts", async () => {
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
    await waitFor(() => expect(projectsListMock).toHaveBeenCalled());
    unmount();

    projectsListMock.mockClear();
    renderPage();

    await waitFor(() => expect(projectsListMock).toHaveBeenCalled());
    expect(await screen.findByRole("tab", { name: "Projects" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  describe("drag to reorder columns", () => {
    function columnOrder() {
      // Column labels render as the uppercase-tracked span right after the
      // (optional) drag-grip icon - grab every column's label text in DOM
      // order, which mirrors visual left-to-right order in the flex row.
      return screen
        .getAllByText(/^(Agent Monitor|Coaching Assistant|Unassigned)$/)
        .map((el) => el.textContent);
    }

    beforeEach(() => {
      projectsListMock.mockResolvedValue({
        projects: [mockProject, mockProject2], // server order: Agent Monitor, Coaching Assistant
        unassigned: { cwds: [], session_count: 0, active_count: 0, last_activity: null },
      });
      const twoProjectSessions: Session[] = [
        mockSessions[0] as Session,
        {
          id: "sess-3",
          name: "Coaching session",
          status: "active",
          cwd: "/repo/coaching-assistant",
          model: "claude-opus-4-6",
          started_at: "2026-06-08T00:00:00.000Z",
          ended_at: null,
          metadata: null,
        } as Session,
      ];
      // Same filter-by-status requirement as the outer beforeEach: KanbanBoard
      // fetches once per persisted status and unions the results, so an
      // unfiltered mock duplicates every session across all four calls.
      sessionsListMock.mockImplementation((params?: { status?: string }) => {
        const filtered = params?.status
          ? twoProjectSessions.filter((s) => s.status === params.status)
          : twoProjectSessions;
        return Promise.resolve({ sessions: filtered, total: filtered.length });
      });
    });

    it("drags the second column over the first to move it to the front, and persists the order", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      // Unassigned always renders (even empty) unless "Hide completed" filters
      // it away - see the sibling describe block above - and always stays last.
      expect(columnOrder()).toEqual(["Agent Monitor", "Coaching Assistant", "Unassigned"]);

      const agentMonitorColumn = screen.getByText("Agent Monitor").closest("div.bg-surface-1");
      const coachingColumn = screen.getByText("Coaching Assistant").closest("div.bg-surface-1");

      fireEvent.dragStart(coachingColumn as HTMLElement);
      fireEvent.dragOver(agentMonitorColumn as HTMLElement);
      fireEvent.dragEnd(coachingColumn as HTMLElement);

      expect(columnOrder()).toEqual(["Coaching Assistant", "Agent Monitor", "Unassigned"]);
      expect(JSON.parse(localStorage.getItem("projects-page-order") ?? "[]")).toEqual([
        "proj-2",
        "proj-1",
      ]);
    });

    it("does not let the Unassigned column be dragged", async () => {
      projectsListMock.mockResolvedValue({
        projects: [mockProject],
        unassigned: mockUnassigned,
      });
      sessionsListMock.mockImplementation((params?: { status?: string }) => {
        const filtered = params?.status
          ? mockSessions.filter((s) => s.status === params.status)
          : mockSessions;
        return Promise.resolve({ sessions: filtered, total: filtered.length });
      });
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Unassigned");

      const unassignedColumn = screen.getByText("Unassigned").closest("div.bg-surface-1");
      expect(unassignedColumn).toHaveAttribute("draggable", "false");
    });

    it("restores a previously persisted order on load, shared with the Projects page's key", async () => {
      localStorage.setItem("projects-page-order", JSON.stringify(["proj-2", "proj-1"]));
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));

      await screen.findByText("Coaching Assistant");
      expect(columnOrder()).toEqual(["Coaching Assistant", "Agent Monitor", "Unassigned"]);
    });
  });
});
