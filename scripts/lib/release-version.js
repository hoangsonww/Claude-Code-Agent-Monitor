/**
 * @file Pure release-version parsing and deterministic root-release surface
 * planning helpers used by the local CLI and GitHub release workflow.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");

const BUMP_TYPES = Object.freeze(["major", "intermediate", "minor"]);
const REQUIRED_TEXT_FILES = Object.freeze([
  "server/openapi.js",
  "docker-compose.yml",
  "deployments/helm/agent-monitor/Chart.yaml",
  "deployments/scripts/deploy.sh",
  "DEPLOYMENT.md",
  "docs/DEPLOYMENT.md",
  "CITATION.cff",
  "index.html",
  "wiki/index.html",
  "client/src/pages/__tests__/__snapshots__/screens.snapshot.test.tsx.snap",
]);
const GENERATED_PATHS = Object.freeze([
  "openapi.yaml",
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
  "plugins/*/.claude-plugin/plugin.json",
  "plugins/*/.codex-plugin/plugin.json",
]);
const SWEEP_IGNORED_FILES = new Set(["server/__tests__/release-version-bump.test.js"]);

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

function readRequired(root, relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`${relativePath} is required for a release bump`);
  return fs.readFileSync(file, "utf8");
}

function expectVersion(relativePath, field, actual, currentVersion) {
  if (actual !== currentVersion) {
    throw new Error(
      `${relativePath} ${field} must be the current release ${currentVersion}; found ${actual}`
    );
  }
}

function jsonMutation(root, relativePath, currentVersion, nextRelease, update) {
  const before = readRequired(root, relativePath);
  let value;
  try {
    value = JSON.parse(before);
  } catch (error) {
    throw new Error(`${relativePath} must contain valid JSON: ${error.message}`);
  }
  update(value, (field, actual) => expectVersion(relativePath, field, actual, currentVersion));
  const after = `${JSON.stringify(value, null, 2)}\n`;
  if (before === after) throw new Error(`${relativePath} did not change to ${nextRelease}`);
  return { path: relativePath, before, after };
}

function textMutation(root, relativePath, currentVersion, nextRelease) {
  const before = readRequired(root, relativePath);
  if (!before.includes(currentVersion)) {
    throw new Error(`${relativePath} must contain the current release ${currentVersion}`);
  }
  return {
    path: relativePath,
    before,
    after: before.split(currentVersion).join(nextRelease),
  };
}

function yamlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return yamlFiles(file);
      return /\.ya?ml$/.test(entry.name) ? [file] : [];
    })
    .sort();
}

function kubernetesMutations(root, currentVersion, nextRelease) {
  const directory = path.join(root, "deployments", "kubernetes");
  const counts = { label: 0, image: 0, tag: 0 };
  const patterns = [
    {
      name: "label",
      regex: /(app\.kubernetes\.io\/version:\s*["']?)([^"'\s]+)/g,
    },
    {
      name: "image",
      regex: /(image:\s*ccam-(?:dashboard|mcp):)([^"'\s]+)/g,
    },
    { name: "tag", regex: /(newTag:\s*["']?)([^"'\s]+)/g },
  ];
  const mutations = [];

  for (const file of yamlFiles(directory)) {
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const { name, regex } of patterns) {
      after = after.replace(regex, (match, prefix, version) => {
        if (version !== currentVersion) {
          const relativePath = path.relative(root, file);
          throw new Error(
            `${relativePath} ${name} must be the current release ${currentVersion}; found ${version}`
          );
        }
        counts[name] += 1;
        return `${prefix}${nextRelease}`;
      });
    }
    if (after !== before) {
      mutations.push({ path: path.relative(root, file), before, after });
    }
  }

  for (const [name, count] of Object.entries(counts)) {
    if (count === 0) throw new Error(`deployments/kubernetes must contain a release ${name}`);
  }
  return mutations;
}

function buildReleasePlan({ root, bump }) {
  const repositoryRoot = path.resolve(root);
  const rootPackage = JSON.parse(readRequired(repositoryRoot, "package.json"));
  const currentVersion = rootPackage.version;
  parseVersion(currentVersion);
  const nextRelease = nextVersion(currentVersion, bump);
  const mutations = [];

  mutations.push(
    jsonMutation(repositoryRoot, "package.json", currentVersion, nextRelease, (value, expect) => {
      expect("version", value.version);
      value.version = nextRelease;
    })
  );
  mutations.push(
    jsonMutation(
      repositoryRoot,
      "package-lock.json",
      currentVersion,
      nextRelease,
      (value, expect) => {
        expect("version", value.version);
        expect('packages[""].version', value.packages?.[""]?.version);
        value.version = nextRelease;
        value.packages[""].version = nextRelease;
      }
    )
  );
  mutations.push(
    jsonMutation(
      repositoryRoot,
      "desktop/package.json",
      currentVersion,
      nextRelease,
      (value, expect) => {
        expect("version", value.version);
        value.version = nextRelease;
      }
    )
  );
  mutations.push(
    jsonMutation(
      repositoryRoot,
      "desktop/package-lock.json",
      currentVersion,
      nextRelease,
      (value, expect) => {
        expect("version", value.version);
        expect('packages[""].version', value.packages?.[""]?.version);
        value.version = nextRelease;
        value.packages[""].version = nextRelease;
      }
    )
  );
  mutations.push(
    jsonMutation(
      repositoryRoot,
      "mcp/package-lock.json",
      currentVersion,
      nextRelease,
      (value, expect) => {
        expect('packages[".."].version', value.packages?.[".."]?.version);
        value.packages[".."].version = nextRelease;
      }
    )
  );

  for (const relativePath of REQUIRED_TEXT_FILES) {
    mutations.push(textMutation(repositoryRoot, relativePath, currentVersion, nextRelease));
  }
  mutations.push(...kubernetesMutations(repositoryRoot, currentVersion, nextRelease));

  const paths = new Set();
  for (const mutation of mutations) {
    if (paths.has(mutation.path))
      throw new Error(`Duplicate release mutation for ${mutation.path}`);
    paths.add(mutation.path);
  }

  return {
    root: repositoryRoot,
    bump,
    currentVersion,
    nextVersion: nextRelease,
    branch: `chore/release-v${nextRelease}`,
    milestone: `v${nextRelease}`,
    mutations,
    generatedPaths: [...GENERATED_PATHS],
  };
}

function applyReleasePlan(plan, { dryRun = false } = {}) {
  const paths = plan.mutations.map((mutation) => mutation.path);
  if (dryRun) return paths;
  for (const mutation of plan.mutations) {
    fs.writeFileSync(path.join(plan.root, mutation.path), mutation.after, "utf8");
  }
  return paths;
}

function findUnexpectedPreviousVersion({ root, previousVersion, trackedFiles }) {
  const repositoryRoot = path.resolve(root);
  const historical = `pre-v${previousVersion}`;
  const escapedVersion = previousVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versionPattern = new RegExp(`(^|[^\\d.])${escapedVersion}(?![\\d.])`);
  const findings = [];
  for (const relativePath of trackedFiles) {
    const normalized = relativePath.split(path.sep).join("/");
    if (
      normalized === "package-lock.json" ||
      normalized.endsWith("/package-lock.json") ||
      SWEEP_IGNORED_FILES.has(normalized) ||
      normalized.startsWith("docs/superpowers/")
    ) {
      continue;
    }
    const file = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const contents = fs.readFileSync(file);
    if (contents.includes(0)) continue;
    const lines = contents.toString("utf8").split(/\r?\n/);
    lines.forEach((text, index) => {
      if (versionPattern.test(text.split(historical).join(""))) {
        findings.push({ path: normalized, line: index + 1, text });
      }
    });
  }
  return findings;
}

module.exports = {
  BUMP_TYPES,
  GENERATED_PATHS,
  REQUIRED_TEXT_FILES,
  applyReleasePlan,
  buildReleasePlan,
  findUnexpectedPreviousVersion,
  nextVersion,
  parseVersion,
};
