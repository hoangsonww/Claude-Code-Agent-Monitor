/**
 * @file constants.ts
 * @description Shared compile-time constants for the Electron desktop shell.
 * Values here must stay aligned with `electron-builder.yml` (app ID), the
 * documented default dashboard port, and the embedded server health probe in
 * `server-host.ts`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
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
