#!/usr/bin/env node
/**
 * @file Downloads official Prometheus + Grafana OSS binaries into monitoring/.bin/.
 * Supports macOS (arm64/Intel), Linux (arm64/amd64), and Windows (x64).
 * Run via `npm run monitoring:setup` — no Homebrew, apt, or global install needed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  BIN_ROOT,
  DATA_ROOT,
  VERSIONS,
  SUPPORTED_TARGETS,
  prometheusUrl,
  grafanaUrl,
  prometheusArchiveName,
  grafanaArchiveName,
  prometheusArchiveExt,
  grafanaArchiveExt,
  prometheusHome,
  grafanaHome,
  prometheusBinary,
  grafanaBinary,
  prometheusPlatform,
  binariesReady,
} = require("./paths");
const {
  downloadFile,
  extractArchive,
  findExtractedRoot,
  replaceDir,
  prometheusContainsFile,
  grafanaContainsFile,
} = require("./install-utils");

async function installPrometheus(tmpDir) {
  const archive = path.join(tmpDir, `${prometheusArchiveName()}.${prometheusArchiveExt()}`);
  const extractRoot = path.join(tmpDir, "prometheus-extract");
  console.log(`→ Prometheus ${VERSIONS.prometheus} (${prometheusPlatform()})`);
  await downloadFile(prometheusUrl(), archive);
  await fs.promises.rm(extractRoot, { recursive: true, force: true });
  await extractArchive(archive, extractRoot);
  const extracted = await findExtractedRoot(
    extractRoot,
    [prometheusArchiveName(), `prometheus-${VERSIONS.prometheus}`],
    prometheusContainsFile
  );
  await replaceDir(prometheusHome(), extracted);
}

async function installGrafana(tmpDir) {
  const archive = path.join(tmpDir, `${grafanaArchiveName()}.${grafanaArchiveExt()}`);
  const extractRoot = path.join(tmpDir, "grafana-extract");
  console.log(`→ Grafana OSS ${VERSIONS.grafana} (${prometheusPlatform()})`);
  await downloadFile(grafanaUrl(), archive);
  await fs.promises.rm(extractRoot, { recursive: true, force: true });
  await extractArchive(archive, extractRoot);
  const extracted = await findExtractedRoot(
    extractRoot,
    [grafanaArchiveName(), `grafana-${VERSIONS.grafana}`, `grafana-v${VERSIONS.grafana}`],
    grafanaContainsFile
  );
  await replaceDir(grafanaHome(), extracted);
}

async function main() {
  if (binariesReady()) {
    console.log("Monitoring binaries already present:");
    console.log(`  Prometheus: ${prometheusBinary()}`);
    console.log(`  Grafana:    ${grafanaBinary()}`);
    return;
  }

  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Supported: ${SUPPORTED_TARGETS.join(" · ")}`);

  await fs.promises.mkdir(BIN_ROOT, { recursive: true });
  await fs.promises.mkdir(DATA_ROOT, { recursive: true });

  const tmpDir = path.join(DATA_ROOT, "downloads");
  await fs.promises.mkdir(tmpDir, { recursive: true });

  console.log("Downloading CCAM monitoring binaries (one-time setup)…");
  await installPrometheus(tmpDir);
  await installGrafana(tmpDir);
  await fs.promises.rm(tmpDir, { recursive: true, force: true });

  if (!binariesReady()) {
    throw new Error("Binary install finished but executables were not found.");
  }

  console.log("Done. Binaries installed to monitoring/.bin/");
  console.log(`  Prometheus: ${prometheusBinary()}`);
  console.log(`  Grafana:    ${grafanaBinary()}`);
}

main().catch((err) => {
  console.error(`monitoring:setup failed: ${err.message}`);
  process.exit(1);
});
