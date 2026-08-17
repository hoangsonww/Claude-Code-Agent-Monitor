/**
 * @file colors.ts
 * @description Provides utility functions for applying ANSI color codes to text in the terminal. This module defines a set of functions for styling text with various colors and modifiers such as bold, italic, underline, and strikethrough. It also includes support for 256-color mode and a function to strip ANSI codes from text. The color functions are designed to be composable, allowing for easy combination of styles. The module checks for color support in the terminal environment and gracefully degrades if colors are not supported.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/ui/colors.ts`
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
 * - `bold` — exported API; see TSDoc on the symbol for behavior.
 * - `dim` — exported API; see TSDoc on the symbol for behavior.
 * - `italic` — exported API; see TSDoc on the symbol for behavior.
 * - `underline` — exported API; see TSDoc on the symbol for behavior.
 * - `strikethrough` — exported API; see TSDoc on the symbol for behavior.
 * - `black` — exported API; see TSDoc on the symbol for behavior.
 * - `red` — exported API; see TSDoc on the symbol for behavior.
 * - `green` — exported API; see TSDoc on the symbol for behavior.
 * - `yellow` — exported API; see TSDoc on the symbol for behavior.
 * - `blue` — exported API; see TSDoc on the symbol for behavior.
 * - `magenta` — exported API; see TSDoc on the symbol for behavior.
 * - `cyan` — exported API; see TSDoc on the symbol for behavior.
 * - `white` — exported API; see TSDoc on the symbol for behavior.
 * - `gray` — exported API; see TSDoc on the symbol for behavior.
 * - `brightRed` — exported API; see TSDoc on the symbol for behavior.
 * - `brightGreen` — exported API; see TSDoc on the symbol for behavior.
 * - `brightYellow` — exported API; see TSDoc on the symbol for behavior.
 * - `brightBlue` — exported API; see TSDoc on the symbol for behavior.
 * - `brightMagenta` — exported API; see TSDoc on the symbol for behavior.
 * - `brightCyan` — exported API; see TSDoc on the symbol for behavior.
 * - `brightWhite` — exported API; see TSDoc on the symbol for behavior.
 * - `bgRed` — exported API; see TSDoc on the symbol for behavior.
 * - `bgGreen` — exported API; see TSDoc on the symbol for behavior.
 * - `bgYellow` — exported API; see TSDoc on the symbol for behavior.
 * - `bgBlue` — exported API; see TSDoc on the symbol for behavior.
 * - `bgMagenta` — exported API; see TSDoc on the symbol for behavior.
 * - `bgCyan` — exported API; see TSDoc on the symbol for behavior.
 * - `bgWhite` — exported API; see TSDoc on the symbol for behavior.
 * - `bgGray` — exported API; see TSDoc on the symbol for behavior.
 * - `fg256` — exported API; see TSDoc on the symbol for behavior.
 * - `bg256` — exported API; see TSDoc on the symbol for behavior.
 * - `reset` — exported API; see TSDoc on the symbol for behavior.
 * - `stripAnsi` — exported API; see TSDoc on the symbol for behavior.
 * - `success` — exported API; see TSDoc on the symbol for behavior.
 * - `error` — exported API; see TSDoc on the symbol for behavior.
 * - `warn` — exported API; see TSDoc on the symbol for behavior.
 * - `info` — exported API; see TSDoc on the symbol for behavior.
 * - `muted` — exported API; see TSDoc on the symbol for behavior.
 * - `highlight` — exported API; see TSDoc on the symbol for behavior.
 * - `label` — exported API; see TSDoc on the symbol for behavior.
 * - … plus 1 additional exports
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
 * **bold**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **dim**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **italic**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **underline**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **strikethrough**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **black**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **red**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **green**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **yellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **blue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **magenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **cyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **white**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **gray**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightRed**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightGreen**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightYellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightBlue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightMagenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightCyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightWhite**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgRed**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgGreen**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgYellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgBlue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgMagenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgCyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgWhite**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgGray**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **fg256**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bg256**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **reset**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **stripAnsi**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **success**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **error**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **warn**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **info**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **muted**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **highlight**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **label**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **accent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Whether ANSI colors should be emitted: `NO_COLOR` always disables;
 * `FORCE_COLOR=0` disables, any other `FORCE_COLOR` enables regardless of
 * TTY; otherwise enabled only on an interactive stdout TTY. Computed once
 * at module load. */
const isColorSupported =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  (process.env.FORCE_COLOR !== undefined || (process.stdout.isTTY ?? false));

/** Builds a styling function wrapping text in ANSI open/close codes, or an
 * identity function when colors are unsupported — every color/modifier
 * below is built with this, so disabling color no-ops all of them at once. */
function wrap(open: string, close: string): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[${open}m${text}\x1b[${close}m`;
}

// Modifiers
export const bold = wrap("1", "22");
export const dim = wrap("2", "22");
export const italic = wrap("3", "23");
export const underline = wrap("4", "24");
export const strikethrough = wrap("9", "29");

// Foreground colors
export const black = wrap("30", "39");
export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const magenta = wrap("35", "39");
export const cyan = wrap("36", "39");
export const white = wrap("37", "39");
export const gray = wrap("90", "39");

// Bright foreground colors
export const brightRed = wrap("91", "39");
export const brightGreen = wrap("92", "39");
export const brightYellow = wrap("93", "39");
export const brightBlue = wrap("94", "39");
export const brightMagenta = wrap("95", "39");
export const brightCyan = wrap("96", "39");
export const brightWhite = wrap("97", "39");

// Background colors
export const bgRed = wrap("41", "49");
export const bgGreen = wrap("42", "49");
export const bgYellow = wrap("43", "49");
export const bgBlue = wrap("44", "49");
export const bgMagenta = wrap("45", "49");
export const bgCyan = wrap("46", "49");
export const bgWhite = wrap("47", "49");
export const bgGray = wrap("100", "49");

// 256-color support

/** Foreground-color function for an xterm 256-color index; not currently
 * used by any composable style below. */
export function fg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[38;5;${code}m${text}\x1b[39m`;
}

/** Background-color function for an xterm 256-color index. */
export function bg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[48;5;${code}m${text}\x1b[49m`;
}

// Utility
/** Raw ANSI "reset all styles" sequence, or `""` when colors are disabled. */
export const reset = isColorSupported ? "\x1b[0m" : "";

/** Strips ANSI SGR sequences from `text`. Used throughout `ui/formatter.ts`
 * to measure/pad colored strings by visible length, not byte length. */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// Composable styles
/** Semantic style aliases used throughout `ui/banner.ts`, `ui/formatter.ts`,
 * and `transports/repl.ts` so call sites express intent, not a specific color. */
export const success = (t: string) => bold(green(t));
export const error = (t: string) => bold(red(t));
export const warn = (t: string) => bold(yellow(t));
export const info = (t: string) => bold(cyan(t));
export const muted = (t: string) => dim(gray(t));
export const highlight = (t: string) => bold(brightMagenta(t));
export const label = (t: string) => bold(brightWhite(t));
export const accent = (t: string) => bold(brightCyan(t));
