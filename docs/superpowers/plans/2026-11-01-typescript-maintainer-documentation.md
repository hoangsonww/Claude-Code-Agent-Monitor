# TypeScript Maintainer Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore TypeScript as the repository's largest GitHub language with a durable margin by adding deterministic, useful maintainer references without changing existing TypeScript behavior.

**Architecture:** A tested TypeScript library parses tracked sources with the client package's existing TypeScript compiler, renders/replaces generated comment blocks, and exposes significant-token comparison. Two opt-in CLIs wrap that library: one maintains the references and one proves an existing-file diff is comments/trivia only.

**Tech Stack:** Node.js 22.22+ built-in TypeScript execution, TypeScript compiler API, `node:test`, Git, Prettier.

## Global Constraints

- Add at least 1,000,000 tracked TypeScript bytes and project at least a 700,000-byte lead over the current JavaScript total.
- Do not change significant tokens in any TypeScript file that exists on `origin/master`.
- Do not add runtime dependencies or automatic install/build/test hooks.
- Every new or changed source file must carry `@author Son Nguyen <hoangson091104@gmail.com>`.
- Generated blocks must be deterministic, idempotent, repository-relative, and derived from the containing module.
- Do not touch localized content because no user-visible behavior or copy changes.

---

### Task 1: Commit the approved design and execution plan

**Files:**
- Create: `docs/superpowers/specs/2026-11-01-typescript-maintainer-documentation-design.md`
- Create: `docs/superpowers/plans/2026-11-01-typescript-maintainer-documentation.md`

**Interfaces:**
- Consumes: the approved target and scope from the user.
- Produces: the normative design and this executable checklist.

- [ ] **Step 1: Review both documents against the approved scope**

Confirm that the design requires a large safety margin, useful generated
references, manually invoked scripts, no existing executable changes, and full
verification.

- [ ] **Step 2: Scan for plan placeholders**

Run:

```bash
rg -n 'T[B]D|T[O]DO|implement lat[e]r|fill i[n]|similar to Tas[k]' \
  docs/superpowers/specs/2026-11-01-typescript-maintainer-documentation-design.md \
  docs/superpowers/plans/2026-11-01-typescript-maintainer-documentation.md
```

Expected: no matches.

- [ ] **Step 3: Commit the documents**

```bash
git add docs/superpowers/specs/2026-11-01-typescript-maintainer-documentation-design.md \
  docs/superpowers/plans/2026-11-01-typescript-maintainer-documentation.md
git commit -m "docs: design TypeScript maintainer references"
```

### Task 2: Specify the documentation-tool contracts with failing tests

**Files:**
- Create: `scripts/__tests__/typescript-source-docs.test.ts`

**Interfaces:**
- Consumes: Node's `node:test` and `node:assert/strict`.
- Produces: expected APIs `analyzeSource`, `renderMaintainerReference`,
  `upsertMaintainerReference`, `significantTokens`, and `compareSignificantTokens`.

- [ ] **Step 1: Add the required authorship header and wished-for imports**

```ts
/**
 * @file Tests the TypeScript maintainer-reference parser, renderer, updater,
 * and significant-token comparator used by the opt-in documentation scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const docs = require("../lib/typescript-source-docs.ts");
```

- [ ] **Step 2: Add focused behavior tests**

Use literal TypeScript fixtures to assert that analysis extracts imports,
exports, declarations, hooks, translation namespaces, API paths, and named test
cases; rendering uses only fixture facts and escapes `*/`; upsert inserts,
replaces, rejects malformed headers, and is idempotent; token comparison accepts
comment/whitespace changes and rejects code or JSX changes.

- [ ] **Step 3: Run the tests and verify RED**

```bash
node --test scripts/__tests__/typescript-source-docs.test.ts
```

Expected: FAIL with `MODULE_NOT_FOUND` for the library.

- [ ] **Step 4: Commit the red tests**

```bash
git add scripts/__tests__/typescript-source-docs.test.ts
git commit -m "test: specify TypeScript documentation tooling"
```

### Task 3: Implement the parser, renderer, updater, and token comparator

**Files:**
- Create: `scripts/lib/typescript-source-docs.ts`
- Test: `scripts/__tests__/typescript-source-docs.test.ts`

**Interfaces:**
- Consumes: TypeScript `SourceFile` ASTs and UTF-8 source strings.
- Produces:
  - `analyzeSource(relativePath: string, source: string): SourceFacts`
  - `renderMaintainerReference(facts: SourceFacts): string`
  - `upsertMaintainerReference(source: string, block: string): string`
  - `significantTokens(path: string, source: string): TokenRecord[]`
  - `compareSignificantTokens(path: string, before: string, after: string): TokenDifference | null`

- [ ] **Step 1: Add constants and compiler loading**

Use exact markers and author identity:

```ts
const BEGIN_MARKER = "GENERATED_MAINTAINER_REFERENCE:BEGIN";
const END_MARKER = "GENERATED_MAINTAINER_REFERENCE:END";
const AUTHOR = "@author Son Nguyen <hoangson091104@gmail.com>";
```

Resolve `typescript` from `client/package.json`, then `mcp/package.json`, and
throw an `npm run setup` hint when neither dependency tree is installed.

- [ ] **Step 2: Implement AST fact collection**

Walk the AST and return stable-sorted, deduplicated arrays. Derive the area from
the relative path. Extract the header overview, import specifiers, exported and
top-level declaration names/kinds, `use*` calls, `useTranslation` namespaces,
`/api/` string literals, and named test callbacks.

- [ ] **Step 3: Implement deterministic rendering and marker-safe upsert**

Render module identity, boundary, dependencies, public surface, declaration
index, framework touchpoints, area-specific invariants, validation commands,
and regeneration command. Omit empty sections and escape comment terminators.
Upsert only after a valid author header and reject unmatched/duplicate markers.

- [ ] **Step 4: Implement significant-token comparison**

Use a TypeScript scanner with trivia skipped and JSX language mode for `.tsx`.
Compare the complete `{kind,text}` sequence and return the first mismatch.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
node --test scripts/__tests__/typescript-source-docs.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write scripts/lib/typescript-source-docs.ts \
  scripts/__tests__/typescript-source-docs.test.ts
git add scripts/lib/typescript-source-docs.ts scripts/__tests__/typescript-source-docs.test.ts
git commit -m "feat(scripts): add TypeScript documentation primitives"
```

### Task 4: Add safe, opt-in documentation CLIs

**Files:**
- Create: `scripts/maintain-typescript-docs.ts`
- Create: `scripts/verify-typescript-comment-only.ts`
- Modify: `scripts/__tests__/typescript-source-docs.test.ts`

**Interfaces:**
- Consumes: Task 3 exports, `git ls-files`, `git diff --name-status`, and
  `git show <ref>:<path>`.
- Produces:
  - `node scripts/maintain-typescript-docs.ts --check [paths...]`
  - `node scripts/maintain-typescript-docs.ts --write [paths...]`
  - `node scripts/verify-typescript-comment-only.ts [base-ref]`

- [ ] **Step 1: Add failing argument and selection tests**

Test default-check behavior, mutually exclusive modes, unsupported-option
errors, normalized path filtering, and modified-versus-added classification.

- [ ] **Step 2: Run the tests and verify RED**

```bash
node --test scripts/__tests__/typescript-source-docs.test.ts
```

Expected: FAIL because the CLI helper modules do not exist.

- [ ] **Step 3: Implement both CLIs**

The maintainer CLI selects tracked sources with `git ls-files`, excludes
declarations/snapshots/dependencies/build output, checks by default, and writes
only with `--write`. The verifier defaults to `origin/master`, reports additions
separately, and fails on the first significant-token mismatch. Both provide
complete `--help` output and nonzero exits for invalid input.

- [ ] **Step 4: Run tests and smoke checks**

```bash
node --test scripts/__tests__/typescript-source-docs.test.ts
node scripts/maintain-typescript-docs.ts --help
node scripts/verify-typescript-comment-only.ts origin/master
```

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write scripts/maintain-typescript-docs.ts \
  scripts/verify-typescript-comment-only.ts scripts/__tests__/typescript-source-docs.test.ts
git add scripts/maintain-typescript-docs.ts \
  scripts/verify-typescript-comment-only.ts scripts/__tests__/typescript-source-docs.test.ts
git commit -m "feat(scripts): maintain and verify TypeScript references"
```

### Task 5: Generate and audit all maintainer references

**Files:**
- Modify: every eligible tracked first-party `.ts` and `.tsx` file.

**Interfaces:**
- Consumes: `maintain-typescript-docs.ts --write`.
- Produces: one current generated reference per selected file.

- [ ] **Step 1: Generate and format all references**

```bash
node scripts/maintain-typescript-docs.ts --write
npx prettier --write $(git diff --name-only --diff-filter=ACM -- '*.ts' '*.tsx')
```

- [ ] **Step 2: Prove generator idempotence**

```bash
node scripts/maintain-typescript-docs.ts --write
git diff --check
node scripts/maintain-typescript-docs.ts --check
```

Expected: the second write reports zero changed files and check mode succeeds.

- [ ] **Step 3: Prove existing modules remain comments-only**

```bash
node scripts/verify-typescript-comment-only.ts origin/master
```

Expected: every modified pre-existing file passes; new tool files are additions.

- [ ] **Step 4: Review content and byte margin**

Inspect representative client page/component/hook/lib/test, MCP source/test,
desktop, and script files. Calculate tracked TS/JS bytes from `git ls-files`;
require at least 1,000,000 added TS bytes and a 700,000 projected lead.

- [ ] **Step 5: Commit generated references**

```bash
git add -- '*.ts' '*.tsx'
git commit -m "docs(ts): add generated maintainer references"
```

### Task 6: Apply repository documentation and verification policy

**Files:**
- Modify only if an audit finds an omission.

**Interfaces:**
- Consumes: project header, documentation, and localization policies.
- Produces: a fully verified PR branch.

- [ ] **Step 1: Classify documentation impact**

Record that these are internal opt-in tools with header/help documentation and
that no public CLI or user-visible behavior changed. External product docs and
localization surfaces are intentionally skipped.

- [ ] **Step 2: Run focused tool and MCP validation**

```bash
node --test scripts/__tests__/typescript-source-docs.test.ts
npm run mcp:typecheck
npm run mcp:build
npm run test:mcp
```

- [ ] **Step 3: Run repository gates**

```bash
bash .claude/skills/file-headers/scripts/check-headers.sh
bash .claude/skills/file-headers/scripts/check-headers-pr.sh origin/master HEAD
git diff --check origin/master...HEAD
npm run verify
```

- [ ] **Step 4: Re-run final proofs**

```bash
node scripts/maintain-typescript-docs.ts --check
node scripts/verify-typescript-comment-only.ts origin/master
git status --short
```

Expected: current references, identical existing-module tokens, clean worktree.

### Task 7: Push and open the pull request

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes: verified branch `docs/typescript-maintainer-guides`.
- Produces: an upstream PR targeting `master`.

- [ ] **Step 1: Push the internal branch**

```bash
git push -u origin docs/typescript-maintainer-guides
```

- [ ] **Step 2: Open and verify the PR**

The PR body states before/after language bytes, scope, manual commands,
comment-only proof, validation results, and intentional docs/i18n exclusions.
Confirm target `master`, matching head SHA, and queued required checks.
