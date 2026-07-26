/**
 * @file Projects.test.tsx
 * @description Tests for the Projects page: rendering a project's folders and
 * aggregated session badges, the unassigned-folder bucket, and the
 * create/rename/delete/add-folder interactions against a mocked api layer.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Projects } from "../Projects";
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
    name: "Test session",
    status: "active",
    cwd: "/repo/agent-monitor",
    model: "claude-opus-4-6",
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
  } as Session,
  {
    id: "sess-2",
    name: "Scratch session",
    status: "completed",
    cwd: "/repo/scratch",
    model: "claude-opus-4-6",
    started_at: "2026-06-09T00:00:00.000Z",
    ended_at: "2026-06-09T00:30:00.000Z",
    metadata: null,
  } as Session,
];

const listMock = vi.fn();
const createMock = vi.fn();
const renameMock = vi.fn();
const removeMock = vi.fn();
const addPathMock = vi.fn();
const removePathMock = vi.fn();
const sessionsListMock = vi.fn();
const focusReportMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    projects: {
      list: (...args: unknown[]) => listMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      rename: (...args: unknown[]) => renameMock(...args),
      remove: (...args: unknown[]) => removeMock(...args),
      addPath: (...args: unknown[]) => addPathMock(...args),
      removePath: (...args: unknown[]) => removePathMock(...args),
      focusReport: (...args: unknown[]) => focusReportMock(...args),
    },
    sessions: {
      list: (...args: unknown[]) => sessionsListMock(...args),
    },
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
      <Projects />
    </MemoryRouter>
  );
}

describe("Projects page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    listMock.mockResolvedValue({ projects: [mockProject], unassigned: mockUnassigned });
    sessionsListMock.mockResolvedValue({ sessions: mockSessions, total: mockSessions.length });
    createMock.mockResolvedValue({ project: { ...mockProject, id: "proj-2" } });
    renameMock.mockResolvedValue({ project: { ...mockProject, name: "Renamed" } });
    removeMock.mockResolvedValue({ ok: true });
    addPathMock.mockResolvedValue({ project: mockProject });
    removePathMock.mockResolvedValue({ project: mockProject });
    focusReportMock.mockResolvedValue({
      project_id: "proj-1",
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
    });
  });

  it("renders a project with its folder and aggregated session count, plus the unassigned bucket", async () => {
    renderPage();

    expect(await screen.findByText("Agent Monitor")).toBeInTheDocument();
    expect(screen.getAllByText("/repo/agent-monitor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 session").length).toBeGreaterThan(0);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getAllByText("/repo/scratch").length).toBeGreaterThan(0);
  });

  it("opens the focus-time report scoped to the clicked project", async () => {
    renderPage();
    await screen.findByText("Agent Monitor");

    fireEvent.click(screen.getByTitle("View focus-time report"));
    expect(await screen.findByText("Focus time — Agent Monitor")).toBeInTheDocument();
    expect(focusReportMock).toHaveBeenCalledWith("proj-1");

    fireEvent.click(screen.getByTitle("Close"));
    await waitFor(() =>
      expect(screen.queryByText("Focus time — Agent Monitor")).not.toBeInTheDocument()
    );
  });

  it("creates a project from the header form", async () => {
    renderPage();
    await screen.findByText("Agent Monitor");

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));
    fireEvent.change(screen.getByPlaceholderText("Project name"), {
      target: { value: "New Thing" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ name: "New Thing", cwds: undefined });
    });
  });

  it("renames a project inline", async () => {
    renderPage();
    await screen.findByText("Agent Monitor");

    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByDisplayValue("Agent Monitor");
    fireEvent.change(input, { target: { value: "Renamed Project" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameMock).toHaveBeenCalledWith("proj-1", "Renamed Project");
    });
  });

  it("deletes a project after a second confirm click", async () => {
    renderPage();
    await screen.findByText("Agent Monitor");

    const deleteButton = screen.getByRole("button", { name: /^Delete$/i });
    fireEvent.click(deleteButton);
    expect(removeMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Confirm delete/i }));

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith("proj-1");
    });
  });

  it("adds a folder mapping to a project", async () => {
    renderPage();
    await screen.findByText("Agent Monitor");

    fireEvent.click(screen.getByRole("button", { name: /Add folder/i }));
    fireEvent.change(screen.getByPlaceholderText("/path/to/folder"), {
      target: { value: "/repo/second-folder" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("/path/to/folder"), { key: "Enter" });

    await waitFor(() => {
      expect(addPathMock).toHaveBeenCalledWith("proj-1", "/repo/second-folder");
    });
  });

  describe("search", () => {
    it("filters by folder, not by project name, and hides a project with no matching sessions", async () => {
      renderPage();
      await screen.findByText("Agent Monitor");
      expect(screen.getByText("Unassigned")).toBeInTheDocument();

      // Matches the folder ("agent-monitor"), not the project's display name.
      fireEvent.change(screen.getByPlaceholderText("Search sessions by folder…"), {
        target: { value: "agent-monitor" },
      });

      await waitFor(() => expect(screen.queryByText("Unassigned")).not.toBeInTheDocument());
      expect(screen.getByText("Agent Monitor")).toBeInTheDocument();
      expect(screen.getByText("Test session")).toBeInTheDocument();
      expect(screen.queryByText("Scratch session")).not.toBeInTheDocument();
    });

    it("hides a project (but keeps Unassigned) when only the unassigned folder matches", async () => {
      renderPage();
      await screen.findByText("Agent Monitor");

      fireEvent.change(screen.getByPlaceholderText("Search sessions by folder…"), {
        target: { value: "scratch" },
      });

      await waitFor(() => expect(screen.queryByText("Agent Monitor")).not.toBeInTheDocument());
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
      expect(screen.getByText("Scratch session")).toBeInTheDocument();
    });

    it("shows a no-results message when nothing matches, and clearing search restores everything", async () => {
      renderPage();
      await screen.findByText("Agent Monitor");

      fireEvent.change(screen.getByPlaceholderText("Search sessions by folder…"), {
        target: { value: "no-such-folder" },
      });

      await waitFor(() =>
        expect(screen.getByText('No sessions match "no-such-folder"')).toBeInTheDocument()
      );
      expect(screen.queryByText("Agent Monitor")).not.toBeInTheDocument();
      expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

      await waitFor(() => expect(screen.getByText("Agent Monitor")).toBeInTheDocument());
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });
  });

  describe("drag to reorder", () => {
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

    function projectCardOrder() {
      return screen
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent)
        .filter((name) => name !== "Unassigned");
    }

    beforeEach(() => {
      listMock.mockResolvedValue({
        projects: [mockProject, mockProject2], // server order: Agent Monitor, Coaching Assistant
        unassigned: { cwds: [], session_count: 0, active_count: 0, last_activity: null },
      });
      sessionsListMock.mockResolvedValue({
        sessions: twoProjectSessions,
        total: twoProjectSessions.length,
      });
    });

    it("drags the second card over the first to move it to the front, and persists the order", async () => {
      renderPage();
      await screen.findByText("Agent Monitor");
      expect(projectCardOrder()).toEqual(["Agent Monitor", "Coaching Assistant"]);

      const cards = screen.getAllByRole("heading", { level: 2 }).map((h) => h.closest(".card"));
      const [agentMonitorCard, coachingCard] = cards as [HTMLElement, HTMLElement];

      fireEvent.dragStart(coachingCard);
      fireEvent.dragOver(agentMonitorCard);
      fireEvent.dragEnd(coachingCard);

      expect(projectCardOrder()).toEqual(["Coaching Assistant", "Agent Monitor"]);
      expect(JSON.parse(localStorage.getItem("projects-page-order") ?? "[]")).toEqual([
        "proj-2",
        "proj-1",
      ]);
    });

    it("restores a previously persisted order on load", async () => {
      localStorage.setItem("projects-page-order", JSON.stringify(["proj-2", "proj-1"]));
      renderPage();

      await screen.findByText("Coaching Assistant");
      expect(projectCardOrder()).toEqual(["Coaching Assistant", "Agent Monitor"]);
    });
  });
});
