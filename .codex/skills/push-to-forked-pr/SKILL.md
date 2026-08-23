---
name: push-to-forked-pr
description: Push the current working tree directly to a GitHub PR whose head lives on a **fork**, without creating a new branch and without pushing to `origin` (which is usually the upstream). Invoke when the user says things like "push straight to PR #N", "push to the forked PR", "update PR from fork", "push these changes to #N directly", "commit and push to the PR" — *especially* when they emphasise not creating a new branch or not pushing into the upstream repo. Use this **instead of** plain `git push origin` whenever the PR head repo differs from the local `origin` repo.
---

# push-to-forked-pr

The whole point of this skill: **`origin` is usually the upstream, but the PR's head is on someone else's fork.** Pushing to `origin` updates the upstream's branch, not the PR. You have to push to the fork.

GitHub allows this in two situations:

1. You are the **fork owner** — straightforward, you own that branch.
2. You are an **upstream maintainer** and the PR has `maintainerCanModify: true` (the "Allow edits from maintainers" checkbox the PR author leaves on by default). GitHub then lets the upstream's auth push to the fork branch.

If neither holds, abort and tell the user only the fork owner can push.

---

## Procedure

### 1. Read the PR's head metadata

```bash
PR_NUMBER=<N>
gh pr view "$PR_NUMBER" --json state,headRefName,headRefOid,headRepository,headRepositoryOwner,maintainerCanModify,url
```

Capture:

- `state` — bail if not `"OPEN"`.
- `headRepository.nameWithOwner` → the **fork** (e.g. `someone/Repo`).
- `headRepositoryOwner.login` → the fork owner.
- `headRefName` → the branch on the fork (usually matches local).
- `headRefOid` → the PR's current head SHA. Your local HEAD must be a descendant.
- `maintainerCanModify` → must be `true` if you are not the fork owner.

If `headRepository.nameWithOwner` matches the upstream's `nameWithOwner`, this PR is **internal**:

```bash
HEAD_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq .headRefName)
HEAD_REF_OID=$(gh pr view "$PR_NUMBER" --json headRefOid --jq .headRefOid)
git merge-base --is-ancestor "$HEAD_REF_OID" HEAD && echo ok || echo NOT-DESCENDANT   # abort if NOT-DESCENDANT
git push origin "HEAD:${HEAD_BRANCH}"
```

Exit the skill once this push lands — do not continue to the fork-push steps below.

### 2. Confirm you can actually push

```bash
gh auth status                        # who am I?
git remote get-url origin             # fetch URL — confirm origin is the UPSTREAM, not the fork
git remote get-url --push origin      # push URL — can differ from the fetch URL if `pushurl` is configured
```

For the internal-PR path above, compare the **push** URL (not just the fetch URL) against the expected upstream `nameWithOwner` before relying on `git push origin` — a configured `pushurl` can silently redirect the push to a different destination than the fetch URL suggests.

You may push to the fork branch iff the active gh user is:

- the fork owner, **or**
- a writer on the upstream **and** `maintainerCanModify == true`.

Otherwise stop. Tell the user the PR doesn't allow maintainer edits.

### 3. Sanity-check the local branch

```bash
git branch --show-current
git rev-parse HEAD
git merge-base --is-ancestor <headRefOid> HEAD && echo ok || echo NOT-DESCENDANT
```

- If `headRefName` differs from the current local branch, that's fine — you'll push with an explicit refspec `local:headRefName` in step 6.
- If local HEAD is **not** a descendant of `headRefOid`, stop. Either you're on the wrong branch, or someone else has pushed to the PR since you forked from it. Do not force-push without explicit user permission.

### 4. Verify commit author identity before committing

```bash
git config user.email
```

If it is empty, hostname-shaped (`user@host.local`, `*@*.tail*.ts.net`, etc.), or otherwise not a real email tied to a GitHub account, the commit will appear "unverified" on GitHub and won't link to a profile. Override per-commit:

```bash
git -c user.name="<Name>"  -c user.email="<email>"  commit -F /tmp/commit-msg.txt
```

To correct an already-made commit before push:

```bash
git -c user.name="..." -c user.email="..." commit --amend --reset-author -C HEAD --no-edit
```

Prefer the user's documented identity (e.g. from `CLAUDE.md` or earlier in the session) over the local git config when the local config is clearly machine-generated.

### 5. Run the repo's full verification suite — **before** pushing

The user almost always asks for this explicitly. In this repo (see `CLAUDE.md` for the authoritative list):

```bash
npm run format:check                        # tracked files only; local .worktrees/ noise is not yours to fix
npm run test:server                         # backend touched
npm run test:client                         # frontend, wiki i18n, screen snapshots
npm run mcp:typecheck && npm run mcp:build  # mcp/ touched
npm --prefix mcp test                       # mcp unit suite
npm run build                               # production client build
bash .claude/skills/file-headers/scripts/check-headers.sh
```

Per-package extras when those areas are touched:

```bash
npm --prefix desktop run build && npm --prefix desktop test
node scripts/validate-agent-extensions.js
```

Stop on the first red. Report which check failed and **do not push**.

### 6. Stage, commit, push to the fork (not origin)

Exclude session-local noise (`.claude/settings.local.json` is harness state, not work) and never stage blindly:

```bash
git status                          # review exactly what changed
git add <path1> <path2> ...         # stage only the files for this PR's change — never `git add -A`
git status                          # confirm the staged diff matches intent (and excludes .claude/settings.local.json) before committing
```

Commit with a real body (use `-F` for multi-paragraph messages), ending with the `Co-Authored-By` trailer your harness requires — copy it verbatim from the harness instructions rather than from this file, so the model name never goes stale.

Then push to the fork. Add a one-off remote so it's clear in `git remote -v` and the destination URL doesn't end up in the user's shell history:

```bash
FORK_REPO=$(gh pr view "$PR_NUMBER" --json headRepository --jq '.headRepository.nameWithOwner')
HEAD_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName   --jq .headRefName)
LOCAL_BRANCH=$(git branch --show-current)

if [ -z "$LOCAL_BRANCH" ]; then
  echo "Detached HEAD — refusing to push (source ref would be empty and delete ${HEAD_BRANCH} on the fork)." >&2
  exit 1
fi

git remote add "pr${PR_NUMBER}-fork" "https://github.com/${FORK_REPO}.git"
git push "pr${PR_NUMBER}-fork" "HEAD:${HEAD_BRANCH}"    # push HEAD itself, not "$LOCAL_BRANCH" — safe even if the local branch name differs
```

`gh` configures git's credential helper, so HTTPS pushes pick up the right token automatically. Don't rewrite to SSH unless asked.

### 7. Verify the push landed on the PR

```bash
LOCAL_HEAD=$(git rev-parse HEAD)
PR_HEAD=$(gh pr view "$PR_NUMBER" --json headRefOid --jq .headRefOid)
[ "$LOCAL_HEAD" = "$PR_HEAD" ] && echo "PR updated ✓" || echo "MISMATCH — push went somewhere else"
```

Report the new HEAD SHA, the PR URL, and the diff stat back to the user.

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `Permission denied` on push | Authenticated as the wrong user, or `maintainerCanModify: false` and you are not the fork owner | Abort. Only the fork owner can push to the branch. |
| `! [rejected] non-fast-forward` | Someone else pushed to the PR since you started | `git fetch "pr${PR_NUMBER}-fork" "${HEAD_BRANCH}"`, then rebase or merge. **Never** force-push someone else's PR branch without explicit permission. |
| Push succeeds, but PR head SHA doesn't update | You pushed to a branch with a different name on the fork | Re-check `headRefName` and use explicit refspec `LOCAL:HEAD_BRANCH`. |
| Commit shows "unverified" on the PR | Author email isn't tied to a verified GitHub account | Amend with the user's real identity (step 4) and push again (fast-forward, not force). |
| `Could not resolve host` | Network or proxy issue | Surface the error. Don't blanket-retry. |

---

## Hard rules

- **Never push to `origin`** when origin is the upstream and the PR head is a fork. Always verify with `git remote -v` and `gh pr view`.
- **Never create a new branch.** The user pushed because they want *this* PR updated; a new branch defeats that.
- **Never force-push** to a fork PR branch without explicit user permission. The fork owner will lose any commits they had locally.
- **Always run the repo's tests/builds first.** A fork-PR push triggers CI on the fork *and* surfaces on the upstream's PR view — pushing red code is doubly visible.
- **Always exclude `.claude/settings.local.json`** unless the user explicitly says to include it. It's harness session state, not the work.
- **Never stage with `git add -A`.** Stage explicit paths for the requested change so unrelated files or local secrets can't ride along.
