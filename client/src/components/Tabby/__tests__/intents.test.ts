/**
 * @file intents.test.ts
 * @description Unit tests for Tabby's intent matcher — natural-language queries mapped to dashboard navigation and status intents.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/Tabby/__tests__/intents.test.ts`
 *
 * Scope
 * Unit tests for Tabby's intent matcher — natural-language queries mapped to dashboard navigation
 * and status intents.
 *
 * Subjects and collaborators
 * - `../intents` — local module imported by this suite.
 * - `../brain` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `matchIntent`
 *
 * Protected behavior
 * - reports live sessions
 * - singularizes correctly
 * - says all quiet when nothing live
 * - reports errors and prioritizes error intent over live
 * - clean when no errors
 * - gives a combined status summary
 * - reports sessions waiting on the user
 * - reflects offline in summary
 * - explains itself on help
 * - empty query nudges the user
 * - hands unknown questions to Claude, preserving original casing
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
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

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
