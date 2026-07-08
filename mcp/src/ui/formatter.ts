/**
 * @file formatter.ts
 * @description A collection of utility functions for formatting console output in the MCP application. This includes functions for creating boxed sections, tables, status badges, formatted tool results, and key-value lists. The formatting is designed to be visually appealing and informative when printed to the terminal, using colors and styles to enhance readability. These utilities are used across various tools and components in the MCP application to maintain a consistent look and feel in the console output.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import * as c from "./colors.js";

// ── Box drawing ───────────────────────────────────────────────
const BOX_TL = "╭";
const BOX_TR = "╮";
const BOX_BL = "╰";
const BOX_BR = "╯";
const BOX_H = "─";
const BOX_V = "│";
/** Unused "tee" joints; not referenced by {@link box}. */
const BOX_ML = "├";
const BOX_MR = "┤";

/** Right-pads `text` to `width` visible columns via {@link stripAnsi}. */
function pad(text: string, width: number): string {
  const visLen = c.stripAnsi(text).length;
  return text + " ".repeat(Math.max(0, width - visLen));
}

/** Renders `content` in a rounded-corner box with `title` in the top
 * border. Not currently called; kept as a general-purpose primitive. */
export function box(title: string, content: string, width = 60): string {
  const inner = width - 4;
  const titleLine = ` ${title} `;
  const topPad = inner - c.stripAnsi(titleLine).length;
  const lines: string[] = [];

  lines.push(
    c.dim(c.cyan(BOX_TL + BOX_H)) +
      c.bold(c.brightCyan(titleLine)) +
      c.dim(c.cyan(BOX_H.repeat(Math.max(0, topPad)) + BOX_TR))
  );

  for (const row of content.split("\n")) {
    lines.push(c.dim(c.cyan(BOX_V)) + " " + pad(row, inner) + " " + c.dim(c.cyan(BOX_V)));
  }

  lines.push(c.dim(c.cyan(BOX_BL + BOX_H.repeat(width - 2) + BOX_BR)));
  return lines.join("\n");
}

/** Plain horizontal rule; `repl.ts` imports this without calling it. */
export function divider(width = 60): string {
  return c.dim(c.cyan(BOX_H.repeat(width)));
}

// ── Table ─────────────────────────────────────────────────────

/** One column definition for {@link table}. */
export interface Column {
  key: string;
  label: string;
  /** Auto-sized from header/cell content when omitted. */
  width?: number;
  align?: "left" | "right" | "center";
  /** Styling applied to each cell's raw value before alignment. */
  color?: (t: string) => string;
}

/** Pads/aligns `text` to `width` visible columns per `align`. */
function alignText(
  text: string,
  width: number,
  align: "left" | "right" | "center" = "left"
): string {
  const len = c.stripAnsi(text).length;
  const diff = Math.max(0, width - len);
  if (align === "right") return " ".repeat(diff) + text;
  if (align === "center") {
    const left = Math.floor(diff / 2);
    return " ".repeat(left) + text + " ".repeat(diff - left);
  }
  return text + " ".repeat(diff);
}

/** Renders `rows` as an ASCII table; used by `repl.ts`'s `printToolList`. */
export function table(columns: Column[], rows: Record<string, unknown>[]): string {
  const colWidths = columns.map((col) => {
    if (col.width) return col.width;
    const headerLen = col.label.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });

  const lines: string[] = [];

  // Header
  const headerParts = columns.map((col, i) =>
    c.bold(c.brightWhite(alignText(col.label, colWidths[i], col.align)))
  );
  lines.push("  " + headerParts.join(c.dim(c.cyan(" │ "))));

  // Separator
  const sep = colWidths.map((w) => BOX_H.repeat(w));
  lines.push("  " + c.dim(c.cyan(sep.join("─┼─"))));

  // Rows
  for (const row of rows) {
    const parts = columns.map((col, i) => {
      const raw = String(row[col.key] ?? "");
      const styled = col.color ? col.color(raw) : raw;
      return alignText(styled, colWidths[i], col.align);
    });
    lines.push("  " + parts.join(c.dim(c.cyan(" │ "))));
  }

  return lines.join("\n");
}

// ── Status badges ─────────────────────────────────────────────

/** Color mapping for {@link badge}. */
const STATUS_COLORS: Record<string, (t: string) => string> = {
  active: c.success,
  completed: c.info,
  error: c.error,
  abandoned: c.warn,
  idle: c.muted,
  connected: c.info,
  working: (t) => c.bold(c.brightYellow(t)),
  ok: c.success,
  healthy: c.success,
  unhealthy: c.error,
  enabled: c.warn,
  disabled: c.success,
};

/** Renders `[STATUS]` colored via {@link STATUS_COLORS} (falls back to
 * muted). Used by `repl.ts`'s `printConfig`. */
export function badge(status: string): string {
  const colorFn = STATUS_COLORS[status.toLowerCase()] ?? c.muted;
  return colorFn(`[${status.toUpperCase()}]`);
}

// ── Tool result formatting ────────────────────────────────────

/** Renders a successful REPL tool invocation: a header plus the result,
 * JSON-highlighted via {@link syntaxHighlight}; results over 30 lines are
 * truncated to 25 (display-only, doesn't affect the actual return value). */
export function formatToolResult(name: string, data: unknown, durationMs: number): string {
  const lines: string[] = [];
  const header = `${c.success("✔")} ${c.bold(c.brightWhite(name))} ${c.muted(`(${durationMs}ms)`)}`;
  lines.push(header);

  if (data === null || data === undefined) {
    lines.push(c.muted("  (no data)"));
    return lines.join("\n");
  }

  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const jsonLines = json.split("\n");

  if (jsonLines.length <= 30) {
    lines.push(syntaxHighlight(json));
  } else {
    lines.push(syntaxHighlight(jsonLines.slice(0, 25).join("\n")));
    lines.push(c.muted(`  ... +${jsonLines.length - 25} more lines`));
  }

  return lines.join("\n");
}

/** Renders a failed REPL tool invocation; given only a plain message
 * string, unlike {@link errorResult}'s structured `ApiError` handling. */
export function formatToolError(name: string, error: string, durationMs: number): string {
  return (
    `${c.error("✘")} ${c.bold(c.brightWhite(name))} ${c.muted(`(${durationMs}ms)`)}\n` +
    `  ${c.red(error)}`
  );
}

// ── JSON syntax highlighting ──────────────────────────────────

/** Regex-based JSON token coloring; a display heuristic, not a real
 * tokenizer — safe since input is always `JSON.stringify` output. */
function syntaxHighlight(json: string): string {
  return json.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (
      _match,
      str: string | undefined,
      colon: string | undefined,
      bool: string | undefined,
      num: string | undefined
    ) => {
      if (str) {
        if (colon) return c.cyan(str) + c.dim(":");
        return c.green(str);
      }
      if (bool) return c.brightMagenta(bool);
      if (num) return c.brightYellow(num);
      return _match;
    }
  );
}

// ── Key-value list ────────────────────────────────────────────

/** Renders an aligned label/value list. Not currently called — `repl.ts`'s
 * `printConfig` builds an equivalent layout inline. */
export function keyValue(pairs: [string, string][], labelWidth = 20): string {
  return pairs.map(([k, v]) => `  ${c.label(k.padEnd(labelWidth))} ${v}`).join("\n");
}

// ── Section header ────────────────────────────────────────────

/** Renders a `◆ Title` heading used throughout `repl.ts`. */
export function sectionHeader(title: string): string {
  return `\n  ${c.bold(c.brightCyan("◆"))} ${c.bold(c.brightWhite(title))}\n`;
}

// ── Spinner frames (for async operations) ─────────────────────

/** Braille spinner animation frames; no current caller drives one. */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Renders a block progress bar with a percentage label, clamped to
 * `[0, 1]`. No current caller reports incremental progress. */
export function progressBar(current: number, total: number, width = 30): string {
  const pct = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = c.brightCyan("█".repeat(filled)) + c.dim("░".repeat(empty));
  const label = c.muted(`${Math.round(pct * 100)}%`);
  return `  ${bar} ${label}`;
}
