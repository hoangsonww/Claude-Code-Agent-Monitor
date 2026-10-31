/**
 * @file fuzzy.test.ts
 * @description Tests the palette's ranking function. The behavior that matters
 * is ordering, not raw scores, so every assertion compares two candidates
 * against the same query rather than pinning a number — the weights are meant to
 * be tunable without rewriting the suite.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
