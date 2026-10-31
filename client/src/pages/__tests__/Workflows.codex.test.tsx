/**
 * @file Verifies that the Claude-only on-disk Workflow-run panel is absent
 * when the global dashboard data scope is set to Codex alone.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/pages/__tests__/Workflows.codex.test.tsx`
 *
 * Scope
 * Behavioral regression suite for `Workflows.codex.test.tsx`.
 *
 * Subjects and collaborators
 * - `../../lib/dataScope` — local module imported by this suite.
 * - `../Workflows` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 * - Mock boundary: `../../lib/api`.
 * - Mock boundary: `../../lib/eventBus`.
 *
 * Suite groups
 * - `Workflows — Codex scope`
 *
 * Protected behavior
 * - does not render Claude Code's Dynamic Workflows journal panel
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
