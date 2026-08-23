---
name: version-release
description: Choose and apply the correct semantic version bump for this repository. Use for every user-visible release, before merge when a change set should ship as patch, minor, or major, and whenever package/plugin/desktop version metadata must stay synchronized.
---

# Version Release Skill

Apply Semantic Versioning across CCAM:

- **Patch** (`X.Y.Z+1`): backward-compatible fixes, docs-only work, dependency/security maintenance, refactors, or small improvements without a substantial new capability.
- **Minor** (`X.Y+1.0`): backward-compatible features or meaningfully larger capabilities such as new workflows, pages, integrations, API fields/routes, or major UX surfaces.
- **Major** (`X+1.0.0`): breaking public behavior, removed or renamed contracts, required migrations, or fundamental product/architecture changes.

Choose the highest applicable category. If the boundary is ambiguous, prefer the higher bump or ask before release. Do not classify from diff size or commit count alone.
An explicit user-requested version takes precedence over automatic classification. Record the override, synchronize that exact version, and do not silently substitute a different patch, minor, or major number.

## Workflow

- Explain the chosen bump from the current root version.
- Update root and desktop package/lockfile versions.
- Update the OpenAPI version example and regenerate `openapi.yaml`.
- Update the deployment surface: `docker-compose.yml` image tags (`ccam-dashboard`, `ccam-mcp`), the Helm chart's `version` and `appVersion`, every `deployments/kubernetes/**` version label, image tag, and kustomize `newTag`, and `deployments/scripts/deploy.sh` (both the `--tag` example and the `sed` substitution).
- Update the release shown in `DEPLOYMENT.md`, `docs/DEPLOYMENT.md`, and `CITATION.cff`.
- Update version-sensitive UI snapshots; the dashboard renders `UI build v<version>`, so regenerate and confirm the diff is only that line.
- Run `npm run extensions:sync` to regenerate Claude/Codex plugin manifests and both marketplaces.
- Keep independently shipped client/MCP/monitoring/VS Code package versions unchanged unless explicitly included.
- Create or reuse the exact open GitHub milestone `v<version>` for the new root version. Query all milestones first. If the exact title already exists closed or more than once, stop and resolve that release state instead of creating a duplicate.
- Assign the current open pull request containing the bump to `v<version>`. Read its `closingIssuesReferences` and assign every linked closing issue to the same milestone. If no PR exists yet, leave this step explicitly incomplete until the PR is created.
- Verify the PR and every linked issue report the expected milestone with fresh GitHub reads.
- Run `npm run extensions:validate`, relevant tests/builds, and the CLI version check.
- Never create or move a release tag without explicit user approval.

## Authoritative surface list

`server/__tests__/release-version-consistency.test.js` is the machine-checkable release contract. Read it before bumping and run it after:

```bash
node --test server/__tests__/release-version-consistency.test.js
```

It covers root/desktop packages and lockfiles, live and generated OpenAPI, Compose and Helm, Kubernetes labels/images/kustomize tags, generated plugin manifests, both marketplaces, the deployment guides and `deploy.sh`, and the negative assertion that independently shipped subprojects were not dragged along.

Any new file carrying the release version needs an assertion added in the same change. An unasserted surface drifts silently — `CITATION.cff` sat at `1.1.0` across many releases for exactly this reason.

Before finishing, sweep for the previous version and expect zero hits outside lockfile history and deliberate historical references such as "pre-v2.0.9":

```bash
previous_version="$(git show HEAD:package.json | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).version')"
grep -rFn "$previous_version" --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=.worktrees .
```

`grep -F` matters: the dots in a version are regex wildcards otherwise, so a
plain `grep -r` also matches unrelated strings like `2a0b11`. Reading the
previous value from `HEAD:package.json` keeps the command runnable as-is
mid-bump, before the change is committed.

Do not bump: `sw.js` / `client/public/sw.js` cache generations (not release-tied; `wiki/sw.js` belongs to the docs skill), the Helm `values.yaml` `tag: ""` which falls back to `appVersion`, or the independently versioned `client`, `mcp`, `monitoring`, and `vscode-extension` packages.

Never blanket find-and-replace the version across the repo: it pulls in the independent subprojects and rewrites historical references.

## GitHub milestone workflow

Run `gh auth status` first. Stop if the active account is not the intended identity for the repository.

```bash
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
version="$(node -p "require('./package.json').version")"
milestone="v${version}"
pr="$(gh pr view --json number --jq .number)"

existing="$(
  gh api "repos/${repo}/milestones?state=all&per_page=100" --paginate \
    --jq ".[] | select(.title == \"${milestone}\") | [.number, .state] | @tsv"
)"
```

- Empty `existing`: create with `gh api --method POST "repos/${repo}/milestones" -f title="${milestone}"`.
- One open match: reuse it.
- Closed or duplicate matches: stop. Do not create another release milestone.
- Assign the PR with `gh pr edit "$pr" --milestone "$milestone"`.
- Read linked issues with `gh pr view "$pr" --json closingIssuesReferences`, then assign each same-repository issue with `gh issue edit <number> --milestone "$milestone"`.
- If a closing issue belongs to another repository, stop and report it. Milestones are repository-scoped, so do not mutate another repository implicitly.
- Verify with `gh pr view "$pr" --json milestone,closingIssuesReferences` and fresh `gh issue view <number> --json milestone` calls.

Milestone creation and assignment are required release bookkeeping for a version bump. They do not authorize creating a Git tag or GitHub Release.

## References

- `references/version-checklist.md`
