# TypeScript Maintainer Documentation Design

## Problem

GitHub currently reports 3,877,943 bytes of JavaScript and 3,621,797 bytes of
TypeScript, leaving TypeScript 256,146 bytes behind. Earlier documentation
passes added useful module and test-contract guides, but subsequent JavaScript
work erased that lead.

The repository needs a documentation-only expansion that makes TypeScript the
largest language again with enough margin that ordinary JavaScript maintenance
does not immediately reverse the result. The expansion must remain useful to
maintainers, must not alter existing executable TypeScript, and must be
repeatable rather than a one-off paste operation.

## Goals

- Add at least 1,000,000 bytes of tracked TypeScript, targeting a projected
  TypeScript lead of at least 700,000 bytes over the current JavaScript total.
- Document every tracked first-party `.ts` and `.tsx` module with a generated,
  module-specific maintainer reference.
- Keep every pre-existing TypeScript module's significant token stream exactly
  equal to `origin/master`.
- Add manually runnable TypeScript maintenance tools that generate/check the
  references and prove comment-only equivalence.
- Keep the application, server, MCP server, desktop shell, tests, and build
  behavior unchanged.

## Non-goals

- No user-visible feature, API, database, hook, event, WebSocket, localization,
  release, or runtime behavior changes.
- No edits to localized guides, UI copy, or wiki content.
- No generic prose copied blindly into files without reflecting their actual
  imports, exports, declarations, hooks, routes, namespaces, or test cases.
- No new runtime dependency and no automatic execution during install, build,
  test, or application startup.

## Approach

Add a small TypeScript documentation-maintenance toolkit under `scripts/`.
The toolkit loads the TypeScript compiler already installed for the client,
parses each Git-tracked first-party TypeScript source, and renders a deterministic
`GENERATED_MAINTAINER_REFERENCE` comment after the required authorship header.
The reference records facts extracted from that module:

- repository-relative path and architectural area;
- file-header overview;
- relative and package dependencies;
- exported and top-level declarations;
- React hooks, translation namespaces, HTTP paths, and named test contracts;
- area-specific maintenance invariants and validation commands.

The block is explicitly generated and carries the regeneration command. A
`--check` mode detects missing or stale blocks without writing; `--write`
inserts or replaces them atomically. Selection defaults to Git-tracked `.ts`
and `.tsx` files and excludes dependencies, build output, declaration files,
and snapshots. Optional path arguments allow a maintainer to scope a run.

A second CLI compares a base Git revision with the current tree. It tokenizes
both versions with the TypeScript scanner while skipping trivia and fails if
any pre-existing changed `.ts`/`.tsx` file differs in significant tokens. New
tool files are reported separately because they intentionally have no base
version.

## Safety and correctness

- Existing code changes are accepted only when the comment-only verifier finds
  identical token kind/text sequences against `origin/master`.
- The generator replaces only text between its exact begin/end markers and
  inserts only after a valid file header containing the required author line.
- `--check` is the default; writes require the explicit `--write` flag.
- Paths come from `git ls-files`, are normalized, and remain inside the repo.
- Generated text escapes comment terminators so source content cannot close the
  reference block early.
- Output is deterministic and idempotent; a second write produces no diff.
- Tool behavior is developed test-first with string fixtures and real compiler
  scanning.

## Documentation shape

Each reference is a navigation aid, not a second implementation. It has these
sections when the source provides relevant facts:

1. Module identity and file-header summary.
2. Architectural placement and ownership boundary.
3. Dependency inventory split into local and package imports.
4. Public surface and top-level declaration index.
5. Framework touchpoints such as React hooks, i18n namespaces, API paths, and
   test contract names.
6. Area-specific invariants derived from the repository's established rules.
7. Focused validation commands and regeneration instructions.

Large lists are complete but deduplicated and stable-sorted. Empty sections are
omitted. This makes references accurate for both very small utility modules and
large route-level screens without inventing behavior.

## Validation

- Red/green unit tests for parsing, rendering, insertion/replacement,
  idempotence, escaping, and significant-token comparison.
- Generator `--check` after the write pass.
- Generator `--write` a second time followed by a clean-diff assertion.
- Comment-only verification against `origin/master` for every modified existing
  TypeScript file.
- Required authorship-header checks for the PR diff and full repository.
- `git diff --check`, Prettier, client typecheck, server tests, client tests,
  MCP typecheck/build/tests, and full `npm run verify`.
- Raw tracked-byte accounting plus GitHub language API verification after push.

## Documentation and localization decision

The new scripts are internal maintainer tools, are not registered as public npm
commands, and do not change a user-facing CLI. Their file headers and `--help`
output are their canonical usage documentation. The project-doc mapping
therefore classifies the rest of the change as comments/internal tooling:
external product docs and all localization surfaces are intentionally
unchanged.
