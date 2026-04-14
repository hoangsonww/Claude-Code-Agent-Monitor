/**
 * @file AgentCard.test.tsx
 * @description Unit tests for the AgentCard component, which displays information about an agent in the application. The tests cover rendering of agent details such as name, status, subagent type, task, and current tool, as well as interaction handling like click events. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// render is used inside renderCard helper
import { MemoryRouter } from "react-router-dom";
import { AgentCard } from "../AgentCard";
import type { Agent } from "../../lib/types";

function renderCard(element: JSX.Element) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

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

describe("AgentCard", () => {
  it("should render agent name", () => {
    renderCard(<AgentCard agent={makeAgent({ name: "Test Agent" })} />);
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("should render status badge", () => {
    renderCard(<AgentCard agent={makeAgent({ status: "working" })} />);
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("should render subagent_type when present", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          type: "subagent",
          subagent_type: "Explore",
        })}
      />
    );
    expect(screen.getByText("Explore")).toBeInTheDocument();
  });

  it("should not render subagent_type when null", () => {
    const { container } = renderCard(<AgentCard agent={makeAgent({ subagent_type: null })} />);
    // Only the name should be in the name container, no subagent type
    expect(container.querySelectorAll(".text-\\[11px\\].text-gray-500.truncate")).toHaveLength(0);
  });

  it("should render task when present", () => {
    renderCard(<AgentCard agent={makeAgent({ task: "Searching for patterns" })} />);
    expect(screen.getByText("Searching for patterns")).toBeInTheDocument();
  });

  it("should not render task when null", () => {
    renderCard(<AgentCard agent={makeAgent({ task: null })} />);
    expect(screen.queryByText("Searching for patterns")).not.toBeInTheDocument();
  });

  it("should render current_tool when present", () => {
    renderCard(<AgentCard agent={makeAgent({ current_tool: "Bash", status: "working" })} />);
    expect(screen.getByText("Bash")).toBeInTheDocument();
  });

  it("should not render current_tool when null", () => {
    renderCard(<AgentCard agent={makeAgent({ current_tool: null })} />);
    expect(screen.queryByText("Bash")).not.toBeInTheDocument();
  });

  it("should apply active border for working agents", () => {
    const { container } = renderCard(<AgentCard agent={makeAgent({ status: "working" })} />);
    const card = container.querySelector(".card-hover");
    expect(card?.className).toContain("border-l-2");
  });

  it("should apply active border for connected agents", () => {
    const { container } = renderCard(<AgentCard agent={makeAgent({ status: "connected" })} />);
    const card = container.querySelector(".card-hover");
    expect(card?.className).toContain("border-l-2");
  });

  it("should not apply active border for completed agents", () => {
    const { container } = renderCard(<AgentCard agent={makeAgent({ status: "completed" })} />);
    const card = container.querySelector(".card-hover");
    expect(card?.className).not.toContain("border-l-2");
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    renderCard(<AgentCard agent={makeAgent()} onClick={onClick} />);
    fireEvent.click(screen.getByText("Main Agent"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should show duration for completed agents with ended_at", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          status: "completed",
          started_at: "2026-03-05T10:00:00.000Z",
          ended_at: "2026-03-05T10:05:30.000Z",
        })}
      />
    );
    expect(screen.getByText(/ran 5m 30s/)).toBeInTheDocument();
  });
});
