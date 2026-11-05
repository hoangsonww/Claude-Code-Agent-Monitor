/**
 * @file Settings.refresh.test.tsx
 * @description Exercises Settings against slow system-info requests and bursts of real
 * WebSocket messages, including recovery and responses from an unmounted page.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Settings.refresh.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Exercises Settings against slow system-info requests and bursts of real WebSocket messages,
 * including recovery and responses from an unmounted page.
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
 * - `../Settings` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `burst` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `deferred` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Deferred` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `deferredValue` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `fixture` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `mount` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PricingList` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `pricingRule` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `raceScopes` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `remoteCompletion` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Literal API paths
 * - `/api/settings/export` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 *
 * ## Named test contracts
 * - `an old scope cannot overwrite the latest exact cost` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `cancels a scheduled full remote refresh when the page unmounts` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `clears the system-info failure once a background read succeeds` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `coalesces remote completions into one fresh read after a slow initial request` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `does not discard a successful cost result when system-info reading fails` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `does not let an old response overwrite the next page instance` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `does not let an older scope's late pricing replace the newest scope` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `does not report a post-save info refresh failure as a Codex home save failure` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `does not serialize remote refreshes behind a slow cost read` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `does not show an older scope's late failure` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `drops a queued remote refresh when unmounted before the pending read settles` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `gets fresh info after a storage change even if an older request is pending` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `ignores the first effect generation's response in StrictMode` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `keeps a sustained hook stream on the periodic refresh cadence` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `keeps pricing and home paths when exact cost fails` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `keeps pricing and home paths when system info fails and shows the failure` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `loads each endpoint once for the three notifications of one remote sync` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `refreshes after cleanup rather than reusing the pre-mutation counts` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `refreshes exact cost after Cursor save and GPT delete` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `refreshes hook status after a Claude home save` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders pricing and home paths while exact cost remains pending` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `renders primary page data while system info remains pending` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `retains the last valid system info when a later full refresh fails` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `retries after a failed request instead of retaining its rejected promise` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `Settings page load guard` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `Settings system-info failure` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `Settings system-info refresh` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Settings.refresh.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
      upsertCursor: vi.fn(async (pricing: unknown) => ({ pricing })),
      upsertGpt: vi.fn(async (pricing: unknown) => ({ pricing })),
      deleteCursor: vi.fn(async () => ({ ok: true })),
      deleteGpt: vi.fn(async () => ({ ok: true })),
      totalCost: vi.fn(async () => ({ total_cost: 0 })),
    },
    settings: {
      info,
      claudeHome: {
        get: vi.fn(async () => ({ claude_home: "/test/claude" })),
        set: vi.fn(async (claudeHome: string) => ({ ok: true, claude_home: claudeHome })),
      },
      codexHome: {
        get: vi.fn(async () => ({ codex_home: "/test/codex" })),
        set: vi.fn(async (codexHome: string) => ({ ok: true, codex_home: codexHome })),
      },
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
  setScope({ mode: "local", selected: [], provider: "both" });
  vi.mocked(api.settings.codexHome.set)
    .mockReset()
    .mockImplementation(async (codexHome: string) => ({ ok: true, codex_home: codexHome }));
  vi.mocked(api.settings.claudeHome.set)
    .mockReset()
    .mockImplementation(async (claudeHome: string) => ({ ok: true, claude_home: claudeHome }));
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

it("an old scope cannot overwrite the latest exact cost", async () => {
  let oldResolve!: (value: { total_cost: number }) => void;
  let newResolve!: (value: { total_cost: number }) => void;
  const oldCost = new Promise((resolve) => {
    oldResolve = resolve;
  });
  const newCost = new Promise((resolve) => {
    newResolve = resolve;
  });
  vi.mocked(api.pricing.totalCost)
    .mockReturnValueOnce(oldCost as never)
    .mockReturnValueOnce(newCost as never);
  await mount();
  await act(async () => {
    setScope({ mode: "all", selected: [], provider: "both" });
  });
  await act(async () => {
    newResolve({ total_cost: 1018.59 });
  });
  expect(screen.getByText("$1,018.59")).toBeInTheDocument();
  await act(async () => {
    oldResolve({ total_cost: 1000 });
  });
  expect(screen.getByText("$1,018.59")).toBeInTheDocument();
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

  it("does not serialize remote refreshes behind a slow cost read", async () => {
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
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.pricing.totalCost).toHaveBeenCalledTimes(before + 2);
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

  it("does not report a post-save info refresh failure as a Codex home save failure", async () => {
    const view = await mount();
    info.mockRejectedValueOnce(new Error("refresh after save failed"));
    const input = within(view.container).getByDisplayValue("/test/codex");
    const codexSection = within(input.closest(".border-t") as HTMLElement);

    fireEvent.change(input, { target: { value: "/test/codex-next" } });
    await act(async () => {
      fireEvent.click(codexSection.getByRole("button", { name: "Save" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(codexSection.getByText("/test/codex-next")).toBeInTheDocument();
    expect(codexSection.queryByText("refresh after save failed")).toBeNull();
    expect(
      within(view.container.querySelector("#about") as HTMLElement).getByText(
        "refresh after save failed"
      )
    ).toBeInTheDocument();
    view.unmount();
  });

  it("refreshes hook status after a Claude home save", async () => {
    const view = await mount();
    const initialInfoReads = info.mock.calls.length;
    const input = within(view.container).getByDisplayValue("/test/claude");
    const claudeControls = within(input.parentElement as HTMLElement);

    fireEvent.change(input, { target: { value: "/test/claude-next" } });
    await act(async () => {
      fireEvent.click(claudeControls.getByRole("button", { name: "Save" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(api.settings.claudeHome.set).toHaveBeenCalledWith("/test/claude-next");
    expect(info).toHaveBeenCalledTimes(initialInfoReads + 1);
    expect(
      within(input.closest("section") as HTMLElement).getByText("/test/claude-next")
    ).toBeInTheDocument();
    view.unmount();
  });
});

it("does not discard a successful cost result when system-info reading fails", async () => {
  info.mockRejectedValueOnce(new Error("System info reader is busy"));
  vi.mocked(api.pricing.totalCost).mockResolvedValue({ total_cost: 1234.56 } as never);
  await mount();
  expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  expect(screen.getByText("System info reader is busy")).toBeInTheDocument();
});

it("refreshes exact cost after Cursor save and GPT delete", async () => {
  const cursorRule = {
    model_pattern: "cursor-priced",
    display_name: "Cursor Priced",
    input_per_mtok: 1,
    cache_write_per_mtok: 1,
    cache_read_per_mtok: 1,
    output_per_mtok: 1,
    updated_at: "2026-10-31T00:00:00.000Z",
  };
  const gptRule = {
    model_pattern: "gpt-priced",
    display_name: "GPT Priced",
    updated_at: "2026-10-31T00:00:00.000Z",
  };
  vi.mocked(api.pricing.listCursor).mockResolvedValue({ pricing: [cursorRule] } as never);
  vi.mocked(api.pricing.listGpt).mockResolvedValue({ pricing: [gptRule] } as never);
  vi.mocked(api.pricing.totalCost)
    .mockReset()
    .mockResolvedValue({ total_cost: 1 } as never);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  );

  const view = await mount();
  const initialCostReads = vi.mocked(api.pricing.totalCost).mock.calls.length;
  const cursorSection = within(view.container.querySelector("#cursor-pricing") as HTMLElement);
  fireEvent.click(
    within(cursorSection.getByText("cursor-priced").closest("tr")!).getAllByRole("button")[0]!
  );
  const cursorEditRow = cursorSection.getByDisplayValue("cursor-priced").closest("tr")!;
  await act(async () => {
    fireEvent.click(within(cursorEditRow).getAllByRole("button")[0]!);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(api.pricing.upsertCursor).toHaveBeenCalled();
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(initialCostReads + 1);

  const gptSection = within(view.container.querySelector("#gpt-pricing") as HTMLElement);
  const gptRow = gptSection.getByText("gpt-priced").closest("tr")!;
  await act(async () => {
    fireEvent.click(within(gptRow).getAllByRole("button")[1]!);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(api.pricing.deleteGpt).toHaveBeenCalledWith("gpt-priced");
  expect(api.pricing.totalCost).toHaveBeenCalledTimes(initialCostReads + 2);
  view.unmount();
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

  it("renders pricing and home paths while exact cost remains pending", async () => {
    const pending = deferredValue<{ total_cost: number }>();
    vi.mocked(api.pricing.totalCost).mockReturnValueOnce(pending.promise as never);
    vi.mocked(api.pricing.list).mockResolvedValueOnce({
      pricing: [pricingRule("ready-without-cost")],
    } as never);

    const view = await mount();
    const page = within(view.container);
    expect(page.getAllByText("ready-without-cost").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/claude").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/codex").length).toBeGreaterThan(0);

    await act(async () => {
      pending.resolve({ total_cost: 42 });
    });
    view.unmount();
  });

  it("keeps pricing and home paths when exact cost fails", async () => {
    vi.mocked(api.pricing.totalCost).mockRejectedValueOnce(new Error("cost reader unavailable"));
    vi.mocked(api.pricing.list).mockResolvedValueOnce({
      pricing: [pricingRule("ready-after-cost-error")],
    } as never);

    const view = await mount();
    const page = within(view.container);
    expect(page.getAllByText("ready-after-cost-error").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/claude").length).toBeGreaterThan(0);
    expect(page.getAllByText("/test/codex").length).toBeGreaterThan(0);
    expect(page.getByText("cost reader unavailable")).toBeInTheDocument();
    view.unmount();
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
