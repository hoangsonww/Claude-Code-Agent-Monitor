/**
 * @file Publishes desktop release artifacts with resumable draft uploads.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

/**
 * Creates or resumes a same-commit draft and publishes it after verifying all
 * four desktop artifacts. Published releases are left unchanged. Uploads get
 * three total attempts; any lookup, upload, or verification failure throws.
 *
 * @param {object} options - Release identity and injected I/O dependencies.
 * @param {string} options.tag - Stable release tag, such as v2.2.1.
 * @param {string} options.sha - Full commit SHA that produced the artifacts.
 * @param {string} options.repo - GitHub owner/repository.
 * @param {function(string[]): string} options.run - Runs gh and returns stdout; throws on failure.
 * @param {function(number): void} options.sleep - Waits for the given milliseconds between retries.
 * @param {function(string): number} options.size - Reads a local artifact's size in bytes.
 * @returns {void}
 */
function publishRelease({ tag, sha, repo, run, sleep, size }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("Expected a release version tag and full commit SHA");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Expected owner/repository");
  const version = tag.slice(1);
  const files = [
    `dmg/ClaudeCodeMonitor-${version}-arm64.dmg`,
    `dmg/ClaudeCodeMonitor-${version}-x64.dmg`,
    `win/ClaudeCodeMonitor-${version}-x64-portable.exe`,
    `win/ClaudeCodeMonitor-Setup-${version}-x64.exe`,
  ];
  // Listing succeeds or fails explicitly: an auth/network failure is not absence.
  const releases = JSON.parse(
    run(["api", "--paginate", "--slurp", `repos/${repo}/releases?per_page=100`])
  ).flat();
  const matches = releases.filter((release) => release.tag_name === tag);
  if (matches.length > 1) throw new Error(`Multiple releases found for ${tag}`);
  const existing = matches[0];
  if (existing && !existing.draft) {
    console.log(`${tag} is already published; leaving it unchanged.`);
    return;
  }
  if (existing && existing.target_commitish !== sha) {
    throw new Error(`Draft ${tag} targets another commit; refusing to mix build artifacts`);
  }
  const sizes = files.map((file) => {
    const bytes = size(file);
    if (bytes <= 0) throw new Error(`Empty artifact: ${file}`);
    return bytes;
  });
  if (!existing) {
    run([
      "release",
      "create",
      tag,
      "--repo",
      repo,
      "--target",
      sha,
      "--title",
      tag,
      "--generate-notes",
      "--draft",
    ]);
  }
  // A timed-out upload may already exist remotely. Clobber only assets in the
  // unpublished draft for this exact commit; never modify a published release.
  for (const file of files) {
    for (let attempt = 1; ; attempt++) {
      try {
        run(["release", "upload", tag, file, "--repo", repo, "--clobber"]);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        console.warn(`Retrying ${file} after upload attempt ${attempt}`);
        sleep(attempt * 5000);
      }
    }
  }
  const release = JSON.parse(run(["release", "view", tag, "--repo", repo, "--json", "assets"]));
  for (const [index, file] of files.entries()) {
    const name = file.split("/").pop();
    const asset = release.assets.find((entry) => entry.name === name);
    if (!asset || asset.state !== "uploaded" || asset.size !== sizes[index]) {
      throw new Error(`Release asset verification failed: ${name}`);
    }
  }
  run(["release", "edit", tag, "--repo", repo, "--draft=false", "--latest"]);
  console.log(`Published ${tag}`);
}

if (require.main === module) {
  publishRelease({
    tag: `v${require("../package.json").version}`,
    sha: process.env.GITHUB_SHA,
    repo: process.env.GITHUB_REPOSITORY,
    run: (args) =>
      execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
    sleep: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
    size: (file) => fs.statSync(file).size,
  });
}

module.exports = { publishRelease };
