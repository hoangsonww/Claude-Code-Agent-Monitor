# .github/workflows/

GitHub Actions workflows for this repository.

| Workflow              | Triggers                                 | What it does                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`              | push and pull request (all branches)     | Format check, server + client tests, cross-OS snapshot store tests, client build, path-change detection, macOS DMG and Windows EXE desktop builds, advisory deployment-stack validation, OCI image supply chain, and release publishing via `scripts/publish-release.js`. |
| `reader-counters.yml` | relevant pull requests and master pushes | Read-only worker, cache, scope and transactional event-count regressions on Linux, macOS and Windows with Node 22.22.0 and 24.14.0.                                                                                                                                       |
| `file-headers.yml`    | pull request                             | Runs `.claude/skills/file-headers/scripts/check-headers-pr.sh` so every touched source file carries the required authorship header.                                                                                                                                       |
| `triage.yml`          | issues, `pull_request_target`, manual    | Reconciles `size/*`, `area/*`, `type/*`, `priority/*`, and review-signal labels using `.github/scripts/label-rules.js`; assigns authors; adds items to the project board. Hand-applied labels are never removed.                                                          |
| `cla.yml`             | issue comments, `pull_request_target`    | CLA Assistant signature check for contributors.                                                                                                                                                                                                                           |

## Related files

- `../scripts/label-rules.js` — pure labeling logic, unit-tested by `server/__tests__/label-rules.test.js`. Changes to rules take effect only after they reach `master`, so prove them with the tests first.
- `../ISSUE_TEMPLATE/` and `../PULL_REQUEST_TEMPLATE.md` — forms whose fields feed the triage labels.
- `../CONTRIBUTING.md` — contributor workflow and expectations.

## Reproducing CI locally

`reader-counters.yml` also runs read-only worker lifecycle, snapshot and scope
checks, count-cache invalidation, HTTP reader regressions and transactional event
totals on Linux, macOS and Windows with Node 22.22.0 and 24.14.0. This is a
separate path-filtered regression workflow; it does not publish artifacts or
change the existing required CI/CD check names.

```bash
npm run verify               # headers, format, client typecheck, server + client tests
npm run test:snapshots       # snapshot store tests (CI runs them on Linux, macOS, Windows)
npm run build                # client production build
npm run deploy:validate      # deployment stack validation
```

`triage.yml`'s project-board step needs a personal access token secret because `GITHUB_TOKEN` cannot write to Projects v2; see the comment block at the top of the workflow.
