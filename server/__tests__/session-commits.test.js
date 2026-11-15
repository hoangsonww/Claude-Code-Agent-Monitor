/**
 * @file Unit tests for session→commit correlation (server/lib/session-commits.js).
 * The parsing and URL helpers are pure and verified directly; the orchestration
 * (`listSessionCommits`, `getCommitStat`) is driven through an INJECTED fake git
 * runner, so no test here ever spawns git — see no-mutating-git-in-tests.test.js
 * for why that guard exists.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  listSessionCommits,
  getCommitStat,
  parseCommitLog,
  shapeStat,
  withinWindow,
  commitWebUrl,
  MAX_COMMITS,
  FIELD,
  RECORD,
} = require("../lib/session-commits");

// Build a chunk of `git log --numstat` output in the module's own format, so the
// parser is tested against exactly what git would emit.
function logEntry({ hash, short, date, name, email, subject, numstat = [] }) {
  const header = [hash, short, date, name, email, subject].join(FIELD);
  return RECORD + header + (numstat.length ? "\n" + numstat.join("\n") : "");
}

describe("session-commits parseCommitLog", () => {
  it("parses a multi-commit log and sums insertions/deletions and file count", () => {
    const stdout = [
      logEntry({
        hash: "a".repeat(40),
        short: "aaaaaaa",
        date: "2026-11-15T10:00:00+00:00",
        name: "Dev",
        email: "dev@example.com",
        subject: "fix: handle empty input",
        numstat: ["12\t3\tserver/db.js", "4\t0\tREADME.md"],
      }),
      logEntry({
        hash: "b".repeat(40),
        short: "bbbbbbb",
        date: "2026-11-15T11:00:00+00:00",
        name: "Dev",
        email: "dev@example.com",
        subject: "docs: note the heuristic",
        numstat: ["1\t1\tdocs/CLI.md"],
      }),
    ].join("");
    const commits = parseCommitLog(stdout);
    assert.equal(commits.length, 2);
    assert.deepEqual(
      { files: commits[0].filesChanged, ins: commits[0].insertions, del: commits[0].deletions },
      { files: 2, ins: 16, del: 3 }
    );
    assert.equal(commits[0].subject, "fix: handle empty input");
    assert.equal(commits[1].filesChanged, 1);
  });

  it("counts binary files (-\\t-) toward files changed but not line totals", () => {
    const stdout = logEntry({
      hash: "c".repeat(40),
      short: "ccccccc",
      date: "2026-11-15T12:00:00+00:00",
      name: "Dev",
      email: "d@e.com",
      subject: "add logo",
      numstat: ["-\t-\tassets/logo.png", "5\t2\tstyle.css"],
    });
    const [commit] = parseCommitLog(stdout);
    assert.equal(commit.filesChanged, 2);
    assert.equal(commit.insertions, 5);
    assert.equal(commit.deletions, 2);
  });

  it("returns [] for empty output and tolerates a commit with no file changes", () => {
    assert.deepEqual(parseCommitLog(""), []);
    const stdout = logEntry({
      hash: "d".repeat(40),
      short: "ddddddd",
      date: "2026-11-15T12:00:00+00:00",
      name: "Dev",
      email: "d@e.com",
      subject: "empty merge",
    });
    const [commit] = parseCommitLog(stdout);
    assert.equal(commit.filesChanged, 0);
    assert.equal(commit.insertions, 0);
  });
});

describe("session-commits withinWindow", () => {
  const start = "2026-11-15T10:00:00.000Z";
  const end = "2026-11-15T12:00:00.000Z";
  it("includes the boundaries and excludes outside", () => {
    assert.equal(withinWindow("2026-11-15T10:00:00Z", start, end), true);
    assert.equal(withinWindow("2026-11-15T11:00:00Z", start, end), true);
    assert.equal(withinWindow("2026-11-15T12:00:00Z", start, end), true);
    assert.equal(withinWindow("2026-11-15T09:59:59Z", start, end), false);
    assert.equal(withinWindow("2026-11-15T12:00:01Z", start, end), false);
  });
  it("treats a missing end as 'now' (open session) and rejects invalid dates", () => {
    assert.equal(withinWindow(new Date().toISOString(), start, null), true);
    assert.equal(withinWindow("not-a-date", start, end), false);
  });
});

describe("session-commits commitWebUrl", () => {
  const hash = "f".repeat(40);
  it("builds GitHub commit URLs from ssh and https remotes", () => {
    assert.equal(
      commitWebUrl("git@github.com:owner/repo.git", hash),
      `https://github.com/owner/repo/commit/${hash}`
    );
    assert.equal(
      commitWebUrl("https://github.com/owner/repo.git", hash),
      `https://github.com/owner/repo/commit/${hash}`
    );
  });
  it("builds GitLab URLs with the /-/commit/ path, including subgroups", () => {
    assert.equal(
      commitWebUrl("git@gitlab.com:group/sub/repo.git", hash),
      `https://gitlab.com/group/sub/repo/-/commit/${hash}`
    );
  });
  it("returns null for unrecognized hosts and junk input", () => {
    assert.equal(commitWebUrl("git@bitbucket.org:o/r.git", hash), null);
    assert.equal(commitWebUrl("", hash), null);
    assert.equal(commitWebUrl("not a url", hash), null);
  });
});

describe("session-commits shapeStat", () => {
  it("builds a per-file stat and sums totals", () => {
    const stat = shapeStat("10\t2\tsrc/a.js\n-\t-\timg.png\n3\t3\tsrc/b.js");
    assert.equal(stat.files.length, 3);
    assert.equal(stat.insertions, 13);
    assert.equal(stat.deletions, 5);
    assert.equal(stat.files[1].binary, true);
  });
});

// A fake git runner: maps the FIRST git arg to canned stdout, and rejects for
// anything not provided (so "not a repo" and "no remote" are expressible).
function fakeGit(responses) {
  return async (_cwd, args) => {
    const key = args[0];
    if (!(key in responses)) throw new Error(`fake git: no response for ${args.join(" ")}`);
    const val = responses[key];
    if (val instanceof Error) throw val;
    return val;
  };
}

describe("session-commits listSessionCommits (injected runner)", () => {
  const session = {
    cwd: "/home/dev/app",
    startedAt: "2026-11-15T10:00:00.000Z",
    endedAt: "2026-11-15T12:00:00.000Z",
  };

  it("returns repo:false when cwd is not inside a git work tree", async () => {
    const run = fakeGit({ "rev-parse": new Error("not a git repository") });
    const res = await listSessionCommits(session, run);
    assert.equal(res.repo, false);
    assert.deepEqual(res.commits, []);
  });

  it("filters commits to the author-date window and attaches web URLs", async () => {
    const log = [
      logEntry({
        hash: "1".repeat(40),
        short: "1111111",
        date: "2026-11-15T11:30:00+00:00", // in window
        name: "Dev",
        email: "d@e.com",
        subject: "in range",
        numstat: ["2\t1\ta.js"],
      }),
      logEntry({
        hash: "2".repeat(40),
        short: "2222222",
        date: "2026-11-15T09:00:00+00:00", // before window → dropped
        name: "Dev",
        email: "d@e.com",
        subject: "too early",
        numstat: ["9\t9\tb.js"],
      }),
    ].join("");
    const run = fakeGit({
      "rev-parse": "/home/dev/app",
      log,
      remote: "git@github.com:owner/repo.git",
    });
    const res = await listSessionCommits(session, run);
    assert.equal(res.repo, true);
    assert.equal(res.commits.length, 1);
    assert.equal(res.commits[0].subject, "in range");
    assert.equal(res.commits[0].url, `https://github.com/owner/repo/commit/${"1".repeat(40)}`);
    assert.equal(res.truncated, false);
  });

  it("reports repo:true with no commits when git log fails (e.g. empty repo)", async () => {
    const run = fakeGit({ "rev-parse": "/home/dev/app", log: new Error("no HEAD") });
    const res = await listSessionCommits(session, run);
    assert.equal(res.repo, true);
    assert.deepEqual(res.commits, []);
  });

  it("flags truncation and caps the list at MAX_COMMITS", async () => {
    const many = [];
    for (let i = 0; i < MAX_COMMITS + 5; i++) {
      many.push(
        logEntry({
          hash: String(i).padStart(40, "0"),
          short: String(i).padStart(7, "0"),
          date: "2026-11-15T11:00:00+00:00",
          name: "Dev",
          email: "d@e.com",
          subject: `c${i}`,
          numstat: ["1\t0\tf.js"],
        })
      );
    }
    const run = fakeGit({
      "rev-parse": "/home/dev/app",
      log: many.join(""),
      remote: new Error("no remote"),
    });
    const res = await listSessionCommits(session, run);
    assert.equal(res.truncated, true);
    assert.equal(res.commits.length, MAX_COMMITS);
    assert.equal(res.commits[0].url, null); // no remote → no link
  });
});

describe("session-commits getCommitStat (injected runner)", () => {
  it("rejects a malformed hash without touching git", async () => {
    let called = false;
    const run = async () => {
      called = true;
      return "";
    };
    const res = await getCommitStat({ cwd: "/x", hash: "nope zzz" }, run);
    assert.equal(res, null);
    assert.equal(called, false);
  });

  it("returns a per-file stat for a valid commit", async () => {
    const run = fakeGit({ "rev-parse": "/x", show: "4\t1\tsrc/a.js" });
    const res = await getCommitStat({ cwd: "/x", hash: "abc1234" }, run);
    assert.equal(res.files.length, 1);
    assert.equal(res.insertions, 4);
  });
});
