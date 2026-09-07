/**
 * @file Branch- and fork-aware tests for getUpdatesStatus(). Each scenario
 * injects a fake git runner that returns canned output for the handful of
 * read-only queries the module makes, so the suite asserts the real
 * branch/fork/detached-HEAD logic without ever spawning git.
 *
 * These tests deliberately create NO git repositories and run NO git commands.
 * They used to build throw-away repos with `git init` + `git commit`, which was
 * unsafe: git exports GIT_DIR / GIT_INDEX_FILE to every hook, hooks pass their
 * environment to whatever they spawn, and those variables outrank a child's
 * `cwd` — so when the pre-commit hook ran this suite inside a worktree, the
 * fixture commits landed in the real repository instead. That produced stray
 * "init" commits, one of which staged the deletion of 200k+ lines. The fake
 * runner removes the failure mode at the source; see server/lib/git-env.js and
 * server/__tests__/no-mutating-git-in-tests.test.js for the other two layers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getUpdatesStatus } = require("../lib/update-check");

/**
 * Builds a fake `execGit`. `responses` maps a joined argv to its stdout; an
 * entry may also be an Error to simulate a failing git command (which is how
 * the module detects a missing ref, a detached HEAD, or no upstream).
 *
 * Unknown argv rejects rather than returning "", so a test can never pass by
 * silently answering a query it did not intend to stub.
 */
function fakeGit(responses) {
  const calls = [];
  const run = async (cwd, args) => {
    const key = args.join(" ");
    calls.push(key);
    if (!(key in responses)) {
      throw new Error(`unstubbed git invocation: git ${key}`);
    }
    const value = responses[key];
    if (value instanceof Error) throw value;
    return value;
  };
  run.calls = calls;
  return run;
}

const FAILS = new Error("git exited non-zero");

/** A repo root that exists on disk with a `.git` entry — created with mkdir, not git. */
let repoRoot;
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "update-check-"));
  repoRoot = path.join(tmpDir, "repo");
  // getUpdatesStatus only checks that `<root>/.git` exists before querying git.
  // A plain directory satisfies that without initializing a repository.
  fs.mkdirSync(path.join(repoRoot, ".git"), { recursive: true });
});

after(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("getUpdatesStatus — local on canonical default branch", () => {
  it("with origin only: tracks_canonical=true, command pulls --ff-only", async () => {
    const execGit = fakeGit({
      remote: "origin",
      "rev-parse --verify origin/master": "ok",
      "symbolic-ref --short HEAD": "master",
      "rev-parse --abbrev-ref --symbolic-full-name @{u}": "origin/master",
      "rev-parse HEAD": "aaaa111",
      "rev-parse origin/master": "bbbb222",
      "rev-list --count HEAD..origin/master": "3",
    });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.git_repo, true);
    assert.equal(result.canonical_remote, "origin");
    assert.equal(result.remote_ref, "origin/master");
    assert.equal(result.current_branch, "master");
    assert.equal(result.tracking_upstream, "origin/master");
    assert.equal(result.tracks_canonical, true);
    assert.equal(result.situation, "tracking_canonical");
    assert.equal(result.situation_note, null);
    assert.match(result.manual_command, /git pull --ff-only/);
    assert.equal(result.commits_behind, 3);
    assert.equal(result.update_available, true);
  });

  it("reports no update when the branch is level with canonical", async () => {
    const execGit = fakeGit({
      remote: "origin",
      "rev-parse --verify origin/master": "ok",
      "symbolic-ref --short HEAD": "master",
      "rev-parse --abbrev-ref --symbolic-full-name @{u}": "origin/master",
      "rev-parse HEAD": "aaaa111",
      "rev-parse origin/master": "aaaa111",
      "rev-list --count HEAD..origin/master": "0",
    });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.commits_behind, 0);
    assert.equal(result.update_available, false);
  });
});

describe("getUpdatesStatus — local on a feature branch", () => {
  it("does NOT suggest git pull (would pull feature, not master)", async () => {
    const execGit = fakeGit({
      remote: "origin",
      "rev-parse --verify origin/master": "ok",
      "symbolic-ref --short HEAD": "feature/foo",
      "rev-parse --abbrev-ref --symbolic-full-name @{u}": FAILS,
      "rev-parse HEAD": "aaaa111",
      "rev-parse origin/master": "bbbb222",
      "rev-list --count HEAD..origin/master": "2",
    });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.current_branch, "feature/foo");
    assert.equal(result.tracks_canonical, false);
    assert.equal(result.situation, "feature_branch");
    assert.ok(result.situation_note, "expected a situation_note for feature branches");
    assert.match(result.manual_command, /git fetch origin/);
    assert.doesNotMatch(
      result.manual_command,
      /git pull/,
      "must not suggest git pull — would pull feature branch, not canonical"
    );
    assert.doesNotMatch(
      result.manual_command,
      /git merge --ff-only/,
      "must not auto-merge canonical into the feature branch"
    );
  });
});

describe("getUpdatesStatus — fork layout (origin = fork, upstream = canonical)", () => {
  it("prefers upstream and emits a fetch+merge command, not git pull", async () => {
    const execGit = fakeGit({
      // Both remotes present; the module prefers "upstream" as canonical.
      remote: "origin\nupstream",
      "rev-parse --verify upstream/master": "ok",
      "symbolic-ref --short HEAD": "master",
      // Local master still tracks origin/master (the fork), not upstream/master.
      "rev-parse --abbrev-ref --symbolic-full-name @{u}": "origin/master",
      "rev-parse HEAD": "aaaa111",
      "rev-parse upstream/master": "bbbb222",
      "rev-list --count HEAD..upstream/master": "5",
    });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.canonical_remote, "upstream");
    assert.equal(result.remote_ref, "upstream/master");
    assert.equal(result.current_branch, "master");
    assert.equal(result.tracking_upstream, "origin/master");
    assert.equal(result.tracks_canonical, false);
    assert.equal(result.situation, "fork_or_diverged_tracking");
    assert.ok(result.situation_note);
    assert.match(result.manual_command, /git fetch upstream/);
    assert.match(result.manual_command, /git merge --ff-only upstream\/master/);
    assert.doesNotMatch(
      result.manual_command,
      /git pull --ff-only(?! upstream)/,
      "plain git pull would pull origin/master (the fork), not canonical"
    );
  });
});

describe("getUpdatesStatus — detached HEAD", () => {
  it("reports detached_head and only suggests fetch", async () => {
    const execGit = fakeGit({
      remote: "origin",
      "rev-parse --verify origin/master": "ok",
      // Detached HEAD: symbolic-ref fails, and there is no tracking upstream.
      "symbolic-ref --short HEAD": FAILS,
      "rev-parse --abbrev-ref --symbolic-full-name @{u}": FAILS,
      "rev-parse HEAD": "aaaa111",
      "rev-parse origin/master": "bbbb222",
      "rev-list --count HEAD..origin/master": "1",
    });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.current_branch, null);
    assert.equal(result.situation, "detached_head");
    assert.match(result.manual_command, /git fetch origin/);
    assert.doesNotMatch(result.manual_command, /git pull/);
  });
});

describe("getUpdatesStatus — no remotes configured", () => {
  it("returns a soft no-remotes payload", async () => {
    const execGit = fakeGit({ remote: "" });

    const result = await getUpdatesStatus(repoRoot, { skipFetch: true, execGit });

    assert.equal(result.git_repo, true);
    assert.equal(result.update_available, false);
    assert.match(result.message, /No git remotes configured/);
  });
});

describe("getUpdatesStatus — not a git clone", () => {
  it("returns the non-repo payload without invoking git at all", async () => {
    const plain = path.join(tmpDir, "plain");
    fs.mkdirSync(plain, { recursive: true });
    const execGit = fakeGit({});

    const result = await getUpdatesStatus(plain, { skipFetch: true, execGit });

    assert.equal(result.git_repo, false);
    assert.equal(result.update_available, false);
    assert.deepEqual(execGit.calls, [], "must not shell out to git for a non-repo");
  });
});

describe("getUpdatesStatus — fetch failure", () => {
  it("surfaces a soft offline payload when the canonical fetch fails", async () => {
    const execGit = fakeGit({
      remote: "origin",
      "fetch origin --prune": FAILS,
    });

    const result = await getUpdatesStatus(repoRoot, { execGit });

    assert.equal(result.git_repo, true);
    assert.equal(result.update_available, false);
    assert.equal(result.canonical_remote, "origin");
    assert.ok(result.fetch_error);
    assert.match(result.message, /Could not reach origin/);
  });
});
