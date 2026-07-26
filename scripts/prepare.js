#!/usr/bin/env node
/**
 * @file prepare.js
 * @description Root `prepare` hook: point this repo's git hooks at `.husky`
 * (`core.hooksPath`), so the pre-commit test gate and commit-msg advisory are
 * active without a husky runtime. Guarded to run ONLY for a genuine top-level
 * `npm install` at this repo's own root — see the INIT_CWD/cwd check below,
 * which exists because `mcp/package.json` depends on this package via
 * `"agent-dashboard": "file:.."`. Any `npm install` scoped to `mcp/` (e.g.
 * `npm run mcp:install`) resolves that self-reference and re-runs THIS
 * package's own `prepare`/`postinstall` lifecycle scripts with their cwd set
 * to wherever the resolved root package physically lives — which, run from
 * inside a linked git worktree, is that worktree's checkout. Because linked
 * worktrees share one `.git/config` (everything except a few worktree-local
 * files), a `git config` write made in that context lands in the SHARED
 * config, not a config scoped to the worktree — corrupting the main
 * checkout's git state from an `mcp/`-only install. Confirmed root cause of
 * two same-day incidents where the main checkout's `core.bare` flipped to
 * `true` and its git operations broke. `INIT_CWD` (where the user actually
 * ran `npm install` from) equals `process.cwd()` (where this script executes)
 * only for a real top-level install; they differ whenever this fires as a
 * nested/transitive `file:` reinstall.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { execSync } = require("child_process");

if (process.env.INIT_CWD !== process.cwd()) {
  console.log(
    "[prepare] running as a nested dependency reinstall (not a top-level `npm install` at this repo's root) — skipping git hooksPath setup."
  );
  process.exit(0);
}

try {
  execSync("git config core.hooksPath .husky", { stdio: "ignore" });
} catch {
  // Not a git checkout (e.g. installed from a published tarball) — harmless.
}
