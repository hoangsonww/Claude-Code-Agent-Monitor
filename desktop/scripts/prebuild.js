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
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const clientDist = path.join(repoRoot, "client", "dist");
const rootNodeModules = path.join(repoRoot, "node_modules");
const assets = path.resolve(__dirname, "..", "assets");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
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

console.log("[prebuild] ok");
