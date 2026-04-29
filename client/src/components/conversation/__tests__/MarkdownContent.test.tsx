/**
 * @file MarkdownContent.test.tsx
 * @description Tests for the lightweight markdown renderer used by the conversation viewer.
 * Focuses on the block parser since the inline parser is well-exercised by snapshot-style
 * DOM assertions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
