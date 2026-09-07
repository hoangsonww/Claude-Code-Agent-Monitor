/**
 * @file Builds a child-process environment with git's per-invocation repository
 * variables removed. Git exports GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE (and
 * friends) to every hook it runs, and hooks pass their environment on to whatever
 * they spawn. In a worktree those values are ABSOLUTE paths to the repository git
 * is mid-operation on, and they take precedence over a subprocess's `cwd` — so a
 * child that runs `git` in some other directory silently operates on the outer
 * repository instead. Scrubbing them makes `cwd` authoritative again.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Git environment variables that redirect where git operates. Anything that
 * points git at a specific repository, index, object store, or path prefix
 * belongs here; identity/config variables (GIT_AUTHOR_*, GIT_CONFIG_*) do not,
 * because they do not change which repository is touched.
 */
const REPO_SCOPED_GIT_VARS = [
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
 * @param {NodeJS.ProcessEnv} [env] source environment (defaults to `process.env`)
 * @returns {NodeJS.ProcessEnv} a copy with every repo-scoped git variable deleted
 */
function gitSafeEnv(env = process.env) {
  const copy = { ...env };
  for (const name of REPO_SCOPED_GIT_VARS) delete copy[name];
  return copy;
}

module.exports = { gitSafeEnv, REPO_SCOPED_GIT_VARS };
