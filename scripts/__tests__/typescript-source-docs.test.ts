/**
 * @file Tests the TypeScript maintainer-reference parser, renderer, updater,
 * and significant-token comparator used by the opt-in documentation scripts.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
