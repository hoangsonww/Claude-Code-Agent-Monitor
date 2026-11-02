/**
 * @file intents.test.ts
 * @description Unit tests for Tabby's intent matcher — natural-language queries mapped to dashboard navigation and status intents.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/__tests__/intents.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for Tabby's intent matcher — natural-language queries mapped to dashboard navigation
 * and status intents.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../brain` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../intents` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `status` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `clean when no errors` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `empty query nudges the user` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `explains itself on help` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `gives a combined status summary` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `hands unknown questions to Claude, preserving original casing` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `matchIntent` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `reflects offline in summary` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `reports errors and prioritizes error intent over live` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `reports live sessions` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `reports sessions waiting on the user` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `says all quiet when nothing live` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `singularizes correctly` — executable behavior named by this suite; preserve the observable
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/__tests__/intents.test.ts`
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
