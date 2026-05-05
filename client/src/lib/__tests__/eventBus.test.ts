/**
 * @file eventBus.test.ts
 * @description Unit tests for the eventBus module to ensure correct subscription, publishing, and unsubscription behavior in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { eventBus } from "../eventBus";
import type { WSMessage } from "../types";

type DataMessageType = Extract<WSMessage, { data: unknown }>["type"];

function makeMsg(type: DataMessageType = "new_event"): WSMessage {
  return {
    type,
    data: {
      id: 1,
      session_id: "s1",
      agent_id: null,
      event_type: "PreToolUse",
      tool_name: "Bash",
      summary: "test",
      data: null,
      created_at: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

describe("eventBus", () => {
  it("should call subscriber when message is published", () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    const msg = makeMsg();
    eventBus.publish(msg);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);

    unsub();
  });

  it("should support multiple subscribers", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = eventBus.subscribe(h1);
    const u2 = eventBus.subscribe(h2);

    eventBus.publish(makeMsg());

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);

    u1();
    u2();
  });

  it("should stop calling handler after unsubscribe", () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    eventBus.publish(makeMsg());
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();

    eventBus.publish(makeMsg());
    expect(handler).toHaveBeenCalledTimes(1); // still 1
  });

  it("should not fail when publishing with no subscribers", () => {
    expect(() => eventBus.publish(makeMsg())).not.toThrow();
  });

  it("should handle unsubscribe called multiple times", () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    unsub();
    unsub(); // second call should be harmless

    eventBus.publish(makeMsg());
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not add duplicate handler references", () => {
    const handler = vi.fn();
    const u1 = eventBus.subscribe(handler);
    const u2 = eventBus.subscribe(handler); // same ref, Set deduplicates

    eventBus.publish(makeMsg());
    expect(handler).toHaveBeenCalledTimes(1); // Set prevents double-add

    u1();
    u2();
  });
});
