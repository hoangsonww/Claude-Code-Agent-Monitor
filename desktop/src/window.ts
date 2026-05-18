/**
 * @file Dashboard window creation + state persistence.
 *
 * We persist size/position to a JSON file under `app.getPath('userData')`.
 * Avoids the `electron-window-state` dependency for ~30 lines of code.
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
    titleBarStyle: "hiddenInset",
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
