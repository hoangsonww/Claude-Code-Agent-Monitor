/**
 * @file Tests the deployment validator's production dependency audit gate.
 * It verifies transient registry failures retry, vulnerability reports fail
 * closed without retry, and successful audit reports pass deterministically.
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

function runAuditScenario(fakeNpmBody, retryBaseSeconds = "0") {
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

  it("fails immediately when the registry returns a real vulnerability report", () => {
    const result = runAuditScenario(`
cat <<'JSON'
{"vulnerabilities":{"js-yaml":{"severity":"high"}},"metadata":{"vulnerabilities":{"total":1}}}
JSON
exit 1
`);
    assert.notEqual(result.status, 0);
    assert.equal(result.attemptCount, 1, "real vulnerabilities must not be retried");
    assert.match(result.stderr, /found 1 vulnerability record/);
    assert.match(result.stderr, /js-yaml/);
  });

  it("fails closed after repeated malformed reports", () => {
    const result = runAuditScenario(`
echo "not-json"
exit 1
`);
    assert.notEqual(result.status, 0);
    assert.equal(result.attemptCount, 3);
    assert.match(result.stderr, /could not retrieve a valid registry report/);
  });
});
