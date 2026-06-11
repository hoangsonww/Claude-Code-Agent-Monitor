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

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

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

function saveState(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMinimized()) return;
  const { width, height, x, y } = win.getBounds();
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ width, height, x, y }));
  } catch (err) {
    log.warn("could not persist window state", err);
  }
}

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
