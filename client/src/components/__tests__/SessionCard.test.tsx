/**
 * @file SessionCard.test.tsx
 * @description Regression tests for the compact Kanban session card, including
 * preserving provider-native session titles, two-turn human task context, and
 * no redundant ID badge.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { SessionCard } from "../SessionCard";
import type { Session } from "../../lib/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "019fbe8f-b608-7c80-afec-ee65e2ebbe1c",
    name: "Ship real-time session discovery",
    status: "active",
    cwd: "/Users/dev/project",
    model: "gpt-5.6-terra",
    started_at: "2026-08-02T00:00:00.000Z",
    ended_at: null,
    metadata: null,
    agent_count: 1,
    cost: 54.85,
    provider: "codex",
    ...overrides,
  };
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("SessionCard", () => {
  it("keeps a named Codex session title clean without a duplicate provider ID badge", () => {
    render(
      <MemoryRouter>
        <SessionCard session={makeSession()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Ship real-time session discovery")).toBeInTheDocument();
    expect(screen.getByText("019fbe8f-b60")).toBeInTheDocument();
    expect(screen.queryByText("Codex · 019fbe8f")).not.toBeInTheDocument();
  });

  it("shows a renamed Codex session's latest prompt below its native title", () => {
    render(
      <MemoryRouter>
        <SessionCard
          session={makeSession({
            name: "hehe",
            prompt_preview:
              "Add live card context for renamed Codex sessions.\nKeep the follow-up concise.",
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("hehe")).toBeInTheDocument();
    expect(
      screen.getByText("Add live card context for renamed Codex sessions.")
    ).toBeInTheDocument();
    expect(screen.getByText("Keep the follow-up concise.")).toBeInTheDocument();
  });

  it("shows the same bounded two-turn history for a Claude session", () => {
    render(
      <MemoryRouter>
        <SessionCard
          session={makeSession({
            id: "claude-two-turn-context",
            name: "Remote sync investigation",
            provider: "claude",
            prompt_preview:
              "Investigate the remote sync delay.\nThen preserve the normal idle sweep.",
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Investigate the remote sync delay.")).toBeInTheDocument();
    expect(screen.getByText("Then preserve the normal idle sweep.")).toBeInTheDocument();
  });

  it("does not navigate before a transient Codex process has a durable session id", () => {
    const metadata = JSON.stringify({ transient: true, pre_identity_process: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/kanban"]}>
        <SessionCard
          session={makeSession({
            id: "codex-process:4312:abc123",
            name: "Codex session",
            metadata,
          })}
        />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Codex · codex-pr"));
    expect(screen.getByTestId("location")).toHaveTextContent("/kanban");
    expect(container.querySelector(".card-hover")?.className).toContain("cursor-default");
  });
});
