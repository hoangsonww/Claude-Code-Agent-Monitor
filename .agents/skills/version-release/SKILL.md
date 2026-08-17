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
- Update version-sensitive UI snapshots.
- Run `npm run extensions:sync` to regenerate Claude/Codex plugin manifests and both marketplaces.
- Keep independently shipped client/MCP/monitoring/VS Code package versions unchanged unless explicitly included.
- Create or reuse the exact open GitHub milestone `v<version>` for the new root version. Query all milestones first. If the exact title already exists closed or more than once, stop and resolve that release state instead of creating a duplicate.
- Assign the current open pull request containing the bump to `v<version>`. Read its `closingIssuesReferences` and assign every linked closing issue to the same milestone. If no PR exists yet, leave this step explicitly incomplete until the PR is created.
- Verify the PR and every linked issue report the expected milestone with fresh GitHub reads.
- Run `npm run extensions:validate`, relevant tests/builds, and the CLI version check.
- Never create or move a release tag without explicit user approval.

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
