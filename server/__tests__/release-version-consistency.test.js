/**
 * @file Guards release metadata that must carry the root package version.
 * The checks make version bumps fail fast when packaged artifacts or published
 * API specifications, or deployment configurations drift.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { createOpenApiSpec } = require("../openapi");

const ROOT = path.resolve(__dirname, "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function yamlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return yamlFiles(file);
    return /\.ya?ml$/.test(entry.name) ? [file] : [];
  });
}

describe("release version consistency", () => {
  const packageVersion = readJson("package.json").version;

  it("keeps package metadata and lockfile roots aligned", () => {
    const rootLockfile = readJson("package-lock.json");
    const desktopPackage = readJson("desktop/package.json");
    const desktopLockfile = readJson("desktop/package-lock.json");

    assert.equal(rootLockfile.version, packageVersion);
    assert.equal(rootLockfile.packages[""].version, packageVersion);
    assert.equal(desktopPackage.version, packageVersion);
    assert.equal(desktopLockfile.version, packageVersion);
    assert.equal(desktopLockfile.packages[""].version, packageVersion);
  });

  it("keeps live and generated OpenAPI versions aligned", () => {
    const liveSpec = createOpenApiSpec();
    const generatedSpec = yaml.load(fs.readFileSync(path.join(ROOT, "openapi.yaml"), "utf8"));

    for (const spec of [liveSpec, generatedSpec]) {
      assert.equal(spec.info.version, packageVersion);
      assert.equal(
        spec.components.schemas.HealthResponse.properties.version.example,
        packageVersion
      );
    }
  });

  it("keeps Compose and Helm release metadata aligned", () => {
    const compose = readText("docker-compose.yml");
    const chart = yaml.load(readText("deployments/helm/agent-monitor/Chart.yaml"));

    assert.match(compose, new RegExp(`ccam-dashboard:${packageVersion}`));
    assert.match(compose, new RegExp(`ccam-mcp:${packageVersion}`));
    assert.equal(chart.version, packageVersion);
    assert.equal(chart.appVersion, packageVersion);
  });

  it("keeps Kubernetes release tags, labels, and images aligned", () => {
    const manifests = yamlFiles(path.join(ROOT, "deployments/kubernetes"));
    const versionLabels = [];
    const imageTags = [];
    const releaseTags = [];

    for (const manifest of manifests) {
      const contents = fs.readFileSync(manifest, "utf8");
      versionLabels.push(...contents.matchAll(/app\.kubernetes\.io\/version:\s*["']?([^"'\s]+)/g));
      imageTags.push(...contents.matchAll(/image: ccam-(?:dashboard|mcp):([^\s]+)/g));
      releaseTags.push(...contents.matchAll(/newTag:\s*["']?([^"'\s]+)/g));
    }

    assert.ok(versionLabels.length > 0, "Kubernetes manifests must declare release labels");
    assert.ok(imageTags.length > 0, "Kubernetes manifests must declare release images");
    assert.ok(releaseTags.length > 0, "Kustomize manifests must declare release tags");
    for (const [, version] of [...versionLabels, ...imageTags, ...releaseTags]) {
      assert.equal(version, packageVersion);
    }
  });

  it("keeps deployment image substitutions and examples aligned", () => {
    const image = `ccam-dashboard:${packageVersion}`;

    for (const guide of ["DEPLOYMENT.md", "docs/DEPLOYMENT.md", "deployments/scripts/deploy.sh"]) {
      assert.ok(readText(guide).includes(image), `${guide} must use ${image}`);
    }
    assert.match(readText("deployments/scripts/deploy.sh"), new RegExp(`--tag ${packageVersion}`));
  });
});
