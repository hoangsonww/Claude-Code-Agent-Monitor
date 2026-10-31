/**
 * @file MarkdownContent.test.tsx
 * @description Tests for the lightweight markdown renderer used by the conversation viewer.
 * Focuses on the block parser since the inline parser is well-exercised by snapshot-style
 * DOM assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
