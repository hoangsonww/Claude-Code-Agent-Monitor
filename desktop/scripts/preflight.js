#!/usr/bin/env node
/**
 * @file Shared native-dependency preflight checks + actionable failure help.
 *
 * The desktop shell embeds the dashboard server in-process, which `require`s
 * the native `better-sqlite3` module rebuilt against Electron's Node ABI. That
 * build is the single most common setup failure: it needs either a C++ toolchain
 * (to compile from source) or a Node version new enough to have a prebuilt
 * binary. When it's missing we want a clear, copy-pasteable message instead of a
 * raw node-gyp stack trace or a runtime "Cannot find module" deep inside boot.
 *
 * This module is shared by `install.js` (wraps the dependency install) and
 * `prebuild.js` (gates every `desktop:*` build/dev script) so both surfaces
 * print the same guidance.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");

const desktopRoot = path.resolve(__dirname, "..");

/** Absolute path to the compiled/prebuilt better-sqlite3 native binary. */
function betterSqliteBinary() {
  return path.join(
    desktopRoot,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
}

/** True when the Electron-ABI better-sqlite3 binary is present on disk. */
function hasBetterSqliteBinary() {
  return fs.existsSync(betterSqliteBinary());
}

/**
 * Print prerequisite guidance and the no-toolchain alternative commands to
 * stderr. Callers should `process.exit(1)` after this so the failing npm
 * command exits non-zero (never leave the user thinking setup succeeded).
 */
function printNativeDepHelp(reason) {
  const line = "─".repeat(74);
  const out = (s) => process.stderr.write(s + "\n");
  out("");
  out(line);
  out("  Claude Code Monitor — desktop native dependency setup did not complete");
  out(line);
  if (reason) {
    out(`  ${reason}`);
    out("");
  }
  out("  The desktop app embeds the dashboard server, which needs the native");
  out("  'better-sqlite3' module built for Electron's Node ABI. This typically");
  out("  fails for one of two reasons:");
  out("");
  out("    1. No C++ build toolchain, so the module can't compile from source:");
  out('       • Windows: install "Visual Studio Build Tools" with the');
  out('                  "Desktop development with C++" workload.');
  out("       • macOS:   xcode-select --install");
  out("       • Linux:   install build-essential + python3.");
  out("");
  out("    2. Your Node.js is newer than any published better-sqlite3 prebuilt");
  out(`       binary (you are on Node ${process.version}). A Node LTS (20 or 22)`);
  out("       ships prebuilt binaries and avoids the compile entirely.");
  out("");
  out("  Or skip the source build and fetch Electron's prebuilt binary directly");
  out("  (no C++ toolchain needed):");
  out("");
  out("    cd desktop");
  out("    npm install --ignore-scripts");
  out("    node node_modules/electron/install.js");
  out("    npx electron-builder install-app-deps");
  out("");
  out(line);
  out("");
}

module.exports = { betterSqliteBinary, hasBetterSqliteBinary, printNativeDepHelp };
