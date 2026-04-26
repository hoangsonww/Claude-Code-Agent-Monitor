/**
 * @file Branch- and fork-aware tests for getUpdatesStatus(). Each scenario
 * builds throw-away git repos in a tmp dir and asserts the payload shape is
 * accurate to the user's situation. skipFetch:true keeps these tests offline.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { getUpdatesStatus } = require("../lib/update-check");

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

function makeBareRemote(parent, name) {
  const repo = path.join(parent, `${name}.git`);
  fs.mkdirSync(repo, { recursive: true });
  // -c init.defaultBranch=master works on every git that supports -c init.*,
  // i.e. far older than --initial-branch.
  execFileSync("git", ["-c", "init.defaultBranch=master", "init", "--bare", repo], {
    stdio: "ignore",
  });
  return repo;
}

function makeWorkingRepo(parent, dir, originUrl) {
  const repo = path.join(parent, dir);
  fs.mkdirSync(repo, { recursive: true });
  execFileSync("git", ["-c", "init.defaultBranch=master", "init", repo], { stdio: "ignore" });
  fs.writeFileSync(path.join(repo, "README.md"), "fixture\n");
  git(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "add", "."]);
  git(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"]);
  git(repo, ["remote", "add", "origin", originUrl]);
  git(repo, ["push", "-u", "origin", "master"]);
  return repo;
}

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "updcheck-"));
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
    const remote = makeBareRemote(tmpDir, "canon1");
    const work = makeWorkingRepo(tmpDir, "work1", remote);

    const result = await getUpdatesStatus(work, { skipFetch: true });

    assert.equal(result.git_repo, true);
    assert.equal(result.canonical_remote, "origin");
    assert.equal(result.remote_ref, "origin/master");
    assert.equal(result.current_branch, "master");
    assert.equal(result.tracking_upstream, "origin/master");
    assert.equal(result.tracks_canonical, true);
    assert.equal(result.situation, "tracking_canonical");
    assert.equal(result.situation_note, null);
    assert.match(result.manual_command, /git pull --ff-only/);
  });
});

describe("getUpdatesStatus — local on a feature branch", () => {
  it("does NOT suggest git pull (would pull feature, not master)", async () => {
    const remote = makeBareRemote(tmpDir, "canon2");
    const work = makeWorkingRepo(tmpDir, "work2", remote);
    git(work, ["checkout", "-b", "feature/foo"]);

    const result = await getUpdatesStatus(work, { skipFetch: true });

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
    const fork = makeBareRemote(tmpDir, "fork3");
    const upstream = makeBareRemote(tmpDir, "upstream3");
    const work = makeWorkingRepo(tmpDir, "work3", fork);
    // Add the canonical remote AFTER the working clone so origin remains the fork.
    git(work, ["remote", "add", "upstream", upstream]);
    git(work, ["push", "upstream", "master"]);

    const result = await getUpdatesStatus(work, { skipFetch: true });

    assert.equal(result.canonical_remote, "upstream");
    assert.equal(result.remote_ref, "upstream/master");
    assert.equal(result.current_branch, "master");
    // Local master still tracks origin/master (the fork), not upstream/master.
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
    const remote = makeBareRemote(tmpDir, "canon4");
    const work = makeWorkingRepo(tmpDir, "work4", remote);
    const sha = git(work, ["rev-parse", "HEAD"]);
    git(work, ["checkout", sha]);

    const result = await getUpdatesStatus(work, { skipFetch: true });

    assert.equal(result.current_branch, null);
    assert.equal(result.situation, "detached_head");
    assert.match(result.manual_command, /git fetch origin/);
    assert.doesNotMatch(result.manual_command, /git pull/);
  });
});

describe("getUpdatesStatus — no remotes configured", () => {
  it("returns a soft no-remotes payload", async () => {
    const repo = path.join(tmpDir, "noremote");
    fs.mkdirSync(repo, { recursive: true });
    execFileSync("git", ["-c", "init.defaultBranch=master", "init", repo], { stdio: "ignore" });
    fs.writeFileSync(path.join(repo, "README.md"), "lonely\n");
    git(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "add", "."]);
    git(repo, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"]);

    const result = await getUpdatesStatus(repo, { skipFetch: true });

    assert.equal(result.git_repo, true);
    assert.equal(result.update_available, false);
    assert.match(result.message, /No git remotes configured/);
  });
});
