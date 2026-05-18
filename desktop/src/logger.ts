/**
 * @file Lightweight file logger for the desktop shell.
 *
 * Electron's main process has no console attached when launched from Finder,
 * so all diagnostics go to a per-user log file under app.getPath('logs').
 * We deliberately avoid the `electron-log` dependency — the project keeps a
 * small dependency tree and this file does the only three things we need.
 */

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

let stream: fs.WriteStream | null = null;
let logPath = "";

function ensureStream(): fs.WriteStream {
  if (stream) return stream;
  const dir = app.getPath("logs");
  fs.mkdirSync(dir, { recursive: true });
  logPath = path.join(dir, "desktop.log");
  stream = fs.createWriteStream(logPath, { flags: "a" });
  return stream;
}

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

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const log = {
  info: (...parts: unknown[]) => write("info", parts),
  warn: (...parts: unknown[]) => write("warn", parts),
  error: (...parts: unknown[]) => write("error", parts),
  /** Absolute path to the active log file (populated after first write). */
  path: () => logPath,
};
