/**
 * @file Unit tests for mergeFreshestById, the helper that collapses rows a
 * status-scoped fan-out returned twice because the row changed status while the
 * requests were in flight.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/merge-by-id.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for mergeFreshestById, the helper that collapses rows a status-scoped fan-out returned
 * twice because the row changed status while the requests were in flight.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../merge-by-id` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `falls back to last_activity, then started_at, when updated_at is absent` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `ignores empty groups and malformed rows` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `keeps one entry per id and prefers the freshest updated_at` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `keeps the earlier copy when neither carries a usable timestamp` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `mergeFreshestById` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `preserves first-appearance order of distinct ids` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/merge-by-id.test.ts`
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
 * Path: `client/src/lib/__tests__/merge-by-id.test.ts`
 *
 * Scope
 * Behavioral regression suite for `merge-by-id.test.ts`.
 *
 * Subjects and collaborators
 * - `../merge-by-id` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `mergeFreshestById`
 *
 * Protected behavior
 * - keeps one entry per id and prefers the freshest updated_at
 * - preserves first-appearance order of distinct ids
 * - falls back to last_activity, then started_at, when updated_at is absent
 * - keeps the earlier copy when neither carries a usable timestamp
 * - ignores empty groups and malformed rows
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
import { mergeFreshestById } from "../merge-by-id";

describe("mergeFreshestById", () => {
  it("keeps one entry per id and prefers the freshest updated_at", () => {
    const stale = { id: "codex:a", status: "waiting", updated_at: "2026-09-20T03:04:58.100Z" };
    const fresh = { id: "codex:a", status: "working", updated_at: "2026-09-20T03:05:03.691Z" };

    expect(mergeFreshestById([fresh], [stale])).toEqual([fresh]);
    // Order of the responses must not change which copy wins.
    expect(mergeFreshestById([stale], [fresh])).toEqual([fresh]);
  });

  it("preserves first-appearance order of distinct ids", () => {
    const rows = mergeFreshestById(
      [{ id: "a", updated_at: "2026-09-20T03:00:00.000Z" }],
      [
        { id: "b", updated_at: "2026-09-20T03:00:00.000Z" },
        { id: "a", updated_at: "2026-09-20T02:00:00.000Z" },
      ]
    );
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("falls back to last_activity, then started_at, when updated_at is absent", () => {
    const older = { id: "s1", last_activity: "2026-09-20T03:00:00.000Z" };
    const newer = { id: "s1", last_activity: "2026-09-20T04:00:00.000Z" };
    expect(mergeFreshestById([older], [newer])).toEqual([newer]);

    const earliest = { id: "s2", started_at: "2026-09-19T00:00:00.000Z" };
    const latest = { id: "s2", started_at: "2026-09-20T00:00:00.000Z" };
    expect(mergeFreshestById([earliest], [latest])).toEqual([latest]);
  });

  it("keeps the earlier copy when neither carries a usable timestamp", () => {
    const first = { id: "x", status: "working" };
    const second = { id: "x", status: "waiting", updated_at: "not-a-date" };
    expect(mergeFreshestById([first], [second])).toEqual([first]);
  });

  it("ignores empty groups and malformed rows", () => {
    const valid = { id: "ok", updated_at: "2026-09-20T03:00:00.000Z" };
    const rows = mergeFreshestById(
      [],
      [valid],
      [null as unknown as typeof valid, { id: 7 } as unknown as typeof valid]
    );
    expect(rows).toEqual([valid]);
  });
});
