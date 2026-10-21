/**
 * @file Validates the executable GitHub Actions contract for coordinated
 * release bump pull requests, merged-PR milestone backfill, and explicit
 * branch CI dispatch.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..", "..");

function workflow(relativePath) {
  return yaml.load(fs.readFileSync(path.join(ROOT, relativePath), "utf8"), {
    schema: yaml.JSON_SCHEMA,
  });
}

function runScripts(config) {
  return Object.values(config.jobs || {})
    .flatMap((job) => job.steps || [])
    .map((step) => step.run)
    .filter(Boolean)
    .join("\n");
}

describe("automated release bump workflow", () => {
  it("accepts the requested bump vocabulary and a no-write dry run", () => {
    const config = workflow(".github/workflows/release-bump.yml");
    const inputs = config.on.workflow_dispatch.inputs;

    assert.equal(inputs.bump.required, true);
    assert.equal(inputs.bump.type, "choice");
    assert.deepEqual(inputs.bump.options, ["major", "intermediate", "minor"]);
    assert.equal(inputs.dry_run.type, "boolean");
    assert.equal(inputs.dry_run.default, false);
  });

  it("serializes write runs with the permissions needed for branch, PR, milestone, and CI state", () => {
    const config = workflow(".github/workflows/release-bump.yml");

    assert.deepEqual(config.permissions, {
      actions: "write",
      contents: "write",
      issues: "write",
      "pull-requests": "write",
    });
    assert.equal(config.concurrency["cancel-in-progress"], false);
    assert.match(config.concurrency.group, /release-bump/);
  });

  it("rejects dispatches and reruns not initiated by the repository owner", () => {
    const config = workflow(".github/workflows/release-bump.yml");
    const firstStep = config.jobs.prepare.steps[0];

    assert.equal(firstStep.name, "Authorize repository owner");
    assert.equal(firstStep.env.ACTOR, "${{ github.actor }}");
    assert.equal(firstStep.env.TRIGGERING_ACTOR, "${{ github.triggering_actor }}");
    assert.equal(firstStep.env.OWNER, "${{ github.repository_owner }}");
    assert.match(firstStep.run, /\[ "\$ACTOR" != "\$OWNER" \]/);
    assert.match(firstStep.run, /\[ "\$TRIGGERING_ACTOR" != "\$OWNER" \]/);
    assert.match(firstStep.run, /exit 1/);
  });

  it("uses the release command without querying repository-admin APIs from GITHUB_TOKEN", () => {
    const scripts = runScripts(workflow(".github/workflows/release-bump.yml"));

    assert.match(scripts, /scripts\/bump-release\.js/);
    assert.match(
      scripts,
      /Co-authored-by: hoangsonww <124531104\+hoangsonww@users\.noreply\.github\.com>/
    );
    assert.match(scripts, /milestones\?state=all/);
    assert.doesNotMatch(scripts, /actions\/permissions\/workflow/);
    assert.doesNotMatch(scripts, /can_approve_pull_request_reviews/);
    assert.match(scripts, /closingIssuesReferences/);
    assert.match(scripts, /gh workflow run ci\.yml --ref/);
    assert.match(scripts, /gh workflow run file-headers\.yml --ref/);
    assert.match(scripts, /-f base_sha=/);
    assert.match(scripts, /-f head_sha=/);
    assert.match(scripts, /gh workflow run cla\.yml --ref/);
    assert.match(scripts, /-f pull_request_number=/);
    assert.doesNotMatch(scripts, /git push[^\n]*(?:--force|-f\b)/);
    assert.doesNotMatch(scripts, /gh pr merge|gh release create|git tag/);
  });

  it("assigns generated release PRs to the owner and applies deterministic labels", () => {
    const scripts = runScripts(workflow(".github/workflows/release-bump.yml"));

    assert.match(scripts, /\.github\/scripts\/label-rules\.js/);
    assert.match(scripts, /computeLabels/);
    assert.match(scripts, /reconcile/);
    assert.match(scripts, /--add-assignee "\$OWNER"/);
    assert.match(scripts, /--add-label "\$LABEL"/);
    assert.match(scripts, /--remove-label "\$LABEL"/);
    assert.match(scripts, /EXPECTED_LABELS_JSON/);
    assert.match(scripts, /assignees/);
    assert.match(scripts, /labels/);
  });

  it("reuses a valid one-commit release branch after the default branch advances", () => {
    const config = workflow(".github/workflows/release-bump.yml");
    const reuse = config.jobs.prepare.steps.find(
      (step) => step.name === "Verify reusable release branch"
    );

    assert.ok(reuse);
    assert.match(reuse.run, /RELEASE_BASE="\$\(git rev-parse "\$REMOTE\^"\)"/);
    assert.match(reuse.run, /git merge-base --is-ancestor "\$RELEASE_BASE" "\$DEFAULT_HEAD"/);
    assert.match(reuse.run, /git rev-list --count "\$RELEASE_BASE\.\.\$REMOTE"/);
    assert.match(reuse.run, /git rev-list --count "\$DEFAULT_HEAD\.\.\$REMOTE"/);
    assert.match(reuse.run, /git merge-tree --write-tree "\$DEFAULT_HEAD" "\$REMOTE"/);
    assert.doesNotMatch(reuse.run, /git merge-base --is-ancestor "\$DEFAULT_HEAD" "\$REMOTE"/);
    assert.doesNotMatch(reuse.run, /git rev-parse "\$REMOTE\^"\)" = "\$DEFAULT_HEAD"/);
  });

  it("backfills every unmilestoned merged PR only after milestone creation", () => {
    const config = workflow(".github/workflows/release-bump.yml");
    const steps = config.jobs.prepare.steps;
    const backfill = steps.find(
      (step) => step.name === "Backfill milestone on unmilestoned merged pull requests"
    );
    const milestoneIndex = steps.findIndex(
      (step) => step.name === "Create or reuse release milestone"
    );

    assert.ok(backfill);
    assert.equal(
      steps.find((step) => step.name === "Resolve included pull request boundary"),
      undefined
    );
    assert.ok(
      steps.indexOf(backfill) >
        steps.findIndex((step) => step.name === "Create or reuse release pull request")
    );
    assert.ok(steps.indexOf(backfill) > milestoneIndex);
    assert.equal(backfill.env.DEFAULT_BRANCH, "${{ steps.state.outputs.default_branch }}");
    assert.equal(backfill.env.MILESTONE_NUMBER, "${{ steps.milestone.outputs.number }}");
    assert.match(backfill.run, /gh api --paginate --method GET "repos\/\$REPO\/pulls"/);
    assert.match(backfill.run, /-f state=closed -f base="\$DEFAULT_BRANCH" -F per_page=100/);
    assert.match(backfill.run, /select\(\.merged_at != null and \.milestone == null\) \| \.number/);
    assert.match(backfill.run, /list_unmilestoned > "\$CANDIDATES"/);
    assert.ok(
      backfill.run.indexOf("CURRENT_MILESTONE=") <
        backfill.run.indexOf('gh api --method PATCH "repos/$REPO/issues/$MERGED_PR"')
    );
    assert.match(
      backfill.run,
      /gh api --method PATCH "repos\/\$REPO\/issues\/\$MERGED_PR"[\s\S]*?-F milestone="\$MILESTONE_NUMBER"/
    );
    assert.match(backfill.run, /gh pr view "\$MERGED_PR"[\s\S]*?--json milestone/);
    assert.match(backfill.run, /REMAINING_UNASSIGNED="\$\(list_unmilestoned\)"/);
    assert.match(backfill.run, /Merged pull requests still have no milestone after backfill/);
    assert.doesNotMatch(backfill.run, /git rev-list|commits\/\$SHA\/pulls/);

    const bookkeeping = steps.find((step) => step.name === "Assign and verify release bookkeeping");
    assert.ok(steps.indexOf(bookkeeping) > milestoneIndex);
    assert.equal(bookkeeping.env.MILESTONE_NUMBER, "${{ steps.milestone.outputs.number }}");
    assert.match(
      bookkeeping.run,
      /gh api --method PATCH "repos\/\$REPO\/issues\/\$PR_NUMBER"[\s\S]*?-F milestone="\$MILESTONE_NUMBER"/
    );

    const milestoneAssignmentSteps = steps.filter(
      (step) =>
        typeof step.run === "string" &&
        /(?:-F milestone="\$MILESTONE_NUMBER"|--milestone)/.test(step.run)
    );
    assert.ok(milestoneAssignmentSteps.length > 0);
    assert.ok(milestoneAssignmentSteps.every((step) => steps.indexOf(step) > milestoneIndex));
  });

  it("allows explicit CI dispatch without weakening default-branch release gating", () => {
    const config = workflow(".github/workflows/ci.yml");

    assert.ok(config.on.push);
    assert.ok(config.on.pull_request);
    assert.deepEqual(config.on.workflow_dispatch, {});
    assert.match(config.jobs.release.if, /github\.event_name == 'push'/);
    assert.match(config.jobs.release.if, /refs\/heads\/(?:master|main)/);
  });

  it("provides explicit file-header and CLA checks for token-created release PRs", () => {
    const headers = workflow(".github/workflows/file-headers.yml");
    assert.equal(headers.on.workflow_dispatch.inputs.base_sha.required, true);
    assert.equal(headers.on.workflow_dispatch.inputs.head_sha.required, true);
    const headerScripts = runScripts(headers);
    assert.match(headerScripts, /EVENT_NAME.*workflow_dispatch/);
    assert.match(headerScripts, /GITHUB_SHA.*HEAD_SHA/);
    assert.match(
      headerScripts,
      /if \[ "\$EVENT_NAME" = workflow_dispatch \] && \[ "\$GITHUB_SHA" != "\$HEAD_SHA" \]; then[\s\S]*?exit 1[\s\S]*?fi/
    );

    const cla = workflow(".github/workflows/cla.yml");
    assert.equal(cla.on.workflow_dispatch.inputs.pull_request_number.required, true);
    const automationJob = cla.jobs["release-automation-cla"];
    assert.equal(automationJob.name, "🖋️ Verify CLA signature");
    const scripts = (automationJob.steps || [])
      .map((step) => step.run)
      .filter(Boolean)
      .join("\n");
    assert.match(scripts, /cla-signatures/);
    assert.match(scripts, /signedContributors/);
    assert.match(scripts, /hoangsonww/);
    assert.match(scripts, /Co-authored-by: hoangsonww/);
  });
});
