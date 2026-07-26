#!/usr/bin/env node
/**
 * @file postinstall.js
 * @description Root `postinstall` hook: after a bare `npm install` at the repo
 * root, install the React client's dependencies too, so a single root install
 * yields a buildable/runnable tree (the client's fonts and build deps live in
 * `client/package.json`). The step is a safe no-op when the `client/` workspace
 * is absent — production/Docker stages that copy only the root manifest and
 * the published tarball both install without a client checkout, and must not
 * fail here. Skipped entirely under `npm install --ignore-scripts` (run
 * `cd client && npm install` manually then).
 *
 * Also guarded against re-firing as a NESTED install: `mcp/package.json`
 * depends on this package via `"agent-dashboard": "file:.."`, so any
 * `npm install` scoped to `mcp/` (e.g. `npm run mcp:install`) resolves that
 * self-reference and re-runs this script with its cwd set to wherever the
 * resolved root package physically lives — which, run from inside a linked
 * git worktree, is that worktree's checkout, not necessarily the one the user
 * intended. Re-triggering a recursive `client/` install in that context risks
 * cascading into whatever git-touching side effects live in the client's own
 * (much larger) devDependency tree, landing in the shared `.git/config`
 * linked worktrees all point at — confirmed root cause of two same-day
 * incidents where the main checkout's git state got corrupted by an `mcp/`
 * -only install. `INIT_CWD` (where the user actually ran `npm install` from)
 * equals `process.cwd()` (where this script executes) only for a real
 * top-level install; they differ whenever this fires as a nested reinstall.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

if (process.env.INIT_CWD !== process.cwd()) {
  console.log(
    "[postinstall] running as a nested dependency reinstall (not a top-level `npm install` at this repo's root) — skipping client dependency install."
  );
  process.exit(0);
}

const clientDir = path.join(__dirname, "..", "client");
const clientManifest = path.join(clientDir, "package.json");

// No client checkout in this context (Docker server-only stages, packed
// tarball, server-only installs). Nothing to do — succeed quietly so the
// parent install is not broken.
if (!fs.existsSync(clientManifest)) {
  console.log("[postinstall] client/ not present — skipping client dependency install.");
  process.exit(0);
}

console.log("[postinstall] installing client dependencies (client/)...");

// `shell: true` is required on Windows so npm's `.cmd` shim resolves (Node
// rejects spawning `.cmd`/`.bat` directly since 18.20 / CVE-2024-27980); the
// fixed arg list has no shell-significant characters, so this stays safe.
const result = spawnSync("npm", ["install"], {
  cwd: clientDir,
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("[postinstall] failed to launch npm for the client install:", result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
