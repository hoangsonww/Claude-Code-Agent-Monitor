/**
 * @file Menu-bar / notification-area (system tray) icon and its context menu.
 *
 * The tray is the "always-on" surface of the app. A single click opens the
 * menu showing live status snapshots from the embedded server plus an Open
 * Dashboard action.
 *
 * The image is platform-specific: macOS uses a black "template" PNG so the OS
 * tints it for light/dark menu bars; Windows uses the colored `icon.ico`,
 * because a black template glyph would be invisible on the (usually dark)
 * Windows taskbar notification area.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { Menu, Tray, app, nativeImage } from "electron";
import * as path from "node:path";

import { APP_NAME } from "./constants";
import { log } from "./logger";

/** Callbacks the tray menu wires to its rows. `main.ts` supplies these —
 * several are shared verbatim with `installApplicationMenu`'s `MenuActions`
 * so the tray and the application menu never disagree about behavior. */
export interface TrayActions {
  /** Bring the dashboard window to front, creating it if it doesn't exist. */
  showDashboard: () => void;
  /** Stop and re-launch the embedded server, then reload the window. */
  restartServer: () => void;
  /** Reveal `desktop.log` in the OS file browser. */
  openLogs: () => void;
  /** Open the dashboard URL in the user's default system browser. */
  openInBrowser: () => void;
  /** Flip the OS auto-start-at-login registration. */
  toggleOpenAtLogin: () => void;
  /** Read the current auto-start state, used to render the checkbox. */
  isOpenAtLogin: () => boolean;
  /** The embedded server's live port, or `null` before it has started. */
  serverPort: () => number | null;
  /** Last cached status snapshot (refreshed by the background poller). */
  getSnapshot: () => ServerSnapshot | null;
  /** Kick an immediate async snapshot refresh (fire-and-forget on menu open). */
  refreshSnapshot: () => void;
  /** Prompt the same quit-confirmation dialog ⌘Q triggers. */
  requestQuit: () => void;
}

/**
 * Structurally identical to `server-host.ts`'s `ServerSnapshot` — redeclared
 * here so this module has no compile-time dependency on `server-host.ts`,
 * only on the `TrayActions` callbacks `main.ts` wires between them. `main.ts`
 * passes `getServerSnapshot`/`refreshServerSnapshot` straight through, so the
 * two types must stay in sync by hand if the stats API response shape changes.
 */
export interface ServerSnapshot {
  activeSessions: number;
  workingAgents: number;
  eventsToday: number;
}

/**
 * Tray icon image location. In dev `__dirname` is `desktop/out/`, so `../assets`
 * resolves to `desktop/assets/`. In the packaged app the images ship outside
 * the asar archive via `extraResources` (see electron-builder.yml), so we
 * read them from `process.resourcesPath/assets/`. Loading these from inside
 * asar can yield empty `nativeImage` results, which is why we keep them
 * unpacked.
 *
 * Windows gets the colored `icon.ico`; macOS gets the black template PNG that
 * the menu bar tints automatically.
 */
/** Pick the platform-appropriate tray image filename — a colored `.ico` on
 * Windows (a black glyph would vanish on the usually-dark taskbar), or the
 * black "template" PNG on macOS (the menu bar auto-tints it for light/dark). */
function trayImageFile(): string {
  return process.platform === "win32" ? "icon.ico" : "tray-icon-Template.png";
}

/** Resolve `trayImageFile()` to an absolute path, branching on dev vs
 * packaged layout — see the file-level doc comment for why these assets are
 * read from disk (`extraResources`) rather than bundled inside the asar. */
function trayImagePath(): string {
  const file = trayImageFile();
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", file);
  }
  return path.join(__dirname, "..", "assets", file);
}

/**
 * Create the menu-bar / notification-area tray icon and wire its dropdown
 * menu. The menu is deliberately rebuilt from `actions` on every open (see
 * `showMenu` below) rather than mutated in place, so the port label, the
 * live `{sessions, agents, events-today}` snapshot, and the "Open at Login"
 * checkbox are always current — Electron menus have no live-binding, so a
 * cached template would show stale values until the app happened to rebuild
 * it for an unrelated reason.
 *
 * Left- and right-click both pop the same dropdown via `popUpContextMenu`
 * (`tray.on('click', ...)` and `tray.on('right-click', ...)`) instead of
 * `Tray#setContextMenu` — a static, pre-assigned menu that Electron shows
 * automatically on click, with no hook for the `refreshSnapshot()` call that
 * needs to run first so the dropdown reflects the very latest counts.
 */
export function createTray(actions: TrayActions): Tray {
  const imagePath = trayImagePath();
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    log.warn("tray image is empty; falling back to in-memory placeholder", imagePath);
  } else if (process.platform === "darwin") {
    // Template tinting is a macOS concept; on Windows the icon is colored and
    // must be shown as-is.
    image.setTemplateImage(true);
  }

  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip(APP_NAME);

  // Singular/plural helper so "1 active session" doesn't read as "1 active sessions".
  const plural = (n: number, singular: string, pluralForm?: string): string =>
    `${n.toLocaleString()} ${n === 1 ? singular : (pluralForm ?? singular + "s")}`;

  // Built fresh on each click so the port, status snapshot, and the
  // "Open at Login" checkbox always reflect current state. Snapshot rows
  // are intentionally `enabled` (with a click handler that opens the
  // dashboard) instead of `enabled: false` — disabled menu items get
  // dimmed by macOS, which looked sickly next to the actionable rows
  // below them. Clicking any row now lands on the dashboard where the
  // user can see the same numbers in context.
  const buildMenu = (): Menu => {
    const port = actions.serverPort();
    const portLabel = port ? `🟢  Listening on :${port}` : "🔴  Server not running";
    const snap = actions.getSnapshot();
    const open = (): void => actions.showDashboard();
    const snapshotItems: Electron.MenuItemConstructorOptions[] = snap
      ? [
          { type: "separator" },
          { label: `📊   ${plural(snap.activeSessions, "active session")}`, click: open },
          { label: `🤖   ${plural(snap.workingAgents, "working agent")}`, click: open },
          { label: `📥   ${plural(snap.eventsToday, "event")} today`, click: open },
        ]
      : [{ type: "separator" }, { label: "Snapshot unavailable", enabled: false }];

    return Menu.buildFromTemplate([
      { label: APP_NAME, enabled: false },
      { label: portLabel, enabled: false },
      ...snapshotItems,
      { type: "separator" },
      { label: "Open Dashboard", accelerator: "CmdOrCtrl+O", click: open },
      { label: "Open in Browser…", click: () => actions.openInBrowser() },
      { type: "separator" },
      { label: "Restart Server", click: () => actions.restartServer() },
      { label: "Show Logs", click: () => actions.openLogs() },
      { type: "separator" },
      {
        label: "Open at Login",
        type: "checkbox",
        checked: actions.isOpenAtLogin(),
        click: () => actions.toggleOpenAtLogin(),
      },
      { type: "separator" },
      { label: `Version ${app.getVersion()}`, enabled: false },
      {
        label: "Quit Claude Code Monitor",
        accelerator: "CmdOrCtrl+Q",
        click: () => actions.requestQuit(),
      },
    ]);
  };

  // Single click (left or right) opens the menu — the conventional macOS
  // menu-bar utility pattern. Opening the dashboard is the first action in
  // the menu, so it's still one click + Enter to surface the window.
  // We kick an async refresh on open so the next interaction reflects the
  // very latest counts; this open renders the most recent cached snapshot.
  const showMenu = (): void => {
    actions.refreshSnapshot();
    tray.popUpContextMenu(buildMenu());
  };
  tray.on("click", showMenu);
  tray.on("right-click", showMenu);
  return tray;
}
