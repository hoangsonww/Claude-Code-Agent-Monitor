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

import { app } from "electron";

/**
 * CLI flag we register the Windows startup entry with, then look for in
 * `process.argv` to recognise a login-triggered launch (Windows has no
 * `wasOpenedAtLogin`). Harmless if it ever reaches another code path.
 */
const WIN_LAUNCH_FLAG = "--ccam-hidden";

function supported(): boolean {
  return process.platform === "darwin" || process.platform === "win32";
}

export function isOpenAtLogin(): boolean {
  if (!supported()) return false;
  return app.getLoginItemSettings().openAtLogin;
}

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
