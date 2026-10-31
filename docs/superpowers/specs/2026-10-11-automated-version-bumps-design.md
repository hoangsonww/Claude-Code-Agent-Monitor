# Automated Version Bumps Design

## Outcome

CCAM will provide one deterministic version-bump command and one manually dispatched GitHub Actions workflow. A maintainer selects `major`, `intermediate`, or `minor`. The automation calculates the next release, updates every root-release surface, regenerates derived artifacts, validates the result, creates one coordinated commit, creates or reuses the matching milestone, opens a release pull request, and dispatches CI for that branch.

The workflow stops at an open pull request. A maintainer reviews and merges it. Existing CI on `master` remains responsible for creating the `vX.Y.Z` tag and publishing the GitHub Release with desktop artifacts.

## Version terminology

The automation exposes the names requested for this repository:

- `major` increments the first number and resets the others. `2.3.0` becomes `3.0.0`.
- `intermediate` increments the middle number and resets the last. `2.3.0` becomes `2.4.0`.
- `minor` increments the last number. `2.3.0` becomes `2.3.1`.

The implementation documents that `intermediate` corresponds to the standard Semantic Versioning minor position and `minor` corresponds to the standard patch position. User-facing workflow and command inputs keep the requested names.

Only strict three-component numeric versions are accepted. Prerelease identifiers, build metadata, missing components, negative values, and non-numeric components are rejected.

## Architecture

The implementation has three bounded parts:

1. `scripts/lib/release-version.js` contains version parsing, next-version calculation, targeted file planning, exact replacement validation, and structured JSON updates. It accepts a repository root so its behavior can be exercised against temporary fixtures without changing the working checkout.
2. `scripts/bump-release.js` is the command-line orchestrator. It exposes the npm command, invokes the mutation engine, runs existing generators, runs release validation, performs the previous-version sweep, and prints a stable JSON result for GitHub Actions.
3. `.github/workflows/release-bump.yml` handles GitHub state. It validates dispatch inputs, prevents concurrent bumps, detects existing branches and pull requests, invokes the command, commits once, creates or reuses the milestone, opens or repairs the release pull request, assigns milestone state, and dispatches the normal CI workflow.

File mutation and GitHub mutation remain separate. The release command can be run and tested locally without GitHub credentials. The workflow does not duplicate version-editing logic.

## Command interface

The root package exposes:

```text
npm run release:bump -- major
npm run release:bump -- intermediate
npm run release:bump -- minor
npm run release:bump -- intermediate --dry-run
npm run release:bump -- intermediate --json
```

Normal mode updates the checkout. `--dry-run` calculates and validates the plan without writing files or running generators. `--json` emits a final machine-readable object containing:

- requested bump name
- current version
- next version
- release branch name
- milestone title
- planned or changed file paths
- dry-run status

Human-readable progress goes to standard error when `--json` is active so standard output remains valid JSON.

## Release surfaces

The mutation engine uses explicit structured fields and allowlisted patterns. It never replaces the old version across the entire repository.

It updates:

- root `package.json` and root lockfile version fields
- desktop package and lockfile version fields
- the root-package entry recorded in `mcp/package-lock.json`
- live OpenAPI version examples in `server/openapi.js`
- generated `openapi.yaml` through the existing generator
- dashboard and MCP image tags in `docker-compose.yml`
- Helm chart `version` and `appVersion`
- Kubernetes release labels, CCAM image tags, and Kustomize `newTag` values under `deployments/kubernetes/`
- deployment examples and image substitutions in `DEPLOYMENT.md`, `docs/DEPLOYMENT.md`, and `deployments/scripts/deploy.sh`
- `CITATION.cff`
- `softwareVersion` metadata in `index.html` and `wiki/index.html`
- the Settings UI version snapshot
- Claude and Codex plugin manifests plus both marketplace catalogs through `npm run extensions:sync`

The independently shipped `client`, `mcp`, `monitoring`, and `vscode-extension` package versions remain unchanged. Their dependency lockfiles may contain unrelated packages whose versions happen to equal the previous CCAM release. The updater changes only the root-link fields defined by the release contract.

Before any file is written, every required field and pattern is validated against the current root version. Missing targets, ambiguous targets, malformed files, or targets already carrying another version stop the command with a path-specific error.

## Previous-version sweep

After generation, the command scans tracked files for the previous root version. Remaining matches fail the bump unless they are in a narrow allowlist:

- dependency records inside package lockfiles, whose release-owned root fields are covered by the positive consistency contract
- explicit historical prose such as `pre-v<previous-version>`

The normal release consistency test remains the authoritative positive contract for current-version surfaces. The sweep is a negative guard against forgotten old values. A new root-release surface must be added to the consistency test and the updater together.

## GitHub workflow

The workflow is manually dispatched with:

- required choice input `bump`: `major`, `intermediate`, or `minor`
- optional boolean input `dry_run`, default `false`

It always checks out the current default branch and reads the root version there. It uses one non-cancelling concurrency group so version bump runs cannot race.

Normal execution performs this sequence:

1. Resolve the current and next versions with a dry run.
2. Set the release branch to `chore/release-v<next-version>`.
3. Inspect all milestones and same-name branches and pull requests.
4. Reuse one exact open milestone. Create it only when no match exists. Stop on a closed or duplicate match.
5. If the exact release pull request already exists, verify its head and continue the bookkeeping steps without creating another commit or pull request.
6. If the branch exists without a pull request, verify that it contains the expected version commit based on the current default branch before reusing it. Refuse unrelated or stale branch content.
7. On a new bump, install dependencies, apply the release command, run all validation, create one commit, and push the release branch.
8. Create the pull request when absent, assign the exact milestone, and assign every same-repository closing issue to that milestone.
9. Read the pull request and linked issues back to verify the saved milestone state.
10. Explicitly dispatch `.github/workflows/ci.yml`, `.github/workflows/file-headers.yml`, and the release-automation CLA check for the release branch.

`ci.yml`, `file-headers.yml`, and `cla.yml` gain controlled `workflow_dispatch` paths. Explicit dispatch is required because pushes and pull requests created with the repository `GITHUB_TOKEN` do not automatically start another workflow. The manual file-header path checks the supplied base and head SHAs. The manual CLA path verifies the bot-authored release PR, exact coordinator trailer, and existing signed `hoangsonww` record on `cla-signatures`. These runs attach every ruleset-required check to the release branch head.

The workflow uses only the repository `GITHUB_TOKEN` with explicit permissions:

- `actions: write`
- `contents: write`
- `issues: write`
- `pull-requests: write`

No personal access token is required. The repository setting **Allow GitHub Actions to create and approve pull requests** must be enabled because GitHub blocks `GITHUB_TOKEN` pull request creation when it is disabled. The workflow reads this setting before any remote write and fails with setup guidance when it is unavailable. Default workflow permissions remain read-only.

Dry-run execution performs no GitHub writes. It publishes the calculated version, branch, milestone, and file plan to the workflow summary.

## Commit contract

Automation creates at most one commit for a new release bump.

The commit uses:

```text
chore(release): bump version to <version>
```

Its body identifies `@hoangsonww` as release coordinator and ends with exactly:

```text
Co-authored-by: hoangsonww <124531104+hoangsonww@users.noreply.github.com>
```

The Git author and committer are `github-actions[bot]`. Every commit created by this release workflow carries the coordinator trailer. Reruns do not add follow-up commits merely to repair milestone, pull request, or CI state.

## Pull request contract

The generated pull request targets the default branch and includes:

- previous and next versions
- requested bump name and its numeric effect
- the release surface categories updated
- validation commands and results
- the coordinator identity
- a statement that independently versioned subprojects were preserved
- a statement that the tag and GitHub Release are created only after merge by existing CI

The pull request receives the exact `v<version>` milestone. The workflow never merges the pull request and never creates or moves a tag directly.

## Validation

Before committing, the workflow runs:

```text
node --test server/__tests__/release-version-bump.test.js
node --test server/__tests__/release-version-consistency.test.js
npm run extensions:validate
node bin/ccam.js version
npm run deploy:validate
npm run verify
```

The bump command also verifies generated artifacts before returning success. The normal PR CI then repeats repository validation on the committed branch.

Tests cover version mapping, invalid input, targeted mutation, dry-run behavior, independent package preservation, replacement-count failures, previous-version sweep behavior, JSON output, and workflow-facing metadata. They test release behavior, not README layout, badge presence, image selection, or other editorial choices.

## Failure handling and idempotency

- Invalid input fails before writing.
- A dirty checkout fails before writing, except for workflow-controlled new branch state.
- Replacement validation completes before the first write.
- Generator or validation failure leaves no commit or remote branch.
- A branch collision with unrelated content fails without force-pushing.
- An existing exact pull request is reused.
- A branch left by a partially completed run is reused only after its version, parent, commit message, and coordinator trailer are verified.
- Closed or duplicate milestones fail without creating another milestone.
- Cross-repository closing issues fail before issue mutation because milestones are repository-scoped.
- GitHub write results are read back before success is reported.
- The workflow never force-pushes, merges, tags, or publishes a release.

## Documentation

The implementation documents the maintainer command and workflow in:

- `scripts/README.md`
- `.github/workflows/README.md`
- `.github/CONTRIBUTING.md`
- the canonical and mirrored `version-release` skill instructions and checklist

Product README content and images are outside the release automation contract.

## Success criteria

Starting from `2.3.0`, each supported input produces the expected next version and a complete, consistent release diff. A normal workflow run creates one correctly attributed commit, one branch, one open milestone, and one pull request. A dry run creates none. Reruns repair or reuse expected state without duplicates. The pull request receives green CI checks, and merging it leaves existing master CI responsible for the tag and published release.
