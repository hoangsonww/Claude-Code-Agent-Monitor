/**
 * @file Electron main process entry point.
 *
 * Lifecycle:
 *   1. App ready → start (or adopt) the embedded Express server.
 *   2. Build the application menu + system tray.
 *   3. Open the dashboard window (skipped when launched at login).
 *   4. On `window-all-closed`: keep the app running (tray-only mode).
 *   5. On `before-quit`: gracefully stop the server if we own it.
 *
 * Single-instance is enforced on every platform via `requestSingleInstanceLock`
 * so double-launching (a second Dock click, or the Windows Start-Menu shortcut)
 * just focuses the existing window instead of spawning a second tray + server.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** desktop/src/main.ts
 * **Area:** desktop shell
 * **Responsibility:**
 * Electron main process entry point. Lifecycle: 1. App ready → start (or adopt) the embedded
 * Express server. 2. Build the application menu + system tray. 3. Open the dashboard window
 * (skipped when launched at login). 4. On `window-all-closed` : keep the app running (tray-only
 * mode). 5. On `before-quit` : gracefully stop the server if we own it. Single-instance is enforced
 * on every platform via `requestSingleInstanceLock` so double-launching (a second Dock click, or
 * the Windows Start-Menu shortcut) just focuses the existing window instead of spawning a second
 * tray + server.
 *
 * ## Architectural boundary
 * - Owns Electron main-process lifecycle, local server hosting, native integration, and the narrow
 *   preload boundary.
 * - Renderer code remains web-compatible; privileged filesystem, process, tray, menu, and window
 *   operations stay here.
 * - Startup and shutdown coordinate one dashboard server instance without corrupting discovery or
 *   user data.
 *
 * ## Local dependency edges
 * - `./constants` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./logger` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./login-item` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./menu` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./server-host` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./shell-path` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./tray` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./window` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `electron` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `AppState` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `boot` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ensureWindow` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `openInBrowser` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `openLogs` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `requestQuit` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `restartServer` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `showFatalDialog` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `state` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `wireLifecycle` (function) — top-level declaration that helps orient code review and focused
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
 *   `node scripts/maintain-typescript-docs.ts --check desktop/src/main.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/desktop/src/main.ts`
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
 * ## Internal dependencies
 * - `./constants`
 * - `./login-item`
 * - `./logger`
 * - `./menu`
 * - `./server-host`
 * - `./shell-path`
 * - `./tray`
 * - `./window`
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

import { BrowserWindow, Notification, app, dialog, shell } from "electron";

import { APP_ID, APP_NAME } from "./constants";
import { isOpenAtLogin, launchedAtLogin, toggleOpenAtLogin } from "./login-item";
import { log } from "./logger";
import { focusOrCreateWindow, installApplicationMenu } from "./menu";
import {
  closeEmbeddedDatabase,
  getServerSnapshot,
  refreshServerSnapshot,
  startEmbeddedServer,
  startSnapshotPolling,
  type ServerHandle,
} from "./server-host";
import { ensureUserPath } from "./shell-path";
import { createTray } from "./tray";
import { appIconPath, createDashboardWindow } from "./window";

/** Single mutable record of process-wide state, held in the module-level
 * `state` singleton below rather than passed around — this main-process
 * entry point has exactly one window, one tray, and one server, so a class
 * or a dependency-injected context would add indirection without benefit. */
interface AppState {
  /** `null` until `startEmbeddedServer()` resolves during `boot()`. */
  serverHandle: ServerHandle | null;
  /** `null` when hidden/not-yet-created; a live window still counts even
   * while hidden by a `close` — see the `win.on("close", ...)` handler. */
  win: BrowserWindow | null;
  /** Tray icon. A reference is kept here so Electron's garbage collector does not destroy it. */
  tray: Electron.Tray | null;
  /** Set once teardown has begun (inside `requestQuit`'s confirm callback or
   * the bypass path in `before-quit`); gates re-entrant quit handling. */
  quitting: boolean;
  /** True while the quit-confirmation dialog is open; a second ⌘Q in this
   * window bypasses the dialog and lets macOS quit immediately. */
  confirmingQuit: boolean;
}

/**
 * Mutable app-wide state for the desktop main process: the server, the window, the tray, and the
 * quit flags.
 */
const state: AppState = {
  serverHandle: null,
  win: null,
  tray: null,
  quitting: false,
  confirmingQuit: false,
};

/**
 * Show the "Quit Claude Code Monitor?" confirmation dialog. Clicking Quit
 * runs the synchronous teardown and exits. Pressing ⌘Q again while the
 * dialog is open is caught by `before-quit` below and skips this prompt.
 */
function requestQuit(): void {
  if (state.quitting || state.confirmingQuit) return;
  state.confirmingQuit = true;
  // On macOS a second ⌘Q while this dialog is open bypasses it (handled in
  // `before-quit`); mention that shortcut only where it applies.
  const quitAccel = process.platform === "darwin" ? "⌘Q" : "Ctrl+Q";
  const opts: Electron.MessageBoxOptions = {
    type: "question",
    buttons: ["Quit", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    title: APP_NAME,
    message: "Quit Claude Code Monitor?",
    detail:
      "The embedded server will stop and your dashboard window will close. " +
      `Press ${quitAccel} again to skip this prompt and quit immediately.`,
    noLink: true,
  };
  const parent = state.win && !state.win.isDestroyed() ? state.win : undefined;
  const promise = parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts);
  void promise
    .then((result) => {
      state.confirmingQuit = false;
      if (result.response === 0) {
        state.quitting = true;
        if (state.serverHandle?.ownedByUs) closeEmbeddedDatabase();
        app.exit(0);
      }
    })
    .catch(() => {
      state.confirmingQuit = false;
    });
}

/**
 * The single entry point every "open the dashboard" action goes through
 * (dock/tray click, menu item, `second-instance`, macOS `activate`). Delegates
 * to `focusOrCreateWindow` to reuse an existing window when possible, and
 * otherwise builds one with `createDashboardWindow` and wires its `close`
 * handler to hide-not-destroy (see the inline comment below).
 *
 * @throws If called before `startEmbeddedServer()` has resolved — there is no
 *   URL to point the window at yet. `boot()` guarantees this can't happen on
 *   the normal startup path.
 */
function ensureWindow(): BrowserWindow {
  if (!state.serverHandle) {
    throw new Error("Cannot create window before the server is up.");
  }
  return focusOrCreateWindow(state.win, () => {
    const win = createDashboardWindow(state.serverHandle!.url);
    state.win = win;
    win.on("close", (event) => {
      if (state.quitting) return;
      // On macOS, "close" means "hide" — the tray stays, the server stays.
      // We deliberately do NOT call `app.dock.hide()` here. With the red
      // close button leaving the app running, the user needs a visible
      // indication that it is still alive. The dock icon (clickable to
      // re-open the window) is exactly that signal; the menu-bar tray
      // icon backs it up. Login-launched startup is the only path that
      // hides the dock, since that user explicitly asked for unobtrusive
      // background behaviour.
      event.preventDefault();
      win.hide();
    });
    return win;
  });
}

/**
 * Handler for the "Restart Server" menu/tray action. Stops the current
 * server only if we own it (an adopted external server is left untouched —
 * we have no business killing a process we didn't start), starts a fresh
 * one via `startEmbeddedServer()` (which re-runs port adoption/selection
 * from scratch), reloads the dashboard window at the new URL if one is
 * open, and surfaces a native notification so the user has confirmation the
 * click did something.
 */
async function restartServer(): Promise<void> {
  log.info("restarting server");
  if (state.serverHandle?.ownedByUs) {
    await state.serverHandle.stop();
  }
  state.serverHandle = await startEmbeddedServer();
  if (state.win && !state.win.isDestroyed()) {
    state.win
      .loadURL(state.serverHandle.url)
      .catch((err) => log.error("reload after restart failed", err));
  }
  new Notification({ title: APP_NAME, body: "Server restarted." }).show();
}

/** Reveal `desktop.log` in the OS file browser (Finder/Explorer), or log a
 * no-op note if no line has been written yet (so `log.path()` is empty). */
function openLogs(): void {
  const p = log.path();
  if (p) {
    void shell.showItemInFolder(p);
  } else {
    log.info("(no log file yet)");
  }
}

/** Open the dashboard's URL in the user's default system browser. A no-op
 * before the server has started, since there is no URL yet. */
function openInBrowser(): void {
  if (state.serverHandle) void shell.openExternal(state.serverHandle.url);
}

/** Show a blocking native error dialog. Used only for conditions the user
 * must see immediately and cannot recover from without restarting the app
 * (e.g. the embedded server failing to boot at all).
 *
 * @param message - Headline of the error.
 * @param detail - Optional details shown under it.
 */
function showFatalDialog(message: string, detail?: string): void {
  dialog.showErrorBox(`${APP_NAME} — Error`, detail ? `${message}\n\n${detail}` : message);
}

/**
 * Runs once, after Electron fires `app.whenReady()`. Performs the full
 * startup sequence documented in the file header: recover the shell `PATH`,
 * boot (or adopt) the embedded server, install the application menu and
 * tray, start the tray's snapshot poller, then open the dashboard window —
 * unless this launch was triggered by the OS at login, in which case the app
 * stays tray-only. A server-boot failure here is fatal: it shows a blocking
 * error dialog and exits the process, since there is nothing useful the app
 * can do without its server.
 */
async function boot(): Promise<void> {
  // macOS only shows the bundle's .icns in the Dock; an unpackaged `desktop:dev`
  // run otherwise displays the generic Electron icon. Set it explicitly so the
  // dev Dock matches the packaged app (Windows/Linux get theirs via the
  // BrowserWindow `icon`). Wrapped in try/catch — purely cosmetic.
  if (process.platform === "darwin" && !app.isPackaged) {
    const icon = appIconPath();
    if (icon) {
      try {
        app.dock?.setIcon(icon);
      } catch (err) {
        log.warn("could not set dev dock icon", err);
      }
    }
  }

  // Recover the user's shell PATH before the server boots — a Finder/Dock or
  // login-launched app only inherits launchd's minimal PATH, which makes the
  // "Run Claude" feature unable to find the `claude` CLI.
  ensureUserPath();

  try {
    state.serverHandle = await startEmbeddedServer();
  } catch (err) {
    log.error("server failed to start", err);
    showFatalDialog(
      "The dashboard server failed to start.",
      err instanceof Error ? err.message : String(err)
    );
    app.exit(1);
    return;
  }

  installApplicationMenu({
    showDashboard: () => ensureWindow(),
    reloadDashboard: () => state.win?.webContents.reload(),
    restartServer: () => {
      void restartServer().catch((err) =>
        showFatalDialog("Could not restart the server.", String(err))
      );
    },
    openLogs,
    toggleOpenAtLogin: () => {
      const next = toggleOpenAtLogin();
      log.info("open-at-login set to", next);
    },
    isOpenAtLogin,
  });

  state.tray = createTray({
    showDashboard: () => ensureWindow(),
    restartServer: () => {
      void restartServer().catch((err) =>
        showFatalDialog("Could not restart the server.", String(err))
      );
    },
    openLogs,
    openInBrowser,
    toggleOpenAtLogin: () => toggleOpenAtLogin(),
    isOpenAtLogin,
    serverPort: () => state.serverHandle?.port ?? null,
    getSnapshot: () => getServerSnapshot(),
    refreshSnapshot: () => void refreshServerSnapshot(state.serverHandle?.port ?? null),
    requestQuit,
  });

  // Keep the tray's live counts fresh by polling the running server's stats
  // API on an interval (and on each menu open via refreshSnapshot above).
  startSnapshotPolling(() => state.serverHandle?.port ?? null);

  // Skip the dashboard window when macOS launched us at login — the user just
  // logged in, they don't want a window jumping in their face. Tray only.
  if (!launchedAtLogin()) {
    ensureWindow();
  } else {
    log.info("launched at login — staying tray-only");
    if (process.platform === "darwin") app.dock?.hide();
  }
}

/**
 * Register the app-level lifecycle handlers. Called synchronously before
 * `app.whenReady()` so the single-instance lock and `before-quit` interception
 * are in place from the very first tick — there is no window yet to race
 * against.
 *
 * `requestSingleInstanceLock()` is what makes a second launch (a second Dock
 * click, or double-clicking the Start-Menu shortcut again) just focus the
 * existing window instead of spawning a second tray + embedded server, which
 * would otherwise fight over the same port and SQLite file.
 */
function wireLifecycle(): void {
  // Single-instance lock: second launches just focus the first window.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.exit(0);
    return;
  }
  app.on("second-instance", () => {
    if (state.serverHandle) ensureWindow();
  });

  app.on("activate", () => {
    if (state.serverHandle) ensureWindow();
  });

  app.on("window-all-closed", () => {
    // Stay alive: tray + server keep running on every platform.
  });

  app.on("before-quit", (event) => {
    // Second ⌘Q while the confirm dialog is up — bypass the prompt and let
    // macOS quit. We still close the SQLite handle on the way out so WAL is
    // checkpointed cleanly.
    if (state.confirmingQuit) {
      state.quitting = true;
      if (state.serverHandle?.ownedByUs) closeEmbeddedDatabase();
      return;
    }
    if (state.quitting) return;
    if (state.serverHandle?.ownedByUs) {
      event.preventDefault();
      requestQuit();
    }
  });
}

app.setName(APP_NAME);
// Windows: associate this process with the installed app's AppUserModelID so
// `new Notification()` toasts (e.g. "Server restarted") render under the app's
// name/icon and taskbar windows group correctly. Must be set before any window
// or notification is created. No-op on macOS/Linux.
if (process.platform === "win32") app.setAppUserModelId(APP_ID);
wireLifecycle();
app
  .whenReady()
  .then(boot)
  .catch((err) => {
    log.error("fatal during boot", err);
    showFatalDialog("Fatal error during startup.", String(err));
    app.exit(1);
  });
