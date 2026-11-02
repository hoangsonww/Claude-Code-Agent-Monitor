/**
 * @file Compares changed TypeScript modules with a Git base revision using the
 * real TypeScript scanner, proving whether existing-file edits changed only
 * comments/trivia while reporting intentional additions separately.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** scripts/verify-typescript-comment-only.ts
 * **Area:** maintenance script
 * **Responsibility:**
 * Compares changed TypeScript modules with a Git base revision using the real TypeScript scanner,
 * proving whether existing-file edits changed only comments/trivia while reporting intentional
 * additions separately.
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
 * - `ChangedEntry` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `describeToken` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `fs` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `git` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HELP` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `main` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `parseArguments` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `parseNameStatusZ` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `path` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `readFromRevision` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `run` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
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
 *   `node scripts/maintain-typescript-docs.ts --check scripts/verify-typescript-comment-only.ts` .
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
const { REPO_ROOT, compareSignificantTokens } = require("./lib/typescript-source-docs.ts");

type Arguments = {
  baseRef: string;
  help: boolean;
};

type ChangedEntry = {
  status: string;
  previousPath: string | null;
  path: string;
};

const HELP = `Verify that edits to existing TypeScript files are comments/trivia only.

Usage:
  node scripts/verify-typescript-comment-only.ts [base-ref]

The base defaults to origin/master. Modified and renamed .ts/.tsx files are
scanned with the TypeScript compiler while trivia is skipped; any different
token kind or text fails verification. Added files are listed separately
because they have no base token stream. Deleted TypeScript files fail.

Examples:
  node scripts/verify-typescript-comment-only.ts
  node scripts/verify-typescript-comment-only.ts HEAD~1

Prerequisite:
  Run npm run setup so the client TypeScript compiler dependency is installed.
`;

/** Parse zero or one safe base revision. */
function parseArguments(argv: string[]): Arguments {
  if (argv.includes("--help") || argv.includes("-h")) {
    if (argv.length !== 1) throw new Error("--help does not accept a base revision.");
    return { baseRef: "origin/master", help: true };
  }
  const options = argv.filter((argument) => argument.startsWith("-"));
  if (options.length > 0) throw new Error(`Unknown option: ${options[0]}`);
  if (argv.length > 1) throw new Error("Provide at most one base revision.");
  return { baseRef: argv[0] || "origin/master", help: false };
}

/** Parse `git diff --name-status -z`, including rename/copy pairs. */
function parseNameStatusZ(output: string): ChangedEntry[] {
  if (!output) return [];
  if (!output.endsWith("\0")) throw new Error("Malformed NUL-delimited Git status output.");
  const fields = output.slice(0, -1).split("\0");
  const entries: ChangedEntry[] = [];
  let index = 0;
  while (index < fields.length) {
    const status = fields[index++];
    if (!status) throw new Error("Malformed Git status: missing status field.");
    if (status.startsWith("R") || status.startsWith("C")) {
      const previousPath = fields[index++];
      const currentPath = fields[index++];
      if (!previousPath || !currentPath) throw new Error(`Malformed Git status for ${status}.`);
      entries.push({ status, previousPath, path: currentPath });
    } else {
      const currentPath = fields[index++];
      if (!currentPath) throw new Error(`Malformed Git status for ${status}.`);
      entries.push({ status, previousPath: null, path: currentPath });
    }
  }
  return entries;
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

/** Read one file as stored at a base revision without invoking a shell. */
function readFromRevision(baseRef: string, relativePath: string): string {
  return git(["show", `${baseRef}:${relativePath}`]);
}

/** Render one scanner token safely for a compact failure diagnostic. */
function describeToken(token: { kind: number; text: string } | null): string {
  if (!token) return "<end-of-file>";
  return `kind=${token.kind} text=${JSON.stringify(token.text)}`;
}

/** Verify changed TypeScript files and return a process exit code. */
function run(baseRef: string): number {
  git(["rev-parse", "--verify", `${baseRef}^{commit}`]);
  const entries = parseNameStatusZ(
    git(["diff", "--name-status", "-z", "--find-renames", baseRef, "--", "*.ts", "*.tsx"])
  );
  const additions: string[] = [];
  const failures: string[] = [];
  let verified = 0;

  for (const entry of entries) {
    if (entry.status === "A") {
      additions.push(entry.path);
      continue;
    }
    if (entry.status === "D") {
      failures.push(`${entry.path}: deleted TypeScript file has no current token stream.`);
      continue;
    }

    const beforePath = entry.previousPath ?? entry.path;
    const filename = path.join(REPO_ROOT, ...entry.path.replaceAll("\\", "/").split("/"));
    if (!fs.existsSync(filename)) {
      failures.push(`${entry.path}: current file is missing.`);
      continue;
    }
    try {
      const before = readFromRevision(baseRef, beforePath);
      const after = fs.readFileSync(filename, "utf8");
      const difference = compareSignificantTokens(entry.path, before, after);
      if (difference) {
        failures.push(
          `${entry.path}: token ${difference.index} differs (${describeToken(difference.before)} -> ${describeToken(difference.after)}).`
        );
      } else {
        verified += 1;
      }
    } catch (error) {
      failures.push(`${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const file of additions) console.log(`ADDED ${file}`);
  for (const failure of failures) console.error(`FAILED ${failure}`);
  console.log(
    `TypeScript comment-only verification: ${verified} existing file(s) equivalent; ${additions.length} addition(s); ${failures.length} failure(s).`
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
    return run(args.baseRef);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Run with --help for usage.");
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  HELP,
  parseArguments,
  parseNameStatusZ,
  readFromRevision,
  describeToken,
  run,
  main,
};
