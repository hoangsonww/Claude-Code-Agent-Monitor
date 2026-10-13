/**
 * @file Dashboard.cost.test.tsx
 * @description Checks visible cost precision/coverage and deferred responses
 * across scope switches, polling and unmount without a real server.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
  const pending = deferred();
  vi.mocked(api.pricing.totalCost).mockReturnValue(pending.promise);
  vi.mocked(api.agents.list).mockResolvedValue({
    agents: [
      { id: "a", session_id: "s", type: "main", status: "working", name: "fixture" },
    ] as never,
  });
  const view = await mount();
  view.unmount();
  await act(async () => {
    pending.resolve(cost(12));
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
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(1);
  await act(async () => {
    reject(new Error("Activity reader timed out"));
  });
  expect(screen.getByText("$1,000.12")).toBeInTheDocument();
  expect(screen.getByText("Activity reader timed out")).toBeInTheDocument();
});
