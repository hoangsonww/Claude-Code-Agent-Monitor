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
import { formatModelName } from "../../lib/format";

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
    status: "working",
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

  it("should show the subagent's own model from metadata, not the session model (issue #185)", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          type: "subagent",
          subagent_type: "qa",
          metadata: JSON.stringify({ model: "claude-haiku-4-5-20251001" }),
        })}
        // Session is Opus, but the subagent card must read Haiku from metadata.
        session={
          {
            id: "sess-1",
            name: "S",
            status: "active",
            cwd: "/x",
            model: "claude-opus-4-8",
          } as never
        }
      />
    );
    // Subtitle is the subagent type + project (cwd); the model badge shows the
    // subagent's OWN model.
    expect(screen.getByText("qa · x")).toBeInTheDocument();
    expect(screen.getByText(formatModelName("claude-haiku-4-5-20251001")!)).toBeInTheDocument();
    // The Opus session model must NOT appear on a subagent card.
    expect(screen.queryByText(formatModelName("claude-opus-4-8")!)).not.toBeInTheDocument();
  });

  it("main agent subtitle shows project + agent count, with the model only once (#185)", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "main", name: "Main" })}
        session={
          {
            id: "s",
            name: "S",
            status: "active",
            cwd: "/Users/dev/proj",
            model: "claude-opus-4-8",
            agent_count: 4,
            metadata: JSON.stringify({ turn_count: 12 }),
          } as never
        }
      />
    );
    // Subtitle: project basename + agent count + turn count (model excluded).
    expect(screen.getByText("proj · 4 agents · 12 turns")).toBeInTheDocument();
    // The model appears exactly once — in the footer badge, not duplicated in
    // the subtitle the way main cards used to.
    expect(screen.getAllByText(formatModelName("claude-opus-4-8")!)).toHaveLength(1);
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

  it("should apply yellow border for waiting agents even without awaiting_input_since", () => {
    const { container } = renderCard(<AgentCard agent={makeAgent({ status: "waiting" })} />);
    const card = container.querySelector(".card-hover");
    expect(card?.className).toContain("border-l-2");
    expect(card?.className).toContain("border-l-yellow-500/60");
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

  it("renders waiting badge and yellow accent when awaiting_input_since is set", () => {
    const { container } = renderCard(
      <AgentCard
        agent={makeAgent({
          status: "waiting",
          awaiting_input_since: "2026-03-05T10:01:00.000Z",
        })}
      />
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    const card = container.querySelector(".card-hover");
    expect(card?.className).toContain("border-l-yellow-500/60");
  });

  it("ignores awaiting_input_since once the agent has completed", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          status: "completed",
          awaiting_input_since: "2026-03-05T10:01:00.000Z",
          ended_at: "2026-03-05T10:02:00.000Z",
        })}
      />
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
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
