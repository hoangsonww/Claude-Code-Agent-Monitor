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

// Both plugin formats a release must keep in lockstep.
const PLUGIN_FORMATS = [".claude-plugin", ".codex-plugin"];

// Every bundled plugin directory, identified by its Claude manifest.
const pluginDirs = fs
  .readdirSync(path.join(ROOT, "plugins"), { withFileTypes: true })
  .filter(
    (e) =>
      e.isDirectory() &&
      fs.existsSync(path.join(ROOT, "plugins", e.name, ".claude-plugin", "plugin.json"))
  )
  .map((e) => e.name);

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

  it("keeps every generated plugin manifest on the root release", () => {
    // `npm run extensions:sync` stamps the root version into both plugin
    // formats. Nothing else re-reads these files, so a bump that skips the
    // sync would leave every manifest advertising the previous release with no
    // other check catching it. Both formats are REQUIRED rather than probed:
    // skipping a missing one would let a release drop a Codex manifest while
    // this test still passed.
    assert.ok(pluginDirs.length > 0, "plugin manifests must exist");
    for (const name of pluginDirs) {
      for (const format of PLUGIN_FORMATS) {
        const manifest = path.join("plugins", name, format, "plugin.json");
        assert.ok(fs.existsSync(path.join(ROOT, manifest)), `${manifest} must exist`);
        assert.equal(
          readJson(manifest).version,
          packageVersion,
          `${manifest} must be ${packageVersion}`
        );
      }
    }
  });

  it("keeps both marketplace catalogs listing every bundled plugin", () => {
    // Catalogs are regenerated by the same sync step; a plugin added without
    // re-running it would ship undiscoverable. Both the Claude and the Codex
    // catalog must carry the exact same plugin set.
    for (const catalogPath of [
      ".claude-plugin/marketplace.json",
      ".agents/plugins/marketplace.json",
    ]) {
      const catalog = readJson(catalogPath);
      const listed = new Set(catalog.plugins.map((p) => p.name));
      assert.equal(
        catalog.plugins.length,
        pluginDirs.length,
        `${catalogPath} must list all ${pluginDirs.length} plugins`
      );
      for (const name of pluginDirs) {
        assert.ok(listed.has(name), `${name} must appear in ${catalogPath}`);
      }
    }
  });

  it("leaves independently versioned subprojects on their own versions", () => {
    // client / mcp / monitoring / vscode-extension ship separately. A blanket
    // find-and-replace during a release bump would silently pull them along.
    for (const project of ["client", "mcp", "monitoring", "vscode-extension"]) {
      const manifest = path.join(project, "package.json");
      if (!fs.existsSync(path.join(ROOT, manifest))) continue;
      assert.notEqual(
        readJson(manifest).version,
        packageVersion,
        `${manifest} is versioned independently and must not track the root release`
      );
    }
  });

  it("keeps deployment image substitutions and examples aligned", () => {
    const image = `ccam-dashboard:${packageVersion}`;

    for (const guide of ["DEPLOYMENT.md", "docs/DEPLOYMENT.md", "deployments/scripts/deploy.sh"]) {
      assert.ok(readText(guide).includes(image), `${guide} must use ${image}`);
    }
    assert.match(readText("deployments/scripts/deploy.sh"), new RegExp(`--tag ${packageVersion}`));
  });

  it("keeps the citation metadata on the shipping release", () => {
    // CITATION.cff drifted to 1.1.0 and stayed there across many releases
    // because nothing asserted it. Anything that carries the release version
    // needs a guard here, or it silently rots.
    // CITATION.cff is YAML, so parse it rather than pattern-matching the line:
    // a regex has to hand-handle "2.0.11", '2.0.11', and bare 2.0.11, and would
    // quietly accept an unterminated quote.
    const citation = yaml.load(readText("CITATION.cff"));

    assert.ok(citation && typeof citation === "object", "CITATION.cff must be valid YAML");
    assert.equal(
      typeof citation.version,
      "string",
      "CITATION.cff must declare a quoted string version"
    );
    assert.equal(citation.version, packageVersion, "CITATION.cff must track the root release");
  });
});
