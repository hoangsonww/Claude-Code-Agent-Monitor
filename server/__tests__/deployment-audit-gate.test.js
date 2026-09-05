/**
 * @file Tests the deployment validator's production dependency audit reporting.
 * The audit is advisory: transient registry failures retry, a valid report with
 * advisories is recorded as a finding without failing, malformed reports are
 * reported rather than passing as clean, and only
 * CCAM_DEPLOY_VALIDATE_STRICT=1 turns findings into a non-zero exit.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const VALIDATOR = path.join(ROOT, "deployments", "scripts", "validate-deployment.sh");

function runAuditScenario(fakeNpmBody, retryBaseSeconds = "0", extraEnv = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-audit-gate-"));
  const fakeNpm = path.join(tmp, "npm");
  const fakeSleep = path.join(tmp, "sleep");
  const attempts = path.join(tmp, "attempts");
  const delays = path.join(tmp, "delays");
  fs.writeFileSync(
    fakeNpm,
    `#!/usr/bin/env bash
set -euo pipefail
attempts_file=${JSON.stringify(attempts)}
count=0
[[ -f "$attempts_file" ]] && count="$(cat "$attempts_file")"
count=$((count + 1))
printf '%s' "$count" >"$attempts_file"
${fakeNpmBody}
`
  );
  fs.chmodSync(fakeNpm, 0o755);
  fs.writeFileSync(
    fakeSleep,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$1" >>${JSON.stringify(delays)}
`
  );
  fs.chmodSync(fakeSleep, 0o755);

  const command = `
    source ${JSON.stringify(VALIDATOR)}
    audit_production_dependencies test npm
  `;
  const result = spawnSync("bash", ["-c", command], {
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: `${tmp}:${process.env.PATH}`,
      CCAM_AUDIT_RETRY_BASE_SECONDS: retryBaseSeconds,
      // Pin the reporting mode: these tests run *inside* CI, so inheriting the
      // real GITHUB_ACTIONS would silently move findings from stderr onto
      // stdout as annotations, and GITHUB_STEP_SUMMARY would append to the
      // live job summary. Cases that want Actions mode opt in via extraEnv.
      GITHUB_ACTIONS: "",
      GITHUB_STEP_SUMMARY: "",
      CCAM_DEPLOY_VALIDATE_STRICT: "",
      ...extraEnv,
    },
    encoding: "utf8",
    timeout: 15_000,
  });
  const attemptCount = Number(fs.readFileSync(attempts, "utf8"));
  const retryDelays = fs.existsSync(delays)
    ? fs.readFileSync(delays, "utf8").trim().split("\n").filter(Boolean)
    : [];
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ...result, attemptCount, retryDelays };
}

describe("deployment production dependency audit gate", () => {
  it("passes one valid zero-vulnerability report", () => {
    const result = runAuditScenario(`
cat <<'JSON'
{"metadata":{"vulnerabilities":{"total":0}}}
JSON
exit 0
`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.attemptCount, 1);
    assert.match(result.stdout, /production dependency audit passed/);
  });

  it("accepts valid JSON when npm also prints a warning on stderr", () => {
    const result = runAuditScenario(`
echo "npm warn registry using cached advisory metadata" >&2
cat <<'JSON'
{"metadata":{"vulnerabilities":{"total":0}}}
JSON
exit 0
`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.attemptCount, 1);
    assert.match(result.stdout, /production dependency audit passed/);
  });

  it("retries malformed transport output and then accepts a valid report", () => {
    const result = runAuditScenario(`
if [[ "$count" -lt 3 ]]; then
  echo "registry connection reset" >&2
  exit 1
fi
cat <<'JSON'
{"metadata":{"vulnerabilities":{"total":0}}}
JSON
exit 0
`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.attemptCount, 3);
    assert.match(result.stdout, /transport failure .* retrying/);
    assert.match(result.stdout, /audit retrying after 0s/);
  });

  it("treats a zero-padded retry base as decimal", () => {
    const result = runAuditScenario(
      `
if [[ "$count" -eq 1 ]]; then
  echo "registry connection reset" >&2
  exit 1
fi
cat <<'JSON'
{"metadata":{"vulnerabilities":{"total":0}}}
JSON
exit 0
`,
      "08"
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.attemptCount, 2);
    assert.deepEqual(result.retryDelays, ["8"]);
    assert.match(result.stdout, /audit retrying after 8s/);
  });

  it("reports a real vulnerability report as an advisory finding without failing", () => {
    const result = runAuditScenario(`
cat <<'JSON'
{"vulnerabilities":{"js-yaml":{"name":"js-yaml","severity":"high","via":[{"name":"js-yaml","title":"js-yaml prototype pollution","url":"https://github.com/advisories/GHSA-test","severity":"high"}],"fixAvailable":{"name":"js-yaml","version":"5.0.0","isSemVerMajor":true}}},"metadata":{"vulnerabilities":{"total":1}}}
JSON
exit 1
`);
    assert.equal(result.status, 0, "advisories must never fail the audit");
    assert.equal(result.attemptCount, 1, "a valid report must not be retried");
    // The advisory list goes to stdout inside a group; the finding is a warning.
    assert.match(result.stdout, /js-yaml prototype pollution/);
    assert.match(result.stdout, /semver-major/);
    assert.match(result.stderr, /FINDING \(test dependency audit\)/);
    assert.match(result.stderr, /1 advisory\(ies\) affecting 1 production package\(s\)/);
  });

  it("emits GitHub Actions annotations when running inside Actions", () => {
    const result = runAuditScenario(
      `
cat <<'JSON'
{"vulnerabilities":{"js-yaml":{"name":"js-yaml","severity":"high","via":[{"name":"js-yaml","title":"js-yaml prototype pollution","url":"https://github.com/advisories/GHSA-test","severity":"high"}],"fixAvailable":false}},"metadata":{"vulnerabilities":{"total":1}}}
JSON
exit 1
`,
      "0",
      { GITHUB_ACTIONS: "true" }
    );
    assert.equal(result.status, 0);
    // Warnings, not errors: this job is advisory and must not look like a gate.
    assert.match(result.stdout, /^::warning title=test dependency audit::/m);
    assert.match(result.stdout, /^::group::test dependency advisories/m);
    assert.match(result.stdout, /^::endgroup::$/m);
    assert.doesNotMatch(result.stdout, /^::error/m);
    assert.match(result.stdout, /no fix available/);
  });

  it("reports repeated malformed reports as a finding instead of passing clean", () => {
    const result = runAuditScenario(`
echo "not-json"
exit 1
`);
    assert.equal(result.status, 0, "the audit stays advisory even when it cannot read a report");
    assert.equal(result.attemptCount, 3);
    assert.match(result.stderr, /could not retrieve a valid registry report/);
  });
});

describe("deployment validator exit policy", () => {
  function runFinish(env = {}) {
    const command = `
      source ${JSON.stringify(VALIDATOR)}
      record_finding "example check" "example detail"
      finish
    `;
    return spawnSync("bash", ["-c", command], {
      cwd: ROOT,
      // Same pinning as runAuditScenario: never inherit the ambient CI
      // reporting mode, summary path, or strict flag.
      env: {
        ...process.env,
        GITHUB_ACTIONS: "",
        GITHUB_STEP_SUMMARY: "",
        CCAM_DEPLOY_VALIDATE_STRICT: "",
        ...env,
      },
      encoding: "utf8",
      timeout: 15_000,
    });
  }

  it("exits 0 with findings by default so the pipeline is never halted", () => {
    const result = runFinish();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 advisory finding\(s\) reported; exiting 0/);
  });

  it("exits non-zero with findings only under CCAM_DEPLOY_VALIDATE_STRICT=1", () => {
    const result = runFinish({ CCAM_DEPLOY_VALIDATE_STRICT: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /CCAM_DEPLOY_VALIDATE_STRICT=1 — failing on 1 finding\(s\)/);
  });

  it("records a validator that fails mid-function, not just on its last command", () => {
    // Regression: run_check used to place the subshell in an `if` condition,
    // where bash suspends errexit for the whole context (an explicit `set -e`
    // inside the subshell does not re-arm it). A failing `docker build --check`
    // followed by any successful command was then recorded as passed.
    const command = `
      source ${JSON.stringify(VALIDATOR)}
      probe() { false; echo "unreachable"; true; }
      run_check "probe" probe
      printf 'FINDINGS=%s\n' "$FINDINGS"
    `;
    const result = spawnSync("bash", ["-c", command], {
      cwd: ROOT,
      env: { ...process.env, GITHUB_ACTIONS: "", GITHUB_STEP_SUMMARY: "" },
      encoding: "utf8",
      timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /FINDINGS=1/, "the mid-function failure must be recorded");
    assert.doesNotMatch(result.stdout, /unreachable/, "the subshell must abort at the failure");
    assert.doesNotMatch(result.stdout, /probe: passed/);
  });

  it("writes an advisory markdown table to the GitHub step summary", () => {
    const summary = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "ccam-summary-")),
      "summary.md"
    );
    const result = runFinish({ GITHUB_STEP_SUMMARY: summary, GITHUB_ACTIONS: "true" });
    assert.equal(result.status, 0, result.stderr);
    const written = fs.readFileSync(summary, "utf8");
    assert.match(written, /advisory finding\(s\)/);
    assert.match(written, /\| ⚠️ \| example check \| example detail \|/);
    assert.match(written, /CCAM_DEPLOY_VALIDATE_STRICT=1/);
  });
});
