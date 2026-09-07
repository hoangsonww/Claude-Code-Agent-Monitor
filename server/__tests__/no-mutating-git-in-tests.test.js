/**
 * @file Guard: no test in this repository may spawn `git` as a subprocess.
 *
 * Why this exists. Git exports GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE to
 * every hook it runs, and in a worktree those are ABSOLUTE paths to the
 * repository git is mid-operation on. Hooks pass their environment to whatever
 * they spawn, and those variables OUTRANK a child process's `cwd`. The
 * pre-commit hook runs this suite, so a test that shelled out to `git` inside
 * its own temp fixture actually operated on the real repository: `git add .`
 * from a directory where the repo's files do not exist staged them all as
 * deletions, and `git commit -m init` wrote that to the branch being committed
 * to. Stray "init" commits — one staging the deletion of 200k+ lines — have
 * landed on branches here more than once because of it.
 *
 * It is not only stray commits. The same suite calls `git init --bare` to build
 * a fake remote; with a leaked GIT_DIR that re-initializes the REAL repository
 * and sets `core.bare = true` on it, after which every work-tree command fails
 * with "this operation must be run in a work tree" until the flag is undone.
 * That happened while writing this guard.
 *
 * Three layers close it, and this file is the one that keeps it closed:
 *   1. `.husky/pre-commit` runs each suite with the git variables unset.
 *   2. `server/lib/git-env.js` scrubs them for production git calls.
 *   3. This guard — tests inject a fake git runner instead of spawning one.
 *
 * If a test genuinely needs git behavior, inject a runner (see the `execGit`
 * option on getUpdatesStatus and the `fakeGit` helper in update-check.test.js).
 * Do not "fix" a failure here by loosening the pattern.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const SELF = path.basename(__filename);

// Directories holding test files, server and client alike.
const TEST_DIRS = [
  path.join(ROOT, "server", "__tests__"),
  path.join(ROOT, "client", "tests"),
  path.join(ROOT, "client", "src"),
  path.join(ROOT, "mcp", "src"),
];

const TEST_FILE = /\.(test|spec)\.(js|ts|tsx|mjs|cjs)$/;

// `git` handed to any child_process entry point, in quotes or a template
// literal: execFile("git", …), spawnSync('git', …), execSync(`git rev-parse`).
const GIT_SUBPROCESS =
  /\b(?:execFile|execFileSync|spawn|spawnSync|exec|execSync)\s*\(\s*[`'"]git(?:[`'"]|\s)/;

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (TEST_FILE.test(entry.name) && entry.name !== SELF) out.push(full);
  }
  return out;
}

describe("tests never spawn git", () => {
  const files = TEST_DIRS.flatMap(walk);

  it("finds test files to scan (the guard itself must not silently pass)", () => {
    assert.ok(files.length > 10, `expected to scan many test files, found ${files.length}`);
  });

  it("no test file invokes git as a subprocess", () => {
    const offenders = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (GIT_SUBPROCESS.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    assert.deepEqual(
      offenders,
      [],
      "Tests must not spawn git — a leaked GIT_DIR from the pre-commit hook makes " +
        "fixture commits land in the real repository. Inject a fake git runner instead.\n" +
        offenders.join("\n")
    );
  });
});

describe("production git calls scrub the inherited repository environment", () => {
  it("update-check.js passes env: gitSafeEnv() to execFile", () => {
    const src = fs.readFileSync(path.join(ROOT, "server", "lib", "update-check.js"), "utf8");
    assert.match(
      src,
      /env:\s*gitSafeEnv\(\)/,
      "execGit must pass env: gitSafeEnv() — otherwise an inherited GIT_DIR " +
        "silently redirects update checks at the wrong repository"
    );
  });

  it("gitSafeEnv removes every repo-scoped git variable", () => {
    const { gitSafeEnv, REPO_SCOPED_GIT_VARS } = require("../lib/git-env");
    const polluted = { PATH: "/usr/bin", HOME: "/home/x" };
    for (const name of REPO_SCOPED_GIT_VARS) polluted[name] = "/leaked";

    const clean = gitSafeEnv(polluted);

    for (const name of REPO_SCOPED_GIT_VARS) {
      assert.ok(!(name in clean), `${name} must be removed`);
    }
    assert.equal(clean.PATH, "/usr/bin", "unrelated variables must survive");
    assert.equal(clean.HOME, "/home/x");
    assert.equal(polluted.GIT_DIR, "/leaked", "must not mutate the source environment");
  });

  it("covers the variables git actually exports to hooks", () => {
    const { REPO_SCOPED_GIT_VARS } = require("../lib/git-env");
    // GIT_DIR and GIT_INDEX_FILE are the two git sets on every hook invocation
    // and are the ones that caused the stray commits; the rest are the same
    // class of redirection and are scrubbed alongside them.
    for (const required of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) {
      assert.ok(REPO_SCOPED_GIT_VARS.includes(required), `${required} must be scrubbed`);
    }
  });
});
