/**
 * @file formatter.ts
 * @description A collection of utility functions for formatting console output in the MCP application. This includes functions for creating boxed sections, tables, status badges, formatted tool results, and key-value lists. The formatting is designed to be visually appealing and informative when printed to the terminal, using colors and styles to enhance readability. These utilities are used across various tools and components in the MCP application to maintain a consistent look and feel in the console output.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/ui/formatter.ts
 * **Area:** MCP server
 * **Responsibility:**
 * A collection of utility functions for formatting console output in the MCP application. This
 * includes functions for creating boxed sections, tables, status badges, formatted tool results,
 * and key-value lists. The formatting is designed to be visually appealing and informative when
 * printed to the terminal, using colors and styles to enhance readability. These utilities are used
 * across various tools and components in the MCP application to maintain a consistent look and feel
 * in the console output.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Local dependency edges
 * - `./colors.js` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Public surface
 * - `badge` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `box` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `Column` (interface) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `divider` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `formatToolError` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `formatToolResult` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `keyValue` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `progressBar` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `sectionHeader` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SPINNER_FRAMES` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `table` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `alignText` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `badge` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `box` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_BL` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_BR` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_H` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_ML` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_MR` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_TL` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_TR` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BOX_V` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Column` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `divider` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `formatToolError` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `formatToolResult` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `keyValue` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `pad` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `progressBar` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `sectionHeader` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SPINNER_FRAMES` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `STATUS_COLORS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `syntaxHighlight` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `table` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
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
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/ui/formatter.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/ui/formatter.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * ## Public surface
 * - `box` — exported API; see TSDoc on the symbol for behavior.
 * - `divider` — exported API; see TSDoc on the symbol for behavior.
 * - `Column` — exported API; see TSDoc on the symbol for behavior.
 * - `table` — exported API; see TSDoc on the symbol for behavior.
 * - `badge` — exported API; see TSDoc on the symbol for behavior.
 * - `formatToolResult` — exported API; see TSDoc on the symbol for behavior.
 * - `formatToolError` — exported API; see TSDoc on the symbol for behavior.
 * - `keyValue` — exported API; see TSDoc on the symbol for behavior.
 * - `sectionHeader` — exported API; see TSDoc on the symbol for behavior.
 * - `SPINNER_FRAMES` — exported API; see TSDoc on the symbol for behavior.
 * - `progressBar` — exported API; see TSDoc on the symbol for behavior.
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
 * **box**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **divider**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Column**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **table**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **badge**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **formatToolResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **formatToolError**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **keyValue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **sectionHeader**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SPINNER_FRAMES**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **progressBar**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import * as c from "./colors.js";

/**
 * Box-drawing characters for the REPL's framed panels, using rounded corners. This is the top-left
 * corner.
 */
const BOX_TL = "╭";
/** Top-right rounded corner. */
const BOX_TR = "╮";
/** Bottom-left rounded corner. */
const BOX_BL = "╰";
/** Bottom-right rounded corner. */
const BOX_BR = "╯";
/** Horizontal edge. */
const BOX_H = "─";
/** Vertical edge. */
const BOX_V = "│";
/** Unused "tee" joints; not referenced by {@link box}. */
const BOX_ML = "├";
/** Right-hand T-junction, closing a divider line inside a box. */
const BOX_MR = "┤";

/**
 * Right-pads `text` to `width` visible columns via {@link stripAnsi}.
 *
 * @param text - Possibly colored text.
 * @param width - Target visible width.
 * @returns The padded text; text already wider is returned unchanged.
 */
function pad(text: string, width: number): string {
  const visLen = c.stripAnsi(text).length;
  return text + " ".repeat(Math.max(0, width - visLen));
}

/** Renders `content` in a rounded-corner box with `title` in the top
 * border. Not currently called; kept as a general-purpose primitive.
 *
 * @param title - Text set into the top border.
 * @param content - Box body; may contain newlines.
 * @param width - Total box width in columns; defaults to 60.
 * @returns The rendered box.
 */
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

/**
 * Plain horizontal rule; `repl.ts` imports this without calling it.
 *
 * @param width - Rule width in columns; defaults to 60.
 * @returns The styled rule.
 */
export function divider(width = 60): string {
  return c.dim(c.cyan(BOX_H.repeat(width)));
}

// ── Table ─────────────────────────────────────────────────────

/** One column definition for {@link table}. */
export interface Column {
  /** Property of each row object to read the cell value from. */
  key: string;
  /** Column header text. */
  label: string;
  /** Auto-sized from header/cell content when omitted. */
  width?: number;
  /** Cell alignment; defaults to left. Right alignment suits numbers. */
  align?: "left" | "right" | "center";
  /** Styling applied to each cell's raw value before alignment. */
  color?: (t: string) => string;
}

/**
 * Pads/aligns `text` to `width` visible columns per `align`.
 *
 * @param text - Possibly colored text.
 * @param width - Target visible width.
 * @param align - Alignment; defaults to left.
 * @returns The aligned text.
 */
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

/**
 * Renders `rows` as an ASCII table; used by `repl.ts`'s `printToolList`.
 *
 * @param columns - Column definitions, in order.
 * @param rows - Row objects keyed by column `key`.
 * @returns The rendered table, with widths sized to the content unless a column sets its own.
 */
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
 * muted). Used by `repl.ts`'s `printConfig`.
 *
 * @param status - Status word, matched case-insensitively.
 * @returns The colored badge.
 */
export function badge(status: string): string {
  const colorFn = STATUS_COLORS[status.toLowerCase()] ?? c.muted;
  return colorFn(`[${status.toUpperCase()}]`);
}

// ── Tool result formatting ────────────────────────────────────

/** Renders a successful REPL tool invocation: a header plus the result,
 * JSON-highlighted via {@link syntaxHighlight}; results over 30 lines are
 * truncated to 25 (display-only, doesn't affect the actual return value).
 *
 * @param name - Tool name.
 * @param data - Tool result to show.
 * @param durationMs - How long the call took.
 * @returns The formatted output.
 */
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
 * string, unlike {@link errorResult}'s structured `ApiError` handling.
 *
 * @param name - Tool name.
 * @param error - Error message.
 * @param durationMs - How long the call took.
 * @returns The formatted output.
 */
export function formatToolError(name: string, error: string, durationMs: number): string {
  return (
    `${c.error("✘")} ${c.bold(c.brightWhite(name))} ${c.muted(`(${durationMs}ms)`)}\n` +
    `  ${c.red(error)}`
  );
}

// ── JSON syntax highlighting ──────────────────────────────────

/** Regex-based JSON token coloring; a display heuristic, not a real
 * tokenizer — safe since input is always `JSON.stringify` output.
 *
 * @param json - Output of `JSON.stringify`.
 * @returns The text with keys, strings, literals, and numbers colored.
 */
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
 * `printConfig` builds an equivalent layout inline.
 *
 * @param pairs - Label and value pairs, in order.
 * @param labelWidth - Column width for labels; defaults to 20.
 * @returns The rendered list.
 */
export function keyValue(pairs: [string, string][], labelWidth = 20): string {
  return pairs.map(([k, v]) => `  ${c.label(k.padEnd(labelWidth))} ${v}`).join("\n");
}

// ── Section header ────────────────────────────────────────────

/**
 * Renders a `◆ Title` heading used throughout `repl.ts`.
 *
 * @param title - Heading text.
 * @returns The heading with surrounding blank lines.
 */
export function sectionHeader(title: string): string {
  return `\n  ${c.bold(c.brightCyan("◆"))} ${c.bold(c.brightWhite(title))}\n`;
}

// ── Spinner frames (for async operations) ─────────────────────

/** Braille spinner animation frames; no current caller drives one. */
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Renders a block progress bar with a percentage label, clamped to
 * `[0, 1]`. No current caller reports incremental progress.
 *
 * @param current - Completed amount.
 * @param total - Total amount.
 * @param width - Bar width in columns; defaults to 30.
 * @returns The bar followed by the percentage.
 */
export function progressBar(current: number, total: number, width = 30): string {
  const pct = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = c.brightCyan("█".repeat(filled)) + c.dim("░".repeat(empty));
  const label = c.muted(`${Math.round(pct * 100)}%`);
  return `  ${bar} ${label}`;
}
