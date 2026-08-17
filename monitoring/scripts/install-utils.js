/**
 * @file Archive extraction and install-dir discovery for cross-platform binaries.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const tar = require("tar");
const AdmZip = require("adm-zip");
const { isWindows } = require("./paths");

async function downloadFile(url, dest) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  if (!response.body) {
    throw new Error(`Empty response body: ${url}`);
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(dest));
}

async function extractTar(archivePath, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true });
  await tar.x({ file: archivePath, cwd: destDir });
}

async function extractZip(archivePath, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true });
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(destDir, true);
}

async function extractArchive(archivePath, destDir) {
  if (archivePath.endsWith(".zip")) {
    await extractZip(archivePath, destDir);
    return;
  }
  await extractTar(archivePath, destDir);
}

async function listChildDirs(parent) {
  const entries = await fs.promises.readdir(parent, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => path.join(parent, e.name));
}

/**
 * Locate a single top-level directory after extraction. Official archives ship
 * one root folder; this also tolerates minor naming differences across OS builds.
 */
async function findExtractedRoot(extractRoot, preferredNames, containsFile) {
  for (const name of preferredNames) {
    const candidate = path.join(extractRoot, name);
    if (fs.existsSync(path.join(candidate, containsFile))) return candidate;
  }

  const dirs = await listChildDirs(extractRoot);
  const matches = [];
  for (const dir of dirs) {
    if (fs.existsSync(path.join(dir, containsFile))) matches.push(dir);
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Multiple install directories matched in ${extractRoot}: ${matches.map(path.basename).join(", ")}`
    );
  }
  throw new Error(
    `Could not find install directory under ${extractRoot} (expected ${containsFile}).`
  );
}

async function replaceDir(target, source) {
  await fs.promises.rm(target, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.cp(source, target, { recursive: true });
}

module.exports = {
  downloadFile,
  extractArchive,
  findExtractedRoot,
  replaceDir,
  prometheusContainsFile: isWindows() ? "prometheus.exe" : "prometheus",
  grafanaContainsFile: path.join("bin", isWindows() ? "grafana.exe" : "grafana"),
};
