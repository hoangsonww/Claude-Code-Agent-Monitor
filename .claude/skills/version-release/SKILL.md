---
name: version-release
description: Choose and apply the correct semantic version bump for this repository. Use for every user-visible release, before merge when a change set should ship as patch, minor, or major, and whenever package/plugin/desktop version metadata must stay synchronized.
---

# Version Release

Use Semantic Versioning as the repository-wide release rule:

- **Patch** (`X.Y.Z+1`) for backward-compatible bug fixes, documentation-only changes, dependency/security maintenance, internal refactors, and small user-visible improvements that do not create a substantial new capability.
- **Minor** (`X.Y+1.0`) for backward-compatible feature additions or meaningfully larger product capabilities, including new workflows, pages, integrations, API fields/routes, or major UX surfaces.
- **Major** (`X+1.0.0`) for backward-incompatible behavior, removed/renamed public contracts, required migrations, or fundamental product/architecture changes.

When a change fits more than one category, use the highest applicable bump. When uncertain between adjacent categories, prefer the higher bump or ask the user before releasing. Never infer the bump from commit count, diff size, or elapsed time alone.
When the user explicitly requests a concrete version, that instruction overrides automatic classification. State the override and synchronize the requested version exactly.

## CCAM release workflow

1. Read the current root `package.json` version and summarize why the change is patch, minor, or major.
2. Update the root `package.json` and root lockfile.
3. Mirror the shipping version in `desktop/package.json` and `desktop/package-lock.json`.
4. Update the OpenAPI version example in `server/openapi.js`, then run `npm run openapi:yaml`.
5. Update version-sensitive UI snapshots when the rendered release string changes.
6. Run `npm run extensions:sync` so every Claude/Codex plugin manifest and marketplace stays on the root release.
7. Update release/version documentation only where the concrete version is intentionally shown.
8. Create or reuse the open GitHub milestone named exactly `v<version>` for the new root version. Query all milestones before creating one. If an exact-title milestone already exists and is closed, stop and verify whether that version has already shipped instead of creating a duplicate.
9. Identify the current open pull request containing the bump and assign it to that milestone. Read `closingIssuesReferences` from the PR and assign every linked closing issue to the same milestone. If the branch has no PR yet, create/reuse the milestone now and treat PR/issue assignment as an incomplete release step until the PR exists.
10. Verify the milestone on the PR and every linked issue with fresh GitHub reads. Do not infer completion from a successful edit command alone.
11. Run `npm run extensions:validate`, relevant tests/builds, and `ccam version` or `node bin/ccam.js version`.
12. Confirm only independently shipped packages remain on their own versions; do not bump `client`, `mcp`, `monitoring`, or VS Code extension packages unless those products are also being released.

## GitHub milestone workflow

Use the repository resolved from the current checkout and the intended authenticated GitHub identity. Run `gh auth status` before any mutation and stop if the active account is not the account intended for the repository:

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

- If `existing` is empty, create the milestone with `gh api --method POST "repos/${repo}/milestones" -f title="${milestone}"`.
- If it reports one open milestone, reuse it.
- If it reports more than one match or a closed match, stop and resolve the repository state. Do not create another milestone with the same release title.
- Assign the PR with `gh pr edit "$pr" --milestone "$milestone"`.
- Read linked issues with `gh pr view "$pr" --json closingIssuesReferences`. Assign each same-repository issue with `gh issue edit <number> --milestone "$milestone"`.
- If a closing issue belongs to another repository, stop and report it. Milestones are repository-scoped, so do not silently create or reuse a similarly named milestone in another repository.
- Verify with `gh pr view "$pr" --json milestone,closingIssuesReferences`, then query each linked issue's `milestone`.

## Release guardrails

- Do not hand-edit generated Codex metadata or marketplace files after `extensions:sync`.
- Do not create or move a Git tag unless the user explicitly requested a release/tag operation.
- Creating the matching GitHub milestone and assigning the current PR plus linked closing issues is part of a version bump, not a release/tag operation.
- Do not create duplicate milestones, guess issue relationships from prose when `closingIssuesReferences` is available, or leave linked release work assigned to a different version.
- Do not call a breaking change “minor” merely because compatibility can be restored later.
- Do not leave root, desktop, OpenAPI, snapshots, or generated plugin versions out of sync.

## References

- Repository release checklist: `references/version-checklist.md`
