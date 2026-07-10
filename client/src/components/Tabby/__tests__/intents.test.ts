/**
 * @file intents.test.ts
 * @description Unit tests for Tabby's intent matcher — natural-language queries mapped to dashboard navigation and status intents.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { matchIntent } from "../intents";
import type { TabbyStatus } from "../brain";

const status = (over: Partial<TabbyStatus> = {}): TabbyStatus => ({
  liveCount: 0,
  waitingCount: 0,
  errorCount: 0,
  connected: true,
  ...over,
});

describe("matchIntent", () => {
  it("reports live sessions", () => {
    const r = matchIntent("what's running?", status({ liveCount: 3 }));
    expect(r).toEqual({ kind: "answer", text: expect.stringContaining("3 sessions live") });
  });

  it("singularizes correctly", () => {
    const r = matchIntent("anything active", status({ liveCount: 1 }));
    expect(r.kind).toBe("answer");
    if (r.kind === "answer") expect(r.text).toContain("1 session live");
  });

  it("says all quiet when nothing live", () => {
    const r = matchIntent("what is running", status());
    if (r.kind === "answer") expect(r.text).toContain("nothing's running");
  });

  it("reports errors and prioritizes error intent over live", () => {
    const r = matchIntent("any failed runs?", status({ liveCount: 2, errorCount: 1 }));
    if (r.kind === "answer") expect(r.text).toContain("1 session errored");
  });

  it("clean when no errors", () => {
    const r = matchIntent("are there errors", status({ liveCount: 2 }));
    if (r.kind === "answer") expect(r.text).toContain("all clean");
  });

  it("gives a combined status summary", () => {
    const r = matchIntent(
      "status",
      status({ liveCount: 2, waitingCount: 1, errorCount: 1, connected: true })
    );
    if (r.kind === "answer") expect(r.text).toBe("2 live · 1 waiting · 1 errored · connected.");
  });

  it("reports sessions waiting on the user", () => {
    const r = matchIntent("anything waiting on me?", status({ liveCount: 2, waitingCount: 1 }));
    if (r.kind === "answer") expect(r.text).toContain("1 session waiting on you");
  });

  it("reflects offline in summary", () => {
    const r = matchIntent("overview", status({ connected: false }));
    if (r.kind === "answer") expect(r.text).toContain("offline");
  });

  it("explains itself on help", () => {
    const r = matchIntent("help", status());
    if (r.kind === "answer") expect(r.text.toLowerCase()).toContain("watch your sessions");
  });

  it("empty query nudges the user", () => {
    const r = matchIntent("   ", status());
    expect(r.kind).toBe("answer");
  });

  it("hands unknown questions to Claude, preserving original casing", () => {
    const r = matchIntent("Refactor my auth module", status());
    expect(r).toEqual({ kind: "handoff", prompt: "Refactor my auth module" });
  });
});
