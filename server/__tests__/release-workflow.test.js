/**
 * @file Validates the executable GitHub Actions contract for coordinated
 * release bump pull requests and explicit branch CI dispatch.
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

  it("uses the release command and preserves the coordinator and PR safety boundaries", () => {
    const scripts = runScripts(workflow(".github/workflows/release-bump.yml"));

    assert.match(scripts, /scripts\/bump-release\.js/);
    assert.match(
      scripts,
      /Co-authored-by: hoangsonww <124531104\+hoangsonww@users\.noreply\.github\.com>/
    );
    assert.match(scripts, /milestones\?state=all/);
    assert.match(scripts, /actions\/permissions\/workflow/);
    assert.match(scripts, /can_approve_pull_request_reviews/);
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
