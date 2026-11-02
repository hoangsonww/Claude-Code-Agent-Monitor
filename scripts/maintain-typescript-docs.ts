/**
 * @file Checks or regenerates deterministic maintainer-reference comments for
 * Git-tracked first-party TypeScript modules. Inspection is the default and
 * writes require an explicit --write flag.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** scripts/maintain-typescript-docs.ts
 * **Area:** maintenance script
 * **Responsibility:**
 * Checks or regenerates deterministic maintainer-reference comments for Git-tracked first-party
 * TypeScript modules. Inspection is the default and writes require an explicit --write flag.
 *
 * ## Architectural boundary
 * - Provides an explicit maintainer operation and is never imported into application runtime paths.
 * - Safe inspection is the default; writes, deletions, publication, or other mutations require
 *   unmistakable flags.
 * - Output and exit status form the script's automation contract even when humans usually run it
 *   interactively.
 *
 * ## Top-level implementation landmarks
 * - `Arguments` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fs` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `git` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HELP` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `isEligiblePath` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `main` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Mode` (type) — top-level declaration that helps orient code review and focused test selection.
 * - `normalizeRequestedPath` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `parseArguments` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `path` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `run` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `selectTrackedFiles` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `writeAtomically` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Resolve the repository root from the script location instead of assuming the caller's current
 *   directory.
 * - Accept normalized repository-relative paths and reject traversal outside the checkout.
 * - Keep output deterministic so CI logs and repeated maintenance runs are reviewable.
 * - Use nonzero exits for invalid input, stale generated state, partial failure, and unmet safety
 *   checks.
 * - Print actionable remediation without dumping secrets, full environment objects, or unrelated
 *   file content.
 * - Do not mutate by default; require an explicit write/apply/confirm option appropriate to the
 *   risk.
 * - Write atomically or use content-preserving replacement when interruption could damage a source
 *   file.
 * - Support paths containing spaces and platform separators; avoid shell-dependent parsing
 *   assumptions.
 * - Keep repeated execution idempotent and report changed versus unchanged work accurately.
 * - Test argument parsing and pure transformations before relying on end-to-end filesystem smoke
 *   tests.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `node --test scripts/__tests__/typescript-source-docs.test.ts` and resolve failures before
 *   widening the verification scope.
 * - Run `bash .claude/skills/file-headers/scripts/check-headers.sh` and resolve failures before
 *   widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check scripts/maintain-typescript-docs.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  REPO_ROOT,
  analyzeSource,
  renderMaintainerReference,
  upsertMaintainerReference,
} = require("./lib/typescript-source-docs.ts");

type Mode = "check" | "write";

type Arguments = {
  help: boolean;
  mode: Mode;
  paths: string[];
};

const HELP = `Maintain generated TypeScript module references.

Usage:
  node scripts/maintain-typescript-docs.ts [--check] [path ...]
  node scripts/maintain-typescript-docs.ts --write [path ...]

Modes:
  --check   Report missing or stale references without writing (default).
  --write   Insert or replace references in selected tracked files.

Selection:
  With no paths, inspect every Git-tracked first-party .ts/.tsx file.
  A path may name one tracked file or a directory prefix. Paths are relative
  to the repository root; dependencies, build output, declarations, snapshots,
  and non-source documentation examples are excluded.

Examples:
  node scripts/maintain-typescript-docs.ts --check client/src
  node scripts/maintain-typescript-docs.ts --write mcp/src/index.ts
  node scripts/maintain-typescript-docs.ts --write

Prerequisite:
  Run npm run setup so the client TypeScript compiler dependency is installed.
`;

/** Normalize a user path and reject absolute or parent-traversing selection. */
function normalizeRequestedPath(value: string): string {
  const slashPath = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (path.posix.isAbsolute(slashPath)) throw new Error(`Path is outside the repository: ${value}`);
  const normalized = path.posix.normalize(slashPath).replace(/\/$/, "");
  if (!normalized || normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Path is outside the repository: ${value}`);
  }
  return normalized;
}

/** Parse safe check/write arguments without reading repository state. */
function parseArguments(argv: string[]): Arguments {
  let mode: Mode = "check";
  let selectedMode: Mode | null = null;
  let help = false;
  const paths: string[] = [];

  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--check" || argument === "--write") {
      const nextMode: Mode = argument === "--write" ? "write" : "check";
      if (selectedMode && selectedMode !== nextMode) {
        throw new Error("--check and --write are mutually exclusive.");
      }
      selectedMode = nextMode;
      mode = nextMode;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      paths.push(normalizeRequestedPath(argument));
    }
  }

  return { help, mode, paths: [...new Set(paths)] };
}

/** Return whether a Git-tracked path is a first-party source supported by the generator. */
function isEligiblePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!/\.tsx?$/.test(normalized) || /\.d\.ts$/.test(normalized)) return false;
  if (!/^(client|mcp|desktop|scripts)\//.test(normalized)) return false;
  if (/(^|\/)(node_modules|dist|build|coverage|__snapshots__)(\/|$)/.test(normalized)) {
    return false;
  }
  return true;
}

/** Run Git and return stdout or throw a focused diagnostic. */
function git(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

/** Select eligible tracked files, optionally narrowed by exact file or directory prefixes. */
function selectTrackedFiles(requestedPaths: string[]): string[] {
  const tracked = git(["ls-files", "-z", "--", "*.ts", "*.tsx"])
    .split("\0")
    .filter(Boolean)
    .map((file: string) => file.replaceAll("\\", "/"))
    .filter(isEligiblePath)
    .sort((a: string, b: string) => a.localeCompare(b));

  if (requestedPaths.length === 0 || requestedPaths.includes("")) return tracked;
  const selected = tracked.filter((file: string) =>
    requestedPaths.some((requested) => file === requested || file.startsWith(`${requested}/`))
  );
  const unmatched = requestedPaths.filter(
    (requested) =>
      !tracked.some((file: string) => file === requested || file.startsWith(`${requested}/`))
  );
  if (unmatched.length > 0) {
    throw new Error(`No eligible tracked TypeScript files matched: ${unmatched.join(", ")}`);
  }
  return selected;
}

/** Replace a source file via a same-directory temporary file and preserve its mode. */
function writeAtomically(filename: string, content: string): void {
  const stat = fs.statSync(filename);
  const temporary = `${filename}.ts-docs-${process.pid}-${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, "utf8");
    fs.chmodSync(temporary, stat.mode);
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

/** Check or update all selected references and return a process exit code. */
function run(args: Arguments): number {
  const files = selectTrackedFiles(args.paths);
  const stale: string[] = [];
  const failures: Array<{ file: string; message: string }> = [];
  let changed = 0;

  for (const relativePath of files) {
    const filename = path.join(REPO_ROOT, ...relativePath.split("/"));
    try {
      const source = fs.readFileSync(filename, "utf8");
      const facts = analyzeSource(relativePath, source);
      const reference = renderMaintainerReference(facts);
      const updated = upsertMaintainerReference(source, reference);
      if (updated === source) continue;
      stale.push(relativePath);
      if (args.mode === "write") {
        writeAtomically(filename, updated);
        changed += 1;
      }
    } catch (error) {
      failures.push({
        file: relativePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const failure of failures) console.error(`ERROR ${failure.file}: ${failure.message}`);
  if (args.mode === "check") {
    for (const file of stale) console.error(`STALE ${file}`);
    console.log(
      `TypeScript references checked: ${files.length}; current: ${files.length - stale.length - failures.length}; stale: ${stale.length}; errors: ${failures.length}.`
    );
    return stale.length > 0 || failures.length > 0 ? 1 : 0;
  }

  console.log(
    `TypeScript references written: ${changed}; unchanged: ${files.length - changed - failures.length}; errors: ${failures.length}.`
  );
  return failures.length > 0 ? 1 : 0;
}

/** CLI entry point kept separate so importing helpers in tests has no side effects. */
function main(argv = process.argv.slice(2)): number {
  try {
    const args = parseArguments(argv);
    if (args.help) {
      process.stdout.write(HELP);
      return 0;
    }
    return run(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Run with --help for usage.");
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  HELP,
  normalizeRequestedPath,
  parseArguments,
  isEligiblePath,
  selectTrackedFiles,
  writeAtomically,
  run,
  main,
};
