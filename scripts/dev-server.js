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

function createSourceWatcher(
  roots,
  onChange,
  {
    isSource = isRuntimeSource,
    onWarning = (message) => console.warn(message),
    recursive = true,
    // Seam for tests, defaulted to the real thing so every production caller is
    // unchanged. OS change notification is lossy by construction: libuv keeps
    // ONE FSEvents stream per event loop on macOS and restarts it whenever a
    // watch handle is added, and a change landing during that restart is dropped
    // and never redelivered. A test that waits on a single real notification is
    // therefore flaky however long it waits. Injecting the watch factory lets
    // the dispatch logic below be driven deterministically against a real
    // on-disk tree.
    watch = fs.watch,
  } = {}
) {
  const watchers = new Map();

  const watchDirectory = (directory) => {
    const resolved = path.resolve(directory);
    if (watchers.has(resolved)) return;
    try {
      const watcher = watch(resolved, (eventType, filename) => {
        if (!filename) return;
        const changedPath = path.join(resolved, filename.toString());
        try {
          if (fs.statSync(changedPath).isDirectory()) {
            if (recursive) {
              for (const nested of directoriesBelow(changedPath)) watchDirectory(nested);
              onChange(changedPath);
            }
            return;
          }
        } catch {
          // Deleted and atomically replaced files are still source changes when
          // their last known pathname has a watched runtime extension.
        }
        if (isSource(changedPath)) onChange(changedPath);
      });
      watcher.on("error", (error) => {
        onWarning(`[dev:server] watcher warning for ${resolved}: ${error.message}`);
      });
      watchers.set(resolved, watcher);
    } catch (error) {
      onWarning(`[dev:server] cannot watch ${resolved}: ${error.message}`);
    }
  };

  for (const root of roots) {
    const directories = recursive ? directoriesBelow(root) : [root];
    for (const directory of directories) watchDirectory(directory);
  }

  return {
    close() {
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
  };
}

function start() {
  let child = null;
  let restarting = false;
  let restartQueued = false;
  let stopping = false;

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

  const sourceWatcher = createSourceWatcher(WATCH_ROOTS, () => scheduler.schedule());
  const rootWatcher = createSourceWatcher([ROOT], () => scheduler.schedule(), { recursive: false });

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    scheduler.cancel();
    sourceWatcher.close();
    rootWatcher.close();
    await stopChild(child);
    process.exit(signal ? 0 : 1);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  launch();
}

if (require.main === module) start();

module.exports = {
  createRestartScheduler,
  createSourceWatcher,
  directoriesBelow,
  isRuntimeSource,
};
