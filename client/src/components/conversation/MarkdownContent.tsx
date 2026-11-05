/**
 * @file MarkdownContent.tsx
 * @description Lightweight markdown renderer for conversation messages. Supports the
 * subset of CommonMark + GFM that actually appears in Claude Code transcripts:
 * fenced code blocks, ATX headings, ordered/unordered lists, task lists, blockquotes,
 * horizontal rules, simple tables, inline code, bold, italic, strikethrough, links,
 * and auto-linked URLs.
 *
 * Output is built as a React element tree (no dangerouslySetInnerHTML) so user content
 * is escaped by React. Code blocks delegate to <CodeBlock /> for syntax highlighting and
 * copy-to-clipboard.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/MarkdownContent.tsx
 * **Area:** client conversation component
 * **Responsibility:**
 * Lightweight markdown renderer for conversation messages. Supports the subset of CommonMark + GFM
 * that actually appears in Claude Code transcripts: fenced code blocks, ATX headings,
 * ordered/unordered lists, task lists, blockquotes, horizontal rules, simple tables, inline code,
 * bold, italic, strikethrough, links, and auto-linked URLs. Output is built as a React element tree
 * (no dangerouslySetInnerHTML) so user content is escaped by React. Code blocks delegate to
 * <CodeBlock /> for syntax highlighting and copy-to-clipboard.
 *
 * ## Architectural boundary
 * - Renders durable transcript messages and tool activity without changing the provider-neutral
 *   conversation model.
 * - Parsing and normalization belong in shared transcript helpers; this layer owns readable
 *   presentation and interaction.
 * - Large histories must remain incremental so a single expanded conversation does not block the
 *   dashboard.
 *
 * ## Local dependency edges
 * - `./CodeBlock` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `MarkdownContent` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Block` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FENCE_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HEADING_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HEADING_STYLES` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `HR_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `MarkdownContent` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MarkdownContentProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `OL_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `parseAlignments` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `parseBlocks` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `QUOTE_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderInline` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `renderListItem` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `splitTableRow` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TABLE_DIVIDER_RE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `UL_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Preserve message identity and sender attribution across Claude, Codex, Cursor, imported, and
 *   snapshot-backed sessions.
 * - Treat tool input, tool output, markdown, code, images, and malformed payloads as distinct
 *   rendering cases.
 * - Never execute transcript content; sanitize links and render code as inert text with controlled
 *   highlighting.
 * - Keep pagination append/prepend behavior stable and preserve scroll position when older messages
 *   arrive.
 * - Do not truncate content without an explicit affordance that lets the operator inspect the full
 *   value.
 * - Use virtualization or bounded rendering patterns where the existing component establishes them.
 * - Keep copy/select behavior predictable for terminal-style segments and syntax-highlighted
 *   blocks.
 * - Represent missing snapshot data honestly instead of implying the underlying provider still
 *   retains a transcript.
 * - Maintain accessible labels for sender, timestamp, tool state, expansion controls, and
 *   attachments.
 * - Test malformed and provider-specific rows because transcript fixtures evolve independently of
 *   UI releases.
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
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/MarkdownContent.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/MarkdownContent.tsx`
 * **Purpose:** Renders Claude transcript rows (user, assistant, tool calls) inside Session Detail with markdown, syntax highlighting, and TUI-style segments.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `./CodeBlock`
 *
 * ## Public surface
 * - `MarkdownContent` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **MarkdownContent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import React from "react";
import { CodeBlock } from "./CodeBlock";

/**
 * A block-level piece of parsed markdown: fenced code, heading, list, block quote, horizontal rule,
 * table, or paragraph.
 */
type Block =
  | { kind: "code"; lang: string; code: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | {
      kind: "table";
      header: string[];
      aligns: ("left" | "center" | "right" | null)[];
      rows: string[][];
    }
  | { kind: "para"; text: string };

/**
 * Opening or closing code fence (``` or ~~~), optionally indented and followed by a language tag.
 */
const FENCE_RE = /^([ \t]*)(```|~~~)(\s*[\w+-]*)\s*$/;
/** ATX heading (`#` to `######`), ignoring optional closing hashes. */
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
/** Horizontal rule: three or more `-`, `*`, or `_`. */
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
/** Unordered list item marked with `-`, `*`, or `+`. */
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
/** Ordered list item such as `1.`. */
const OL_RE = /^(\s*)(\d+)\.\s+(.*)$/;
/** Block quote line starting with `>`. */
const QUOTE_RE = /^\s*>\s?(.*)$/;
/** Table header divider row, such as `| --- | :---: |`. */
const TABLE_DIVIDER_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

/**
 * Split a markdown table row into cell texts, dropping the outer pipes and honoring `\|` escapes
 * inside cells.
 *
 * @param line - Table row.
 * @returns Trimmed cell texts.
 */
function splitTableRow(line: string): string[] {
  // Trim leading/trailing pipes, then split, respecting escaped pipes.
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  // Split on unescaped pipes
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (s[i] === "|") {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += s[i];
    }
  }
  parts.push(cur.trim());
  return parts;
}

/**
 * Read column alignments from a table divider row: `:---` left, `---:` right, `:---:` center.
 *
 * @param divider - Divider row.
 * @returns One alignment per column, or null when unspecified.
 */
function parseAlignments(divider: string): ("left" | "center" | "right" | null)[] {
  return splitTableRow(divider).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

/**
 * Split markdown source into blocks in one pass over its lines: fenced code (an unclosed fence runs
 * to the end), headings, horizontal rules, tables (a header row followed by a divider), block
 * quotes, ordered and unordered lists, and paragraphs. Inline formatting is handled later, per
 * block.
 *
 * @param src - Markdown text.
 * @returns The blocks in order.
 */
function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    const fence = line.match(FENCE_RE);
    if (fence) {
      const fenceMarker = fence[2]!;
      const lang = (fence[3] ?? "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const closing = lines[i]!.match(/^([ \t]*)(```|~~~)\s*$/);
        if (closing && closing[2] === fenceMarker) {
          i++;
          break;
        }
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push({ kind: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ATX heading
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (HR_RE.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Table: header line followed by an alignment divider
    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER_RE.test(lines[i + 1]!)) {
      const header = splitTableRow(line);
      const aligns = parseAlignments(lines[i + 1]!);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        rows.push(splitTableRow(lines[i]!));
        i++;
      }
      blocks.push({ kind: "table", header, aligns, rows });
      continue;
    }

    // Lists
    const ulMatch = line.match(UL_RE);
    const olMatch = line.match(OL_RE);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const itemRe = ordered ? OL_RE : UL_RE;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(itemRe);
        if (m) {
          items.push(m[3]!);
          i++;
          while (
            i < lines.length &&
            lines[i]!.trim() !== "" &&
            !lines[i]!.match(UL_RE) &&
            !lines[i]!.match(OL_RE) &&
            /^\s+\S/.test(lines[i]!)
          ) {
            items[items.length - 1] += "\n" + lines[i]!.trim();
            i++;
          }
        } else {
          break;
        }
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // Blockquote
    if (QUOTE_RE.test(line)) {
      const qLines: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(QUOTE_RE);
        if (!m) break;
        qLines.push(m[1]!);
        i++;
      }
      blocks.push({ kind: "quote", text: qLines.join("\n") });
      continue;
    }

    // Paragraph: collect until a blank line or the start of another block
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const nl = lines[i]!;
      if (
        nl.trim() === "" ||
        FENCE_RE.test(nl) ||
        HEADING_RE.test(nl) ||
        HR_RE.test(nl) ||
        UL_RE.test(nl) ||
        OL_RE.test(nl) ||
        QUOTE_RE.test(nl)
      ) {
        break;
      }
      paraLines.push(nl);
      i++;
    }
    blocks.push({ kind: "para", text: paraLines.join("\n") });
  }
  return blocks;
}

/**
 * Render inline markdown (bold/italic/code/strikethrough/links/auto-links).
 *
 * @param text - Inline markdown.
 * @param baseKey - Prefix for React keys, unique within the parent.
 * @returns The rendered nodes.
 */
function renderInline(text: string, baseKey = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let buf = "";
  let n = 0;
  /** Emit pending plain text as a node. */
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
  /** Emit a formatted node, flushing pending text first. */
  const push = (node: React.ReactNode) => {
    flush();
    out.push(<React.Fragment key={`${baseKey}-${n++}`}>{node}</React.Fragment>);
  };

  while (i < text.length) {
    const rest = text.slice(i);

    // Inline code: `...`
    const codeM = rest.match(/^`([^`\n]+)`/);
    if (codeM) {
      push(
        <code className="rounded bg-surface-4 border border-surface-3 px-1.5 py-0.5 font-mono text-[12.5px] text-amber-200">
          {codeM[1]}
        </code>
      );
      i += codeM[0].length;
      continue;
    }

    // Bold: **...** or __...__
    const boldM = rest.match(/^(\*\*|__)(.+?)\1/);
    if (boldM) {
      push(
        <strong className="font-semibold text-gray-50">
          {renderInline(boldM[2]!, `${baseKey}-b${n}`)}
        </strong>
      );
      i += boldM[0].length;
      continue;
    }

    // Italic: *...* or _..._
    const italicM = rest.match(/^(\*|_)([^*_\n]+?)\1/);
    if (italicM) {
      push(
        <em className="italic text-gray-200">{renderInline(italicM[2]!, `${baseKey}-i${n}`)}</em>
      );
      i += italicM[0].length;
      continue;
    }

    // Strikethrough
    const strikeM = rest.match(/^~~(.+?)~~/);
    if (strikeM) {
      push(
        <span className="line-through text-gray-500">
          {renderInline(strikeM[1]!, `${baseKey}-s${n}`)}
        </span>
      );
      i += strikeM[0].length;
      continue;
    }

    // Markdown link
    const linkM = rest.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
    if (linkM) {
      push(
        <a
          href={linkM[2]!}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300 hover:text-violet-200 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-300/70"
        >
          {renderInline(linkM[1]!, `${baseKey}-l${n}`)}
        </a>
      );
      i += linkM[0].length;
      continue;
    }

    // Auto-link
    const urlM = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/);
    if (urlM) {
      push(
        <a
          href={urlM[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300 hover:text-violet-200 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-300/70 break-all"
        >
          {urlM[0]}
        </a>
      );
      i += urlM[0].length;
      continue;
    }

    buf += text[i]!;
    i++;
  }
  flush();
  return out;
}

/**
 * Render a single list item, handling [ ] / [x] task list prefixes.
 *
 * @param item - List item text, possibly starting with `[ ]` or `[x]`.
 * @param key - React key.
 * @returns The rendered item, with a checkbox for task items.
 */
function renderListItem(item: string, key: string): React.ReactNode {
  const taskMatch = item.match(/^\[([ xX])\]\s+(.*)$/s);
  if (taskMatch) {
    const checked = taskMatch[1]!.toLowerCase() === "x";
    return (
      <span className="inline-flex items-baseline gap-2">
        <span
          className={`inline-block w-3 h-3 rounded-sm border flex-shrink-0 translate-y-0.5 ${
            checked ? "bg-emerald-500/40 border-emerald-400/60" : "bg-surface-4 border-surface-3"
          }`}
          aria-hidden="true"
        />
        <span className={checked ? "text-gray-500 line-through" : ""}>
          {renderInline(taskMatch[2]!, key)}
        </span>
      </span>
    );
  }
  return renderInline(item, key);
}

/** Props for {@link MarkdownContent}. */
interface MarkdownContentProps {
  /** Markdown source to render. */
  text: string;
  /** Tighter spacing for nested contexts (list items, quotes). */
  dense?: boolean;
}

/** Classes for heading levels 1 to 6. */
const HEADING_STYLES = [
  "text-[18px] font-semibold text-gray-50 mt-2 pb-1 border-b border-surface-3",
  "text-[16px] font-semibold text-gray-50 mt-2",
  "text-[15px] font-semibold text-gray-100",
  "text-sm font-semibold text-gray-100",
  "text-sm font-medium text-gray-200",
  "text-xs font-medium text-gray-300 uppercase tracking-wider",
];

/**
 * Lightweight markdown renderer used for agent messages in the conversation views and the Run page.
 * Supports fenced code with syntax highlighting, headings, lists, quotes, rules, tables, and inline
 * formatting, without pulling in a full markdown library and without rendering raw HTML.
 */
export function MarkdownContent({ text, dense = false }: MarkdownContentProps) {
  const blocks = parseBlocks(text);
  const gap = dense ? "space-y-1.5" : "space-y-2.5";

  return (
    <div className={`text-sm text-gray-300 leading-relaxed ${gap}`}>
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "code":
            return <CodeBlock key={idx} code={b.code} lang={b.lang} />;

          case "heading": {
            const cls = HEADING_STYLES[b.level - 1] ?? HEADING_STYLES[5];
            return (
              <div key={idx} className={cls}>
                {renderInline(b.text, `h${idx}`)}
              </div>
            );
          }

          case "list":
            if (b.ordered) {
              return (
                <ol
                  key={idx}
                  className="list-decimal pl-5 space-y-1 marker:text-gray-500 marker:font-mono marker:text-xs"
                >
                  {b.items.map((item, i) => (
                    <li key={i} className="text-sm text-gray-300">
                      {renderListItem(item, `li${idx}-${i}`)}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1 marker:text-violet-400/60">
                {b.items.map((item, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    {renderListItem(item, `li${idx}-${i}`)}
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <blockquote
                key={idx}
                className="relative border-l-2 border-violet-400/50 pl-3 pr-2 py-1 text-gray-400 italic bg-violet-500/[0.04] rounded-r"
              >
                {renderInline(b.text, `q${idx}`)}
              </blockquote>
            );

          case "hr":
            return (
              <hr
                key={idx}
                className="border-0 h-px bg-gradient-to-r from-transparent via-surface-3 to-transparent my-2"
              />
            );

          case "table": {
            /** Text alignment class for a table column. */
            const alignClass = (a: "left" | "center" | "right" | null) =>
              a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
            return (
              <div
                key={idx}
                className="overflow-x-auto rounded-md border border-surface-3 bg-surface-4/40"
              >
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-surface-3/60">
                    <tr>
                      {b.header.map((cell, i) => (
                        <th
                          key={i}
                          className={`px-3 py-1.5 font-semibold text-gray-200 border-b border-surface-3 ${alignClass(b.aligns[i] ?? null)}`}
                        >
                          {renderInline(cell, `th${idx}-${i}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-surface-3/50 last:border-b-0 hover:bg-surface-3/30"
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`px-3 py-1.5 text-gray-300 align-top ${alignClass(b.aligns[ci] ?? null)}`}
                          >
                            {renderInline(cell, `td${idx}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case "para":
            return (
              <p key={idx} className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                {renderInline(b.text, `p${idx}`)}
              </p>
            );
        }
      })}
    </div>
  );
}
