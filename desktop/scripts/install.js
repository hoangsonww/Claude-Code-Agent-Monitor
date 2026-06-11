#!/usr/bin/env node
/**
 * @file Desktop dependency installer with actionable failure help.
 *
 * Thin wrapper around `npm install` (which still runs the `postinstall`
 * `electron-builder install-app-deps` to rebuild native modules for Electron).
 * On success it behaves exactly like a bare `npm install`. On failure — almost
 * always the `better-sqlite3` native build — it prints the prerequisite
 * guidance + the no-toolchain alternative commands, then exits non-zero so the
 * normal command still fails loudly rather than silently leaving a half-set-up
 * `node_modules`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { printNativeDepHelp, hasBetterSqliteBinary } = require("./preflight");

const desktopRoot = path.resolve(__dirname, "..");

// On Windows `npm` is a `.cmd` shim that `spawnSync` can only launch via a
// shell; without this it fails with ENOENT. POSIX is unaffected.
const result = spawnSync("npm", ["install"], {
  cwd: desktopRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

// `npm install` failed outright (e.g. node-gyp could not find a compiler), or
// it "succeeded" but the native binary never landed (a prebuilt download was
// skipped). Either way the desktop app cannot boot — surface the fix and fail.
if (result.status !== 0) {
  printNativeDepHelp("`npm install` failed while building the native better-sqlite3 module.");
  process.exit(result.status || 1);
}

if (!hasBetterSqliteBinary()) {
  printNativeDepHelp("Dependencies installed, but the better-sqlite3 native binary is missing.");
  process.exit(1);
}
