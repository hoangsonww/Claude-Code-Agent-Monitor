/**
 * @file MarkdownContent.test.tsx
 * @description Tests for the lightweight markdown renderer used by the conversation viewer.
 * Focuses on the block parser since the inline parser is well-exercised by snapshot-style
 * DOM assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/__tests__/MarkdownContent.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests for the lightweight markdown renderer used by the conversation viewer. Focuses on the block
 * parser since the inline parser is well-exercised by snapshot-style DOM assertions.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../MarkdownContent` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `<MarkdownContent />` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `auto-links bare URLs and renders explicit markdown links` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `handles empty input safely` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders blockquotes` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `renders fenced code blocks with the language label` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders headings as semantic-looking elements` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders inline code, bold, and italic` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `renders plain text without any markdown features` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders unordered and ordered lists` — executable behavior named by this suite; preserve the
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/__tests__/MarkdownContent.test.tsx`
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
 * Path: `client/src/components/conversation/__tests__/MarkdownContent.test.tsx`
 *
 * Scope
 * Tests for the lightweight markdown renderer used by the conversation viewer. Focuses on the block
 * parser since the inline parser is well-exercised by snapshot-style DOM assertions.
 *
 * Subjects and collaborators
 * - `../MarkdownContent` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `<MarkdownContent />`
 *
 * Protected behavior
 * - renders fenced code blocks with the language label
 * - renders headings as semantic-looking elements
 * - renders unordered and ordered lists
 * - renders blockquotes
 * - renders inline code, bold, and italic
 * - auto-links bare URLs and renders explicit markdown links
 * - renders plain text without any markdown features
 * - handles empty input safely
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
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "../MarkdownContent";

describe("<MarkdownContent />", () => {
  it("renders fenced code blocks with the language label", () => {
    render(<MarkdownContent text={"Here is some code:\n```js\nconst x = 1;\n```"} />);
    // The CodeBlock header shows the language
    expect(screen.getByText(/javascript/i)).toBeInTheDocument();
    // The code text is present (split across syntax-highlighted spans, so use a substring)
    expect(screen.getByText(/const/)).toBeInTheDocument();
  });

  it("renders headings as semantic-looking elements", () => {
    render(<MarkdownContent text={"# Title\n\nbody"} />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders unordered and ordered lists", () => {
    const { container } = render(<MarkdownContent text={"- one\n- two\n\n1. first\n2. second"} />);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders blockquotes", () => {
    const { container } = render(<MarkdownContent text={"> a quote"} />);
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(screen.getByText("a quote")).toBeInTheDocument();
  });

  it("renders inline code, bold, and italic", () => {
    const { container } = render(
      <MarkdownContent text={"This has `code`, **bold**, and *italic*."} />
    );
    expect(container.querySelector("code")).not.toBeNull();
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("em")).not.toBeNull();
  });

  it("auto-links bare URLs and renders explicit markdown links", () => {
    const { container } = render(
      <MarkdownContent text={"See https://example.com or [docs](https://example.com/docs)."} />
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0]!.getAttribute("href")).toBe("https://example.com");
    expect(links[1]!.getAttribute("href")).toBe("https://example.com/docs");
    // Both should open in a new tab safely
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
  });

  it("renders plain text without any markdown features", () => {
    render(<MarkdownContent text={"just a normal sentence."} />);
    expect(screen.getByText("just a normal sentence.")).toBeInTheDocument();
  });

  it("handles empty input safely", () => {
    const { container } = render(<MarkdownContent text="" />);
    // Wrapper exists but no block elements
    expect(container.firstChild).not.toBeNull();
    expect(container.querySelectorAll("p, ul, ol, blockquote, pre, hr").length).toBe(0);
  });
});
