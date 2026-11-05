/**
 * @file Open-at-login integration (macOS Login Items + Windows startup).
 *
 * Both platforms go through Electron's first-party `app.*LoginItemSettings`
 * API — no third-party deps, no hand-rolled plist or registry edits:
 *   - macOS: wraps the modern `SMAppService` / `ServiceManagement` framework
 *     (macOS 13+), so the toggle appears in System Settings → General →
 *     Login Items where users expect to manage it.
 *   - Windows: writes an entry under the per-user
 *     `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` registry key (the
 *     standard startup location), which shows up in Task Manager → Startup.
 *
 * Linux has no Electron-supported equivalent, so the toggle is a no-op there.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** desktop/src/login-item.ts
 * **Area:** desktop shell
 * **Responsibility:**
 * Open-at-login integration (macOS Login Items + Windows startup). Both platforms go through
 * Electron's first-party `app.*LoginItemSettings` API — no third-party deps, no hand-rolled plist
 * or registry edits: - macOS: wraps the modern `SMAppService` / `ServiceManagement` framework
 * (macOS 13+), so the toggle appears in System Settings → General → Login Items where users expect
 * to manage it. - Windows: writes an entry under the per-user
 * `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` registry key (the standard startup
 * location), which shows up in Task Manager → Startup. Linux has no Electron-supported equivalent,
 * so the toggle is a no-op there.
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
 *
 * ## Public surface
 * - `isOpenAtLogin` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `launchedAtLogin` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `setOpenAtLogin` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `toggleOpenAtLogin` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `isOpenAtLogin` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `launchedAtLogin` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `setOpenAtLogin` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `supported` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `toggleOpenAtLogin` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `WIN_LAUNCH_FLAG` (variable) — top-level declaration that helps orient code review and focused
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
 *   `node scripts/maintain-typescript-docs.ts --check desktop/src/login-item.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/desktop/src/login-item.ts`
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
 * - `isOpenAtLogin` — exported API; see TSDoc on the symbol for behavior.
 * - `setOpenAtLogin` — exported API; see TSDoc on the symbol for behavior.
 * - `toggleOpenAtLogin` — exported API; see TSDoc on the symbol for behavior.
 * - `launchedAtLogin` — exported API; see TSDoc on the symbol for behavior.
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
 * **isOpenAtLogin**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **setOpenAtLogin**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **toggleOpenAtLogin**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **launchedAtLogin**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { app } from "electron";

/**
 * CLI flag we register the Windows startup entry with, then look for in
 * `process.argv` to recognise a login-triggered launch (Windows has no
 * `wasOpenedAtLogin`). Harmless if it ever reaches another code path.
 */
const WIN_LAUNCH_FLAG = "--ccam-hidden";

/** True on macOS and Windows — the only platforms Electron can register an
 * auto-start entry for. Every exported function below is a no-op on Linux. */
function supported(): boolean {
  return process.platform === "darwin" || process.platform === "win32";
}

/**
 * Read the current auto-start state directly from the OS (macOS Login Items
 * or the Windows `Run` key), not from any value cached by this module — so it
 * stays correct even if the user disables the entry from outside the app
 * (e.g. macOS System Settings, or Windows Task Manager → Startup).
 */
export function isOpenAtLogin(): boolean {
  if (!supported()) return false;
  return app.getLoginItemSettings().openAtLogin;
}

/**
 * Enable or disable launching the app at login. Delegates entirely to
 * `app.setLoginItemSettings`, which picks the platform mechanism:
 *   - **Windows** — writes/removes the per-user
 *     `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry, tagged with
 *     `WIN_LAUNCH_FLAG` so a subsequent launch can be recognised as
 *     login-triggered (see `launchedAtLogin`).
 *   - **macOS** — registers via the modern `SMAppService` API and starts the
 *     app hidden (see the `openAsHidden` comment below).
 * No-op on Linux, where Electron has no supported mechanism.
 *
 * @param enabled - Whether the app should open at login.
 */
export function setOpenAtLogin(enabled: boolean): void {
  if (!supported()) return;
  if (process.platform === "win32") {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      // Tag the registry Run entry so launchedAtLogin() can tell a login-time
      // start apart from the user double-clicking the app.
      args: [WIN_LAUNCH_FLAG],
    });
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    // Start hidden — the user just logged in, they didn't ask for a window
    // to appear. The tray icon makes the app's presence obvious. (macOS only;
    // `openAsHidden` is ignored on other platforms.)
    openAsHidden: true,
  });
}

/**
 * Flip the auto-start setting and return the new state. Used by both the
 * tray "Open at Login" checkbox and the application menu item — each reads
 * `isOpenAtLogin()` to render its own checked state, then calls this on click.
 */
export function toggleOpenAtLogin(): boolean {
  const next = !isOpenAtLogin();
  setOpenAtLogin(next);
  return next;
}

/**
 * Returns true if the current process was launched at login (as opposed to the
 * user double-clicking the app). When true, we keep the window hidden and only
 * show the tray icon.
 *
 * macOS reports this directly via `wasOpenedAtLogin`. Windows has no such flag,
 * so we detect the marker argument we registered the startup entry with.
 */
export function launchedAtLogin(): boolean {
  if (process.platform === "darwin") {
    return app.getLoginItemSettings().wasOpenedAtLogin;
  }
  if (process.platform === "win32") {
    return process.argv.includes(WIN_LAUNCH_FLAG);
  }
  return false;
}
