/**
 * @file Lightweight file logger for the desktop shell.
 *
 * Electron's main process has no console attached when launched from Finder,
 * so all diagnostics go to a per-user log file under app.getPath('logs').
 * We deliberately avoid the `electron-log` dependency — the project keeps a
 * small dependency tree and this file does the only three things we need.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** desktop/src/logger.ts
 * **Area:** desktop shell
 * **Responsibility:**
 * Lightweight file logger for the desktop shell. Electron's main process has no console attached
 * when launched from Finder, so all diagnostics go to a per-user log file under
 * app.getPath('logs'). We deliberately avoid the `electron-log` dependency — the project keeps a
 * small dependency tree and this file does the only three things we need.
 *
 * ## Architectural boundary
 * - Owns Electron main-process lifecycle, local server hosting, native integration, and the narrow
 *   preload boundary.
 * - Renderer code remains web-compatible; privileged filesystem, process, tray, menu, and window
 *   operations stay here.
 * - Startup and shutdown coordinate one dashboard server instance without corrupting discovery or
 *   user data.
 *
 * ## Package dependency edges
 * - `electron` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:fs` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:path` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `log` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ensureStream` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `log` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `logPath` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `safeStringify` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `stream` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `write` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep context isolation enabled and expose only the minimum typed preload surface required by
 *   the renderer.
 * - Do not enable arbitrary Node integration or pass unchecked renderer input into
 *   filesystem/process operations.
 * - Make window, tray, server, and app shutdown idempotent across quit, close, signal, and update
 *   paths.
 * - Resolve packaged and development resource paths explicitly for macOS, Windows, and Linux
 *   layouts.
 * - Use atomic writes for discovery and state files that another process may read during startup.
 * - Remove stale discovery metadata only when it belongs to the process being stopped.
 * - Keep single-instance and deep-link handling bounded to the intended application origin.
 * - Preserve platform-specific menu and login-item semantics without assuming one operating system.
 * - Avoid blocking the main process with synchronous work on hot lifecycle paths.
 * - Test pure path/lifecycle decisions and run the desktop-specific suite for process integration
 *   changes.
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
 * - Run `npm run desktop:test` and resolve failures before widening the verification scope.
 * - Run `npm run desktop:build` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check desktop/src/logger.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/desktop/src/logger.ts`
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
 * - `log` — exported API; see TSDoc on the symbol for behavior.
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
 * **log**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

/** Append-mode stream to `desktop.log`, opened lazily on the first write. */
let stream: fs.WriteStream | null = null;
/** Path of the log file, set when the stream opens. */
let logPath = "";

/**
 * Lazily open the append-mode write stream to `desktop.log`, creating the
 * `app.getPath('logs')` directory if this is the first write of the process.
 * Cached in the module-level `stream` so every subsequent `write()` call
 * reuses the same file descriptor instead of re-opening the file.
 */
function ensureStream(): fs.WriteStream {
  if (stream) return stream;
  const dir = app.getPath("logs");
  fs.mkdirSync(dir, { recursive: true });
  logPath = path.join(dir, "desktop.log");
  stream = fs.createWriteStream(logPath, { flags: "a" });
  return stream;
}

/**
 * Format one log line (ISO timestamp + level + space-joined parts) and fan it
 * out to the log file and, conditionally, to the process streams:
 *   - `error` always echoes to `stderr`, so a crash is visible even without
 *     `CCAM_DESKTOP_VERBOSE` (e.g. when Electron is launched from a terminal).
 *   - `info`/`warn` only echo to `stdout` when `CCAM_DESKTOP_VERBOSE` is set,
 *     keeping a normal launch quiet.
 * The file write is wrapped in try/catch — a logging failure (e.g. a full
 * disk) must never take down the app.
 *
 * @param level - Severity.
 * @param parts - Values to log, stringified and joined with spaces.
 */
function write(level: "info" | "warn" | "error", parts: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${parts
    .map((p) => (typeof p === "string" ? p : safeStringify(p)))
    .join(" ")}\n`;
  try {
    ensureStream().write(line);
  } catch {
    // Logging must never crash the app.
  }
  if (level === "error") {
    process.stderr.write(line);
  } else if (process.env.CCAM_DESKTOP_VERBOSE) {
    process.stdout.write(line);
  }
}

/** `JSON.stringify` a non-string log argument, falling back to `String()` for
 * values it can't serialize (e.g. circular objects or `BigInt`).
 *
 * @param value - Any value.
 * @returns The value as JSON, or `String(value)` when it cannot be serialized.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The desktop shell's only logging surface. Electron's main process has no
 * attached console when launched from Finder/Dock, so every call here is
 * durably persisted to `desktop.log` (see `ensureStream`) in addition to the
 * conditional stdout/stderr echo described in `write`.
 */
export const log = {
  info: (...parts: unknown[]) => write("info", parts),
  warn: (...parts: unknown[]) => write("warn", parts),
  error: (...parts: unknown[]) => write("error", parts),
  /** Absolute path to the active log file (populated after first write). */
  path: () => logPath,
};
