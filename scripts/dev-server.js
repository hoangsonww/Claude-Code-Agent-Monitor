#!/usr/bin/env node
/**
 * @file Runs the development Express server under a debounced, cross-platform
 * source watcher. Save bursts become one graceful restart, and the server
 * inherits stdio directly so an intermediary output pipe cannot fail with
 * EPIPE and strand Vite without its API backend.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT, "server", "index.js");
const WATCH_ROOTS = [path.join(ROOT, "server"), path.join(ROOT, "scripts")];
const ROOT_FILES = new Set([".env", "package.json", "package-lock.json"]);
// Editors, generators, and `prettier --write .` can touch several runtime
// modules in one pass. Restart only after that burst becomes quiet.
const RESTART_DELAY_MS = 500;
const SHUTDOWN_TIMEOUT_MS = 6_000;

function isRuntimeSource(filePath) {
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith("..")) return false;
  if (ROOT_FILES.has(relative)) return true;
  const segments = relative.split(path.sep);
  if (!WATCH_ROOTS.some((root) => filePath.startsWith(`${root}${path.sep}`))) return false;
  if (segments.includes("__tests__")) return false;
  return [".js", ".cjs", ".mjs", ".json"].includes(path.extname(relative));
}

function createRestartScheduler(restart, delayMs = RESTART_DELAY_MS) {
  let timer = null;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        restart();
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

function directoriesBelow(root) {
  const directories = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    directories.push(directory);
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
        pending.push(path.join(directory, entry.name));
      }
    }
  }
  return directories;
}

function start() {
  let child = null;
  let restarting = false;
  let restartQueued = false;
  let stopping = false;
  const watchers = [];

  const launch = () => {
    if (stopping) return;
    const next = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child = next;
    next.once("error", (error) => {
      console.error(`[dev:server] failed to launch: ${error.message}`);
    });
    next.once("exit", (code, signal) => {
      if (child === next) child = null;
      if (stopping || restarting) return;
      console.error(
        `[dev:server] server exited${signal ? ` from ${signal}` : ` with code ${code}`}; retrying after a change`
      );
    });
  };

  const stopChild = (runningChild) =>
    new Promise((resolve) => {
      if (!runningChild || runningChild.exitCode !== null || runningChild.signalCode) {
        resolve();
        return;
      }
      let settled = false;
      let forceTimer;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(forceTimer);
        resolve();
      };
      runningChild.once("exit", finish);
      runningChild.kill("SIGTERM");
      forceTimer = setTimeout(() => {
        if (runningChild.exitCode === null && !runningChild.signalCode)
          runningChild.kill("SIGKILL");
      }, SHUTDOWN_TIMEOUT_MS);
      forceTimer.unref();
    });

  const restart = async () => {
    if (stopping) return;
    if (restarting) {
      restartQueued = true;
      return;
    }
    restarting = true;
    const previous = child;
    if (previous) console.log("[dev:server] source changed; restarting once…");
    await stopChild(previous);
    launch();
    restarting = false;
    if (restartQueued) {
      restartQueued = false;
      scheduler.schedule();
    }
  };
  const scheduler = createRestartScheduler(restart);

  const watchDirectory = (directory) => {
    try {
      const watcher = fs.watch(directory, (eventType, filename) => {
        if (!filename) return;
        const changedPath = path.join(directory, filename.toString());
        if (!isRuntimeSource(changedPath)) return;
        scheduler.schedule();
      });
      watcher.on("error", (error) => {
        console.warn(`[dev:server] watcher warning for ${directory}: ${error.message}`);
      });
      watchers.push(watcher);
    } catch (error) {
      console.warn(`[dev:server] cannot watch ${directory}: ${error.message}`);
    }
  };

  for (const root of WATCH_ROOTS) {
    for (const directory of directoriesBelow(root)) watchDirectory(directory);
  }
  watchDirectory(ROOT);

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    scheduler.cancel();
    for (const watcher of watchers) watcher.close();
    await stopChild(child);
    process.exit(signal ? 0 : 1);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  launch();
}

if (require.main === module) start();

module.exports = { createRestartScheduler, directoriesBelow, isRuntimeSource };
