/**
 * @file highlight.test.ts
 * @description Unit tests for the syntax highlighter used by the conversation viewer.
 * Ensures token classification stays stable for languages we actually render.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
