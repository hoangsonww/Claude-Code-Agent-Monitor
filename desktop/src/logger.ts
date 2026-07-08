/**
 * @file Lightweight file logger for the desktop shell.
 *
 * Electron's main process has no console attached when launched from Finder,
 * so all diagnostics go to a per-user log file under app.getPath('logs').
 * We deliberately avoid the `electron-log` dependency — the project keeps a
 * small dependency tree and this file does the only three things we need.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

let stream: fs.WriteStream | null = null;
let logPath = "";

/**
 * Lazily open the append-mode write stream to `desktop.log`, creating the
 * `app.getPath('logs')` directory if this is the first write of the process.
 * Cached in the module-level `stream` so every subsequent `write()` call
 * reuses the same file descriptor instead of re-opening the file.
 */
function ensureStream(): fs.WriteStream {
  if (stream) return stream;
  const dir = app.getPath("logs");
  fs.mkdirSync(dir, { recursive: true });
  logPath = path.join(dir, "desktop.log");
  stream = fs.createWriteStream(logPath, { flags: "a" });
  return stream;
}

/**
 * Format one log line (ISO timestamp + level + space-joined parts) and fan it
 * out to the log file and, conditionally, to the process streams:
 *   - `error` always echoes to `stderr`, so a crash is visible even without
 *     `CCAM_DESKTOP_VERBOSE` (e.g. when Electron is launched from a terminal).
 *   - `info`/`warn` only echo to `stdout` when `CCAM_DESKTOP_VERBOSE` is set,
 *     keeping a normal launch quiet.
 * The file write is wrapped in try/catch — a logging failure (e.g. a full
 * disk) must never take down the app.
 */
function write(level: "info" | "warn" | "error", parts: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${parts
    .map((p) => (typeof p === "string" ? p : safeStringify(p)))
    .join(" ")}\n`;
  try {
    ensureStream().write(line);
  } catch {
    // Logging must never crash the app.
  }
  if (level === "error") {
    process.stderr.write(line);
  } else if (process.env.CCAM_DESKTOP_VERBOSE) {
    process.stdout.write(line);
  }
}

/** `JSON.stringify` a non-string log argument, falling back to `String()` for
 * values it can't serialize (e.g. circular objects or `BigInt`). */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The desktop shell's only logging surface. Electron's main process has no
 * attached console when launched from Finder/Dock, so every call here is
 * durably persisted to `desktop.log` (see `ensureStream`) in addition to the
 * conditional stdout/stderr echo described in `write`.
 */
export const log = {
  info: (...parts: unknown[]) => write("info", parts),
  warn: (...parts: unknown[]) => write("warn", parts),
  error: (...parts: unknown[]) => write("error", parts),
  /** Absolute path to the active log file (populated after first write). */
  path: () => logPath,
};
