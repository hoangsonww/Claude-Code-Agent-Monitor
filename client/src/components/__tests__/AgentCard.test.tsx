/**
 * @file AgentCard.test.tsx
 * @description Unit tests for the AgentCard component, including consistent
 * Claude Code/Cursor/Codex titles, subtitles, and transcript-derived context.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/AgentCard.test.tsx`
 *
 * Scope
 * Unit tests for the AgentCard component, including consistent Claude Code/Cursor/Codex titles,
 * subtitles, and transcript-derived context.
 *
 * Subjects and collaborators
 * - `../AgentCard` — local module imported by this suite.
 * - `../../lib/types` — local module imported by this suite.
 * - `../../lib/format` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 *
 * Suite groups
 * - `AgentCard`
 *
 * Protected behavior
 * - should render agent name
 * - should render status badge
 * - renders session task progress immediately before the status badge
 * - keeps task-progress interaction from triggering the card click
 * - should render subagent_type when present
 * - should show the subagent's own model from metadata, not the session model (issue #185)
 * - main agent subtitle shows project + subagent count, with the model only once (#185)
 * - keeps the full subtitle and a subagent's session name available on hover
 * - shows a subagent's OWN cost, not the session total (avoids misleading spend)
 * - shows the session total on a main-agent card
 * - shows no cost on a subagent card with no recorded usage
 * - titles a hook-style placeholder with the native session title, tool in the subtitle
 * - uses the native Claude Code title for an import-style placeholder
 * - falls back to an untitled label while a native Claude title is unavailable
 * - uses a native Codex title instead of a bare Codex agent name
 * - falls back to an untitled label while a native Codex title is unavailable
 * - uses the session prompt fallback to make an imported renamed Codex card informative
 * - uses the same compact two-turn session context for a Claude main agent
 * - should not render a subtitle for a subagent with no type or project
 * - should render task when present
 * - should not render task when null
 * - should render current_tool when present
 * - should not render current_tool when null
 * - should apply active border for working agents
 * - should apply yellow border for waiting agents even without awaiting_input_since
 * - should not apply active border for completed agents
 * - should call onClick when clicked
 * - does not navigate before a transient Codex process has a durable session id
 * - gives Cursor main cards a native title and an always-visible subtitle
 * - renders waiting badge and yellow accent when awaiting_input_since is set
 * - keeps the card badge compact: reason is tooltip-only, no inline chip
 * - degrades to a plain Waiting badge on an unknown awaiting_reason
 * - ignores awaiting_input_since once the agent has completed
 * - should show duration for completed agents with ended_at
 * - clamps very long titles to three lines and keeps the full title on hover
 * - leads every provider's main-card subtitle with the tool name
 * - drops the duplicate session name from a main card's footer but keeps it for subagents
 * - renders status as a dot with a tooltip label when statusDisplay is dot
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
// render is used inside renderCard helper
import { MemoryRouter, useLocation } from "react-router";
import { AgentCard } from "../AgentCard";
import type { Agent, Session, SessionTodoSummary } from "../../lib/types";
import { formatModelName, fmtCost } from "../../lib/format";

function renderCard(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
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

const taskSummary: SessionTodoSummary = {
  total: 3,
  completed: 2,
  inProgress: 1,
  pending: 0,
  cancelled: 0,
  unknown: 0,
  percentComplete: 67,
  activeText: "Confirm the setup is ready for local testing",
  sourceTool: "update_plan",
  updatedAt: "2026-08-08T00:06:07.958Z",
  previewItems: [],
  overflowCount: 0,
  ownerBreakdown: [],
};

describe("AgentCard", () => {
  it("should render agent name", () => {
    renderCard(<AgentCard agent={makeAgent({ name: "Test Agent" })} />);
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("should render status badge", () => {
    renderCard(<AgentCard agent={makeAgent({ status: "working" })} />);
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("renders session task progress immediately before the status badge", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ status: "waiting" })}
        session={
          {
            id: "sess-1",
            name: "Codex session",
            provider: "codex",
            status: "active",
            todo_summary: taskSummary,
          } as Session
        }
      />
    );

    const progress = screen.getByRole("button", { name: "Task progress: 2 of 3 complete" });
    const status = screen.getByText("Waiting");
    expect(
      progress.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps task-progress interaction from triggering the card click", () => {
    const onClick = vi.fn();
    renderCard(
      <AgentCard
        agent={makeAgent()}
        session={
          {
            id: "sess-1",
            name: "Task session",
            status: "active",
            todo_summary: taskSummary,
          } as Session
        }
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Task progress: 2 of 3 complete" }));
    expect(onClick).not.toHaveBeenCalled();
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

  it("main agent subtitle shows project + subagent count, with the model only once (#185)", () => {
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
    // Subtitle: project basename + SUBAGENT count + turn count (model excluded).
    // agent_count includes the main agent itself, so 4 agents => 3 subagents.
    // Showing subagents (not agents) reconciles the card with the "Active
    // Subagents" dashboard stat, which excludes main agents.
    expect(screen.getByText("proj · 3 subagents · 12 turns")).toBeInTheDocument();
    // The model appears exactly once — in the footer badge, not duplicated in
    // the subtitle the way main cards used to.
    expect(screen.getAllByText(formatModelName("claude-opus-4-8")!)).toHaveLength(1);
  });

  it("keeps the full subtitle and a subagent's session name available on hover", () => {
    const session = {
      id: "s",
      name: "Refactor the ingestion pipeline for very large rollouts",
      status: "active",
      cwd: "/Users/dev/proj",
      agent_count: 4,
      metadata: JSON.stringify({ turn_count: 12 }),
    } as never;
    const { unmount } = renderCard(
      <AgentCard agent={makeAgent({ type: "main", name: "Main" })} session={session} />
    );
    // The single-line subtitle truncates in a 288px column; hover shows it all.
    const subtitle = screen.getByText("proj · 3 subagents · 12 turns");
    expect(subtitle).toHaveAttribute("title", "proj · 3 subagents · 12 turns");
    unmount();

    renderCard(
      <AgentCard
        agent={makeAgent({ type: "subagent", subagent_type: "qa", session_id: "s" })}
        session={session}
      />
    );
    // A subagent card's footer keeps the (max-width truncated) session name.
    expect(
      screen.getByTitle("Refactor the ingestion pipeline for very large rollouts")
    ).toBeInTheDocument();
  });

  it("shows a subagent's OWN cost, not the session total (avoids misleading spend)", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "subagent", subagent_type: "qa", cost: 3.5 })}
        session={
          {
            id: "s",
            name: "S",
            status: "active",
            cwd: "/x",
            model: "claude-opus-4-8",
            cost: 646.5,
          } as never
        }
      />
    );
    expect(screen.getByText(fmtCost(3.5))).toBeInTheDocument();
    // The session total must NOT appear on a subagent card.
    expect(screen.queryByText(fmtCost(646.5))).not.toBeInTheDocument();
  });

  it("shows the session total on a main-agent card", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "main" })}
        session={
          {
            id: "s",
            name: "S",
            status: "active",
            cwd: "/x",
            model: "claude-opus-4-8",
            cost: 646.5,
          } as never
        }
      />
    );
    expect(screen.getByText(fmtCost(646.5))).toBeInTheDocument();
  });

  it("shows no cost on a subagent card with no recorded usage", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "subagent", subagent_type: "qa" })}
        session={{ id: "s", name: "S", status: "active", cwd: "/x", cost: 646.5 } as never}
      />
    );
    expect(screen.queryByText(fmtCost(646.5))).not.toBeInTheDocument();
  });

  it("titles a hook-style placeholder with the native session title, tool in the subtitle", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "main", name: "Main Agent - Session 329c4d24" })}
        session={{ id: "s", name: "Resumable runs UI", status: "active" } as never}
      />
    );
    expect(screen.getByText("Resumable runs UI")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });

  it("uses the native Claude Code title for an import-style placeholder", () => {
    // Regression: imported / background-synced main agents are named
    // "Main Agent - <cwd-folder> - <id8>", which the old Session-only regex
    // could not rewrite, so they kept showing "work - e3f8e613" forever even
    // though the session title was known.
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "main", name: "Main Agent - work - e3f8e613" })}
        session={
          { id: "s", name: "Implement in-process libdocs MCP server", status: "active" } as never
        }
      />
    );
    expect(screen.getByText("Implement in-process libdocs MCP server")).toBeInTheDocument();
    expect(screen.queryByText("Main Agent - work - e3f8e613")).not.toBeInTheDocument();
  });

  it("falls back to an untitled label while a native Claude title is unavailable", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "main", name: "Main Agent - work - e3f8e613" })}
        session={{ id: "s", name: "Session e3f8e613", status: "active" } as never}
      />
    );
    // "Session <id8>" is suppressed as a non-name, matching Cursor/Codex cards;
    // the short session ID stays in the footer.
    expect(screen.getByText("Untitled session")).toBeInTheDocument();
    expect(screen.getByText("sess-1")).toBeInTheDocument();
  });

  it("uses a native Codex title instead of a bare Codex agent name", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Codex", session_id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c" })}
        session={
          {
            id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c",
            name: "hehe",
            provider: "codex",
            status: "active",
          } as never
        }
      />
    );
    expect(screen.getByText("hehe")).toBeInTheDocument();
    // The bare agent name never becomes the title; "Codex" leads the subtitle.
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("hehe").className).toContain("line-clamp-3");
  });

  it("falls back to an untitled label while a native Codex title is unavailable", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Codex", session_id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c" })}
        session={
          {
            id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c",
            name: "Codex session",
            provider: "codex",
            status: "active",
          } as never
        }
      />
    );
    expect(screen.getByText("Untitled session")).toBeInTheDocument();
    expect(screen.getByText("019fbb99")).toBeInTheDocument();
  });

  it("uses the session prompt fallback to make an imported renamed Codex card informative", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Codex", session_id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c" })}
        session={
          {
            id: "019fbb99-bd87-7c80-afec-ee65e2ebbe1c",
            name: "hehe",
            provider: "codex",
            status: "active",
            prompt_preview:
              "Fix the real-time Codex discovery path and add coverage.\nThen include the missing edge case.",
          } as never
        }
      />
    );

    expect(screen.getByText("hehe")).toBeInTheDocument();
    expect(
      screen.getByText("Fix the real-time Codex discovery path and add coverage.")
    ).toBeInTheDocument();
    expect(screen.getByText("Then include the missing edge case.")).toBeInTheDocument();
  });

  it("uses the same compact two-turn session context for a Claude main agent", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Main Agent - live sync", task: "original task" })}
        session={
          {
            id: "claude-two-turn-context",
            name: "Live sync investigation",
            provider: "claude",
            status: "active",
            prompt_preview:
              "Investigate the live sync delay.\nThen cover the remote source retry path.",
          } as never
        }
      />
    );

    expect(screen.getByText("Investigate the live sync delay.")).toBeInTheDocument();
    expect(screen.getByText("Then cover the remote source retry path.")).toBeInTheDocument();
    expect(screen.queryByText("original task")).not.toBeInTheDocument();
  });

  it("should not render a subtitle for a subagent with no type or project", () => {
    const { container } = renderCard(
      <AgentCard agent={makeAgent({ type: "subagent", subagent_type: null })} />
    );
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
    fireEvent.click(screen.getByText("Untitled session"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not navigate before a transient Codex process has a durable session id", () => {
    const metadata = JSON.stringify({ transient: true, pre_identity_process: true });
    const agent = makeAgent({
      id: "codex:codex-process:4312:abc123",
      session_id: "codex-process:4312:abc123",
      name: "Codex",
      status: "waiting",
      metadata,
    });
    const session: Session = {
      id: agent.session_id,
      name: "Codex session",
      status: "active",
      cwd: "/workspace/pre-identity",
      model: null,
      started_at: "2026-08-05T12:00:00.000Z",
      ended_at: null,
      metadata,
      provider: "codex",
      awaiting_input_since: "2026-08-05T12:00:00.000Z",
      awaiting_reason: "session_start",
    };
    const { container } = render(
      <MemoryRouter initialEntries={["/kanban"]}>
        <AgentCard agent={agent} session={session} />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Untitled session"));
    expect(screen.getByTestId("location")).toHaveTextContent("/kanban");
    expect(container.querySelector(".card-hover")?.className).toContain("cursor-default");
  });

  it("gives Cursor main cards a native title and an always-visible subtitle", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Main Agent - Session 1bace4f0" })}
        session={
          {
            id: "1bace4f0-506a-436b-badd-16209a514803",
            name: "Ship the backend",
            status: "active",
            cwd: "/Users/example/project",
            model: "grok-4.6",
            provider: "cursor",
            agent_count: 2,
            metadata: JSON.stringify({ turn_count: 4 }),
          } as Session
        }
      />
    );
    expect(screen.getByText("Ship the backend")).toBeInTheDocument();
    expect(screen.getByText("Cursor · project · 1 subagent · 4 turns")).toBeInTheDocument();
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

  it("keeps the card badge compact: reason is tooltip-only, no inline chip", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          status: "waiting",
          awaiting_input_since: "2026-03-05T10:01:00.000Z",
          awaiting_reason: "notification",
        })}
      />
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    // Cards are narrow — the inline chip would squeeze the title, so the
    // reason must NOT render inline here (hover tooltip only).
    expect(screen.queryByText("Needs input")).not.toBeInTheDocument();
  });

  it("degrades to a plain Waiting badge on an unknown awaiting_reason", () => {
    renderCard(
      <AgentCard
        agent={makeAgent({
          status: "waiting",
          awaiting_input_since: "2026-03-05T10:01:00.000Z",
          awaiting_reason: "some_future_reason",
        })}
      />
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Needs input")).not.toBeInTheDocument();
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

  it("clamps very long titles to three lines and keeps the full title on hover", () => {
    const longTitle =
      "Investigate why the remote source sync stalls on large Codex rollouts and add a regression test that covers resumed sessions plus the retry budget";
    renderCard(
      <AgentCard
        agent={makeAgent({ name: "Main Agent - Session 1bace4f0" })}
        session={{ id: "s", name: longTitle, status: "active" } as never}
      />
    );
    const title = screen.getByText(longTitle);
    expect(title.className).toContain("line-clamp-3");
    expect(title.className).toContain("[overflow-wrap:anywhere]");
    expect(title.className).not.toContain("truncate");
    expect(title).toHaveAttribute("title", longTitle);
  });

  it("leads every provider's main-card subtitle with the tool name", () => {
    for (const [provider, label] of [
      ["claude", "Claude Code"],
      ["cursor", "Cursor"],
      ["codex", "Codex"],
    ] as const) {
      const { unmount } = renderCard(
        <AgentCard
          agent={makeAgent({ name: provider === "codex" ? "Codex" : "Main Agent - x" })}
          session={{ id: "s", name: "T", status: "active", cwd: "/w/repo", provider } as never}
        />
      );
      expect(screen.getByText(`${label} · repo`)).toBeInTheDocument();
      unmount();
    }
  });

  it("drops the duplicate session name from a main card's footer but keeps it for subagents", () => {
    const session = { id: "s", name: "Ship the backend", status: "active" } as never;
    const { unmount } = renderCard(
      <AgentCard agent={makeAgent({ name: "Main Agent - x" })} session={session} />
    );
    expect(screen.getAllByText(/Ship the backend/)).toHaveLength(1); // title only
    unmount();
    renderCard(
      <AgentCard
        agent={makeAgent({ type: "subagent", subagent_type: "Explore", name: "explorer" })}
        session={session}
      />
    );
    expect(screen.getByText("Ship the backend ·")).toBeInTheDocument();
  });

  it("renders status as a dot with a tooltip label when statusDisplay is dot", () => {
    const { container } = renderCard(
      <AgentCard agent={makeAgent({ status: "working" })} statusDisplay="dot" />
    );
    expect(container.querySelector("[data-status-dot]")).not.toBeNull();
    expect(container.querySelector(".badge")).toBeNull();
    // Still announced to screen readers.
    expect(screen.getByText("Working").className).toContain("sr-only");
  });
});
