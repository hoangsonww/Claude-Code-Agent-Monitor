/**
 * @file KanbanBoard.projectsView.test.tsx
 * @description Tests for the Kanban Board's third "Projects" view toggle:
 * switching to it renders one column per project (grouping sessions by
 * folder via each project's mapped cwds) plus an Unassigned column for
 * sessions whose cwd isn't mapped to any project. Also covers the "Hide
 * completed" toggle, which filters completed sessions out of every column
 * and drops any column left empty by that filter, plus the monitor grouping
 * feature (creating/renaming/deleting monitors, dragging project columns
 * into/out of/between their bordered boxes, and dragging a monitor's box to
 * reposition it left-to-right in the same row) that activates once at least
 * one monitor exists.
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

  describe("monitor groups (boxed clusters in a single row)", () => {
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
      sessionsListMock.mockImplementation((params?: { status?: string }) => {
        const filtered = params?.status
          ? twoProjectSessions.filter((s) => s.status === params.status)
          : twoProjectSessions;
        return Promise.resolve({ sessions: filtered, total: filtered.length });
      });
    });

    async function addMonitor() {
      const before = screen.queryAllByDisplayValue(/^Monitor \d+$/).length;
      fireEvent.click(screen.getByRole("button", { name: "Add Monitor" }));
      await waitFor(() =>
        expect(screen.queryAllByDisplayValue(/^Monitor \d+$/).length).toBe(before + 1)
      );
    }

    function currentMonitors(): { id: string; name: string }[] {
      return JSON.parse(localStorage.getItem("kanban-monitors") ?? "[]");
    }

    function currentMonitorMap(): Record<string, string> {
      return JSON.parse(localStorage.getItem("kanban-monitor-map") ?? "{}");
    }

    /** Grabs the nth persisted monitor, asserting it exists - keeps the
     *  drag tests below free of non-null assertions on array indexing. */
    function nthMonitor(n: number): { id: string; name: string } {
      const monitor = currentMonitors()[n];
      if (!monitor) throw new Error(`expected a monitor at index ${n}`);
      return monitor;
    }

    /** Left-to-right order of the top-level monitor boxes in the row, by
     *  reading each box's own name from its header input - used only for the
     *  box-reordering test below. Cluster *membership* (which columns ended
     *  up inside a box) is asserted with `within(box)` instead, since
     *  columns are now real DOM children of their monitor's box. */
    function monitorBoxOrder(): string[] {
      const row = screen.getByTestId("kanban-board-row");
      return Array.from(row.children)
        .filter((node) => (node as HTMLElement).dataset.testid?.startsWith("monitor-box-"))
        .map((node) => (node.querySelector("input") as HTMLInputElement).value);
    }

    function dragColumnOnto(column: HTMLElement, target: HTMLElement) {
      fireEvent.dragStart(column);
      fireEvent.dragOver(target);
      fireEvent.dragEnd(column);
    }

    it("shows Add Monitor only in the Projects view", async () => {
      renderPage();
      expect(screen.queryByRole("button", { name: "Add Monitor" })).not.toBeInTheDocument();

      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      expect(screen.getByRole("button", { name: "Add Monitor" })).toBeInTheDocument();
    });

    it("creates a monitor with a default name and persists it", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");

      await addMonitor();

      expect(screen.getByDisplayValue("Monitor 1")).toBeInTheDocument();
      const stored = currentMonitors();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.name).toBe("Monitor 1");
    });

    it("drags a project column onto an empty monitor's box and persists the assignment, rendering it inside the box", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor();

      const monitorId = nthMonitor(0).id;
      const agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      const box = screen.getByTestId(`monitor-box-${monitorId}`);

      dragColumnOnto(agentMonitorColumn, box);

      expect(currentMonitorMap()["proj-1"]).toBe(monitorId);
      expect(within(box).getByText("Agent Monitor")).toBeInTheDocument();
    });

    it("moves a project between monitor boxes, including via a column already inside the target box", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor(); // Monitor 1
      await addMonitor(); // Monitor 2
      const monitor1 = nthMonitor(0);
      const monitor2 = nthMonitor(1);

      // Put Agent Monitor into Monitor 1's box.
      let agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      dragColumnOnto(agentMonitorColumn, screen.getByTestId(`monitor-box-${monitor1.id}`));
      expect(currentMonitorMap()["proj-1"]).toBe(monitor1.id);

      // Drag Coaching Assistant onto Agent Monitor (already inside Monitor
      // 1's box) - it should join Monitor 1 without needing the box itself
      // as the drop target.
      agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      const coachingColumn = screen
        .getByText("Coaching Assistant")
        .closest("div.bg-surface-1") as HTMLElement;
      dragColumnOnto(coachingColumn, agentMonitorColumn);

      expect(currentMonitorMap()["proj-2"]).toBe(monitor1.id);
      let box1 = screen.getByTestId(`monitor-box-${monitor1.id}`);
      expect(within(box1).getByText("Agent Monitor")).toBeInTheDocument();
      expect(within(box1).getByText("Coaching Assistant")).toBeInTheDocument();

      // Now move Coaching Assistant on to Monitor 2's box.
      const coachingColumn2 = screen
        .getByText("Coaching Assistant")
        .closest("div.bg-surface-1") as HTMLElement;
      dragColumnOnto(coachingColumn2, screen.getByTestId(`monitor-box-${monitor2.id}`));

      expect(currentMonitorMap()["proj-2"]).toBe(monitor2.id);
      box1 = screen.getByTestId(`monitor-box-${monitor1.id}`);
      const box2 = screen.getByTestId(`monitor-box-${monitor2.id}`);
      expect(within(box1).queryByText("Coaching Assistant")).not.toBeInTheDocument();
      expect(within(box2).getByText("Coaching Assistant")).toBeInTheDocument();
    });

    it("dragging a project onto the Ungrouped marker clears its monitor assignment", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor();
      const monitorId = nthMonitor(0).id;

      let agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      const box = screen.getByTestId(`monitor-box-${monitorId}`);
      dragColumnOnto(agentMonitorColumn, box);
      expect(currentMonitorMap()["proj-1"]).toBe(monitorId);
      expect(within(box).getByText("Agent Monitor")).toBeInTheDocument();

      agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      dragColumnOnto(agentMonitorColumn, screen.getByTestId("monitor-divider-__ungrouped__"));

      expect(currentMonitorMap()["proj-1"]).toBeUndefined();
      expect(within(box).queryByText("Agent Monitor")).not.toBeInTheDocument();
      // Back to being a loose column, not nested inside any box.
      expect(screen.getByText("Agent Monitor").closest("div.bg-surface-1")).not.toBeNull();
    });

    it("drags a monitor's box onto another to reposition it, and persists the new monitor order", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor(); // Monitor 1
      await addMonitor(); // Monitor 2
      const monitor1 = nthMonitor(0);
      const monitor2 = nthMonitor(1);
      expect(monitorBoxOrder()).toEqual(["Monitor 1", "Monitor 2"]);

      const box1 = screen.getByTestId(`monitor-box-${monitor1.id}`);
      const box2 = screen.getByTestId(`monitor-box-${monitor2.id}`);
      fireEvent.dragStart(box1);
      fireEvent.dragOver(box2);
      fireEvent.dragEnd(box1);

      expect(monitorBoxOrder()).toEqual(["Monitor 2", "Monitor 1"]);
      expect(currentMonitors().map((m) => m.id)).toEqual([monitor2.id, monitor1.id]);
    });

    it("does not let the Ungrouped marker be dragged", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await addMonitor();
      const ungroupedMarker = screen.getByTestId("monitor-divider-__ungrouped__");
      expect(ungroupedMarker).toHaveAttribute("draggable", "false");
    });

    it("deleting a monitor removes its box and returns its project to Ungrouped", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      // A second monitor stays around after the first is deleted, so the
      // boxed layout (including the Ungrouped marker) keeps rendering -
      // deleting the *only* monitor instead reverts to the flat layout
      // entirely, covered by its own expectation below.
      await addMonitor(); // Monitor 1
      await addMonitor(); // Monitor 2
      const monitor1 = nthMonitor(0);

      const agentMonitorColumn = screen
        .getByText("Agent Monitor")
        .closest("div.bg-surface-1") as HTMLElement;
      dragColumnOnto(agentMonitorColumn, screen.getByTestId(`monitor-box-${monitor1.id}`));
      expect(currentMonitorMap()["proj-1"]).toBe(monitor1.id);

      const box1 = screen.getByTestId(`monitor-box-${monitor1.id}`);
      fireEvent.click(within(box1).getByRole("button", { name: "Remove monitor" }));

      expect(screen.queryByTestId(`monitor-box-${monitor1.id}`)).not.toBeInTheDocument();
      expect(currentMonitors()).toHaveLength(1);
      expect(currentMonitorMap()["proj-1"]).toBeUndefined();
      // Agent Monitor survives as a loose column, not nested in any box.
      expect(screen.getByText("Agent Monitor").closest("div.bg-surface-1")).not.toBeNull();
    });

    it("deleting the only monitor reverts to the flat, box-free layout", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor();
      const monitorId = nthMonitor(0).id;

      fireEvent.click(screen.getByRole("button", { name: "Remove monitor" }));

      expect(currentMonitors()).toHaveLength(0);
      expect(screen.queryByTestId(`monitor-box-${monitorId}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId("monitor-divider-__ungrouped__")).not.toBeInTheDocument();
      // Agent Monitor's column still renders, just back in the plain flat row.
      expect(screen.getByText("Agent Monitor").closest("div.bg-surface-1")).not.toBeNull();
    });

    it("restores monitors and their project assignments on remount", async () => {
      const monitorId = "monitor-fixed-1";
      localStorage.setItem(
        "kanban-monitors",
        JSON.stringify([{ id: monitorId, name: "Left Screen" }])
      );
      localStorage.setItem("kanban-monitor-map", JSON.stringify({ "proj-1": monitorId }));

      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");

      const box = screen.getByTestId(`monitor-box-${monitorId}`);
      expect(within(box).getByText("Agent Monitor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Left Screen")).toBeInTheDocument();
      // Coaching Assistant has no monitor assignment, so it stays a loose
      // column outside every box, right after the Ungrouped marker.
      expect(within(box).queryByText("Coaching Assistant")).not.toBeInTheDocument();
      expect(screen.getByText("Coaching Assistant").closest("div.bg-surface-1")).not.toBeNull();
    });

    it("renames a monitor on blur and persists the new name", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("tab", { name: "Projects" }));
      await screen.findByText("Agent Monitor");
      await addMonitor();

      const input = screen.getByDisplayValue("Monitor 1");
      fireEvent.change(input, { target: { value: "Left Screen" } });
      fireEvent.blur(input);

      expect(screen.getByDisplayValue("Left Screen")).toBeInTheDocument();
      expect(nthMonitor(0).name).toBe("Left Screen");
    });
  });
});
