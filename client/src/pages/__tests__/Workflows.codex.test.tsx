/**
 * @file Verifies that the Claude-only on-disk Workflow-run panel is absent
 * when the global dashboard data scope is set to Codex alone.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { setScope } from "../../lib/dataScope";

const { emptyWorkflow } = vi.hoisted(() => ({
  emptyWorkflow: {
    stats: {
      totalSessions: 0,
      totalAgents: 0,
      totalSubagents: 0,
      avgSubagents: 0,
      successRate: 100,
      avgDepth: 0,
      avgDurationSec: 0,
      totalCompactions: 0,
      avgCompactions: 0,
      topFlow: null,
    },
    orchestration: {
      sessionCount: 0,
      mainCount: 0,
      subagentTypes: [],
      edges: [],
      outcomes: [],
      compactions: { total: 0, sessions: 0 },
    },
    toolFlow: { transitions: [], toolCounts: [] },
    effectiveness: [],
    patterns: { patterns: [], soloSessionCount: 0, soloPercentage: 0 },
    modelDelegation: { mainModels: [], subagentModels: [], tokensByModel: [] },
    errorPropagation: {
      byDepth: [],
      byType: [],
      eventErrors: [],
      sessionsWithErrors: 0,
      totalSessions: 0,
      errorRate: 0,
    },
    concurrency: { aggregateLanes: [] },
    complexity: [],
    compaction: {
      totalCompactions: 0,
      tokensRecovered: 0,
      perSession: [],
      sessionsWithCompactions: 0,
      totalSessions: 0,
    },
    cooccurrence: [],
  },
}));

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    api: {
      workflows: { get: vi.fn().mockResolvedValue(emptyWorkflow) },
    },
  };
});

vi.mock("../../lib/eventBus", () => ({
  eventBus: { subscribe: () => () => {}, onConnection: () => () => {}, connected: true },
}));

import { Workflows } from "../Workflows";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  setScope({ mode: "all", selected: [], provider: "claude" });
  localStorage.removeItem("ccam-data-scope");
});

describe("Workflows — Codex scope", () => {
  it("does not render Claude Code's Dynamic Workflows journal panel", async () => {
    setScope({ mode: "all", selected: [], provider: "codex" });
    render(
      <MemoryRouter initialEntries={["/workflows"]}>
        <Workflows />
      </MemoryRouter>
    );
    await settle();

    expect(screen.queryByText("Dynamic Workflows")).not.toBeInTheDocument();
    expect(screen.getByText("Agent Orchestration Graph")).toBeInTheDocument();
  });
});
