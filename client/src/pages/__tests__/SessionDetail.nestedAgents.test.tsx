import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SessionDetail } from "../SessionDetail";
import type { Agent, Session, DashboardEvent } from "../../lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    session_id: "sess-1",
    name: "Main Agent",
    type: "main",
    subagent_type: null,
    status: "connected",
    task: null,
    current_tool: null,
    started_at: "2026-03-05T10:00:00.000Z",
    ended_at: null,
    updated_at: "2026-03-05T10:00:00.000Z",
    parent_agent_id: null,
    metadata: null,
    ...overrides,
  };
}

const mockSession: Session = {
  id: "sess-1",
  name: "Test Session",
  status: "active",
  cwd: "/test",
  model: "claude-opus-4-6",
  started_at: "2026-03-05T10:00:00.000Z",
  ended_at: null,
  metadata: null,
};

// ── Mock API ─────────────────────────────────────────────────────────────────

let mockAgents: Agent[] = [];

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      get: vi.fn(() =>
        Promise.resolve({
          session: mockSession,
          agents: mockAgents,
          events: [] as DashboardEvent[],
        })
      ),
    },
    pricing: {
      sessionCost: vi.fn(() => Promise.resolve({ total_cost: 0, breakdown: [] })),
    },
  },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: vi.fn(() => () => {}),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/sessions/sess-1"]}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SessionDetail — Nested Agent Tree Rendering", () => {
  beforeEach(() => {
    mockAgents = [];
  });

  it("renders a flat main → subagent hierarchy (depth 1)", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main Agent", type: "main", status: "working" }),
      makeAgent({
        id: "sub-1",
        name: "Explorer",
        type: "subagent",
        subagent_type: "Explore",
        status: "working",
        parent_agent_id: "main-1",
      }),
    ];

    renderPage();
    expect(await screen.findByText("Main Agent")).toBeInTheDocument();
    // Subagent should be visible (auto-expanded because it's working)
    expect(await screen.findByText("Explorer")).toBeInTheDocument();
  });

  it("renders deeply nested agents (depth 3: main → L1 → L2 → L3)", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "idle" }),
      makeAgent({
        id: "l1",
        name: "Level-1",
        type: "subagent",
        status: "working",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "l2",
        name: "Level-2",
        type: "subagent",
        status: "working",
        parent_agent_id: "l1",
      }),
      makeAgent({
        id: "l3",
        name: "Level-3",
        type: "subagent",
        status: "working",
        parent_agent_id: "l2",
      }),
    ];

    renderPage();
    // All levels should render (auto-expanded because they have working children)
    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(await screen.findByText("Level-1")).toBeInTheDocument();
    expect(await screen.findByText("Level-2")).toBeInTheDocument();
    expect(await screen.findByText("Level-3")).toBeInTheDocument();
  });

  it("shows descendant count in collapsed badge for nested agents", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "idle" }),
      makeAgent({
        id: "l1",
        name: "Level-1",
        type: "subagent",
        status: "completed",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "l2",
        name: "Level-2",
        type: "subagent",
        status: "completed",
        parent_agent_id: "l1",
      }),
      makeAgent({
        id: "l3a",
        name: "Level-3a",
        type: "subagent",
        status: "completed",
        parent_agent_id: "l2",
      }),
      makeAgent({
        id: "l3b",
        name: "Level-3b",
        type: "subagent",
        status: "completed",
        parent_agent_id: "l2",
      }),
    ];

    renderPage();
    // Main has 4 total descendants (L1, L2, L3a, L3b) — should show "4 subagents" when collapsed
    expect(await screen.findByText("4 subagents")).toBeInTheDocument();
  });

  it("expands and collapses nested agent groups", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "idle" }),
      makeAgent({
        id: "l1",
        name: "Level-1",
        type: "subagent",
        status: "completed",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "l2",
        name: "Level-2",
        type: "subagent",
        status: "completed",
        parent_agent_id: "l1",
      }),
    ];

    renderPage();
    // Initially collapsed (agents are completed, no auto-expand)
    expect(await screen.findByText("2 subagents")).toBeInTheDocument();
    expect(screen.queryByText("Level-1")).not.toBeInTheDocument();

    // Click the count badge to expand
    fireEvent.click(screen.getByText("2 subagents"));
    expect(await screen.findByText("Level-1")).toBeInTheDocument();
    // Level-2 is still nested under Level-1 which is collapsed
    expect(screen.getByText("1 subagent")).toBeInTheDocument();
  });

  it("renders orphaned subagents in dedicated section", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "idle" }),
      makeAgent({
        id: "orphan-1",
        name: "Orphan Agent",
        type: "subagent",
        status: "working",
        parent_agent_id: "nonexistent-parent",
      }),
    ];

    renderPage();
    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(await screen.findByText("Orphan Agent")).toBeInTheDocument();
    expect(await screen.findByText("Unparented Subagents")).toBeInTheDocument();
  });

  it("auto-expands all ancestors when a deeply nested agent is active", async () => {
    // Level-3 is working → Level-2, Level-1, and Main should all auto-expand
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "idle" }),
      makeAgent({
        id: "l1",
        name: "Level-1",
        type: "subagent",
        status: "working",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "l2",
        name: "Level-2",
        type: "subagent",
        status: "working",
        parent_agent_id: "l1",
      }),
      makeAgent({
        id: "l3",
        name: "Deep Active",
        type: "subagent",
        status: "working",
        parent_agent_id: "l2",
      }),
    ];

    renderPage();
    // All levels should be visible because l3 is working, triggering ancestor expansion
    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(await screen.findByText("Level-1")).toBeInTheDocument();
    expect(await screen.findByText("Level-2")).toBeInTheDocument();
    expect(await screen.findByText("Deep Active")).toBeInTheDocument();
  });

  it("handles agents with no children (leaf nodes)", async () => {
    mockAgents = [makeAgent({ id: "main-1", name: "Main", type: "main", status: "working" })];

    renderPage();
    expect(await screen.findByText("Main")).toBeInTheDocument();
    // No expand button should exist for leaf node
    expect(screen.queryByText(/subagent/)).not.toBeInTheDocument();
  });

  it("renders multiple main agents in the same session", async () => {
    // Edge case: import/resume could create multiple "main" entries
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main-A", type: "main", status: "completed" }),
      makeAgent({ id: "main-2", name: "Main-B", type: "main", status: "working" }),
      makeAgent({
        id: "sub-a",
        name: "Sub of A",
        type: "subagent",
        status: "completed",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "sub-b",
        name: "Sub of B",
        type: "subagent",
        status: "working",
        parent_agent_id: "main-2",
      }),
    ];

    renderPage();
    expect(await screen.findByText("Main-A")).toBeInTheDocument();
    expect(await screen.findByText("Main-B")).toBeInTheDocument();
    // Sub of B auto-expanded (working)
    expect(await screen.findByText("Sub of B")).toBeInTheDocument();
  });

  it("renders sibling subagents at the same depth", async () => {
    mockAgents = [
      makeAgent({ id: "main-1", name: "Main", type: "main", status: "working" }),
      makeAgent({
        id: "sub-a",
        name: "Sibling-A",
        type: "subagent",
        status: "working",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "sub-b",
        name: "Sibling-B",
        type: "subagent",
        status: "working",
        parent_agent_id: "main-1",
      }),
      makeAgent({
        id: "sub-c",
        name: "Sibling-C",
        type: "subagent",
        status: "completed",
        parent_agent_id: "main-1",
      }),
    ];

    renderPage();
    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(await screen.findByText("Sibling-A")).toBeInTheDocument();
    expect(await screen.findByText("Sibling-B")).toBeInTheDocument();
    expect(await screen.findByText("Sibling-C")).toBeInTheDocument();
  });
});
