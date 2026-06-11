/**
 * @file Native application menu (the macOS top-bar menu).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { BrowserWindow, Menu, app, shell, type MenuItemConstructorOptions } from "electron";

import { APP_NAME } from "./constants";

export interface MenuActions {
  showDashboard: () => void;
  reloadDashboard: () => void;
  restartServer: () => void;
  openLogs: () => void;
  toggleOpenAtLogin: () => void;
  isOpenAtLogin: () => boolean;
}

export function installApplicationMenu(actions: MenuActions): Menu {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: APP_NAME,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Open at Login",
                type: "checkbox",
                checked: actions.isOpenAtLogin(),
                click: () => actions.toggleOpenAtLogin(),
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ] satisfies MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        // "Open Dashboard" is macOS-only. On macOS the menu bar is global and
        // persists after the window is closed/hidden, so this item (and Cmd+1)
        // genuinely reopens it. On Windows/Linux the menu is attached to the
        // window itself and a menu accelerator only fires while that window is
        // already focused/foreground — so the item could only ever run when the
        // window is already up, making it a confusing no-op. Reopening from a
        // hidden/tray state is handled by the tray's own "Open Dashboard" there.
        ...(isMac
          ? ([
              {
                label: "Open Dashboard",
                accelerator: "CmdOrCtrl+1",
                click: () => actions.showDashboard(),
              },
            ] satisfies MenuItemConstructorOptions[])
          : []),
        {
          // No accelerator here: the View menu's `reload` role already owns
          // CmdOrCtrl+R. Two menu items sharing one accelerator triggers an
          // Electron duplicate-accelerator warning at startup.
          label: "Reload Dashboard",
          click: () => actions.reloadDashboard(),
        },
        { type: "separator" },
        {
          label: "Restart Server",
          click: () => actions.restartServer(),
        },
        {
          label: "Show Logs",
          click: () => actions.openLogs(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? ([
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ] satisfies MenuItemConstructorOptions[])
          : ([{ role: "close" }] satisfies MenuItemConstructorOptions[])),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Project on GitHub",
          click: () =>
            void shell.openExternal("https://github.com/hoangsonww/Claude-Code-Agent-Monitor"),
        },
        {
          label: "Report an Issue",
          click: () =>
            void shell.openExternal(
              "https://github.com/hoangsonww/Claude-Code-Agent-Monitor/issues/new/choose"
            ),
        },
        {
          label: `${APP_NAME} v${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

/** Bring the dashboard window to focus, creating one via the supplied factory if needed. */
export function focusOrCreateWindow(
  existing: BrowserWindow | null,
  create: () => BrowserWindow
): BrowserWindow {
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    // Call show() unconditionally (not just when hidden): on Windows a bare
    // focus() on a visible-but-background window often only flashes the taskbar
    // button instead of raising it, whereas show() reliably activates and
    // brings it to the foreground. Harmless when the window is already frontmost.
    existing.show();
    existing.focus();
    return existing;
  }
  return create();
}
