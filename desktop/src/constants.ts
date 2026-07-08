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

/**
 * Preferred dashboard port — matches the project's documented default. Also
 * the only port `server-host.ts`'s `startEmbeddedServer` will *adopt* an
 * already-healthy server on; a server found on any other port is never
 * treated as "ours" to reuse.
 */
export const PREFERRED_PORT = 4820;

/**
 * Last-resort port scan range when `PREFERRED_PORT` and its nine immediate
 * fallbacks (4821–4829) are all taken. Set to the IANA-registered
 * dynamic/private port range (49152–65535, truncated here to 49500 — far more
 * headroom than `pickFreePort()` should ever need) so we never guess at a
 * port some other, unrelated service might be registered on.
 */
export const FALLBACK_PORT_RANGE = { min: 49152, max: 49500 } as const;

/**
 * How long `server-host.ts`'s `waitForHealthy()` polls a freshly bound port
 * for `/api/health` before giving up and surfacing an error dialog to the
 * user. 30s comfortably covers a cold start on a slow disk (SQLite file
 * creation, migrations) without leaving the user staring at a spinner
 * indefinitely if something is actually broken.
 */
export const HEALTH_TIMEOUT_MS = 30_000;

/** Default window size, used only when no `window-state.json` exists yet
 * (first launch). Persisted to `app.getPath('userData')` after that — see
 * `window.ts`'s `loadState`/`saveState`. */
export const DEFAULT_WINDOW = { width: 1280, height: 800 } as const;
