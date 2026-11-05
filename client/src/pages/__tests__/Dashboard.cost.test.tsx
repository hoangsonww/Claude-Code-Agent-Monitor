/**
 * @file Dashboard.cost.test.tsx
 * @description Checks visible cost precision/coverage and deferred responses
 * across scope switches, polling and unmount without a real server.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Dashboard.cost.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Checks visible cost precision/coverage and deferred responses across scope switches, polling and
 * unmount without a real server.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../Dashboard` — repository-local contract consumed by this module; review its exports before
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
 * - `cost` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `deferred` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `mount` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `a completed sync during a pending load queues one fresh cost read` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `an unmounted pending load cannot issue subagent follow-up requests` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `costs show cents and the selected scope` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `pending polls coalesce and A→B→A cannot publish an older cost` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `publishes fresh cost while the activity reader is pending and preserves it on failure` —
 *   executable behavior named by this suite; preserve the observable contract or update the test
 *   with rationale.
 * - `reports an activity failure and retries activity while the cost read is pending` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Dashboard.cost.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../Dashboard";
import { api } from "../../lib/api";
import { setScope } from "../../lib/dataScope";
import { eventBus } from "../../lib/eventBus";
vi.mock("../../lib/api", () => ({
  api: {
    stats: { get: vi.fn() },
    agents: { list: vi.fn() },
    events: { list: vi.fn() },
    pricing: { totalCost: vi.fn() },
    sessions: { list: vi.fn() },
  },
}));
const cost = (total_cost: number) => ({
  total_cost,
  breakdown: [],
  daily_costs: [],
  feature_costs: {
    web_search_cost: 0,
    web_fetch_cost: 0,
    code_execution_cost: 0,
    code_execution_hours_estimated: 0,
    code_execution_free_hours: 0,
  },
  unpriced_models: [],
});
function deferred() {
  let resolve!: (value: ReturnType<typeof cost>) => void;
  const promise = new Promise<ReturnType<typeof cost>>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  setScope({ mode: "local", selected: [], provider: "both" });
  vi.mocked(api.stats.get).mockResolvedValue({
    total_sessions: 1,
    active_sessions: 0,
    total_agents: 0,
    active_agents: 0,
    total_events: 1,
    events_today: 1,
    ws_connections: 1,
    agents_by_status: {},
    sessions_by_status: {},
  });
  vi.mocked(api.agents.list).mockResolvedValue({ agents: [] });
  vi.mocked(api.events.list).mockResolvedValue({ events: [], limit: 30, offset: 0, total: 0 });
  vi.mocked(api.sessions.list).mockResolvedValue({ sessions: [], total: 0, limit: 100, offset: 0 });
  vi.mocked(api.pricing.totalCost).mockResolvedValue(cost(1000.12));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount() {
  const view = render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
  await act(async () => {});
  return view;
}
it("costs show cents and the selected scope", async () => {
  await mount();
  expect(screen.getByText("$1,000.12")).toBeInTheDocument();
  expect(screen.getByText("Sources: This machine only · Products: Both")).toBeInTheDocument();
  expect(
    screen.getByText("API-equivalent estimate, not subscription charges.")
  ).toBeInTheDocument();
});
it("pending polls coalesce and A→B→A cannot publish an older cost", async () => {
  const a = deferred(),
    b = deferred(),
    fresh = deferred();
  vi.mocked(api.pricing.totalCost)
    .mockReset()
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise)
    .mockReturnValueOnce(fresh.promise);
  await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(1);
  await act(async () => {
    setScope({ mode: "all", selected: [], provider: "both" });
  });
  await act(async () => {
    setScope({ mode: "local", selected: [], provider: "both" });
  });
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(3);
  await act(async () => {
    fresh.resolve(cost(1018.59));
  });
  expect(screen.getByText("$1,018.59")).toBeInTheDocument();
  await act(async () => {
    b.resolve(cost(9));
    a.resolve(cost(7));
  });
  expect(screen.getByText("$1,018.59")).toBeInTheDocument();
  expect(screen.queryByText("$9.00")).not.toBeInTheDocument();
});
it("an unmounted pending load cannot issue subagent follow-up requests", async () => {
  let resolveEvents!: (value: Awaited<ReturnType<typeof api.events.list>>) => void;
  const pending = new Promise<Awaited<ReturnType<typeof api.events.list>>>((resolve) => {
    resolveEvents = resolve;
  });
  vi.mocked(api.events.list).mockReturnValue(pending);
  vi.mocked(api.agents.list).mockResolvedValue({
    agents: [
      { id: "a", session_id: "s", type: "main", status: "working", name: "fixture" },
    ] as never,
  });
  const view = await mount();
  view.unmount();
  await act(async () => {
    resolveEvents({ events: [], limit: 30, offset: 0, total: 0 });
  });
  expect(api.agents.list).toHaveBeenCalledTimes(2);
});

it("a completed sync during a pending load queues one fresh cost read", async () => {
  const pending = deferred();
  vi.mocked(api.pricing.totalCost)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(cost(1018.59));
  await mount();
  await act(async () => {
    for (let n = 0; n < 10; n++)
      eventBus.publish({ type: "remote_data.updated", data: {} } as never);
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(1);
  await act(async () => {
    pending.resolve(cost(1000));
  });
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(2);
  expect(screen.getByText("$1,018.59")).toBeInTheDocument();
});

it("publishes fresh cost while the activity reader is pending and preserves it on failure", async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<Awaited<ReturnType<typeof api.events.list>>>((_resolve, no) => {
    reject = no;
  });
  vi.mocked(api.events.list).mockReturnValue(pending);
  await mount();
  expect(screen.getByText("$1,000.12")).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(2);
  await act(async () => {
    reject(new Error("Activity reader timed out"));
  });
  expect(screen.getByText("$1,000.12")).toBeInTheDocument();
  expect(screen.getByText("Activity reader timed out")).toBeInTheDocument();
});

it("reports an activity failure and retries activity while the cost read is pending", async () => {
  const pendingCost = deferred();
  vi.mocked(api.pricing.totalCost).mockReturnValue(pendingCost.promise);
  vi.mocked(api.events.list)
    .mockRejectedValueOnce(new Error("Activity reader timed out"))
    .mockResolvedValue({ events: [], limit: 30, offset: 0, total: 0 });

  await mount();
  expect(screen.getByText("Activity reader timed out")).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(api.events.list).toHaveBeenCalledTimes(2);
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(1);

  await act(async () => {
    pendingCost.resolve(cost(1000.12));
  });
});
