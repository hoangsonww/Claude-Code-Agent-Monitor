# Automated Version Bumps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic release bump command and a manually dispatched GitHub workflow that prepares a complete, attributed, validated release pull request.

**Architecture:** A pure Node module owns version calculation and allowlisted file mutation. A CLI orchestrator runs existing generators and release checks. A thin GitHub Actions workflow owns branch, commit, milestone, pull request, linked-issue, and required-check dispatch state without duplicating file-editing logic.

**Tech Stack:** Node.js CommonJS, Node test runner, GitHub Actions YAML, GitHub CLI, npm scripts, existing OpenAPI and extension generators.

## Global Constraints

- User-facing bump names are `major`, `intermediate`, and `minor` with mappings `X+1.0.0`, `X.Y+1.0`, and `X.Y.Z+1` respectively.
- Every automation-created release commit ends with `Co-authored-by: hoangsonww <124531104+hoangsonww@users.noreply.github.com>`.
- Root and desktop release surfaces move together. `client`, `mcp`, `monitoring`, and `vscode-extension` package versions remain independent.
- Use targeted release files and structured fields. Never replace the old version repository-wide.
- The workflow opens a pull request and stops. It never merges, force-pushes, creates a tag, or publishes a release.
- Existing master CI remains the only tag and GitHub Release publisher.
- Use the normal checkout. Do not create a Git worktree.
- Do not add README layout, badge, image, or editorial-content assertions.
- Every new or modified JavaScript file carries the required Son Nguyen authorship header.
- Implementation commits in this personal repository carry no AI or tool attribution.

---

### Task 1: Build the deterministic version and mutation engine

**Files:**

- Create: `scripts/lib/release-version.js`
- Create: `server/__tests__/release-version-bump.test.js`

**Interfaces:**

- Produces: `parseVersion(value) -> { major, intermediate, minor }`
- Produces: `nextVersion(currentVersion, bump) -> string`
- Produces: `buildReleasePlan({ root, bump }) -> { bump, currentVersion, nextVersion, branch, milestone, mutations, generatedPaths }`
- Produces: `applyReleasePlan(plan, { dryRun }) -> string[]`
- Produces: `findUnexpectedPreviousVersion({ root, previousVersion, trackedFiles }) -> Array<{ path, line, text }>`
- `mutations` contains `{ path, before, after }` entries fully validated before the first write.

- [ ] **Step 1: Write failing version-mapping tests**

Add tests that require the not-yet-created module and assert:

```js
assert.equal(nextVersion("2.3.0", "major"), "3.0.0");
assert.equal(nextVersion("2.3.0", "intermediate"), "2.4.0");
assert.equal(nextVersion("2.3.0", "minor"), "2.3.1");
assert.throws(() => nextVersion("2.3", "minor"), /X\.Y\.Z/);
assert.throws(() => nextVersion("2.3.0-beta.1", "minor"), /X\.Y\.Z/);
assert.throws(() => nextVersion("2.3.0", "patch"), /major, intermediate, or minor/);
```

- [ ] **Step 2: Run the mapping tests and confirm the expected missing-module failure**

Run:

```bash
node --test server/__tests__/release-version-bump.test.js
```

Expected result: failure because `scripts/lib/release-version.js` does not exist.

- [ ] **Step 3: Implement strict parsing and bump calculation**

Create the module with:

```js
const BUMP_TYPES = Object.freeze(["major", "intermediate", "minor"]);

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value));
  if (!match) throw new Error(`Version must use strict X.Y.Z form: ${value}`);
  return {
    major: Number(match[1]),
    intermediate: Number(match[2]),
    minor: Number(match[3]),
  };
}

function nextVersion(currentVersion, bump) {
  if (!BUMP_TYPES.includes(bump)) {
    throw new Error(`Bump must be major, intermediate, or minor: ${bump}`);
  }
  const current = parseVersion(currentVersion);
  if (bump === "major") return `${current.major + 1}.0.0`;
  if (bump === "intermediate") return `${current.major}.${current.intermediate + 1}.0`;
  return `${current.major}.${current.intermediate}.${current.minor + 1}`;
}
```

- [ ] **Step 4: Verify mapping tests pass**

Run the focused test and confirm all mapping cases pass.

- [ ] **Step 5: Add failing fixture tests for every release surface**

Build a temporary fixture containing minimal versions of:

- root and desktop package and lockfiles
- MCP lockfile with both `packages[".."].version` and an unrelated dependency at the same version
- live OpenAPI source
- Compose and Helm files
- representative Kubernetes label, image, and `newTag` files
- deployment guides and script
- citation metadata
- root and wiki site metadata
- version-sensitive UI snapshot

Assert `buildReleasePlan()` changes every release-owned field to `2.4.0`, preserves independent package manifests and unrelated dependency records, and reports all changed paths. Add separate cases proving missing required literals and mismatched current versions fail before a write.

- [ ] **Step 6: Run fixture tests and confirm they fail because planning is absent**

Expected result: mapping tests pass and planning tests fail with `buildReleasePlan is not a function`.

- [ ] **Step 7: Implement allowlisted planning and atomic write preparation**

Use structured JSON updates for package and lockfile fields. Use a fixed required text-file list for OpenAPI source, Compose, Helm, deployment docs and script, citation metadata, public metadata, and snapshot. Discover YAML files recursively under `deployments/kubernetes/`, but mutate only recognized release patterns.

Validate all required files, JSON fields, and old-version occurrences before returning the plan. Do not write from `buildReleasePlan()`. `applyReleasePlan()` writes the already-validated `after` content only when `dryRun` is false.

- [ ] **Step 8: Add and pass dry-run and previous-version sweep tests**

Assert dry run returns the planned paths without changing fixture bytes. Assert the sweep ignores `package-lock.json`, `mcp/package-lock.json`, and `docs/superpowers/`, allows explicit `pre-v<old>` historical prose, and reports an old version in any other tracked file.

- [ ] **Step 9: Run focused tests and the file-header check**

```bash
node --test server/__tests__/release-version-bump.test.js
npm run check:headers
```

- [ ] **Step 10: Commit the engine**

```bash
git add scripts/lib/release-version.js server/__tests__/release-version-bump.test.js
git -c core.hooksPath=/dev/null commit -m "feat(release): add deterministic version planner"
```

---

### Task 2: Add the release bump CLI and npm command

**Files:**

- Create: `scripts/bump-release.js`
- Modify: `package.json`
- Modify: `server/__tests__/release-version-bump.test.js`

**Interfaces:**

- Consumes: Task 1 release planning and mutation functions.
- Produces: `runReleaseBump({ root, bump, dryRun, json, runCommand, trackedFiles }) -> result`
- Produces npm command: `npm run release:bump -- <major|intermediate|minor> [--dry-run] [--json]`

- [ ] **Step 1: Write failing CLI orchestration tests**

Test an injected `runCommand` recorder and assert normal mode invokes, in order:

```text
node --test server/__tests__/release-version-consistency.test.js
npm run openapi:yaml
npm run extensions:sync
node --test server/__tests__/release-version-consistency.test.js
npm run extensions:validate
node bin/ccam.js version
```

Assert dry-run mode invokes none of these commands and writes no files. Assert `--json` prints exactly one JSON object to standard output and sends progress elsewhere. Assert the root `package.json` exposes `release:bump` as `node scripts/bump-release.js`.

- [ ] **Step 2: Run the focused tests and confirm the missing CLI failure**

Expected result: failure because `scripts/bump-release.js` and the npm script are absent.

- [ ] **Step 3: Implement argument parsing and injected orchestration**

Support one positional bump and the flags `--dry-run` and `--json`. Reject extra positional arguments and unknown flags with exit code 1 and concise usage. Export `parseArgs`, `runReleaseBump`, and `main` for direct tests.

Before a normal mutation, require a clean tracked working tree and run the current-version consistency test. Apply the plan, regenerate OpenAPI and extensions, run post-generation validation, then perform the previous-version sweep over `git ls-files` results.

Return and print:

```js
{
  bump,
  currentVersion,
  nextVersion,
  branch: `chore/release-v${nextVersion}`,
  milestone: `v${nextVersion}`,
  files,
  dryRun,
}
```

- [ ] **Step 4: Add the npm script and verify red becomes green**

Add:

```json
"release:bump": "node scripts/bump-release.js"
```

Run the focused tests and a real dry run:

```bash
node --test server/__tests__/release-version-bump.test.js
npm run release:bump -- intermediate --dry-run --json
```

Expected next version from the current repository: `2.4.0`.

- [ ] **Step 5: Verify dry run leaves the checkout unchanged**

Capture `git status --short` before and after the dry run and assert the tracked-file output is identical.

- [ ] **Step 6: Commit the CLI**

```bash
git add package.json scripts/bump-release.js server/__tests__/release-version-bump.test.js
git -c core.hooksPath=/dev/null commit -m "feat(release): automate version surface updates"
```

---

### Task 3: Add the release pull request workflow

**Files:**

- Create: `.github/workflows/release-bump.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/file-headers.yml`
- Modify: `.github/workflows/cla.yml`
- Create: `server/__tests__/release-workflow.test.js`

**Interfaces:**

- Consumes: `npm run release:bump` and its JSON fields.
- Produces: manual workflow `release-bump.yml` with `bump` and `dry_run` inputs.
- Produces: controlled manual trigger support in `ci.yml`, `file-headers.yml`, and `cla.yml` so token-created release PRs receive every ruleset-required check.

- [ ] **Step 1: Write failing workflow contract tests**

Parse both workflows using `js-yaml` with `JSON_SCHEMA`. Assert:

- `release-bump.yml` exists and exposes `workflow_dispatch`.
- `bump` is a required choice with exactly `major`, `intermediate`, and `minor`.
- `dry_run` is a boolean defaulting to false.
- permissions are `actions: write`, `contents: write`, `issues: write`, and `pull-requests: write`.
- concurrency is non-cancelling.
- the workflow invokes `npm run release:bump` rather than editing versions itself.
- the commit message includes the exact coordinator trailer.
- the workflow contains branch, milestone, PR, linked-issue, saved-state verification, and explicit dispatches for CI, file-header, and CLA checks.
- the workflow fails before GitHub writes when repository-token pull request creation is disabled.
- `ci.yml` exposes `workflow_dispatch` while retaining push and pull request triggers.
- `file-headers.yml` accepts exact base and head SHAs for a manually dispatched diff check.
- `cla.yml` verifies the bot-authored PR, exact coordinator trailer, and signed coordinator record during manual dispatch.

- [ ] **Step 2: Run workflow tests and confirm the missing workflow failure**

```bash
node --test server/__tests__/release-workflow.test.js
```

- [ ] **Step 3: Implement the manual workflow**

Use `actions/checkout` with the repository default branch and full history. Set up Node 24 and run `npm ci`. Resolve the dry-run JSON first. Write the plan to the step summary and exit before all GitHub writes when `dry_run` is true.

For normal mode:

- query all exact-title milestones and fail on closed or duplicate matches
- query open and closed PRs for the exact head branch
- query the remote branch before mutation
- verify reusable branch ancestry, one-commit shape, version, commit title, and coordinator trailer
- run the bump and full validations before committing a new branch
- configure `github-actions[bot]` as author and committer
- create exactly one commit with the coordinator body and trailer
- push without force
- create the PR when absent
- assign and read back the milestone on the PR and linked same-repository issues
- reject cross-repository closing issues before issue mutation
- explicitly dispatch `ci.yml`, `file-headers.yml`, and `cla.yml` for the release branch

- [ ] **Step 4: Add controlled dispatch paths to required-check workflows**

Preserve existing event triggers. Add manual inputs for CI, exact file-header base/head SHAs, and release-automation CLA verification without changing default-branch release conditions, so a manual branch run cannot publish a tag or release.

- [ ] **Step 5: Run workflow contract and focused release tests**

```bash
node --test server/__tests__/release-workflow.test.js
node --test server/__tests__/release-version-bump.test.js
node --test server/__tests__/release-version-consistency.test.js
```

- [ ] **Step 6: Commit workflow automation**

```bash
git add .github/workflows/release-bump.yml .github/workflows/ci.yml .github/workflows/file-headers.yml .github/workflows/cla.yml server/__tests__/release-workflow.test.js
git -c core.hooksPath=/dev/null commit -m "feat(release): open coordinated bump pull requests"
```

---

### Task 4: Document the automated release path and update release skills

**Files:**

- Modify: `scripts/README.md`
- Modify: `.github/workflows/README.md`
- Modify: `.github/CONTRIBUTING.md`
- Modify: `.claude/skills/version-release/SKILL.md`
- Modify: `.claude/skills/version-release/references/version-checklist.md`
- Modify: `.agents/skills/version-release/SKILL.md`
- Modify: `.agents/skills/version-release/references/version-checklist.md`

**Interfaces:**

- Documents the exact local commands, workflow inputs, bump-name mapping, coordinator trailer, PR boundary, milestone behavior, CI dispatch, and master release behavior.

- [ ] **Step 1: Update maintainer documentation**

Add a Release section explaining:

```text
npm run release:bump -- major
npm run release:bump -- intermediate
npm run release:bump -- minor
npm run release:bump -- intermediate --dry-run --json
```

Document the manual workflow and state clearly that it opens a PR but does not merge or tag.

- [ ] **Step 2: Update both version-release skill copies and checklists**

Keep their automation instructions semantically identical. Preserve the standard SemVer guidance for classifying ordinary changes, then state that the automation input names use `intermediate` for the middle component and `minor` for the last component by explicit repository convention.

- [ ] **Step 3: Validate extension documentation and formatting**

```bash
npm run extensions:validate
npx prettier --check scripts/README.md .github/workflows/README.md .github/CONTRIBUTING.md .claude/skills/version-release .agents/skills/version-release
```

- [ ] **Step 4: Commit documentation**

```bash
git add scripts/README.md .github/workflows/README.md .github/CONTRIBUTING.md .claude/skills/version-release .agents/skills/version-release
git -c core.hooksPath=/dev/null commit -m "docs(release): document automated bump workflow"
```

---

### Task 5: Run release and repository verification

**Files:**

- Verify all files changed in Tasks 1 through 4.
- Keep unrelated untracked `docs/superpowers/` files unstaged.

- [ ] **Step 1: Run focused release checks**

```bash
node --test server/__tests__/release-version-bump.test.js
node --test server/__tests__/release-workflow.test.js
node --test server/__tests__/release-version-consistency.test.js
npm run release:bump -- intermediate --dry-run --json
```

- [ ] **Step 2: Run generated-extension and deployment validation**

```bash
npm run extensions:validate
npm run deploy:validate
node bin/ccam.js version
```

- [ ] **Step 3: Run the full local gate**

```bash
npm run verify
```

Expected result: headers, formatting, typecheck, server tests, and all 495 client tests pass.

- [ ] **Step 4: Confirm dry run did not alter release surfaces**

Run `git status --short` and verify only the intentional implementation commits and the pre-existing unrelated untracked planning files remain.

- [ ] **Step 5: Inspect commit attribution and branch diff**

Confirm no implementation commit contains AI or tool attribution. Confirm the workflow source contains the required `hoangsonww` coordinator trailer for future automated release commits.

- [ ] **Step 6: Request remote-write approval**

State the exact target branch `feat/automated-version-bumps`, the commits to push, and the intended PR target `master`. Wait for explicit approval immediately before pushing or opening the PR.

- [ ] **Step 7: Push and open the pull request after approval**

Push the existing branch without force, open one PR against `master`, and verify the remote head SHA, PR state, labels, review gates, and CI checks with fresh GitHub reads. Do not merge it.
