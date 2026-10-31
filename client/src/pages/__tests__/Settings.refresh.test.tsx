/**
 * @file Settings.refresh.test.tsx
 * @description Exercises Settings against slow system-info requests and bursts of real
 * WebSocket messages, including recovery and responses from an unmounted page.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StrictMode } from "react";
import { Settings } from "../Settings";
import { api } from "../../lib/api";
import { eventBus } from "../../lib/eventBus";
import { getScope, setScope } from "../../lib/dataScope";

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("../../lib/api", () => ({
  api: {
    pricing: {
      list: vi.fn(async () => ({ pricing: [] })),
      listCursor: vi.fn(async () => ({ pricing: [] })),
      listGpt: vi.fn(async () => ({ pricing: [] })),
      totalCost: vi.fn(async () => ({ total_cost: 0 })),
    },
    settings: {
      info,
      claudeHome: { get: vi.fn(async () => ({ claude_home: "/test/claude" })) },
      codexHome: { get: vi.fn(async () => ({ codex_home: "/test/codex" })) },
      exportData: vi.fn(() => "/api/settings/export"),
      cleanup: vi.fn(async () => ({
        abandoned: 0,
        purged_sessions: 0,
        purged_events: 0,
        purged_agents: 0,
      })),
    },
  },
}));
vi.mock("../../components/RemoteSources", () => ({ RemoteSources: () => null }));
vi.mock("../../components/ImportHistory", () => ({ ImportHistory: () => null }));
vi.mock("../../components/AlertsNotifications", () => ({ AlertsNotifications: () => null }));
vi.mock("../../components/SnapshotStorage", () => ({
  formatStorageBytes: (bytes: number) => `${bytes} B`,
  SnapshotStorage: ({ onChanged }: { onChanged: () => void }) => (
    <button onClick={onChanged}>Refresh storage</button>
  ),
}));

function fixture(path = "/test/current.db") {
  return {
    db: { path, size: 0, counts: {} },
    hooks: { installed: false, path: "/test/settings.json", hooks: {} },
    server: {
      version: "test",
      uptime: 0,
      node_version: "test",
      platform: "test",
      ws_connections: 0,
    },
  };
}

function deferred() {
  let resolve!: (value: ReturnType<typeof fixture>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<ReturnType<typeof fixture>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function mount() {
  const view = render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
  await act(async () => {});
  return view;
}

function burst() {
  for (let i = 0; i < 20; i++) {
    eventBus.publish({ type: "new_event", data: { session_id: "busy-session" } } as never);
    eventBus.publish({ type: "agent_updated", data: { session_id: "busy-session" } } as never);
  }
}

function remoteCompletion() {
  eventBus.publish({ type: "remote_source.status", data: { status: "ok" } } as never);
  eventBus.publish({
    type: "import.progress",
    data: { phase: "complete", source: "remote" },
  } as never);
  eventBus.publish({ type: "remote_data.updated", data: {} } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  info.mockReset().mockResolvedValue(fixture());
  Element.prototype.scrollIntoView = vi.fn();
  const Observer = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("IntersectionObserver", Observer);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Settings system-info refresh", () => {
  it("loads each endpoint once for the three notifications of one remote sync", async () => {
    await mount();
    const endpoints = [
      api.pricing.list,
      api.pricing.totalCost,
      api.settings.claudeHome.get,
      api.settings.codexHome.get,
      info,
    ];
    const before = endpoints.map((fn) => ({ fn, calls: vi.mocked(fn).mock.calls.length }));
    await act(async () => {
      remoteCompletion();
      await vi.advanceTimersByTimeAsync(0);
    });
    before.forEach(({ fn, calls }) => expect(fn).toHaveBeenCalledTimes(calls + 1));
  });

  it("queues one full follow-up while remote cost reading is slow", async () => {
    await mount();
    let resolveCost!: (value: { total_cost: number }) => void;
    const pendingCost = new Promise<{ total_cost: number }>((resolve) => {
      resolveCost = resolve;
    });
    const before = vi.mocked(api.pricing.totalCost).mock.calls.length;
    vi.mocked(api.pricing.totalCost).mockReturnValueOnce(pendingCost as never);
    await act(async () => {
      remoteCompletion();
      await vi.advanceTimersByTimeAsync(0);
      remoteCompletion();
      remoteCompletion();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.pricing.totalCost).toHaveBeenCalledTimes(before + 1);
    await act(async () => {
      resolveCost({ total_cost: 123 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.pricing.totalCost).toHaveBeenCalledTimes(before + 2);
  });

  it("cancels a scheduled full remote refresh when the page unmounts", async () => {
    const view = await mount();
    const before = vi.mocked(api.pricing.totalCost).mock.calls.length;
    await act(async () => {
      remoteCompletion();
      view.unmount();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.pricing.totalCost).toHaveBeenCalledTimes(before);
  });

  it("keeps a sustained hook stream on the periodic refresh cadence", async () => {
    await mount();
    expect(info).toHaveBeenCalledTimes(1);
    for (let window = 0; window < 3; window++) {
      await act(async () => {
        burst();
      });
      expect(info).toHaveBeenCalledTimes(window + 1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(info).toHaveBeenCalledTimes(window + 2);
    }
  });

  it("coalesces remote completions into one fresh read after a slow initial request", async () => {
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise).mockResolvedValue(fixture("/test/after-import.db"));
    await mount();
    await act(async () => {
      burst();
      for (let i = 0; i < 10; i++)
        eventBus.publish({ type: "remote_data.updated", data: {} } as never);
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(info).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(fixture("/test/before-import.db"));
    });
    expect(info).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("/test/after-import.db").length).toBeGreaterThan(0);
  }, 15000);

  it("drops a queued remote refresh when unmounted before the pending read settles", async () => {
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    const view = await mount();
    await act(async () => {
      eventBus.publish({ type: "remote_data.updated", data: {} } as never);
      view.unmount();
      pending.resolve(fixture());
    });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed request instead of retaining its rejected promise", async () => {
    info.mockRejectedValueOnce(new Error("temporarily unavailable"));
    await mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(info).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("/test/current.db").length).toBeGreaterThan(0);
  });

  it("does not let an old response overwrite the next page instance", async () => {
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    const old = await mount();
    old.unmount();
    await mount();
    await act(async () => {
      pending.resolve(fixture("/test/stale.db"));
    });
    expect(screen.queryByText("/test/stale.db")).toBeNull();
    expect(screen.getAllByText("/test/current.db").length).toBeGreaterThan(0);
  });

  it("ignores the first effect generation's response in StrictMode", async () => {
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    render(
      <StrictMode>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </StrictMode>
    );
    await act(async () => {});
    expect(info).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(fixture("/test/stale.db"));
    });
    expect(screen.queryByText("/test/stale.db")).toBeNull();
    expect(screen.getAllByText("/test/current.db").length).toBeGreaterThan(0);
  });

  it("gets fresh info after a storage change even if an older request is pending", async () => {
    await mount();
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    fireEvent.click(screen.getByText("Refresh storage"));
    fireEvent.click(screen.getByText("Refresh storage"));
    expect(info).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(fixture());
    });
    expect(info).toHaveBeenCalledTimes(3);
    expect(api.settings.info).toBe(info);
  });

  it("refreshes after cleanup rather than reusing the pre-mutation counts", async () => {
    await mount();
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    fireEvent.click(screen.getByText("Run Cleanup"));
    await act(async () => {
      fireEvent.click(screen.getByText("Confirm Cleanup"));
    });
    expect(api.settings.cleanup).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(fixture());
    });
    expect(info).toHaveBeenCalledTimes(3);
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

function deferredValue<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function pricingRule(pattern: string) {
  return {
    model_pattern: pattern,
    display_name: `${pattern} display`,
    input_per_mtok: 1,
    output_per_mtok: 2,
    cache_read_per_mtok: 0.1,
    cache_write_per_mtok: 1.25,
    cache_write_1h_per_mtok: 2,
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

type PricingList = { pricing: ReturnType<typeof pricingRule>[] };

/** Mount at scope `all`, switch to `local` (whose pricing read stays pending), then back. */
async function raceScopes(stale: Deferred<PricingList>) {
  const list = () =>
    getScope().mode === "local"
      ? stale.promise
      : Promise.resolve({ pricing: [pricingRule("fresh-model")] });
  vi.mocked(api.pricing.list).mockImplementation(list as never);
  setScope({ mode: "all", selected: [] });
  const view = await mount();
  for (const mode of ["local", "all"] as const) {
    await act(async () => {
      setScope({ mode, selected: [] });
      await vi.advanceTimersByTimeAsync(0);
    });
  }
  return view;
}

describe("Settings page load guard", () => {
  const initialScope = getScope();
  afterEach(() => {
    vi.mocked(api.pricing.list).mockImplementation((async () => ({ pricing: [] })) as never);
    setScope(initialScope);
  });

  it("renders primary page data while system info remains pending", async () => {
    const pending = deferred();
    info.mockReturnValueOnce(pending.promise);
    vi.mocked(api.pricing.list).mockResolvedValueOnce({
      pricing: [pricingRule("ready-model")],
    } as never);

    const view = await mount();
    const page = within(view.container);
    expect(page.getAllByText("ready-model").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/claude").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/codex").length).toBeGreaterThan(0);

    await act(async () => {
      pending.resolve(fixture());
    });
    view.unmount();
  });

  it("does not let an older scope's late pricing replace the newest scope", async () => {
    const stale = deferredValue<PricingList>();
    const view = await raceScopes(stale);
    const page = within(view.container);
    expect(page.getAllByText("fresh-model").length).toBeGreaterThan(0);
    await act(async () => {
      stale.resolve({ pricing: [pricingRule("stale-model")] });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(page.queryByText("stale-model")).toBeNull();
    expect(page.getAllByText("fresh-model").length).toBeGreaterThan(0);
    view.unmount();
  });

  it("does not show an older scope's late failure", async () => {
    const stale = deferredValue<PricingList>();
    const view = await raceScopes(stale);
    await act(async () => {
      stale.reject(new Error("stale scope failed"));
      await vi.advanceTimersByTimeAsync(0);
    });
    const page = within(view.container);
    expect(page.queryByText("stale scope failed")).toBeNull();
    expect(page.getAllByText("fresh-model").length).toBeGreaterThan(0);
    view.unmount();
  });
});

describe("Settings system-info failure", () => {
  it("keeps pricing and home paths when system info fails and shows the failure", async () => {
    info.mockReset().mockRejectedValue(new Error("system info unavailable"));
    const priced = { pricing: [pricingRule("priced-model")] };
    vi.mocked(api.pricing.list).mockResolvedValueOnce(priced as never);
    const view = await mount();
    const page = within(view.container);
    const section = (id: string) => within(view.container.querySelector(`#${id}`) as HTMLElement);
    expect(section("about").getByText("system info unavailable")).toBeInTheDocument();
    expect(section("claude-pricing").queryByText("system info unavailable")).toBeNull();
    expect(page.getAllByText("priced-model").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/claude").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/codex").length).toBeGreaterThan(0);
    view.unmount();
  });

  it("retains the last valid system info when a later full refresh fails", async () => {
    const view = await mount();
    info.mockRejectedValueOnce(new Error("refresh failed"));
    const nextHome = { claude_home: "/test/claude-next" };
    vi.mocked(api.settings.claudeHome.get).mockResolvedValueOnce(nextHome as never);
    await act(async () => {
      remoteCompletion();
      await vi.advanceTimersByTimeAsync(0);
    });
    const page = within(view.container);
    expect(page.getAllByText("refresh failed").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/current.db").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/claude-next").length).toBeGreaterThan(0);
    view.unmount();
  });

  it("clears the system-info failure once a background read succeeds", async () => {
    info.mockRejectedValueOnce(new Error("info briefly down"));
    const view = await mount();
    const page = within(view.container);
    expect(page.getByText("info briefly down")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(page.queryByText("info briefly down")).toBeNull();
    expect(page.getAllByText("/test/current.db").length).toBeGreaterThan(0);
    view.unmount();
  });
});
