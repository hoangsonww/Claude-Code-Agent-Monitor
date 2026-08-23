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
5. Update the deployment surface, which carries the release in many places: `docker-compose.yml` (`ccam-dashboard` and `ccam-mcp` image tags), `deployments/helm/agent-monitor/Chart.yaml` (`version` **and** `appVersion`), every `deployments/kubernetes/**` manifest (`app.kubernetes.io/version` labels, `image:` tags, kustomize `newTag`), and `deployments/scripts/deploy.sh` (the `--tag` example and the `sed` image substitution).
6. Update the version shown in `DEPLOYMENT.md` and `docs/DEPLOYMENT.md` (the `ccam-dashboard:<version>` substitution example) and in `CITATION.cff` (`version:`).
7. Update version-sensitive UI snapshots when the rendered release string changes (the dashboard renders `UI build v<version>`; regenerate with `cd client && npx vitest run -u` and confirm the diff is only the version line).
8. Run `npm run extensions:sync` so every Claude/Codex plugin manifest and marketplace stays on the root release.
9. Update release/version documentation only where the concrete version is intentionally shown.
10. Create or reuse the open GitHub milestone named exactly `v<version>` for the new root version. Query all milestones before creating one. If an exact-title milestone already exists and is closed, stop and verify whether that version has already shipped instead of creating a duplicate.
11. Identify the current open pull request containing the bump and assign it to that milestone. Read `closingIssuesReferences` from the PR and assign every linked closing issue to the same milestone. If the branch has no PR yet, create/reuse the milestone now and treat PR/issue assignment as an incomplete release step until the PR exists.
12. Verify the milestone on the PR and every linked issue with fresh GitHub reads. Do not infer completion from a successful edit command alone.
13. Run `npm run extensions:validate`, relevant tests/builds, and `ccam version` or `node bin/ccam.js version`.
14. Confirm only independently shipped packages remain on their own versions; do not bump `client`, `mcp`, `monitoring`, or VS Code extension packages unless those products are also being released.

## The authoritative surface list

`server/__tests__/release-version-consistency.test.js` is the machine-checkable
contract for a release bump. **Read it first and run it last** — it is more
reliable than this document, because it fails when a surface drifts:

```bash
node --test server/__tests__/release-version-consistency.test.js
```

It asserts root/desktop packages and lockfiles (including `packages[""].version`),
the live and generated OpenAPI versions, Compose and Helm metadata, Kubernetes
labels/images/kustomize tags, every generated plugin manifest, both marketplace
catalogs, the deployment guides and `deploy.sh`, and that the independently
versioned subprojects have *not* been dragged along.

When you add a new file that carries the release version, add an assertion there
in the same change. A surface with no assertion is a surface that will silently
drift — `CITATION.cff` sat at `1.1.0` for many releases for exactly this reason.

Cross-check with a repo-wide sweep for the *previous* version before finishing:

```bash
previous_version="$(git show HEAD:package.json | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).version')"
grep -rFn "$previous_version" --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=.worktrees .
```

`grep -F` matters: the dots in a version are regex wildcards otherwise, so a
plain `grep -r` also matches unrelated strings like `2a0b11`. Reading the
previous value from `HEAD:package.json` keeps the command runnable as-is
mid-bump, before the change is committed.

Expect zero hits outside `package-lock.json` history and deliberate historical
references (for example "pre-v2.0.9 inflation" in the token-repair docs), which
must stay pointing at the release they describe.

### Not release-tied — do not bump

- `sw.js` and `client/public/sw.js` cache names (`landing-v2`, `dashboard-v2`)
  are cache generations, not release versions. `wiki/sw.js` is bumped when wiki
  *content* changes, which is the `update-project-docs` skill's job, not this one.
- `deployments/helm/agent-monitor/values.yaml` uses `tag: ""` and falls back to
  the chart's `appVersion`. Leave it empty.
- `client`, `mcp`, `monitoring`, and `vscode-extension` ship on their own
  versions and are asserted *not* to equal the root release.

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
- Do not leave root, desktop, OpenAPI, snapshots, deployment manifests, or generated plugin versions out of sync.
- Do not blanket find-and-replace the version across the repo: it would pull the independently versioned subprojects along and rewrite deliberate historical references.

## References

- Repository release checklist: `references/version-checklist.md`
