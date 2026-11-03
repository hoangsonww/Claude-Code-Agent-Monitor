/**
 * @file Verifies that the Claude-only on-disk Workflow-run panel is absent
 * when the global dashboard data scope is set to Codex alone.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Workflows.codex.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Verifies that the Claude-only on-disk Workflow-run panel is absent when the global dashboard data
 * scope is set to Codex alone.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../Workflows` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `ResizeObserverStub` (class) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `settle` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `does not render Claude Code's Dynamic Workflows journal panel` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `Workflows — Codex scope` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Workflows.codex.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
