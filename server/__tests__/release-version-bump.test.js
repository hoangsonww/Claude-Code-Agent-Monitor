/**
 * @file Behavioral tests for deterministic release version planning and
 * allowlisted root-release surface updates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  applyReleasePlan,
  buildReleasePlan,
  findUnexpectedPreviousVersion,
  nextVersion,
} = require("../../scripts/lib/release-version");

const ROOT = path.resolve(__dirname, "..", "..");
const BUMP_SCRIPT = path.join(ROOT, "scripts", "bump-release.js");

function write(root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-release-bump-"));
  write(root, "package.json", { name: "agent-dashboard", version: "2.3.0" });
  write(root, "package-lock.json", {
    name: "agent-dashboard",
    version: "2.3.0",
    packages: {
      "": { name: "agent-dashboard", version: "2.3.0" },
      "node_modules/same-number-dependency": { version: "2.3.0" },
    },
  });
  write(root, "desktop/package.json", { name: "desktop", version: "2.3.0" });
  write(root, "desktop/package-lock.json", {
    name: "desktop",
    version: "2.3.0",
    packages: { "": { name: "desktop", version: "2.3.0" } },
  });
  write(root, "mcp/package.json", { name: "mcp", version: "1.0.0" });
  write(root, "mcp/package-lock.json", {
    name: "mcp",
    version: "1.0.0",
    packages: {
      "": { name: "mcp", version: "1.0.0" },
      "..": { name: "agent-dashboard", version: "2.3.0" },
      "node_modules/same-number-dependency": { version: "2.3.0" },
    },
  });
  for (const project of ["client", "monitoring", "vscode-extension"]) {
    write(root, `${project}/package.json`, { name: project, version: "1.0.0" });
  }

  write(root, "server/openapi.js", 'example: "2.3.0",\n');
  write(root, "docker-compose.yml", "image: ccam-dashboard:2.3.0\nsidecar: ccam-mcp:2.3.0\n");
  write(root, "deployments/helm/agent-monitor/Chart.yaml", 'version: 2.3.0\nappVersion: "2.3.0"\n');
  write(
    root,
    "deployments/kubernetes/base/deployment.yaml",
    'app.kubernetes.io/version: "2.3.0"\nimage: ccam-dashboard:2.3.0\n'
  );
  write(
    root,
    "deployments/kubernetes/components/mcp-sidecar/deployment-patch.yaml",
    "image: ccam-mcp:2.3.0\n"
  );
  write(root, "deployments/kubernetes/overlays/production/kustomization.yaml", "newTag: 2.3.0\n");
  write(root, "deployments/scripts/deploy.sh", "--tag 2.3.0\nccam-dashboard:2.3.0\n");
  write(root, "DEPLOYMENT.md", "ccam-dashboard:2.3.0\n");
  write(root, "docs/DEPLOYMENT.md", "ccam-dashboard:2.3.0\n");
  write(root, "CITATION.cff", 'version: "2.3.0"\n');
  write(root, "index.html", '"softwareVersion": "2.3.0"\n');
  write(root, "wiki/index.html", '"softwareVersion": "2.3.0"\n');
  write(
    root,
    "client/src/pages/__tests__/__snapshots__/screens.snapshot.test.tsx.snap",
    "UI build v2.3.0 (rebuild client to match)\n"
  );
  return root;
}

describe("release bump version mapping", () => {
  it("increments the first component for a major bump", () => {
    assert.equal(nextVersion("2.3.0", "major"), "3.0.0");
  });

  it("increments the middle component for an intermediate bump", () => {
    assert.equal(nextVersion("2.3.0", "intermediate"), "2.4.0");
  });

  it("increments the last component for a minor bump", () => {
    assert.equal(nextVersion("2.3.0", "minor"), "2.3.1");
  });

  it("rejects malformed and unsupported versions or bump names", () => {
    assert.throws(() => nextVersion("2.3", "minor"), /strict X\.Y\.Z/);
    assert.throws(() => nextVersion("2.3.0-beta.1", "minor"), /strict X\.Y\.Z/);
    assert.throws(() => nextVersion("02.3.0", "minor"), /strict X\.Y\.Z/);
    assert.throws(() => nextVersion("2.3.0", "patch"), /major, intermediate, or minor/);
  });
});

describe("release surface planning", () => {
  it("updates every root-release surface without changing independent or dependency versions", () => {
    const root = fixture();
    const plan = buildReleasePlan({ root, bump: "intermediate" });

    assert.equal(plan.currentVersion, "2.3.0");
    assert.equal(plan.nextVersion, "2.4.0");
    assert.equal(plan.branch, "chore/release-v2.4.0");
    assert.equal(plan.milestone, "v2.4.0");
    assert.ok(plan.mutations.length >= 17);
    assert.equal(plan.root, root);
    assert.notEqual(plan.root, path.resolve(__dirname, "..", ".."));
    for (const mutation of plan.mutations) {
      assert.ok(
        path.resolve(plan.root, mutation.path).startsWith(`${plan.root}${path.sep}`),
        `mutation escapes fixture: ${mutation.path}`
      );
    }

    const changed = applyReleasePlan(plan, { dryRun: false });
    assert.deepEqual(
      changed,
      plan.mutations.map((mutation) => mutation.path)
    );

    for (const mutation of plan.mutations) {
      assert.equal(read(root, mutation.path), mutation.after, mutation.path);
    }
    assert.equal(JSON.parse(read(root, "client/package.json")).version, "1.0.0");
    assert.equal(JSON.parse(read(root, "mcp/package.json")).version, "1.0.0");
    assert.equal(
      JSON.parse(read(root, "package-lock.json")).packages["node_modules/same-number-dependency"]
        .version,
      "2.3.0"
    );
    assert.equal(
      JSON.parse(read(root, "mcp/package-lock.json")).packages[
        "node_modules/same-number-dependency"
      ].version,
      "2.3.0"
    );
  });

  it("performs a byte-preserving dry run", () => {
    const root = fixture();
    const before = read(root, "docker-compose.yml");
    const plan = buildReleasePlan({ root, bump: "minor" });

    assert.deepEqual(
      applyReleasePlan(plan, { dryRun: true }),
      plan.mutations.map((mutation) => mutation.path)
    );
    assert.equal(read(root, "docker-compose.yml"), before);
  });

  it("fails the complete plan before writing when a required target is missing or stale", () => {
    const missing = fixture();
    write(missing, "CITATION.cff", 'version: "1.0.0"\n');
    assert.throws(
      () => buildReleasePlan({ root: missing, bump: "minor" }),
      /CITATION\.cff.*2\.3\.0/
    );
    assert.equal(JSON.parse(read(missing, "package.json")).version, "2.3.0");

    const stale = fixture();
    const desktop = JSON.parse(read(stale, "desktop/package.json"));
    desktop.version = "2.2.0";
    write(stale, "desktop/package.json", desktop);
    assert.throws(
      () => buildReleasePlan({ root: stale, bump: "minor" }),
      /desktop\/package\.json.*2\.3\.0/
    );
    assert.equal(JSON.parse(read(stale, "package.json")).version, "2.3.0");
  });
});

describe("previous version sweep", () => {
  it("reports forgotten shipping values while allowing dependencies, specs, and pre-version history", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-release-sweep-"));
    write(root, "forgotten.yaml", "image: ccam-dashboard:2.3.0\n");
    write(root, "other-release.yaml", "image: example:12.3.0\n");
    write(root, "package-lock.json", '{"dependency":"2.3.0"}\n');
    write(root, "mcp/package-lock.json", '{"dependency":"2.3.0"}\n');
    write(root, "client/package-lock.json", '{"dependency":"2.3.0"}\n');
    write(root, "vscode-extension/package-lock.json", '{"dependency":"2.3.0"}\n');
    write(root, "server/__tests__/release-version-bump.test.js", 'fixture = "2.3.0";\n');
    write(root, "docs/superpowers/specs/history.md", "2.3.0 design example\n");
    write(root, "docs/HISTORY.md", "pre-v2.3.0 sessions used the old schema\n");

    assert.deepEqual(
      findUnexpectedPreviousVersion({
        root,
        previousVersion: "2.3.0",
        trackedFiles: [
          "forgotten.yaml",
          "other-release.yaml",
          "package-lock.json",
          "mcp/package-lock.json",
          "client/package-lock.json",
          "vscode-extension/package-lock.json",
          "server/__tests__/release-version-bump.test.js",
          "docs/superpowers/specs/history.md",
          "docs/HISTORY.md",
        ],
      }),
      [{ path: "forgotten.yaml", line: 1, text: "image: ccam-dashboard:2.3.0" }]
    );
  });
});

describe("release bump CLI", () => {
  it("prints a machine-readable dry-run plan without changing files", () => {
    const root = fixture();
    const before = read(root, "package.json");
    const result = spawnSync(
      process.execPath,
      [BUMP_SCRIPT, "intermediate", "--dry-run", "--json"],
      { cwd: root, encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      bump: "intermediate",
      currentVersion: "2.3.0",
      nextVersion: "2.4.0",
      branch: "chore/release-v2.4.0",
      milestone: "v2.4.0",
      files: JSON.parse(result.stdout).files,
      dryRun: true,
    });
    assert.ok(JSON.parse(result.stdout).files.includes("package.json"));
    assert.equal(read(root, "package.json"), before);
  });

  it("rejects unknown flags and bump names without changing files", () => {
    const root = fixture();
    const before = read(root, "package.json");
    for (const args of [
      ["patch", "--dry-run"],
      ["minor", "--unknown"],
      ["minor", "extra"],
    ]) {
      const result = spawnSync(process.execPath, [BUMP_SCRIPT, ...args], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(result.status, 1, `${args.join(" ")} unexpectedly succeeded`);
      assert.match(result.stderr, /Usage:|major, intermediate, or minor/);
    }
    assert.equal(read(root, "package.json"), before);
  });

  it("applies the plan and runs every release validation boundary", () => {
    const { runReleaseBump } = require(BUMP_SCRIPT);
    const root = fixture();
    const trackedFiles = [
      "package.json",
      "package-lock.json",
      "desktop/package.json",
      "desktop/package-lock.json",
      "mcp/package.json",
      "mcp/package-lock.json",
      "server/openapi.js",
      "docker-compose.yml",
      "deployments/helm/agent-monitor/Chart.yaml",
      "deployments/kubernetes/base/deployment.yaml",
      "deployments/kubernetes/components/mcp-sidecar/deployment-patch.yaml",
      "deployments/kubernetes/overlays/production/kustomization.yaml",
      "deployments/scripts/deploy.sh",
      "DEPLOYMENT.md",
      "docs/DEPLOYMENT.md",
      "CITATION.cff",
      "index.html",
      "wiki/index.html",
      "client/src/pages/__tests__/__snapshots__/screens.snapshot.test.tsx.snap",
    ];
    const calls = [];
    const runCommand = (command, args) => {
      calls.push([command, ...args].join(" "));
      if (command === "git" && args[0] === "ls-files") {
        return { status: 0, stdout: `${trackedFiles.join("\0")}\0`, stderr: "" };
      }
      if (command === "git" && args[0] === "diff") {
        return { status: 0, stdout: "package.json\nserver/openapi.js\n", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };

    const result = runReleaseBump({
      root,
      bump: "minor",
      dryRun: false,
      runCommand,
      log: () => {},
    });

    assert.equal(result.nextVersion, "2.3.1");
    assert.equal(JSON.parse(read(root, "package.json")).version, "2.3.1");
    assert.deepEqual(calls, [
      "git status --porcelain --untracked-files=no",
      `${process.execPath} --test server/__tests__/release-version-consistency.test.js`,
      "npm run openapi:yaml",
      "npm run extensions:sync",
      `${process.execPath} --test server/__tests__/release-version-consistency.test.js`,
      "npm run extensions:validate",
      `${process.execPath} bin/ccam.js version`,
      "git ls-files -z",
      "git diff --name-only",
    ]);
    assert.deepEqual(result.files, ["package.json", "server/openapi.js"]);
  });

  it("exposes the CLI through the root package scripts", () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts;
    assert.equal(scripts["release:bump"], "node scripts/bump-release.js");
  });
});
