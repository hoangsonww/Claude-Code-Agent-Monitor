/**
 * @file Dashboard window creation + state persistence.
 *
 * We persist size/position to a JSON file under `app.getPath('userData')`.
 * Avoids the `electron-window-state` dependency for ~30 lines of code.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { BrowserWindow, app, shell } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

import { APP_NAME, DEFAULT_WINDOW } from "./constants";
import { log } from "./logger";

/** Persisted window geometry. `x`/`y` are omitted until the window has been
 * moved at least once — a fresh install lets Electron pick the OS default
 * placement rather than forcing `(0, 0)`. */
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/** Absolute path to the JSON file geometry is persisted to, under this
 * platform's `userData` directory (e.g. `~/Library/Application Support/…`
 * on macOS, `%APPDATA%` on Windows). */
function statePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

/**
 * Absolute path to the colored application icon used for the window title bar
 * and the Windows taskbar / Linux launcher — the same logo the macOS app shows
 * in its Dock (rendered from `assets/icon.svg`). Without this, an unpackaged
 * `electron out/main.js` run falls back to the generic Electron icon.
 *
 * Windows wants the multi-size `.ico` (crisp at every taskbar scale); other
 * platforms take the `.png`. macOS ignores `BrowserWindow#icon` entirely (its
 * window has no icon and the Dock uses the bundle's `.icns`), so the value is
 * harmless there. Resolves dev (`desktop/assets`) vs packaged
 * (`Resources/assets`, shipped via `extraResources`); returns `undefined` if
 * the file is absent so we cleanly fall back instead of throwing.
 */
export function appIconPath(): string | undefined {
  const file = process.platform === "win32" ? "icon.ico" : "icon.png";
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "..", "assets");
  const p = path.join(base, file);
  return fs.existsSync(p) ? p : undefined;
}

/**
 * Read the persisted window geometry, falling back field-by-field to
 * `DEFAULT_WINDOW` (and to `undefined` for position) whenever the file is
 * missing, unreadable, or contains a field of the wrong type — so a
 * corrupted or partially-written state file degrades gracefully instead of
 * preventing the window from opening at all.
 */
function loadState(): WindowState {
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return {
      width: typeof parsed.width === "number" ? parsed.width : DEFAULT_WINDOW.width,
      height: typeof parsed.height === "number" ? parsed.height : DEFAULT_WINDOW.height,
      x: typeof parsed.x === "number" ? parsed.x : undefined,
      y: typeof parsed.y === "number" ? parsed.y : undefined,
    };
  } catch {
    return { width: DEFAULT_WINDOW.width, height: DEFAULT_WINDOW.height };
  }
}

/**
 * Write the window's current bounds to `statePath()`. Skipped while the
 * window is destroyed or minimized, since `getBounds()` on a minimized
 * window reports the pre-minimize size on some platforms — persisting it
 * would silently discard the user's last real resize/move. Failures (e.g.
 * a read-only `userData` dir) are logged, not thrown — losing the saved
 * geometry is cosmetic, not fatal.
 */
function saveState(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMinimized()) return;
  const { width, height, x, y } = win.getBounds();
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ width, height, x, y }));
  } catch (err) {
    log.warn("could not persist window state", err);
  }
}

/**
 * Create the single dashboard `BrowserWindow` and point it at the embedded
 * server's origin. Restores the last persisted size/position (see
 * `loadState`), re-saves it (debounced) on every resize/move/close, routes
 * all external navigation to the system browser instead of inside Electron,
 * and defers `show()` until `ready-to-show` so the window never flashes an
 * unstyled blank frame while the page loads.
 *
 * @param targetUrl The embedded server's origin, e.g. `http://127.0.0.1:4820`.
 * @returns The newly created, not-yet-visible `BrowserWindow`.
 */
export function createDashboardWindow(targetUrl: string): BrowserWindow {
  const state = loadState();

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: APP_NAME,
    // Colored app logo for the title bar + taskbar (matches the macOS Dock
    // icon). No-op on macOS; falls through to the Electron default if missing.
    icon: appIconPath(),
    // Use the standard macOS title bar rather than `hiddenInset`. With a hidden
    // title bar the traffic-light buttons float directly over the React app's
    // top edge and visually blend into the dashboard chrome; a native title bar
    // gives them their own clearly-separated row, shows the app name, and
    // restores the conventional double-click-to-maximize / drag-from-anywhere
    // behaviour without needing custom drag regions in the renderer.
    titleBarStyle: "default",
    backgroundColor: "#0b0f1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // We're loading our own localhost-only origin, never remote content.
      webSecurity: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Persist size/position on resize/move (debounced via the close handler too).
  let saveTimer: NodeJS.Timeout | null = null;
  const debounced = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveState(win), 400);
  };
  win.on("resize", debounced);
  win.on("move", debounced);
  win.on("close", () => saveState(win));

  // External links open in the user's browser, not inside Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(targetUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.loadURL(targetUrl).catch((err) => log.error("failed to load dashboard URL", err));
  return win;
}
