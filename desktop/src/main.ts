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
  // Hold a reference to the tray so the GC doesn't collect it (electron quirk).
  tray: Electron.Tray | null;
  /** Set once teardown has begun (inside `requestQuit`'s confirm callback or
   * the bypass path in `before-quit`); gates re-entrant quit handling. */
  quitting: boolean;
  /** True while the quit-confirmation dialog is open; a second ⌘Q in this
   * window bypasses the dialog and lets macOS quit immediately. */
  confirmingQuit: boolean;
}

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
 * (e.g. the embedded server failing to boot at all). */
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
