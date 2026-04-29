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
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import React from "react";
import { CodeBlock } from "./CodeBlock";

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

const FENCE_RE = /^([ \t]*)(```|~~~)(\s*[\w+-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)\.\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_DIVIDER_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

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

/** Render inline markdown (bold/italic/code/strikethrough/links/auto-links). */
function renderInline(text: string, baseKey = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let buf = "";
  let n = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
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

/** Render a single list item, handling [ ] / [x] task list prefixes. */
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

interface MarkdownContentProps {
  text: string;
  /** Tighter spacing for nested contexts (list items, quotes). */
  dense?: boolean;
}

const HEADING_STYLES = [
  "text-[18px] font-semibold text-gray-50 mt-2 pb-1 border-b border-surface-3",
  "text-[16px] font-semibold text-gray-50 mt-2",
  "text-[15px] font-semibold text-gray-100",
  "text-sm font-semibold text-gray-100",
  "text-sm font-medium text-gray-200",
  "text-xs font-medium text-gray-300 uppercase tracking-wider",
];

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
