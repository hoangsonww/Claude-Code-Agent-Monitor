# .github/workflows/

GitHub Actions workflows for this repository.

| Workflow           | Triggers                                   | What it does |
| ------------------ | ------------------------------------------ | ------------ |
| `ci.yml`           | push, pull request, and explicit dispatch  | Format check, server + client tests, cross-OS snapshot store tests, client build, path-change detection, macOS DMG and Windows EXE desktop builds, advisory deployment-stack validation, OCI image supply chain, and default-branch release publishing via `scripts/publish-release.js`. Explicit branch dispatch never publishes. |
| `release-bump.yml` | manual                                     | Accepts `major`, `intermediate`, or `minor`, runs the deterministic bump command and full validation, creates one release-coordinated commit, creates or reuses the milestone, opens the release PR, verifies linked-issue milestones, and dispatches every required check. Dry run performs no GitHub writes. |
| `file-headers.yml` | pull request and explicit dispatch         | Runs `.claude/skills/file-headers/scripts/check-headers-pr.sh` so every touched source file carries the required authorship header. The manual path accepts exact base and head SHAs for token-created release PRs. |
| `triage.yml`       | issues, `pull_request_target`, manual      | Reconciles `size/*`, `area/*`, `type/*`, `priority/*`, and review-signal labels using `.github/scripts/label-rules.js`; assigns authors; adds items to the project board. Hand-applied labels are never removed. |
| `cla.yml`          | issue comments, `pull_request_target`, and explicit dispatch | CLA Assistant signature check for contributors. The manual release path verifies the bot-authored PR, coordinator trailer, and signed `hoangsonww` record. |

## Related files

- `../scripts/label-rules.js` — pure labeling logic, unit-tested by `server/__tests__/label-rules.test.js`. Changes to rules take effect only after they reach `master`, so prove them with the tests first.
- `../ISSUE_TEMPLATE/` and `../PULL_REQUEST_TEMPLATE.md` — forms whose fields feed the triage labels.
- `../CONTRIBUTING.md` — contributor workflow and expectations.

## Reproducing CI locally

```bash
npm run verify               # headers, format, client typecheck, server + client tests
npm run test:snapshots       # snapshot store tests (CI runs them on Linux, macOS, Windows)
npm run build                # client production build
npm run deploy:validate      # deployment stack validation
```

`triage.yml`'s project-board step needs a personal access token secret because `GITHUB_TOKEN` cannot write to Projects v2; see the comment block at the top of the workflow.

## Automated version bumps

Run **Prepare Release Bump** from the Actions tab. The component mapping is:

- `major`: `X.Y.Z` becomes `X+1.0.0`
- `intermediate`: `X.Y.Z` becomes `X.Y+1.0`
- `minor`: `X.Y.Z` becomes `X.Y.Z+1`

The generated commit is authored by `github-actions[bot]` and carries `hoangsonww` as release coordinator through the required coauthor trailer. The workflow uses the repository token, then explicitly dispatches `ci.yml`, `file-headers.yml`, and the release-automation path in `cla.yml` because token-created pull requests do not emit secondary workflow runs.

One repository setting is required: **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**. The workflow checks this setting before any branch, milestone, or pull request write and stops with a direct error when it is disabled. Default workflow permissions may remain read-only because each workflow declares its narrower job permissions explicitly.

The workflow stops with an open pull request. Merging remains a maintainer decision. A successful merge to `master` lets the existing CI release job create the tag and published GitHub Release.
