/**
 * @file Builds a child-process environment with git's per-invocation repository
 * variables removed. Git exports GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE (and
 * friends) to every hook it runs, and hooks pass their environment on to whatever
 * they spawn. In a worktree those values are ABSOLUTE paths to the repository git
 * is mid-operation on, and they take precedence over a subprocess's `cwd` — so a
 * child that runs `git` in some other directory silently operates on the outer
 * repository instead. Scrubbing them makes `cwd` authoritative again.
 *
 * The identity variables (GIT_AUTHOR_*, GIT_COMMITTER_*) are stripped for the
 * same reason: git exports those to hooks as well, so any commit a child makes
 * inherits the outer commit's identity. See issue #323.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Variables that redirect WHICH repository git acts on. Anything pointing git at
 * a specific repository, index, object store, or path prefix belongs here.
 */
const LOCATION_GIT_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_PREFIX",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_INDEX_VERSION",
];

/**
 * Variables that redirect WHOSE identity a commit is recorded under. Git exports
 * these to hooks too, so a child that creates a commit silently inherits the
 * identity of the commit being made — the fingerprint reported in issue #323 was
 * fixture commits whose author and committer disagreed, the committer coming
 * from the test's own `-c user.name` and the author from the inherited
 * GIT_AUTHOR_*. Nothing reached by gitSafeEnv() writes a commit today, so this
 * is defence in depth: it keeps the environment hermetic if a writing command is
 * ever added.
 */
const IDENTITY_GIT_VARS = [
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_AUTHOR_DATE",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  "GIT_COMMITTER_DATE",
];

/**
 * The full set stripped from child environments.
 *
 * Deliberately a denylist, never a blanket `GIT_*` wipe: this module runs
 * `git fetch` over the network, so GIT_SSH_COMMAND, GIT_ASKPASS,
 * GIT_PROXY_COMMAND, GIT_TERMINAL_PROMPT and GIT_CONFIG_GLOBAL must survive or
 * remote access breaks for anyone whose transport depends on them.
 */
const REPO_SCOPED_GIT_VARS = [...LOCATION_GIT_VARS, ...IDENTITY_GIT_VARS];

/**
 * @param {NodeJS.ProcessEnv} [env] source environment (defaults to `process.env`)
 * @returns {NodeJS.ProcessEnv} a copy with every repo-scoped git variable deleted
 */
function gitSafeEnv(env = process.env) {
  const copy = { ...env };
  for (const name of REPO_SCOPED_GIT_VARS) delete copy[name];
  return copy;
}

module.exports = { gitSafeEnv, REPO_SCOPED_GIT_VARS, LOCATION_GIT_VARS, IDENTITY_GIT_VARS };
