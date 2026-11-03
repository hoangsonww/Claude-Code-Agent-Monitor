/**
 * @file highlight.test.ts
 * @description Unit tests for the syntax highlighter used by the conversation viewer.
 * Ensures token classification stays stable for languages we actually render.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/highlight.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the syntax highlighter used by the conversation viewer. Ensures token
 * classification stays stable for languages we actually render.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../highlight` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `joinByType` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `canonicalLang()` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `classifies bash builtins and variables` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `classifies diff lines` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `classifies JS keywords, strings, numbers, comments` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `classifies JSON keys as property and bare strings as string` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `highlight()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `maps common aliases to canonical keys` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `preserves the original source verbatim when concatenated` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `returns a non-empty class for every token type` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `returns plain tokens for unknown languages` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `tokenClass()` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/highlight.test.ts` .
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
 * Path: `client/src/lib/__tests__/highlight.test.ts`
 *
 * Scope
 * Unit tests for the syntax highlighter used by the conversation viewer. Ensures token
 * classification stays stable for languages we actually render.
 *
 * Subjects and collaborators
 * - `../highlight` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `highlight()`
 * - `canonicalLang()`
 * - `tokenClass()`
 *
 * Protected behavior
 * - preserves the original source verbatim when concatenated
 * - classifies JS keywords, strings, numbers, comments
 * - classifies JSON keys as property and bare strings as string
 * - classifies bash builtins and variables
 * - returns plain tokens for unknown languages
 * - classifies diff lines
 * - maps common aliases to canonical keys
 * - returns a non-empty class for every token type
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
import { canonicalLang, highlight, tokenClass } from "../highlight";

function joinByType(tokens: { type: string; text: string }[], type: string): string {
  return tokens
    .filter((t) => t.type === type)
    .map((t) => t.text)
    .join("|");
}

describe("highlight()", () => {
  it("preserves the original source verbatim when concatenated", () => {
    const sources = [
      "const x = 42;\nconsole.log(x);",
      "def foo(a, b):\n    return a + b\n",
      '{"a": 1, "b": [true, null]}',
      "echo $HOME && ls -la",
    ];
    for (const src of sources) {
      const langs = ["js", "python", "json", "bash"];
      for (const lang of langs) {
        const out = highlight(src, lang)
          .map((t) => t.text)
          .join("");
        expect(out).toBe(src);
      }
    }
  });

  it("classifies JS keywords, strings, numbers, comments", () => {
    const tokens = highlight('const x = "hi"; // greet\nreturn 42;', "ts");
    expect(joinByType(tokens, "keyword")).toContain("const");
    expect(joinByType(tokens, "keyword")).toContain("return");
    expect(joinByType(tokens, "string")).toContain('"hi"');
    expect(joinByType(tokens, "comment")).toContain("// greet");
    expect(joinByType(tokens, "number")).toContain("42");
  });

  it("classifies JSON keys as property and bare strings as string", () => {
    const tokens = highlight('{"name": "Son", "age": 30}', "json");
    expect(joinByType(tokens, "property")).toContain('"name"');
    expect(joinByType(tokens, "property")).toContain('"age"');
    expect(joinByType(tokens, "string")).toContain('"Son"');
    expect(joinByType(tokens, "number")).toContain("30");
  });

  it("classifies bash builtins and variables", () => {
    const tokens = highlight("echo $USER", "bash");
    expect(joinByType(tokens, "builtin")).toContain("echo");
    expect(joinByType(tokens, "variable")).toContain("$USER");
  });

  it("returns plain tokens for unknown languages", () => {
    const tokens = highlight("anything goes here", "klingon");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.type).toBe("plain");
  });

  it("classifies diff lines", () => {
    const src = "diff --git a b\n+++ b\n--- a\n+added\n-removed\n unchanged";
    const tokens = highlight(src, "diff");
    expect(joinByType(tokens, "diff-add")).toContain("+added");
    expect(joinByType(tokens, "diff-del")).toContain("-removed");
    expect(joinByType(tokens, "diff-meta")).toContain("diff --git a b");
  });
});

describe("canonicalLang()", () => {
  it("maps common aliases to canonical keys", () => {
    expect(canonicalLang("JavaScript")).toBe("js");
    expect(canonicalLang("tsx")).toBe("ts");
    expect(canonicalLang("py")).toBe("python");
    expect(canonicalLang("zsh")).toBe("bash");
    expect(canonicalLang("yml")).toBe("yaml");
    expect(canonicalLang("")).toBe("plain");
  });
});

describe("tokenClass()", () => {
  it("returns a non-empty class for every token type", () => {
    const types = [
      "plain",
      "comment",
      "string",
      "number",
      "keyword",
      "builtin",
      "function",
      "operator",
      "punctuation",
      "property",
      "tag",
      "attr",
      "variable",
      "boolean",
      "diff-add",
      "diff-del",
      "diff-meta",
    ] as const;
    for (const t of types) {
      expect(tokenClass(t).length).toBeGreaterThan(0);
    }
  });
});
