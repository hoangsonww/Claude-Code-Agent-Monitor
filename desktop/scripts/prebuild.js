#!/usr/bin/env node
/**
 * @file Pre-build guard.
 *
 * Ensures the desktop bundle has everything it needs before TypeScript
 * compiles. Specifically:
 *   1. The root repo's node_modules exists (Express + friends).
 *   2. The client has been built (client/dist exists). In production mode the
 *      Express server serves the SPA from client/dist; if it's missing the
 *      DMG would ship a 404-only dashboard.
 *   3. Asset PNGs exist (or we leave a clear warning — icons can be
 *      regenerated via scripts/build-icons.sh).
 *   4. The desktop-local better-sqlite3 native binary matches this machine's
 *      CPU architecture. A prior `electron-builder --mac --x64/--arm64` build
 *      rebuilds it for the target arch; left mismatched it breaks `desktop:dev`
 *      and `desktop:test` with ERR_DLOPEN_FAILED. We rebuild it if so.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { hasBetterSqliteBinary, printNativeDepHelp } = require("./preflight");

const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(__dirname, "..", "..");
const clientDist = path.join(repoRoot, "client", "dist");
const rootNodeModules = path.join(repoRoot, "node_modules");
const assets = path.join(desktopRoot, "assets");

function run(cmd, args, opts = {}) {
  // On Windows `npm`/`npx` are `.cmd` shims that `spawnSync` can only launch
  // through a shell; without this it fails with ENOENT. POSIX is unaffected.
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}`);
  }
}

if (!fs.existsSync(rootNodeModules)) {
  console.log("[prebuild] installing root dependencies…");
  run("npm", ["ci"], { cwd: repoRoot });
}

if (!fs.existsSync(clientDist) || !fs.existsSync(path.join(clientDist, "index.html"))) {
  console.log("[prebuild] building client (client/dist missing)…");
  run("npm", ["ci"], { cwd: path.join(repoRoot, "client") });
  run("npm", ["run", "build"], { cwd: repoRoot });
}

const trayIcon = path.join(assets, "tray-icon-Template.png");
if (!fs.existsSync(trayIcon)) {
  console.warn(
    "[prebuild] WARN: tray-icon-Template.png missing. Run `npm run build:icons` to regenerate from assets/icon.svg."
  );
}

// Heal a better-sqlite3 native binary left built for the wrong CPU arch by a
// prior `electron-builder --mac --x64/--arm64` run. Without this, `desktop:dev`
// and `desktop:test` fail to load the module (ERR_DLOPEN_FAILED) until the
// contributor manually re-runs `npm run desktop:install`.
if (process.platform === "darwin") {
  const bsNode = path.join(
    desktopRoot,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
  if (fs.existsSync(bsNode)) {
    const desc = spawnSync("file", ["-b", bsNode], { encoding: "utf8" }).stdout || "";
    // A universal binary works on both arches; only act on a clear mismatch.
    const universal = /universal/i.test(desc);
    const wrongArch =
      !universal &&
      ((process.arch === "arm64" && !/arm64/.test(desc)) ||
        (process.arch === "x64" && !/x86_64/.test(desc)));
    if (wrongArch) {
      console.log(
        "[prebuild] better-sqlite3 is built for the wrong CPU arch (a prior DMG build left it that way) — rebuilding for this machine…"
      );
      run("npx", ["electron-builder", "install-app-deps"], { cwd: desktopRoot });
    }
  }
}

// The embedded server `require`s better-sqlite3 at boot; without its native
// binary the desktop app dies with a fatal dialog after compiling cleanly.
// Catch it here (a build-time, copy-pasteable failure) rather than at runtime.
if (!hasBetterSqliteBinary()) {
  printNativeDepHelp("The desktop-local better-sqlite3 native binary is missing.");
  process.exit(1);
}

console.log("[prebuild] ok");
