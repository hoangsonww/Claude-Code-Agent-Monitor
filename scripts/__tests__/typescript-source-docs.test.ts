/**
 * @file Tests the TypeScript maintainer-reference parser, renderer, updater,
 * and significant-token comparator used by the opt-in documentation scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** scripts/__tests__/typescript-source-docs.test.ts
 * **Area:** maintenance script test
 * **Responsibility:**
 * Tests the TypeScript maintainer-reference parser, renderer, updater, and significant-token
 * comparator used by the opt-in documentation scripts.
 *
 * ## Architectural boundary
 * - Protects repository-maintenance tooling with deterministic fixtures and no dependence on
 *   operator data.
 * - Pure parsing, rendering, selection, and comparison contracts are preferred over broad
 *   subprocess snapshots.
 * - A failing case should identify the unsafe or stale behavior that a maintainer would otherwise
 *   encounter.
 *
 * ## Top-level implementation landmarks
 * - `assert` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fixture` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `test` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Literal API paths
 * - `/api/health` — route literal present in this source; keep request/response expectations
 *   aligned with the server and API docs.
 * - `/api/sessions/facets` — route literal present in this source; keep request/response
 *   expectations aligned with the server and API docs.
 *
 * ## Named test contracts
 * - `analyzeSource extracts module facts from the TypeScript AST` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `comment-only verifier parses base refs and NUL-delimited Git status` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `compareSignificantTokens accepts comments and whitespace only` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `compareSignificantTokens rejects executable TypeScript and JSX changes` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `maintainer CLI arguments default to check and require explicit writes` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `renderMaintainerReference escapes block-comment terminators` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `renderMaintainerReference renders module-specific sections deterministically` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `upsertMaintainerReference allows the author literal outside the file header` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `upsertMaintainerReference ignores marker literals in executable code` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `upsertMaintainerReference inserts after the compliant file header` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `upsertMaintainerReference rejects missing authorship and malformed markers` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `upsertMaintainerReference replaces one existing marked block` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Use temporary directories for integration fixtures and clean them even when an assertion fails.
 * - Assert exit semantics and diagnostics separately from transformed content.
 * - Exercise paths containing spaces, Windows separators, empty selections, and malformed
 *   arguments.
 * - Prove mutation modes are explicit while check/dry-run modes leave bytes unchanged.
 * - Keep fixtures small enough that expected generated text remains reviewable.
 * - Test idempotence by applying the same operation twice and comparing exact bytes.
 * - Test hostile comment text and paths so generated source cannot escape its documentation block.
 * - Use real TypeScript scanning for semantic-equivalence claims rather than regular-expression
 *   stripping.
 * - Avoid network dependencies; repository facts should be injected or read from local Git state.
 * - Run the test once in the broken state before implementing each behavior.
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
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check scripts/__tests__/typescript-source-docs.test.ts`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AUTHOR,
  BEGIN_MARKER,
  END_MARKER,
  analyzeSource,
  renderMaintainerReference,
  upsertMaintainerReference,
  compareSignificantTokens,
} = require("../lib/typescript-source-docs.ts");

const fixture = `/**
 * @file Widget.tsx
 * @description Renders a scoped session widget and documents its data boundary.
 * ${AUTHOR}
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Session } from "../lib/types";
import { api } from "../lib/api";

export interface WidgetProps { session: Session }
export const Widget = ({ session }: WidgetProps) => {
  const { t } = useTranslation("dashboard");
  const [open] = useState(false);
  const label = useMemo(() => t("title"), [t]);
  void api.sessions.get(session.id);
  void fetch("/api/sessions/facets");
  return <section data-open={open}>{label}</section>;
};

function helper() { return "/api/health"; }
export { helper as exportedHelper };

describe("Widget", () => {
  it("renders the translated label", () => {});
  test("keeps scope local", () => {});
});
`;

test("analyzeSource extracts module facts from the TypeScript AST", () => {
  const facts = analyzeSource("client/src/components/Widget.tsx", fixture);

  assert.equal(facts.area, "client component");
  assert.equal(facts.overview, "Renders a scoped session widget and documents its data boundary.");
  assert.deepEqual(facts.localImports, ["../lib/api", "../lib/types"]);
  assert.deepEqual(facts.packageImports, ["react", "react-i18next"]);
  assert.deepEqual(facts.exports, [
    { kind: "function alias", name: "exportedHelper" },
    { kind: "variable", name: "Widget" },
    { kind: "interface", name: "WidgetProps" },
  ]);
  assert.deepEqual(facts.declarations, [
    { kind: "function", name: "helper" },
    { kind: "variable", name: "Widget" },
    { kind: "interface", name: "WidgetProps" },
  ]);
  assert.deepEqual(facts.reactHooks, ["useMemo", "useState", "useTranslation"]);
  assert.deepEqual(facts.translationNamespaces, ["dashboard"]);
  assert.deepEqual(facts.apiPaths, ["/api/health", "/api/sessions/facets"]);
  assert.deepEqual(facts.testCases, [
    "keeps scope local",
    "renders the translated label",
    "Widget",
  ]);
});

test("renderMaintainerReference renders module-specific sections deterministically", () => {
  const facts = analyzeSource("client/src/components/Widget.tsx", fixture);
  const block = renderMaintainerReference(facts);

  assert.match(block, new RegExp(BEGIN_MARKER));
  assert.match(block, new RegExp(END_MARKER));
  assert.match(block, /client\/src\/components\/Widget\.tsx/);
  assert.match(block, /client component/);
  assert.match(block, /\.\.\/lib\/api/);
  assert.match(block, /react-i18next/);
  assert.match(block, /`WidgetProps` \(interface\)/);
  assert.match(block, /useMemo/);
  assert.match(block, /dashboard/);
  assert.match(block, /\/api\/sessions\/facets/);
  assert.match(block, /renders the translated label/);
  assert.match(block, /npm run test:client/);
  assert.match(block, /node scripts\/maintain-typescript-docs\.ts --write/);
  assert.equal(block, renderMaintainerReference(facts));
});

test("renderMaintainerReference escapes block-comment terminators", () => {
  const facts = analyzeSource("client/src/components/Widget.tsx", fixture);
  facts.overview = "Never emit */ inside a generated block.";

  const block = renderMaintainerReference(facts);

  assert.doesNotMatch(block.slice(0, -2), /\*\//);
  assert.match(block, /Never emit \* \/ inside a generated block\./);
});

test("upsertMaintainerReference inserts after the compliant file header", () => {
  const block = renderMaintainerReference(
    analyzeSource("client/src/components/Widget.tsx", fixture)
  );
  const updated = upsertMaintainerReference(fixture, block);
  const headerEnd = updated.indexOf("*/") + 2;

  assert.equal(updated.slice(headerEnd).trimStart().startsWith("/*"), true);
  assert.equal(updated.split(BEGIN_MARKER).length - 1, 1);
  assert.equal(upsertMaintainerReference(updated, block), updated);
});

test("upsertMaintainerReference replaces one existing marked block", () => {
  const first = renderMaintainerReference(
    analyzeSource("client/src/components/Widget.tsx", fixture)
  );
  const inserted = upsertMaintainerReference(fixture, first);
  const second = first.replace("client component", "replacement area");
  const replaced = upsertMaintainerReference(inserted, second);

  assert.match(replaced, /replacement area/);
  assert.doesNotMatch(replaced, /\* \*\*Area:\*\* client component/);
  assert.equal(replaced.split(BEGIN_MARKER).length - 1, 1);
});

test("upsertMaintainerReference rejects missing authorship and malformed markers", () => {
  const block = `/* ${BEGIN_MARKER}\n * reference\n * ${END_MARKER}\n */`;

  assert.throws(() => upsertMaintainerReference("export const value = 1;\n", block), /author/i);
  assert.throws(
    () => upsertMaintainerReference(`${fixture}\n/* ${BEGIN_MARKER} */\n`, block),
    /marker/i
  );
  assert.throws(
    () => upsertMaintainerReference(fixture.replace(AUTHOR, `${AUTHOR}\n * ${AUTHOR}`), block),
    /exactly one author/i
  );
});

test("upsertMaintainerReference allows the author literal outside the file header", () => {
  const block = renderMaintainerReference(
    analyzeSource("client/src/components/Widget.tsx", fixture)
  );
  const source = `${fixture}\nconst requiredAuthor = ${JSON.stringify(AUTHOR)};\n`;

  assert.match(upsertMaintainerReference(source, block), new RegExp(BEGIN_MARKER));
});

test("upsertMaintainerReference ignores marker literals in executable code", () => {
  const block = renderMaintainerReference(analyzeSource("scripts/example.ts", fixture));
  const source = `/**
 * @file Keeps marker constants available to the generator itself.
 * ${AUTHOR}
 */
const BEGIN = ${JSON.stringify(BEGIN_MARKER)};
const END = ${JSON.stringify(END_MARKER)};
export const markers = [BEGIN, END];
`;

  const updated = upsertMaintainerReference(source, block);

  assert.equal(compareSignificantTokens("scripts/example.ts", source, updated), null);
  assert.match(updated, /const BEGIN =/);
  assert.match(updated, /export const markers/);
});

test("compareSignificantTokens accepts comments and whitespace only", () => {
  const before = "export const answer: number = 42;\n";
  const after = `/** documentation */

export  const answer: number = 42; // rationale
`;

  assert.equal(compareSignificantTokens("answer.ts", before, after), null);
});

test("compareSignificantTokens rejects executable TypeScript and JSX changes", () => {
  const identifierChange = compareSignificantTokens(
    "answer.ts",
    "export const answer = 42;",
    "export const result = 42;"
  );
  const jsxChange = compareSignificantTokens(
    "View.tsx",
    "export const View = () => <span>one</span>;",
    "export const View = () => <span>two</span>;"
  );

  assert.equal(identifierChange.before.text, "answer");
  assert.equal(identifierChange.after.text, "result");
  assert.equal(jsxChange.before.text, "one");
  assert.equal(jsxChange.after.text, "two");
});

test("maintainer CLI arguments default to check and require explicit writes", () => {
  const { parseArguments, isEligiblePath } = require("../maintain-typescript-docs.ts");

  assert.deepEqual(parseArguments([]), { help: false, mode: "check", paths: [] });
  assert.deepEqual(parseArguments(["--write", "client\\src\\App.tsx"]), {
    help: false,
    mode: "write",
    paths: ["client/src/App.tsx"],
  });
  assert.deepEqual(parseArguments(["--help"]), { help: true, mode: "check", paths: [] });
  assert.throws(() => parseArguments(["--check", "--write"]), /mutually exclusive/i);
  assert.throws(() => parseArguments(["--wat"]), /unknown option/i);
  assert.throws(() => parseArguments(["../outside.ts"]), /outside/i);

  assert.equal(isEligiblePath("client/src/App.tsx"), true);
  assert.equal(isEligiblePath("mcp/src/index.ts"), true);
  assert.equal(isEligiblePath("client/src/generated.d.ts"), false);
  assert.equal(isEligiblePath("client/node_modules/pkg/index.ts"), false);
  assert.equal(isEligiblePath("client/dist/index.ts"), false);
  assert.equal(isEligiblePath("client/src/__snapshots__/view.ts"), false);
  assert.equal(isEligiblePath("docs/example.ts"), false);
});

test("comment-only verifier parses base refs and NUL-delimited Git status", () => {
  const { parseArguments, parseNameStatusZ } = require("../verify-typescript-comment-only.ts");

  assert.deepEqual(parseArguments([]), { baseRef: "origin/master", help: false });
  assert.deepEqual(parseArguments(["HEAD~2"]), { baseRef: "HEAD~2", help: false });
  assert.deepEqual(parseArguments(["--help"]), { baseRef: "origin/master", help: true });
  assert.throws(() => parseArguments(["main", "other"]), /one base/i);
  assert.throws(() => parseArguments(["--wat"]), /unknown option/i);

  assert.deepEqual(
    parseNameStatusZ("M\0client/src/App.tsx\0A\0scripts/new.ts\0R100\0old.ts\0new.ts\0"),
    [
      { path: "client/src/App.tsx", previousPath: null, status: "M" },
      { path: "scripts/new.ts", previousPath: null, status: "A" },
      { path: "new.ts", previousPath: "old.ts", status: "R100" },
    ]
  );
  assert.throws(() => parseNameStatusZ("M\0missing-path"), /malformed/i);
});
