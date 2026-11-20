/**
 * @file Correlates a session with the git commits produced in its working
 * directory during its active window. Nothing is persisted: commits are always
 * computed fresh by shelling out to the local `git` binary (scoped to the
 * session's `cwd`), so the view can never drift from the real repository state.
 *
 * The correlation is best-effort by AUTHOR date — a commit counts when its
 * author date falls within `[session.started_at, session.ended_at ?? now]`.
 * That is deliberately a heuristic: a human committing in the same repo during
 * the same window would also appear, and the UI says so rather than presenting
 * attribution as certain.
 *
 * The parsing half (`parseCommitLog`, `withinWindow`, `commitWebUrl`,
 * `shapeStat`) is pure and unit-tested without a real repository; the git calls
 * go through an injectable `run` so orchestration is testable with a fake.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { execFile } = require("child_process");
const { gitSafeEnv } = require("./git-env");

// Bound every git invocation so a pathological repo can never hang a request.
const GIT_TIMEOUT_MS = 10_000;
// Cap the commit list so a long-running session over a busy repo returns a
// reviewable page rather than thousands of rows. One extra is requested so the
// caller can report truncation honestly.
const MAX_COMMITS = 200;
// ASCII unit/record separators: safe inside commit subjects, which can contain
// anything except a NUL and are far more likely to contain tabs or newlines.
const FIELD = "\x1f";
const RECORD = "\x1e";

const LOG_FORMAT = `${RECORD}%H${FIELD}%h${FIELD}%aI${FIELD}%an${FIELD}%ae${FIELD}%s`;

/**
 * Run git with the repo-scoping environment variables stripped. `env:
 * gitSafeEnv()` is load-bearing, not hygiene: if the dashboard was started from
 * a git hook, GIT_DIR / GIT_INDEX_FILE arrive in our environment as absolute
 * paths and OUTRANK `cwd`, so every query would read the wrong repository.
 * See lib/git-env.js and lib/update-check.js (same pattern).
 *
 * @param {string} cwd directory to run git in
 * @param {string[]} args git arguments
 * @param {number} [timeout]
 * @returns {Promise<string>} trimmed stdout
 */
function execGit(cwd, args, timeout = GIT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd,
        timeout,
        maxBuffer: 8_000_000,
        encoding: "utf8",
        windowsHide: true,
        env: gitSafeEnv(),
      },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout).trim());
      }
    );
  });
}

/**
 * True when `dateIso` is within the inclusive window. A missing end means the
 * session is still open, so "now" is the upper bound. Invalid dates never match.
 */
function withinWindow(dateIso, startIso, endIso) {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return false;
  const start = Date.parse(startIso);
  if (!Number.isNaN(start) && t < start) return false;
  const end = endIso ? Date.parse(endIso) : Date.now();
  if (!Number.isNaN(end) && t > end) return false;
  return true;
}

/**
 * Convert a git remote URL to the commit's web URL on GitHub or GitLab. Handles
 * both `git@host:owner/repo.git` (scp-like) and `https://host/owner/repo.git`
 * forms, and GitLab subgroups (owner/group/repo). Returns null for any host we
 * don't recognize, so the UI simply omits the link rather than guessing wrong.
 *
 * @param {string} remoteUrl
 * @param {string} hash full commit sha
 * @returns {string|null}
 */
function commitWebUrl(remoteUrl, hash) {
  if (!remoteUrl || !hash) return null;
  let host = null;
  let pathPart = null;

  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(remoteUrl.trim());
  if (scp) {
    host = scp[1];
    pathPart = scp[2];
  } else {
    let m;
    try {
      const u = new URL(remoteUrl.trim());
      host = u.hostname;
      pathPart = u.pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  }
  if (!host || !pathPart) return null;
  pathPart = pathPart.replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!pathPart) return null;

  const base = `https://${host}/${pathPart}`;
  if (/(^|\.)github\./i.test(host)) return `${base}/commit/${hash}`;
  // GitLab (and self-hosted GitLab) route commits under `/-/commit/`.
  if (/(^|\.)gitlab\./i.test(host)) return `${base}/-/commit/${hash}`;
  return null;
}

/**
 * Parse `git log --numstat` output (formatted with LOG_FORMAT) into commit
 * objects with summed insertions/deletions and a changed-file count. Pure: no
 * git, no I/O. Binary files appear as `-\t-\t<path>` in numstat; they count
 * toward files-changed but contribute 0 to the line totals.
 *
 * @param {string} stdout
 * @returns {Array<{hash,shortHash,authorDate,authorName,authorEmail,subject,filesChanged,insertions,deletions}>}
 */
function parseCommitLog(stdout) {
  if (!stdout) return [];
  const commits = [];
  // Split on the record separator; the first chunk before the first RECORD is
  // empty (the format leads with RECORD), so it is skipped by the guard below.
  for (const chunk of stdout.split(RECORD)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split("\n");
    const header = lines[0];
    const [hash, shortHash, authorDate, authorName, authorEmail, ...subjectParts] =
      header.split(FIELD);
    if (!hash) continue;
    const commit = {
      hash,
      shortHash: shortHash || hash.slice(0, 7),
      authorDate: authorDate || null,
      authorName: authorName || "",
      authorEmail: authorEmail || "",
      // A subject could in theory contain the field separator; rejoin defensively.
      subject: subjectParts.join(FIELD) || "",
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
    };
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const m = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(line);
      if (!m) continue;
      commit.filesChanged += 1;
      if (m[1] !== "-") commit.insertions += Number(m[1]);
      if (m[2] !== "-") commit.deletions += Number(m[2]);
    }
    commits.push(commit);
  }
  return commits;
}

/**
 * Shape `git show --numstat` output for one commit into a per-file stat list.
 * Pure. Used by the optional (collapsed) diff preview.
 *
 * @param {string} stdout
 * @returns {{files: Array<{path,insertions,deletions,binary}>, insertions, deletions}}
 */
function shapeStat(stdout) {
  const files = [];
  let insertions = 0;
  let deletions = 0;
  for (const line of String(stdout || "").split("\n")) {
    const m = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(line);
    if (!m) continue;
    const binary = m[1] === "-" && m[2] === "-";
    const ins = m[1] === "-" ? 0 : Number(m[1]);
    const del = m[2] === "-" ? 0 : Number(m[2]);
    insertions += ins;
    deletions += del;
    files.push({ path: m[3], insertions: ins, deletions: del, binary });
  }
  return { files, insertions, deletions };
}

/**
 * Resolve the git work-tree root that contains `cwd`, or null when `cwd` is not
 * inside a repository (or git is unavailable). Never throws.
 */
async function resolveRepoRoot(cwd, run) {
  if (!cwd) return null;
  try {
    const root = await run(cwd, ["rev-parse", "--show-toplevel"]);
    return root || null;
  } catch {
    return null;
  }
}

/**
 * Pick a remote URL for building commit links. Prefers `origin`, then
 * `upstream`, then the first remote. Returns null when there are no remotes.
 */
async function resolveRemoteUrl(cwd, run) {
  for (const name of ["origin", "upstream"]) {
    try {
      const url = await run(cwd, ["remote", "get-url", name], 10_000);
      if (url) return url;
    } catch {
      // try the next candidate
    }
  }
  try {
    const list = await run(cwd, ["remote"], 10_000);
    const first = list.split(/\r?\n/).find((l) => l.trim());
    if (first) {
      const url = await run(cwd, ["remote", "get-url", first.trim()], 10_000);
      return url || null;
    }
  } catch {
    // no remotes
  }
  return null;
}

/**
 * List the commits correlated with a session. Always resolves (never rejects):
 * a non-repo cwd, a missing git binary, or an empty range all yield
 * `{ repo: false }` or an empty commit list, so the caller can render a clean
 * "no panel" state. Commits are filtered by AUTHOR date in the window; `--since`
 * bounds the walk by commit date (a near-equal proxy) purely to keep the git
 * call cheap on deep histories.
 *
 * @param {{cwd:string, startedAt:string, endedAt?:string|null}} session
 * @param {Function} [run] injectable git runner (defaults to execGit)
 */
async function listSessionCommits({ cwd, startedAt, endedAt }, run = execGit) {
  const root = await resolveRepoRoot(cwd, run);
  if (!root) return { repo: false, root: null, remoteUrl: null, commits: [], truncated: false };

  const args = [
    "log",
    "--no-color",
    "--date=iso-strict",
    `--max-count=${MAX_COMMITS + 1}`,
    `--pretty=format:${LOG_FORMAT}`,
    "--numstat",
  ];
  // `--since` filters by commit date; author date is what we actually window on
  // (in JS below), but commit date is a close proxy and lets git stop walking
  // old history instead of scanning the whole repo.
  if (startedAt) args.push(`--since=${startedAt}`);

  let stdout = "";
  try {
    stdout = await run(cwd, args);
  } catch {
    // A repo with zero commits (`git log` exits non-zero) or any other failure
    // degrades to "repo, but nothing to show".
    return { repo: true, root, remoteUrl: null, commits: [], truncated: false };
  }

  const remoteUrl = await resolveRemoteUrl(cwd, run);
  const all = parseCommitLog(stdout).filter((c) => withinWindow(c.authorDate, startedAt, endedAt));
  const truncated = all.length > MAX_COMMITS;
  const commits = (truncated ? all.slice(0, MAX_COMMITS) : all).map((c) => ({
    ...c,
    url: commitWebUrl(remoteUrl, c.hash),
  }));
  return { repo: true, root, remoteUrl, commits, truncated };
}

/**
 * Per-file stat for a single commit (the collapsed diff preview). Validates the
 * hash shape before shelling out and resolves to null on any failure.
 *
 * @param {{cwd:string, hash:string}} params
 * @param {Function} [run]
 */
async function getCommitStat({ cwd, hash }, run = execGit) {
  if (!cwd || !/^[0-9a-fA-F]{4,64}$/.test(String(hash || ""))) return null;
  const root = await resolveRepoRoot(cwd, run);
  if (!root) return null;
  try {
    const stdout = await run(cwd, ["show", "--no-color", "--numstat", "--format=", String(hash)]);
    return shapeStat(stdout);
  } catch {
    return null;
  }
}

module.exports = {
  listSessionCommits,
  getCommitStat,
  // Exported for unit tests and reuse:
  parseCommitLog,
  shapeStat,
  withinWindow,
  commitWebUrl,
  resolveRepoRoot,
  resolveRemoteUrl,
  MAX_COMMITS,
  FIELD,
  RECORD,
};
