/**
 * @file constants.ts
 * @description Shared compile-time constants for the Electron desktop shell.
 * Values here must stay aligned with `electron-builder.yml` (app ID), the
 * documented default dashboard port, and the embedded server health probe in
 * `server-host.ts`.
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
 * **Module:** desktop/src/constants.ts
 * **Area:** desktop shell
 * **Responsibility:**
 * Shared compile-time constants for the Electron desktop shell. Values here must stay aligned with
 * `electron-builder.yml` (app ID), the documented default dashboard port, and the embedded server
 * health probe in `server-host.ts` .
 *
 * ## Architectural boundary
 * - Owns Electron main-process lifecycle, local server hosting, native integration, and the narrow
 *   preload boundary.
 * - Renderer code remains web-compatible; privileged filesystem, process, tray, menu, and window
 *   operations stay here.
 * - Startup and shutdown coordinate one dashboard server instance without corrupting discovery or
 *   user data.
 *
 * ## Public surface
 * - `APP_ID` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `APP_NAME` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `DEFAULT_WINDOW` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `FALLBACK_PORT_RANGE` (variable) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `HEALTH_TIMEOUT_MS` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `PREFERRED_PORT` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `APP_ID` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `APP_NAME` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DEFAULT_WINDOW` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `FALLBACK_PORT_RANGE` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `HEALTH_TIMEOUT_MS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `PREFERRED_PORT` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
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
 *   `node scripts/maintain-typescript-docs.ts --check desktop/src/constants.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/desktop/src/constants.ts`
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
 * - `APP_NAME` — exported API; see TSDoc on the symbol for behavior.
 * - `APP_ID` — exported API; see TSDoc on the symbol for behavior.
 * - `PREFERRED_PORT` — exported API; see TSDoc on the symbol for behavior.
 * - `FALLBACK_PORT_RANGE` — exported API; see TSDoc on the symbol for behavior.
 * - `HEALTH_TIMEOUT_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `DEFAULT_WINDOW` — exported API; see TSDoc on the symbol for behavior.
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
 * **APP_NAME**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **APP_ID**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **PREFERRED_PORT**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **FALLBACK_PORT_RANGE**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **HEALTH_TIMEOUT_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DEFAULT_WINDOW**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Human-readable product name shown in window title and About menu. */
export const APP_NAME = "Claude Code Monitor";

/**
 * Application identifier. Must match `appId` in electron-builder.yml: on Windows
 * we hand it to `app.setAppUserModelId()` so toast notifications attribute to
 * the installed Start-Menu shortcut (NSIS writes the same AUMID there) instead
 * of appearing as a generic "electron.app" toast — and so taskbar windows group
 * under one icon. Ignored on macOS/Linux.
 */
export const APP_ID = "com.hoangsonww.ccam.desktop";

/**
 * Preferred dashboard port — matches the project's documented default. Also
 * the only port `server-host.ts`'s `startEmbeddedServer` will *adopt* an
 * already-healthy server on; a server found on any other port is never
 * treated as "ours" to reuse.
 */
export const PREFERRED_PORT = 4820;

/**
 * Last-resort port scan range when `PREFERRED_PORT` and its nine immediate
 * fallbacks (4821–4829) are all taken. Set to the IANA-registered
 * dynamic/private port range (49152–65535, truncated here to 49500 — far more
 * headroom than `pickFreePort()` should ever need) so we never guess at a
 * port some other, unrelated service might be registered on.
 */
export const FALLBACK_PORT_RANGE = { min: 49152, max: 49500 } as const;

/**
 * How long `server-host.ts`'s `waitForHealthy()` polls a freshly bound port
 * for `/api/health` before giving up and surfacing an error dialog to the
 * user. 30s comfortably covers a cold start on a slow disk (SQLite file
 * creation, migrations) without leaving the user staring at a spinner
 * indefinitely if something is actually broken.
 */
export const HEALTH_TIMEOUT_MS = 30_000;

/** Default window size, used only when no `window-state.json` exists yet
 * (first launch). Persisted to `app.getPath('userData')` after that — see
 * `window.ts`'s `loadState`/`saveState`. */
export const DEFAULT_WINDOW = { width: 1280, height: 800 } as const;
