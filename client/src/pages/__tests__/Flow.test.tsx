/**
 * @file Flow.test.tsx
 * @description Tests for the Live Flow page: the empty state, one card per active session with
 * its tools on the ring, and a live WebSocket event landing in the side feed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Flow } from "../Flow";
import type { Agent, DashboardEvent, Session, WSMessage } from "../../lib/types";

let mockSessions: Session[] = [];
let mockAgents: Agent[] = [];
let mockEvents: DashboardEvent[] = [];
let listener: ((msg: WSMessage) => void) | null = null;

vi.mock("../../lib/api", () => ({
  api: {
    sessions: { list: vi.fn(() => Promise.resolve({ sessions: mockSessions })) },
    agents: { list: vi.fn(() => Promise.resolve({ agents: mockAgents })) },
    events: {
      list: vi.fn(() => Promise.resolve({ events: mockEvents, total: mockEvents.length })),
    },
  },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: vi.fn((fn: (msg: WSMessage) => void) => {
      listener = fn;
      return () => {
        listener = null;
      };
    }),
    onConnection: vi.fn(() => () => {}),
    connected: true,
  },
}));

const session = {
  id: "sess-1",
  name: "shoresh-api",
  status: "active",
  cwd: "/work/shoresh",
  model: null,
  started_at: "2026-11-18T10:00:00.000Z",
  ended_at: null,
} as unknown as Session;

const mainAgent = {
  id: "sess-1-main",
  session_id: "sess-1",
  name: "Main",
  type: "main",
  subagent_type: null,
  status: "working",
  task: null,
  current_tool: null,
  started_at: "2026-11-18T10:00:00.000Z",
  ended_at: null,
  updated_at: "2026-11-18T10:00:00.000Z",
  parent_agent_id: null,
  metadata: null,
} as Agent;

function event(id: number, tool: string | null, summary: string): DashboardEvent {
  return {
    id,
    session_id: "sess-1",
    agent_id: "sess-1-main",
    event_type: tool ? "PreToolUse" : "Stop",
    tool_name: tool,
    summary,
    data: null,
    created_at: new Date().toISOString(),
  } as DashboardEvent;
}

function renderFlow() {
  return render(
    <MemoryRouter>
      <Flow />
    </MemoryRouter>
  );
}

describe("Flow page", () => {
  beforeEach(() => {
    mockSessions = [];
    mockAgents = [];
    mockEvents = [];
    listener = null;
  });

  it("shows the empty state when no session is active", async () => {
    renderFlow();
    expect(await screen.findByText("No active sessions")).toBeInTheDocument();
  });

  it("draws one card per active session with its tools", async () => {
    mockSessions = [session];
    mockAgents = [mainAgent];
    mockEvents = [event(1, "Bash", "Ran tests"), event(2, "Edit", "Edited app.ts")];
    renderFlow();
    expect(await screen.findByRole("button", { name: /shoresh-api/ })).toBeInTheDocument();
    expect(screen.getAllByText("Bash").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("adds a live event to the feed", async () => {
    mockSessions = [session];
    mockAgents = [mainAgent];
    renderFlow();
    await screen.findByRole("button", { name: /shoresh-api/ });
    await waitFor(() => expect(listener).not.toBeNull());
    act(() => {
      listener?.({ type: "new_event", data: event(9, "Grep", "Searched the repo") } as WSMessage);
    });
    expect((await screen.findAllByText(/Searched the repo/)).length).toBeGreaterThan(0);
  });
});
