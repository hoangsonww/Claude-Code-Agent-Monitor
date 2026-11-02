/**
 * @file fuzzy.test.ts
 * @description Tests the palette's ranking function. The behavior that matters
 * is ordering, not raw scores, so every assertion compares two candidates
 * against the same query rather than pinning a number — the weights are meant to
 * be tunable without rewriting the suite.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/fuzzy.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Tests the palette's ranking function. The behavior that matters is ordering, not raw scores, so
 * every assertion compares two candidates against the same query rather than pinning a number — the
 * weights are meant to be tunable without rewriting the suite.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../fuzzy` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `score` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `always ranks a label hit above a keyword hit` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `breaks ties toward the shorter, more specific label` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `collapses a multi-character folding onto the single source character` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `falls back to secondary fields when the label does not match` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `fuzzyMatch` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `fuzzyMatchFields` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `handles matches that are not contiguous` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `highlightSegments` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `is case-insensitive and diacritic-insensitive` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `matches a subsequence, not only a substring` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `matches an empty query against anything` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `ranks a contiguous run above a scattered one` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `ranks a prefix above a mid-word hit` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `ranks a word-start hit above an interior one` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `reassembles to the original text` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `reports offsets into the original text, not the normalized one` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `reports the positions that matched, for highlighting` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `returns null when a character is missing` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `returns null when nothing matches` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `returns null when the query is longer than the text` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `returns one unmatched run when nothing matched` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `splits the text into matched and unmatched runs` — executable behavior named by this suite;
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/fuzzy.test.ts` .
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
 * Path: `client/src/lib/__tests__/fuzzy.test.ts`
 *
 * Scope
 * Tests the palette's ranking function. The behavior that matters is ordering, not raw scores, so
 * every assertion compares two candidates against the same query rather than pinning a number — the
 * weights are meant to be tunable without rewriting the suite.
 *
 * Subjects and collaborators
 * - `../fuzzy` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `fuzzyMatch`
 * - `fuzzyMatchFields`
 * - `highlightSegments`
 *
 * Protected behavior
 * - matches an empty query against anything
 * - matches a subsequence, not only a substring
 * - returns null when a character is missing
 * - returns null when the query is longer than the text
 * - reports the positions that matched, for highlighting
 * - ranks a prefix above a mid-word hit
 * - ranks a word-start hit above an interior one
 * - ranks a contiguous run above a scattered one
 * - breaks ties toward the shorter, more specific label
 * - reports offsets into the original text, not the normalized one
 * - collapses a multi-character folding onto the single source character
 * - is case-insensitive and diacritic-insensitive
 * - falls back to secondary fields when the label does not match
 * - always ranks a label hit above a keyword hit
 * - returns null when nothing matches
 * - returns one unmatched run when nothing matched
 * - splits the text into matched and unmatched runs
 * - handles matches that are not contiguous
 * - reassembles to the original text
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

import { describe, expect, it } from "vitest";
import { foldText, fuzzyMatch, fuzzyMatchFields, highlightSegments } from "../fuzzy";

/** Score `text` for `query`, failing loudly if it did not match at all. */
function score(text: string, query: string): number {
  const match = fuzzyMatch(text, query);
  expect(match, `${query} should match ${text}`).not.toBeNull();
  return match!.score;
}

describe("fuzzyMatch", () => {
  it("matches an empty query against anything", () => {
    expect(fuzzyMatch("Dashboard", "")).toEqual({ score: 0, indices: [] });
  });

  it("matches a subsequence, not only a substring", () => {
    expect(fuzzyMatch("Kanban Board", "kbrd")).not.toBeNull();
    expect(fuzzyMatch("MCP servers", "mcp")).not.toBeNull();
  });

  it("returns null when a character is missing", () => {
    expect(fuzzyMatch("Dashboard", "dashz")).toBeNull();
  });

  it("returns null when the query is longer than the text", () => {
    expect(fuzzyMatch("Run", "running")).toBeNull();
  });

  it("reports the positions that matched, for highlighting", () => {
    expect(fuzzyMatch("Sessions", "ses")?.indices).toEqual([0, 1, 2]);
  });

  it("ranks a prefix above a mid-word hit", () => {
    expect(score("Analytics", "ana")).toBeGreaterThan(score("Workflow Analytics", "ana"));
  });

  it("ranks a word-start hit above an interior one", () => {
    expect(score("Agent Board", "b")).toBeGreaterThan(score("Kanban", "b"));
  });

  it("ranks a contiguous run above a scattered one", () => {
    expect(score("Run Agent", "run")).toBeGreaterThan(score("Return unsaved notes", "run"));
  });

  it("breaks ties toward the shorter, more specific label", () => {
    expect(score("Sessions", "sessions")).toBeGreaterThan(
      score("Sessions: Active and waiting", "sessions")
    );
  });

  it("reports offsets into the original text, not the normalized one", () => {
    // A Hangul syllable decomposes into jamo that are not combining marks, so
    // the folded string is longer than the original. Reporting folded offsets
    // here would underline the wrong characters in a Korean session name.
    const text = "가x";
    const match = fuzzyMatch(text, "x");
    expect(match).not.toBeNull();
    expect(match!.indices).toEqual([1]);
    expect(text[match!.indices[0]!]).toBe("x");
  });

  it("collapses a multi-character folding onto the single source character", () => {
    const match = fuzzyMatch("가나", "가");
    expect(match).not.toBeNull();
    // Two folded jamo, one original syllable — one index, not two.
    expect(match!.indices).toEqual([0]);
  });

  it("is case-insensitive and diacritic-insensitive", () => {
    expect(fuzzyMatch("Analíticas", "analiticas")).not.toBeNull();
    expect(fuzzyMatch("ANALYTICS", "analytics")).not.toBeNull();
    expect(foldText("Analíticas")).toBe("analiticas");
  });
});

describe("fuzzyMatchFields", () => {
  it("falls back to secondary fields when the label does not match", () => {
    const match = fuzzyMatchFields("Agent Config", ["/cc-config?tab=mcp"], "mcp");
    expect(match).not.toBeNull();
    // Secondary hits carry no highlight indices — underlining characters the
    // user cannot see would be worse than not underlining at all.
    expect(match!.indices).toEqual([]);
  });

  it("always ranks a label hit above a keyword hit", () => {
    const onLabel = fuzzyMatchFields("MCP servers", [], "mcp")!;
    const onKeyword = fuzzyMatchFields("Agent Config", ["mcp"], "mcp")!;
    expect(onLabel.score).toBeGreaterThan(onKeyword.score);
  });

  it("returns null when nothing matches", () => {
    expect(fuzzyMatchFields("Dashboard", ["/"], "zzz")).toBeNull();
  });
});

describe("highlightSegments", () => {
  it("returns one unmatched run when nothing matched", () => {
    expect(highlightSegments("Dashboard", [])).toEqual([{ text: "Dashboard", match: false }]);
  });

  it("splits the text into matched and unmatched runs", () => {
    expect(highlightSegments("Sessions", [0, 1, 2])).toEqual([
      { text: "Ses", match: true },
      { text: "sions", match: false },
    ]);
  });

  it("handles matches that are not contiguous", () => {
    expect(highlightSegments("abcd", [0, 2])).toEqual([
      { text: "a", match: true },
      { text: "b", match: false },
      { text: "c", match: true },
      { text: "d", match: false },
    ]);
  });

  it("reassembles to the original text", () => {
    const text = "Keyboard shortcuts";
    const match = fuzzyMatch(text, "kbs")!;
    expect(
      highlightSegments(text, match.indices)
        .map((segment) => segment.text)
        .join("")
    ).toBe(text);
  });
});
