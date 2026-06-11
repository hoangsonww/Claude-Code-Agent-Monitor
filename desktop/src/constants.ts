/**
 * @file Shared constants for the desktop shell.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

export const APP_NAME = "Claude Code Monitor";

/**
 * Application identifier. Must match `appId` in electron-builder.yml: on Windows
 * we hand it to `app.setAppUserModelId()` so toast notifications attribute to
 * the installed Start-Menu shortcut (NSIS writes the same AUMID there) instead
 * of appearing as a generic "electron.app" toast — and so taskbar windows group
 * under one icon. Ignored on macOS/Linux.
 */
export const APP_ID = "com.hoangsonww.ccam.desktop";

/** Preferred dashboard port — matches the project's documented default. */
export const PREFERRED_PORT = 4820;

/** Highest port we'll try as a fallback when 4820 (and friends) are taken. */
export const FALLBACK_PORT_RANGE = { min: 49152, max: 49500 } as const;

/**
 * How long we wait for the embedded server to answer `/api/health` before
 * giving up and surfacing an error dialog to the user.
 */
export const HEALTH_TIMEOUT_MS = 30_000;

/** Default window size. Persisted to electron's userData after first launch. */
export const DEFAULT_WINDOW = { width: 1280, height: 800 } as const;
