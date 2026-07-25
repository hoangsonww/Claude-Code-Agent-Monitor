/**
 * @file focusStore.test.ts
 * @description Tests for the module-level session-focus store: lazy bulk
 * hydrate from GET /api/focus, in-place merge of `session_focus` WebSocket
 * pushes (via the real eventBus), malformed-payload tolerance, and the
 * push-beats-racing-hydrate rule.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus } from "../eventBus";
import type { SessionFocus, WSMessage } from "../types";

const focusAllMock = vi.fn();

vi.mock("../api", () => ({
  api: {
    plans: {
      focusAll: (...args: unknown[]) => focusAllMock(...args),
    },
  },
}));

import { focusStore } from "../focusStore";

function makeFocus(overrides: Partial<SessionFocus> = {}): SessionFocus {
  return {
    session_id: "sess-1",
    cwd: "/repo",
    item_number: 4,
    item_text: "Migrate auth",
    note: null,
    detour_stack: [],
    since: "2026-06-10T11:00:00.000Z",
    drift: null,
    drift_reason: null,
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
}

function publishFocus(data: unknown) {
  eventBus.publish({
    type: "session_focus",
    data,
    timestamp: new Date().toISOString(),
  } as WSMessage);
}

describe("focusStore", () => {
  beforeEach(() => {
    focusStore.__resetForTest();
    vi.clearAllMocks();
  });

  it("hydrates the map from focusAll on first subscribe", async () => {
    focusAllMock.mockResolvedValue({ focus: [makeFocus()] });
    const unsub = focusStore.subscribe(() => {});
    await focusStore.hydrate();
    expect(focusStore.getSnapshot().get("sess-1")?.item_number).toBe(4);
    unsub();
  });

  it("merges session_focus pushes and notifies listeners", () => {
    const listener = vi.fn();
    const unsub = focusStore.subscribe(listener);
    publishFocus(makeFocus({ session_id: "sess-2", item_number: 7 }));
    expect(focusStore.getSnapshot().get("sess-2")?.item_number).toBe(7);
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it("ignores malformed payloads without throwing", () => {
    expect(() => publishFocus({ nope: true })).not.toThrow();
    expect(() => publishFocus(null)).not.toThrow();
    expect(focusStore.getSnapshot().size).toBe(0);
  });

  it("a WS push that races the hydrate wins over the fetched row", async () => {
    let resolveFetch: (v: { focus: SessionFocus[] }) => void = () => {};
    focusAllMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const unsub = focusStore.subscribe(() => {});
    const hydratePromise = focusStore.hydrate();
    // Push arrives while the fetch is still in flight, with newer state.
    publishFocus(makeFocus({ item_number: 9, updated_at: "2026-06-10T12:00:00.000Z" }));
    resolveFetch({ focus: [makeFocus({ item_number: 4 })] });
    await hydratePromise;
    expect(focusStore.getSnapshot().get("sess-1")?.item_number).toBe(9);
    unsub();
  });

  it("a failed hydrate leaves the store retryable and keeps WS state", async () => {
    focusAllMock.mockRejectedValue(new Error("server down"));
    const unsub = focusStore.subscribe(() => {});
    await focusStore.hydrate();
    publishFocus(makeFocus({ session_id: "sess-3" }));
    expect(focusStore.getSnapshot().has("sess-3")).toBe(true);
    unsub();
  });
});
