#!/usr/bin/env node
/**
 * @file Applies one complete allowlisted CCAM root-release version bump, then
 * regenerates and validates every derived release artifact.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  BUMP_TYPES,
  applyReleasePlan,
  buildReleasePlan,
  findUnexpectedPreviousVersion,
} = require("./lib/release-version");

const USAGE = "Usage: npm run release:bump -- <major|intermediate|minor> [--dry-run] [--json]";

function parseArgs(argv) {
  let bump = null;
  let dryRun = false;
  let json = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("--")) throw new Error(`${USAGE}\nUnknown option: ${arg}`);
    else if (bump === null) bump = arg;
    else throw new Error(`${USAGE}\nUnexpected argument: ${arg}`);
  }
  if (!BUMP_TYPES.includes(bump)) {
    throw new Error(`${USAGE}\nBump must be major, intermediate, or minor: ${bump || "<missing>"}`);
  }
  return { bump, dryRun, json };
}

function defaultRunCommand(command, args, { cwd }) {
  const executable = command === "npm" && process.platform === "win32" ? "npm.cmd" : command;
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

function commandLabel(command, args) {
  return [command, ...args].join(" ");
}

function runChecked(runCommand, command, args, root, log) {
  log(`$ ${commandLabel(command, args)}\n`);
  const result = runCommand(command, args, { cwd: root });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${commandLabel(command, args)} failed${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function releaseResult(plan, files, dryRun) {
  return {
    bump: plan.bump,
    currentVersion: plan.currentVersion,
    nextVersion: plan.nextVersion,
    branch: plan.branch,
    milestone: plan.milestone,
    files,
    dryRun,
  };
}

function runReleaseBump({
  root = process.cwd(),
  bump,
  dryRun = false,
  runCommand = defaultRunCommand,
  log = (message) => process.stderr.write(message),
}) {
  const repositoryRoot = path.resolve(root);
  const plan = buildReleasePlan({ root: repositoryRoot, bump });
  const plannedFiles = [
    ...new Set([...plan.mutations.map((mutation) => mutation.path), ...plan.generatedPaths]),
  ].sort();
  if (dryRun) return releaseResult(plan, plannedFiles, true);

  const status = runChecked(
    runCommand,
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    repositoryRoot,
    log
  ).stdout.trim();
  if (status)
    throw new Error(`Tracked working tree must be clean before a release bump:\n${status}`);

  const consistencyTest = ["--test", "server/__tests__/release-version-consistency.test.js"];
  runChecked(runCommand, process.execPath, consistencyTest, repositoryRoot, log);
  applyReleasePlan(plan, { dryRun: false });
  runChecked(runCommand, "npm", ["run", "openapi:yaml"], repositoryRoot, log);
  runChecked(runCommand, "npm", ["run", "extensions:sync"], repositoryRoot, log);
  runChecked(runCommand, process.execPath, consistencyTest, repositoryRoot, log);
  runChecked(runCommand, "npm", ["run", "extensions:validate"], repositoryRoot, log);
  runChecked(runCommand, process.execPath, ["bin/ccam.js", "version"], repositoryRoot, log);

  const trackedFiles = runChecked(runCommand, "git", ["ls-files", "-z"], repositoryRoot, log)
    .stdout.split("\0")
    .filter(Boolean);
  const stale = findUnexpectedPreviousVersion({
    root: repositoryRoot,
    previousVersion: plan.currentVersion,
    trackedFiles,
  });
  if (stale.length > 0) {
    const lines = stale.map((entry) => `${entry.path}:${entry.line}: ${entry.text}`);
    throw new Error(
      `Previous release ${plan.currentVersion} remains outside allowlists:\n${lines.join("\n")}`
    );
  }

  const files = runChecked(runCommand, "git", ["diff", "--name-only"], repositoryRoot, log)
    .stdout.split(/\r?\n/)
    .filter(Boolean)
    .sort();
  if (files.length === 0) throw new Error("Release bump produced no changed files");
  return releaseResult(plan, files, false);
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const result = runReleaseBump({ ...options, root: process.cwd() });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else {
      process.stdout.write(
        `${result.dryRun ? "Would bump" : "Bumped"} ${result.currentVersion} to ${result.nextVersion} (${result.bump}).\n`
      );
      process.stdout.write(`Branch: ${result.branch}\nMilestone: ${result.milestone}\n`);
      for (const file of result.files) process.stdout.write(`  ${file}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { defaultRunCommand, main, parseArgs, runReleaseBump };
