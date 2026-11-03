/**
 * @file Unit tests for friendlyPreview - turns an agent's raw (often truncated)
 * JSON result preview into a human-readable excerpt for the Workflow Runs panel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/__tests__/friendlyPreview.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for friendlyPreview - turns an agent's raw (often truncated) JSON result preview into
 * a human-readable excerpt for the Workflow Runs panel.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../WorkflowRunsPanel` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `de-JSONs a blob with no good string, stripping structural punctuation` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `extracts the first claim from a findings array` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `falls back to the first substantial quoted string when no known key matches` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `friendlyPreview` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `fullPreview` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `handles a TRUNCATED json blob (no closing quote/brace) via the keyed field` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `passes plain prose through unchanged` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `prefers a known content field (pitch) over earlier short fields` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `pretty-prints valid JSON` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `returns empty for nullish input` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `returns empty for nullish/empty input` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `returns truncated/invalid JSON verbatim` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/__tests__/friendlyPreview.test.ts`
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
 * Path: `client/src/components/workflows/__tests__/friendlyPreview.test.ts`
 *
 * Scope
 * Behavioral regression suite for `friendlyPreview.test.ts`.
 *
 * Subjects and collaborators
 * - `../WorkflowRunsPanel` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `friendlyPreview`
 * - `fullPreview`
 *
 * Protected behavior
 * - returns empty for nullish/empty input
 * - prefers a known content field (pitch) over earlier short fields
 * - extracts the first claim from a findings array
 * - handles a TRUNCATED json blob (no closing quote/brace) via the keyed field
 * - falls back to the first substantial quoted string when no known key matches
 * - de-JSONs a blob with no good string, stripping structural punctuation
 * - passes plain prose through unchanged
 * - pretty-prints valid JSON
 * - returns truncated/invalid JSON verbatim
 * - returns empty for nullish input
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
import { friendlyPreview, fullPreview } from "../WorkflowRunsPanel";

describe("friendlyPreview", () => {
  it("returns empty for nullish/empty input", () => {
    expect(friendlyPreview(null)).toBe("");
    expect(friendlyPreview(undefined)).toBe("");
    expect(friendlyPreview("")).toBe("");
  });

  it("prefers a known content field (pitch) over earlier short fields", () => {
    const raw =
      '{"language":"Python","pitch":"If you learn one language first in 2026, make it Python."}';
    expect(friendlyPreview(raw)).toBe("If you learn one language first in 2026, make it Python.");
  });

  it("extracts the first claim from a findings array", () => {
    const raw =
      '{"angle":"starship","findings":[{"claim":"SpaceX flew Starship Flight 12 on May 22, 2026.","source":"x","confidence":"high"}]}';
    expect(friendlyPreview(raw)).toBe("SpaceX flew Starship Flight 12 on May 22, 2026.");
  });

  it("handles a TRUNCATED json blob (no closing quote/brace) via the keyed field", () => {
    const raw =
      '{"angle":"starlink","findings":[{"claim":"As of June 2026, Starlink has roughly 10,500 active satellites in orbit and a';
    // keyed match stops at end-of-string (no closing quote), so it returns the partial claim
    expect(friendlyPreview(raw)).toContain("As of June 2026, Starlink has roughly 10,500");
    expect(friendlyPreview(raw)).not.toContain('{"angle"');
  });

  it("falls back to the first substantial quoted string when no known key matches", () => {
    const raw = '{"x":"ab","y":"this is a sufficiently long quoted value to surface"}';
    expect(friendlyPreview(raw)).toBe("this is a sufficiently long quoted value to surface");
  });

  it("de-JSONs a blob with no good string, stripping structural punctuation", () => {
    const raw = '{"a":1,"b":[2,3]}';
    const out = friendlyPreview(raw);
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
    expect(out).not.toContain("[");
  });

  it("passes plain prose through unchanged", () => {
    const raw = "All four claims confirmed against primary sources.";
    expect(friendlyPreview(raw)).toBe("All four claims confirmed against primary sources.");
  });
});

describe("fullPreview", () => {
  it("pretty-prints valid JSON", () => {
    const out = fullPreview('{"a":1,"b":{"c":2}}');
    expect(out).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
  });

  it("returns truncated/invalid JSON verbatim", () => {
    const raw = '{"claim":"partial value with no close';
    expect(fullPreview(raw)).toBe(raw);
  });

  it("returns empty for nullish input", () => {
    expect(fullPreview(null)).toBe("");
    expect(fullPreview(undefined)).toBe("");
  });
});
