/**
 * @file eventBus.test.ts
 * @description Unit tests for the eventBus module to ensure correct subscription, publishing, and unsubscription behavior in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/eventBus.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the eventBus module to ensure correct subscription, publishing, and unsubscription
 * behavior in the agent dashboard application.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../eventBus` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `makeMsg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `eventBus` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `should call subscriber when message is published` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should handle unsubscribe called multiple times` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should not add duplicate handler references` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should not fail when publishing with no subscribers` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should stop calling handler after unsubscribe` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should support multiple subscribers` — executable behavior named by this suite; preserve the
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/eventBus.test.ts` .
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
 * Path: `client/src/lib/__tests__/eventBus.test.ts`
 *
 * Scope
 * Unit tests for the eventBus module to ensure correct subscription, publishing, and unsubscription
 * behavior in the agent dashboard application.
 *
 * Subjects and collaborators
 * - `../eventBus` — local module imported by this suite.
 * - `../types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 *
 * Suite groups
 * - `eventBus`
 *
 * Protected behavior
 * - should call subscriber when message is published
 * - should support multiple subscribers
 * - should stop calling handler after unsubscribe
 * - should not fail when publishing with no subscribers
 * - should handle unsubscribe called multiple times
 * - should not add duplicate handler references
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

import { describe, it, expect, vi } from "vitest";
import { eventBus } from "../eventBus";
import type { WSMessage } from "../types";

function makeMsg(type: WSMessage["type"] = "new_event"): WSMessage {
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
