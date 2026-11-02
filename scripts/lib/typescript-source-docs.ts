/**
 * @file Parses first-party TypeScript modules into stable documentation facts,
 * renders generated maintainer references, safely upserts those comments, and
 * compares significant TypeScript tokens for comment-only verification.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** scripts/lib/typescript-source-docs.ts
 * **Area:** maintenance script
 * **Responsibility:**
 * Parses first-party TypeScript modules into stable documentation facts, renders generated
 * maintainer references, safely upserts those comments, and compares significant TypeScript tokens
 * for comment-only verification.
 *
 * ## Architectural boundary
 * - Provides an explicit maintainer operation and is never imported into application runtime paths.
 * - Safe inspection is the default; writes, deletions, publication, or other mutations require
 *   unmistakable flags.
 * - Output and exit status form the script's automation contract even when humans usually run it
 *   interactively.
 *
 * ## Top-level implementation landmarks
 * - `analyzeSource` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `appendSection` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `AREA_GUIDES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AreaGuide` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AUTHOR` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BEGIN_MARKER` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `classifyArea` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `compareSignificantTokens` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `compilerCache` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `countOccurrences` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `declarationKind` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `declarationNames` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `END_MARKER` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `extractHeaderTag` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `FALLBACK_GUIDE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `findGeneratedReference` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `insertReferenceAfterHeader` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `isExported` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `loadTypeScriptCompiler` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `NamedFact` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `path` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderMaintainerReference` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `REPO_ROOT` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SHARED_REVIEW` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `significantTokens` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `sortedNamed` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `sortedUnique` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SourceFacts` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TokenDifference` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TokenRecord` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `upsertMaintainerReference` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `wrappedCommentLines` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Literal API paths
 * - `/api/` — route literal present in this source; keep request/response expectations aligned with
 *   the server and API docs.
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
 *   `node scripts/maintain-typescript-docs.ts --check scripts/lib/typescript-source-docs.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

const path = require("node:path");
const { createRequire } = require("node:module");

const AUTHOR = "@author Son Nguyen <hoangson091104@gmail.com>";
const BEGIN_MARKER = "GENERATED_MAINTAINER_REFERENCE:BEGIN";
const END_MARKER = "GENERATED_MAINTAINER_REFERENCE:END";
const REPO_ROOT = path.resolve(__dirname, "../..");

type NamedFact = {
  kind: string;
  name: string;
};

type SourceFacts = {
  path: string;
  area: string;
  overview: string;
  localImports: string[];
  packageImports: string[];
  exports: NamedFact[];
  declarations: NamedFact[];
  reactHooks: string[];
  translationNamespaces: string[];
  apiPaths: string[];
  testCases: string[];
};

type TokenRecord = {
  kind: number;
  text: string;
};

type TokenDifference = {
  index: number;
  before: TokenRecord | null;
  after: TokenRecord | null;
};

type AreaGuide = {
  boundary: string[];
  invariants: string[];
  review: string[];
  validation: string[];
};

let compilerCache: any;

function loadTypeScriptCompiler(): any {
  if (compilerCache) return compilerCache;

  const packageFiles = [
    path.join(REPO_ROOT, "client", "package.json"),
    path.join(REPO_ROOT, "mcp", "package.json"),
  ];
  const failures: string[] = [];
  for (const packageFile of packageFiles) {
    try {
      compilerCache = createRequire(packageFile)("typescript");
      return compilerCache;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Unable to load TypeScript from client or MCP dependencies. Run \`npm run setup\` first. ${failures.join(" | ")}`
  );
}

/** Return sorted unique strings, retaining only non-empty values. */
function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Return sorted unique named facts. */
function sortedNamed(values: Iterable<NamedFact>): NamedFact[] {
  const unique = new Map<string, NamedFact>();
  for (const value of values) unique.set(`${value.name}\0${value.kind}`, value);
  return [...unique.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind)
  );
}

/** Normalize one JSDoc tag body into readable single-line prose. */
function extractHeaderTag(source: string, tag: string): string {
  const header = source.match(/^\uFEFF?\s*\/\*\*[\s\S]*?\*\//)?.[0] ?? "";
  const match = header.match(new RegExp(`@${tag}\\s+([\\s\\S]*?)(?=\\n\\s*\\*\\s*@|\\*\\/)`));
  if (!match) return "";
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify a tracked module into the narrowest repository area we document. */
function classifyArea(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const isTest = /(^|\/)(__tests__|tests)\//.test(normalized) || /\.test\.tsx?$/.test(normalized);

  if (normalized.startsWith("scripts/"))
    return isTest ? "maintenance script test" : "maintenance script";
  if (normalized.startsWith("mcp/")) {
    if (isTest) return "MCP test";
    if (normalized.startsWith("mcp/src/tools/")) return "MCP tool";
    if (normalized.startsWith("mcp/src/transports/")) return "MCP transport";
    if (normalized.startsWith("mcp/src/policy/")) return "MCP policy";
    if (normalized.startsWith("mcp/src/config/")) return "MCP configuration";
    return "MCP server";
  }
  if (normalized.startsWith("desktop/")) return isTest ? "desktop shell test" : "desktop shell";
  if (normalized.startsWith("client/")) {
    if (isTest) return "client test";
    if (normalized.startsWith("client/src/pages/")) return "client page";
    if (normalized.startsWith("client/src/components/workflows/")) {
      return "client workflow visualization";
    }
    if (normalized.startsWith("client/src/components/conversation/")) {
      return "client conversation component";
    }
    if (normalized.startsWith("client/src/components/Tabby/")) return "client Tabby component";
    if (normalized.startsWith("client/src/components/")) return "client component";
    if (normalized.startsWith("client/src/hooks/")) return "client hook";
    if (normalized.startsWith("client/src/i18n/")) return "client localization";
    if (normalized.startsWith("client/src/lib/")) return "client library";
    return "client build or application entry";
  }
  return "TypeScript module";
}

/** Describe the declaration kind using stable words rather than compiler enum numbers. */
function declarationKind(ts: any, node: any): string | null {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isModuleDeclaration(node)) return "namespace";
  if (ts.isVariableStatement(node)) return "variable";
  return null;
}

/** Collect identifier names declared by one supported top-level statement. */
function declarationNames(ts: any, node: any): string[] {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration: any) => declaration.name)
      .filter((name: any) => ts.isIdentifier(name))
      .map((name: any) => name.text);
  }
  if (node.name && ts.isIdentifier(node.name)) return [node.name.text];
  return [];
}

/** Test whether a declaration carries an export modifier. */
function isExported(ts: any, node: any): boolean {
  return Boolean(
    node.modifiers?.some((modifier: any) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/** Extract stable, source-derived facts used by generated documentation. */
function analyzeSource(relativePath: string, source: string): SourceFacts {
  const ts = loadTypeScriptCompiler();
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );
  const localImports: string[] = [];
  const packageImports: string[] = [];
  const declarations: NamedFact[] = [];
  const exports: NamedFact[] = [];
  const declarationKinds = new Map<string, string>();
  const reactHooks: string[] = [];
  const translationNamespaces: string[] = [];
  const apiPaths: string[] = [];
  const testCases: string[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      (specifier.startsWith(".") ? localImports : packageImports).push(specifier);
    }

    const kind = declarationKind(ts, statement);
    if (kind) {
      for (const name of declarationNames(ts, statement)) {
        declarations.push({ kind, name });
        declarationKinds.set(name, kind);
        if (isExported(ts, statement)) exports.push({ kind, name });
      }
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const original = element.propertyName?.text ?? element.name.text;
          const kind = declarationKinds.get(original);
          exports.push({ kind: kind ? `${kind} alias` : "re-export", name: element.name.text });
        }
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        exports.push({ kind: "namespace re-export", name: statement.exportClause.name.text });
      }
    }
    if (ts.isExportAssignment(statement)) exports.push({ kind: "default export", name: "default" });
  }

  function visit(node: any): void {
    if (ts.isCallExpression(node)) {
      let callName = "";
      if (ts.isIdentifier(node.expression)) callName = node.expression.text;
      else if (ts.isPropertyAccessExpression(node.expression)) callName = node.expression.name.text;

      if (/^use[A-Z0-9]/.test(callName)) reactHooks.push(callName);
      if (callName === "useTranslation") {
        const first = node.arguments[0];
        if (first && ts.isStringLiteralLike(first)) translationNamespaces.push(first.text);
      }
      if (["describe", "it", "test"].includes(callName)) {
        const first = node.arguments[0];
        if (first && ts.isStringLiteralLike(first)) testCases.push(first.text);
      }
    }

    if (ts.isStringLiteralLike(node) && node.text.startsWith("/api/")) apiPaths.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const description = extractHeaderTag(source, "description");
  const fileTag = extractHeaderTag(source, "file");
  const basename = path.basename(relativePath);
  const overview = description || (fileTag === basename ? "" : fileTag);

  return {
    path: relativePath.replaceAll("\\", "/"),
    area: classifyArea(relativePath),
    overview:
      overview || `Maintains the ${basename} module within the ${classifyArea(relativePath)} area.`,
    localImports: sortedUnique(localImports),
    packageImports: sortedUnique(packageImports),
    exports: sortedNamed(exports),
    declarations: sortedNamed(declarations),
    reactHooks: sortedUnique(reactHooks),
    translationNamespaces: sortedUnique(translationNamespaces),
    apiPaths: sortedUnique(apiPaths),
    testCases: sortedUnique(testCases),
  };
}

const SHARED_REVIEW = [
  "Read the file header and this generated index before changing code; both describe the intended ownership boundary.",
  "Trace every local import listed here to distinguish data contracts from presentation helpers and avoid circular dependencies.",
  "Search every exported symbol before changing its signature; callers may live in tests, route components, desktop code, or MCP wiring.",
  "Keep observable behavior stable unless the task explicitly requests a behavior change and includes regression coverage.",
  "Prefer the repository's existing helpers and types over parallel abstractions that encode the same contract twice.",
  "Keep failure behavior explicit: recoverable local failures should degrade visibly without hiding actionable diagnostics.",
  "Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated output where this module participates.",
  "Treat identifiers, API paths, event names, translation keys, and persisted field names as compatibility surfaces.",
  "Update the truthful file overview when the module's responsibility changes; never let the header become historical fiction.",
  "Run the narrowest relevant test first, then the area gate, then the full repository verification before merging.",
];

const AREA_GUIDES: Record<string, AreaGuide> = {
  "client page": {
    boundary: [
      "Route-level orchestration belongs here: load scoped data, subscribe to live updates, and compose reusable components.",
      "Server authority remains on the API side; the page may explain or confirm actions but must not invent authorization rules.",
      "The global data-source scope must flow through shared API helpers so local, all-source, and selected-source views agree.",
    ],
    invariants: [
      "Represent loading, empty, partial, error, and refreshed states deliberately; a blank panel is not an error strategy.",
      "Cancel or ignore stale asynchronous work when parameters, source scope, or component lifetime changes.",
      "Merge WebSocket deltas without duplicating entities already returned by the REST snapshot.",
      "Keep query parameters and route state shareable when the surrounding router already exposes that state in URLs.",
      "Use translation keys for visible copy and preserve interpolation tokens across every supported locale.",
      "Keep expensive derivations memoized only when profiling or dependency stability justifies the extra contract.",
      "Preserve keyboard focus and useful headings when switching tabs, filters, drawers, or modal states.",
      "Do not make destructive requests without the confirmation and server-side gate required by the underlying API.",
      "Use canonical formatting helpers for timestamps, durations, token counts, costs, and provider labels.",
      "Keep page-level polling and event subscriptions bounded; cleanup must run on unmount and scope changes.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client component": {
    boundary: [
      "This component should express one reusable UI responsibility through typed props and observable callbacks.",
      "Network orchestration belongs in pages, hooks, or the typed API client unless this component explicitly owns the workflow.",
      "Visual state must remain a projection of props and local interaction state rather than a second server truth.",
    ],
    invariants: [
      "Keep prop meaning and callback timing stable; parent components often rely on both even when types still compile.",
      "Render valid semantic controls with accessible names, focus behavior, disabled states, and keyboard operation.",
      "Keep visible strings in the appropriate i18n namespace rather than embedding English-only literals.",
      "Use shared design tokens and existing primitives so light/dark styling and compact layouts remain coherent.",
      "Avoid mutating arrays or objects received through props; derived display data should be computed immutably.",
      "Make empty and unavailable values explicit instead of rendering misleading zeroes or placeholder punctuation.",
      "Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction requires it.",
      "Do not duplicate server validation or destructive gates as if client-side checks were authoritative.",
      "Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated copy.",
      "Prefer stable keys derived from entity identity over array indexes for live, filtered, or reordered collections.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client workflow visualization": {
    boundary: [
      "Transforms workflow analytics into an explanatory visualization without redefining the server's aggregate semantics.",
      "Layout geometry, interaction state, and rendering adapters stay local; canonical workflow types stay in shared contracts.",
      "Every graphical encoding needs a readable textual label or surrounding explanation for accessibility and debugging.",
    ],
    invariants: [
      "Use stable entity identifiers for nodes, links, colors, selections, legends, and React keys.",
      "Treat missing timestamps, models, token values, parents, and terminal states as expected partial-data cases.",
      "Keep scales and domains deterministic so identical data does not jump between renders.",
      "Bound SVG/canvas dimensions and event listeners; resize observers and D3 selections require cleanup.",
      "Do not silently discard filtered records when a visual limit is applied; explain truncation in the UI.",
      "Keep tooltip and legend values aligned with the exact encoding shown in the chart.",
      "Preserve keyboard and screen-reader paths to information that is otherwise available only by pointer hover.",
      "Avoid mutating API-owned arrays while sorting, grouping, or assigning visualization coordinates.",
      "Keep provider and model labels canonical through shared formatting helpers.",
      "Snapshot tests should assert stable structure, while focused unit tests own geometry and derivation edge cases.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client conversation component": {
    boundary: [
      "Renders durable transcript messages and tool activity without changing the provider-neutral conversation model.",
      "Parsing and normalization belong in shared transcript helpers; this layer owns readable presentation and interaction.",
      "Large histories must remain incremental so a single expanded conversation does not block the dashboard.",
    ],
    invariants: [
      "Preserve message identity and sender attribution across Claude, Codex, Cursor, imported, and snapshot-backed sessions.",
      "Treat tool input, tool output, markdown, code, images, and malformed payloads as distinct rendering cases.",
      "Never execute transcript content; sanitize links and render code as inert text with controlled highlighting.",
      "Keep pagination append/prepend behavior stable and preserve scroll position when older messages arrive.",
      "Do not truncate content without an explicit affordance that lets the operator inspect the full value.",
      "Use virtualization or bounded rendering patterns where the existing component establishes them.",
      "Keep copy/select behavior predictable for terminal-style segments and syntax-highlighted blocks.",
      "Represent missing snapshot data honestly instead of implying the underlying provider still retains a transcript.",
      "Maintain accessible labels for sender, timestamp, tool state, expansion controls, and attachments.",
      "Test malformed and provider-specific rows because transcript fixtures evolve independently of UI releases.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client Tabby component": {
    boundary: [
      "Provides the optional Tabby companion layer without becoming a dependency of core monitoring workflows.",
      "Intent recognition, state transitions, positioning, and rendering remain separable so decoration cannot block data views.",
      "Reduced-motion, hidden, and disabled states are first-class outcomes rather than exceptional branches.",
    ],
    invariants: [
      "Keep companion reactions deterministic for a given event/state input when tests assert a specific response.",
      "Bound timers, animation frames, listeners, and persisted position state; clean them up on unmount.",
      "Respect reduced-motion preferences and never require animation to communicate dashboard status.",
      "Keep the companion out of keyboard focus order unless an element performs an actual interactive action.",
      "Constrain dragging and restored coordinates to the current viewport after resizes or display changes.",
      "Avoid coupling core API requests or monitoring state transitions to companion visibility.",
      "Keep quips and intent vocabulary aligned with the localization decision already established by the module.",
      "Do not let decorative overlays cover destructive confirmations, navigation, or primary session controls.",
      "Prefer explicit state-machine transitions over intersecting booleans that allow impossible poses.",
      "Test cleanup with fake timers where time drives behavior, then restore timer globals after each case.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client hook": {
    boundary: [
      "Owns a reusable React side-effect or stateful subscription while exposing a small declarative interface.",
      "The hook is responsible for setup, freshness, cleanup, and race handling; consumers should not duplicate that lifecycle.",
      "Shared transport and API semantics remain in library modules rather than being hidden inside component-specific closures.",
    ],
    invariants: [
      "List every reactive dependency honestly or use stable refs intentionally with an explanatory comment.",
      "Clean up timers, sockets, observers, media objects, DOM listeners, and event-bus subscriptions on every exit path.",
      "Prevent stale async completions from updating state after unmount, reconnection, or parameter changes.",
      "Keep StrictMode mount-cleanup-remount behavior free of duplicate subscriptions and duplicate messages.",
      "Use functional state updates when the next value depends on the previous value across asynchronous callbacks.",
      "Keep callbacks stable only when consumers benefit; unnecessary memoization makes dependency contracts harder to audit.",
      "Surface recoverable status to consumers rather than swallowing failures into a permanently stale state.",
      "Do not expose mutable internal refs as if they were stable public state.",
      "Keep browser-only globals inside effect or capability checks so tests and non-browser tooling can load the module.",
      "Test mount, update, cleanup, failure, and retry behavior with the narrowest realistic dependency boundary.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client library": {
    boundary: [
      "Provides shared typed behavior or wire contracts consumed by multiple client screens and components.",
      "Keep functions deterministic and side effects explicit; central helpers amplify both correct behavior and regressions.",
      "Types mirroring server payloads must stay aligned with serializers, OpenAPI descriptions, and WebSocket messages.",
    ],
    invariants: [
      "Preserve null, undefined, zero, and empty distinctions when they carry different server or presentation meaning.",
      "Do not mutate caller-owned collections in formatters, mergers, grouping helpers, or selectors.",
      "Keep stable sorting and tie-breakers explicit so live updates do not reorder equal records unpredictably.",
      "Use exhaustive checks for discriminated unions when new providers, messages, or statuses can be added.",
      "Keep URL construction encoded and route through shared auth/source-scope behavior.",
      "Return errors with enough context for the UI to explain the failed action without leaking secrets.",
      "Avoid browser globals at module evaluation time unless the module is deliberately browser-only and tested as such.",
      "Keep formatting locale-aware where the chosen UI language, not the browser default, owns the output.",
      "Document non-obvious thresholds, unit conversions, and compatibility fallbacks beside their definitions.",
      "Add table-driven tests for boundary values because library helpers often serve many visually unrelated screens.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run typecheck:client", "npm run test:client", "npm run verify"],
  },
  "client localization": {
    boundary: [
      "Defines locale registration and parity contracts; English remains the source of truth for every supported language.",
      "Translation resources, interpolation tokens, namespace types, and language switchers must evolve together.",
      "Fallback behavior protects rendering but never substitutes for shipping complete translations.",
    ],
    invariants: [
      "Keep the supported locale set identical across registration, resources, switchers, wiki bundles, and audits.",
      "Preserve key paths, value types, plural forms, and interpolation-token names across every locale.",
      "Never translate code identifiers, commands, paths, environment variables, event names, or provider brands.",
      "Use the established glossary and neighboring terminology rather than inventing a new translation in isolation.",
      "Keep locale maps aligned with BCP-47 formatting identifiers used by dates and numbers.",
      "Treat copied English in a non-English resource as an incomplete translation unless the glossary requires it.",
      "Update all five full-guide and wiki surfaces when the canonical localized documentation changes.",
      "Do not rename exact source markers parsed by wiki localization tests.",
      "Run the parity audit before relying on a fallback to explain a missing key.",
      "Test interpolation and rich text where markup or variables make plain key parity insufficient.",
    ],
    review: SHARED_REVIEW,
    validation: [
      "bash .claude/skills/i18n-parity/scripts/i18n-audit.sh",
      "npm run test:client",
      "npm run verify",
    ],
  },
  "client test": {
    boundary: [
      "Protects an observable client contract using Vitest and, for UI, Testing Library semantics.",
      "The test should fail for a meaningful production regression, not for harmless implementation rearrangement.",
      "Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims to prove.",
    ],
    invariants: [
      "Name the user-visible or contract-level behavior in each test title so failures explain the regression.",
      "Query rendered UI by role, accessible name, or meaningful text before reaching for implementation selectors.",
      "Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.",
      "Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.",
      "Keep fixtures minimal but structurally realistic, including provider and source fields used by production branches.",
      "Assert important negative behavior when duplicate events, stale responses, or absent data are the known risk.",
      "Avoid snapshots for volatile values unless serializers normalize them and review remains readable.",
      "Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual output.",
      "Do not assert internal hook state when the same contract can be observed through rendered output or callbacks.",
      "When fixing a regression, prove the test fails on the broken implementation before accepting the fix.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run test:client", "npm run typecheck:client", "npm run verify"],
  },
  "MCP tool": {
    boundary: [
      "Exposes one dashboard capability through a schema-validated MCP tool while delegating data access to the API client.",
      "Tool descriptions and schemas are part of the model-facing API and must remain precise enough for safe selection.",
      "Mutation and destructive permissions are enforced centrally and cannot be bypassed by a domain handler.",
    ],
    invariants: [
      "Validate every argument with the declared schema before constructing requests or selecting resource identifiers.",
      "Keep read, mutation, and destructive operations correctly classified for policy guards.",
      "Return structured tool results through shared helpers so errors and JSON payloads remain transport-neutral.",
      "Do not leak dashboard tokens, webhook secrets, SSH material, raw environment values, or unredacted configuration.",
      "Preserve pagination and explicit limits for potentially large session, event, transcript, or metrics responses.",
      "Use exact API route and field names from the typed client rather than duplicating ad hoc HTTP calls.",
      "Keep tool names stable; hosts and prompts may persist them outside this repository.",
      "Explain confirmation requirements in both schema descriptions and policy errors for destructive actions.",
      "Keep handlers independent of stdio, HTTP, and REPL transport details.",
      "Test successful, validation, permission-denied, API-error, and redaction paths for each risk-bearing tool.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run mcp:typecheck", "npm run mcp:build", "npm run test:mcp"],
  },
  "MCP transport": {
    boundary: [
      "Owns protocol lifecycle and connection-specific state while keeping tool semantics in the shared registry.",
      "Transport code must not write non-protocol data to stdio stdout or retain resources after disconnect.",
      "Authentication, origin, session, timeout, and graceful-shutdown behavior are explicit security boundaries.",
    ],
    invariants: [
      "Keep stdout reserved for JSON-RPC in stdio mode; diagnostic output belongs through the configured logger.",
      "Create and dispose per-client server/session resources exactly once across normal close and error paths.",
      "Bound request bodies, idle sessions, connection counts, and retained event streams.",
      "Validate authentication before allocating expensive state or exposing tool metadata.",
      "Preserve compatibility between streamable HTTP and supported legacy transport behavior where documented.",
      "Make shutdown idempotent so signals, host disappearance, and transport close cannot race teardown.",
      "Do not trust forwarded host/origin information unless the server configuration explicitly enables that topology.",
      "Keep health endpoints lightweight and independent of long-lived MCP session initialization.",
      "Surface protocol errors in the shape expected by the SDK without leaking internal stacks or secrets.",
      "Test disconnect, expiration, duplicate close, authentication failure, and concurrent-session isolation.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run mcp:typecheck", "npm run mcp:build", "npm run test:mcp"],
  },
  "MCP policy": {
    boundary: [
      "Centralizes capability gates so every transport and tool domain applies the same mutation/destruction rules.",
      "A policy denial is a safe terminal result and must occur before any external state changes.",
      "Configuration enables capability; individual tools still validate their exact target and confirmation contract.",
    ],
    invariants: [
      "Default to read-only behavior when capability configuration is absent, malformed, or ambiguous.",
      "Keep destructive permission strictly stronger than ordinary mutation permission.",
      "Do not infer authorization from transport mode, localhost origin, caller wording, or model identity.",
      "Return actionable denial messages without exposing secret configuration values.",
      "Apply checks before API calls, filesystem writes, process signals, or other irreversible effects.",
      "Keep policy functions deterministic and free of hidden global mutation.",
      "Use exact tool metadata rather than name-prefix guesses when classifying risk.",
      "Preserve auditability by keeping exceptional bypasses explicit and narrowly tested.",
      "Treat new tool domains as unclassified until tests prove their policy category.",
      "Test every combination of read, mutation, destructive, enabled, and disabled capability states.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run mcp:typecheck", "npm run test:mcp", "npm run verify"],
  },
  "MCP configuration": {
    boundary: [
      "Parses environment and command-line configuration into validated values consumed by every MCP mode.",
      "Defaults define the secure local-first posture and malformed input must not silently broaden access.",
      "Secret-bearing inputs stay in memory and out of logs, banners, tool results, and thrown diagnostics.",
    ],
    invariants: [
      "Parse URLs, booleans, ports, durations, limits, and enums explicitly rather than relying on truthy strings.",
      "Keep localhost/read-only defaults when optional settings are absent.",
      "Reject or safely fall back from invalid values with a message that names the setting, not its secret value.",
      "Preserve precedence between CLI flags, environment variables, and defaults.",
      "Normalize trailing slashes and path forms once so downstream clients do not repeat URL logic.",
      "Keep destructive capability opt-in and independent from ordinary mutation capability.",
      "Do not include tokens or credentials when serializing config for diagnostics.",
      "Bound numeric values to prevent disabled timeouts, unbounded pages, or invalid network listeners.",
      "Document new settings on every required project surface before treating them as supported.",
      "Test absent, valid, invalid, boundary, precedence, and redaction cases.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run mcp:typecheck", "npm run test:mcp", "npm run verify"],
  },
  "MCP server": {
    boundary: [
      "Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent server behavior.",
      "Domain modules own individual tools; this layer owns consistent registration and process-level coordination.",
      "Host disappearance and signals must converge on bounded, idempotent cleanup.",
    ],
    invariants: [
      "Keep server metadata and advertised capabilities synchronized with the actual registered implementation.",
      "Do not let one tool-registration failure leave a partially initialized server accepting requests.",
      "Preserve transport neutrality for tool behavior and result formatting.",
      "Route logs away from protocol stdout and redact secret-bearing fields.",
      "Make startup failures explicit and nonzero while allowing graceful close to finish in-flight cleanup.",
      "Keep orphan detection bounded and compare against the correct startup parent semantics.",
      "Avoid module-evaluation side effects that complicate tests or create resources before configuration validates.",
      "Keep tool collection deterministic so schemas and help output do not reorder between runs.",
      "Treat unhandled rejection and exception paths as process health failures without double-running shutdown.",
      "Test server construction independently from real network transports where the SDK permits it.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run mcp:typecheck", "npm run mcp:build", "npm run test:mcp"],
  },
  "MCP test": {
    boundary: [
      "Protects MCP schema, policy, API-client, formatting, lifecycle, or transport behavior using Node's test runner.",
      "Tests should exercise public contracts with realistic SDK and HTTP boundaries while keeping external state local.",
      "Fixtures must not contain usable credentials or depend on the operator's real dashboard configuration.",
    ],
    invariants: [
      "Name the exact protocol or policy contract in each test so a failure identifies the broken boundary.",
      "Use ephemeral ports, temporary directories, and isolated environment values for concurrent-safe execution.",
      "Restore process globals, environment variables, clocks, fetch stubs, and listeners after every case.",
      "Assert structured results and error shapes rather than only checking that a call throws.",
      "Cover redaction and permission denial for every secret-bearing or state-changing path.",
      "Avoid snapshotting unstable SDK internals when a focused schema or result assertion is clearer.",
      "Test cleanup and idempotence because abandoned transports and timers can keep the process alive.",
      "Keep test doubles behaviorally faithful to the API client methods used by the subject.",
      "Exercise malformed and boundary inputs at schema and direct-function layers where each owns distinct validation.",
      "Prove regression tests fail against the broken behavior before accepting a fix.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run test:mcp", "npm run mcp:typecheck", "npm run mcp:build"],
  },
  "desktop shell": {
    boundary: [
      "Owns Electron main-process lifecycle, local server hosting, native integration, and the narrow preload boundary.",
      "Renderer code remains web-compatible; privileged filesystem, process, tray, menu, and window operations stay here.",
      "Startup and shutdown coordinate one dashboard server instance without corrupting discovery or user data.",
    ],
    invariants: [
      "Keep context isolation enabled and expose only the minimum typed preload surface required by the renderer.",
      "Do not enable arbitrary Node integration or pass unchecked renderer input into filesystem/process operations.",
      "Make window, tray, server, and app shutdown idempotent across quit, close, signal, and update paths.",
      "Resolve packaged and development resource paths explicitly for macOS, Windows, and Linux layouts.",
      "Use atomic writes for discovery and state files that another process may read during startup.",
      "Remove stale discovery metadata only when it belongs to the process being stopped.",
      "Keep single-instance and deep-link handling bounded to the intended application origin.",
      "Preserve platform-specific menu and login-item semantics without assuming one operating system.",
      "Avoid blocking the main process with synchronous work on hot lifecycle paths.",
      "Test pure path/lifecycle decisions and run the desktop-specific suite for process integration changes.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run desktop:test", "npm run desktop:build", "npm run verify"],
  },
  "desktop shell test": {
    boundary: [
      "Protects desktop lifecycle and integration decisions without requiring access to the operator's real profile.",
      "Mocks represent Electron process boundaries; pure helpers should be tested directly whenever possible.",
      "Temporary files and discovery records must remain isolated and removable on every platform.",
    ],
    invariants: [
      "Restore mocked Electron modules, process globals, environment values, and timers after each case.",
      "Use temporary directories rather than repository or home-directory state.",
      "Normalize only where platform behavior is intentionally equivalent; preserve meaningful separator differences.",
      "Assert idempotent cleanup after partial startup and duplicate shutdown requests.",
      "Cover packaged and development path resolution when the production code distinguishes them.",
      "Do not rely on a graphical display for tests that can validate main-process decisions as plain functions.",
      "Keep fake app/window/tray objects limited to methods used by the subject so missing calls remain visible.",
      "Test ownership checks before deleting discovery files or signalling processes.",
      "Avoid arbitrary sleeps; expose readiness promises or use controlled fake time.",
      "Run platform matrix CI for behavior that depends on operating-system process semantics.",
    ],
    review: SHARED_REVIEW,
    validation: ["npm run desktop:test", "npm run desktop:build", "npm run verify"],
  },
  "maintenance script": {
    boundary: [
      "Provides an explicit maintainer operation and is never imported into application runtime paths.",
      "Safe inspection is the default; writes, deletions, publication, or other mutations require unmistakable flags.",
      "Output and exit status form the script's automation contract even when humans usually run it interactively.",
    ],
    invariants: [
      "Resolve the repository root from the script location instead of assuming the caller's current directory.",
      "Accept normalized repository-relative paths and reject traversal outside the checkout.",
      "Keep output deterministic so CI logs and repeated maintenance runs are reviewable.",
      "Use nonzero exits for invalid input, stale generated state, partial failure, and unmet safety checks.",
      "Print actionable remediation without dumping secrets, full environment objects, or unrelated file content.",
      "Do not mutate by default; require an explicit write/apply/confirm option appropriate to the risk.",
      "Write atomically or use content-preserving replacement when interruption could damage a source file.",
      "Support paths containing spaces and platform separators; avoid shell-dependent parsing assumptions.",
      "Keep repeated execution idempotent and report changed versus unchanged work accurately.",
      "Test argument parsing and pure transformations before relying on end-to-end filesystem smoke tests.",
    ],
    review: SHARED_REVIEW,
    validation: [
      "node --test scripts/__tests__/typescript-source-docs.test.ts",
      "bash .claude/skills/file-headers/scripts/check-headers.sh",
      "npm run verify",
    ],
  },
  "maintenance script test": {
    boundary: [
      "Protects repository-maintenance tooling with deterministic fixtures and no dependence on operator data.",
      "Pure parsing, rendering, selection, and comparison contracts are preferred over broad subprocess snapshots.",
      "A failing case should identify the unsafe or stale behavior that a maintainer would otherwise encounter.",
    ],
    invariants: [
      "Use temporary directories for integration fixtures and clean them even when an assertion fails.",
      "Assert exit semantics and diagnostics separately from transformed content.",
      "Exercise paths containing spaces, Windows separators, empty selections, and malformed arguments.",
      "Prove mutation modes are explicit while check/dry-run modes leave bytes unchanged.",
      "Keep fixtures small enough that expected generated text remains reviewable.",
      "Test idempotence by applying the same operation twice and comparing exact bytes.",
      "Test hostile comment text and paths so generated source cannot escape its documentation block.",
      "Use real TypeScript scanning for semantic-equivalence claims rather than regular-expression stripping.",
      "Avoid network dependencies; repository facts should be injected or read from local Git state.",
      "Run the test once in the broken state before implementing each behavior.",
    ],
    review: SHARED_REVIEW,
    validation: ["node --test scripts/__tests__/typescript-source-docs.test.ts", "npm run verify"],
  },
};

const FALLBACK_GUIDE: AreaGuide = {
  boundary: [
    "Owns a focused TypeScript responsibility within the repository and should remain loadable only by its intended consumers.",
    "Public exports are compatibility surfaces; internal declarations may change only while their observable behavior remains stable.",
    "Cross-package dependencies should point through established contracts rather than reaching into build output or private state.",
  ],
  invariants: [
    "Keep types narrower than the untrusted values they validate and avoid assertions that merely silence the compiler.",
    "Preserve deterministic output, ordering, and error behavior for identical inputs.",
    "Do not create module-evaluation side effects unless startup ownership is the module's explicit purpose.",
    "Use explicit units for time, bytes, tokens, money, and percentages.",
    "Keep nullable and optional fields distinct where absence carries meaning.",
    "Avoid hidden mutation of arguments and imported singleton state.",
    "Keep asynchronous work cancellable or safely ignorable after its consumer is gone.",
    "Return actionable errors without leaking secrets or unrelated implementation details.",
    "Document compatibility fallbacks beside the branch that implements them.",
    "Add focused tests for new boundary and failure cases.",
  ],
  review: SHARED_REVIEW,
  validation: ["npm run verify"],
};

/** Wrap comment prose while retaining a stable prefix on every line. */
function wrappedCommentLines(
  text: string,
  prefix = " * ",
  width = 100,
  continuationPrefix = prefix
): string[] {
  const safe = text.replaceAll("*/", "* /").replace(/\s+/g, " ").trim();
  if (!safe) return [prefix.trimEnd()];
  const available = Math.max(20, width - prefix.length);
  const words = safe.match(/`[^`]*`|\S+/g) ?? [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + word.length + 1 > available) {
      lines.push((lines.length === 0 ? prefix : continuationPrefix) + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push((lines.length === 0 ? prefix : continuationPrefix) + line);
  return lines;
}

/** Append a heading and bullet list to a generated comment. */
function appendSection(lines: string[], heading: string, entries: string[]): void {
  if (entries.length === 0) return;
  lines.push(" *", ` * ## ${heading}`);
  for (const entry of entries) lines.push(...wrappedCommentLines(entry, " * - ", 100, " *   "));
}

/** Render a deterministic, module-specific navigation and review reference. */
function renderMaintainerReference(facts: SourceFacts): string {
  const guide = AREA_GUIDES[facts.area] ?? FALLBACK_GUIDE;
  const lines = [
    "/*",
    ` * ${BEGIN_MARKER}`,
    " *",
    " * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.",
    " * It is derived from the current TypeScript AST and repository-area contracts.",
    " * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.",
    " *",
    ` * **Module:** ${facts.path.replaceAll("*/", "* /")}`,
    ` * **Area:** ${facts.area.replaceAll("*/", "* /")}`,
    " * **Responsibility:**",
    ...wrappedCommentLines(facts.overview),
  ];

  appendSection(lines, "Architectural boundary", guide.boundary);
  appendSection(
    lines,
    "Local dependency edges",
    facts.localImports.map(
      (specifier) =>
        `\`${specifier}\` — repository-local contract consumed by this module; review its exports before changing assumptions here.`
    )
  );
  appendSection(
    lines,
    "Package dependency edges",
    facts.packageImports.map(
      (specifier) =>
        `\`${specifier}\` — external package boundary; keep usage within the installed version and the repository's existing adapter patterns.`
    )
  );
  appendSection(
    lines,
    "Public surface",
    facts.exports.map(
      ({ name, kind }) =>
        `\`${name}\` (${kind}) — exported contract; search downstream imports and tests before changing its name, shape, or timing.`
    )
  );
  appendSection(
    lines,
    "Top-level implementation landmarks",
    facts.declarations.map(
      ({ name, kind }) =>
        `\`${name}\` (${kind}) — top-level declaration that helps orient code review and focused test selection.`
    )
  );
  appendSection(
    lines,
    "React and framework hooks",
    facts.reactHooks.map(
      (hook) =>
        `\`${hook}\` — lifecycle/state dependency detected in this module; preserve dependency freshness and cleanup semantics.`
    )
  );
  appendSection(
    lines,
    "Translation namespaces",
    facts.translationNamespaces.map(
      (namespace) =>
        `\`${namespace}\` — visible copy resolves through this namespace; key and interpolation parity applies to every supported locale.`
    )
  );
  appendSection(
    lines,
    "Literal API paths",
    facts.apiPaths.map(
      (apiPath) =>
        `\`${apiPath}\` — route literal present in this source; keep request/response expectations aligned with the server and API docs.`
    )
  );
  appendSection(
    lines,
    "Named test contracts",
    facts.testCases.map(
      (testCase) =>
        `\`${testCase}\` — executable behavior named by this suite; preserve the observable contract or update the test with rationale.`
    )
  );
  appendSection(lines, "Area invariants", guide.invariants);
  appendSection(lines, "Change-review checklist", guide.review);
  appendSection(
    lines,
    "Focused validation",
    guide.validation.map(
      (command) => `Run \`${command}\` and resolve failures before widening the verification scope.`
    )
  );
  appendSection(lines, "Reference maintenance", [
    `Regenerate all tracked references with \`node scripts/maintain-typescript-docs.ts --write\`.`,
    `Check this module without writing via \`node scripts/maintain-typescript-docs.ts --check ${facts.path}\`.`,
    "Prove existing-file edits are comments/trivia only with `node scripts/verify-typescript-comment-only.ts origin/master`.",
    "Review the regenerated diff: generated structure is evidence, not a substitute for understanding runtime behavior.",
  ]);
  lines.push(" *", ` * ${END_MARKER}`, " */");
  return lines.join("\n");
}

/** Count non-overlapping literal occurrences. */
function countOccurrences(source: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

/** Locate one complete generated block comment while ignoring marker text in strings/code. */
function findGeneratedReference(source: string): { start: number; end: number } | null {
  const ts = loadTypeScriptCompiler();
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source
  );
  const matches: Array<{ start: number; end: number }> = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (
      kind !== ts.SyntaxKind.MultiLineCommentTrivia &&
      kind !== ts.SyntaxKind.SingleLineCommentTrivia
    ) {
      continue;
    }
    const comment = scanner.getTokenText();
    const begins = countOccurrences(comment, BEGIN_MARKER);
    const ends = countOccurrences(comment, END_MARKER);
    if (begins === 0 && ends === 0) continue;
    if (begins !== 1 || ends !== 1 || comment.indexOf(BEGIN_MARKER) > comment.indexOf(END_MARKER)) {
      throw new Error("Source contains malformed generated reference markers.");
    }
    matches.push({ start: scanner.getTokenPos(), end: scanner.getTextPos() });
  }
  if (matches.length > 1) throw new Error("Source contains duplicate generated references.");
  return matches[0] ?? null;
}

/** Normalize a generated reference to immediately follow the required file header. */
function insertReferenceAfterHeader(source: string, header: string, block: string): string {
  const remainder = source
    .slice(header.length)
    .replace(/^(?:[ \t]*\r?\n)+/, "")
    .replace(/^\s+$/, "");
  return remainder ? `${header}\n${block.trim()}\n\n${remainder}` : `${header}\n${block.trim()}\n`;
}

/** Insert or replace exactly one generated reference without touching executable text. */
function upsertMaintainerReference(source: string, block: string): string {
  const header = source.match(/^\uFEFF?\s*\/\*\*[\s\S]*?\*\//)?.[0];
  if (!header || countOccurrences(header, AUTHOR) !== 1) {
    throw new Error(
      "Source must contain exactly one author line before a reference can be maintained."
    );
  }
  if (countOccurrences(block, BEGIN_MARKER) !== 1 || countOccurrences(block, END_MARKER) !== 1) {
    throw new Error("Generated reference block must contain exactly one begin and end marker.");
  }

  const normalizedBlock = block.trim();
  const existing = findGeneratedReference(source);
  if (existing) {
    const before = source.slice(0, existing.start).replace(/[ \t]+$/, "");
    const after = source.slice(existing.end).replace(/^(?:[ \t]*\r?\n)+/, "\n");
    const withoutReference = before + after;
    const cleanHeader = withoutReference.match(/^\uFEFF?\s*\/\*\*[\s\S]*?\*\//)?.[0];
    if (!cleanHeader) throw new Error("Source lost its required file header during replacement.");
    return insertReferenceAfterHeader(withoutReference, cleanHeader, normalizedBlock);
  }

  return insertReferenceAfterHeader(source, header, normalizedBlock);
}

/** Scan significant tokens, deliberately excluding whitespace and all comments. */
function significantTokens(relativePath: string, source: string): TokenRecord[] {
  const ts = loadTypeScriptCompiler();
  const languageVariant = relativePath.endsWith(".tsx")
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, languageVariant, source);
  const tokens: TokenRecord[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    tokens.push({ kind, text: scanner.getTokenText() });
  }
  return tokens;
}

/** Return the first significant-token difference, or null for a comments/trivia-only edit. */
function compareSignificantTokens(
  relativePath: string,
  beforeSource: string,
  afterSource: string
): TokenDifference | null {
  const before = significantTokens(relativePath, beforeSource);
  const after = significantTokens(relativePath, afterSource);
  const count = Math.max(before.length, after.length);
  for (let index = 0; index < count; index += 1) {
    const beforeToken = before[index] ?? null;
    const afterToken = after[index] ?? null;
    if (beforeToken?.kind !== afterToken?.kind || beforeToken?.text !== afterToken?.text) {
      return { index, before: beforeToken, after: afterToken };
    }
  }
  return null;
}

module.exports = {
  AUTHOR,
  BEGIN_MARKER,
  END_MARKER,
  REPO_ROOT,
  analyzeSource,
  classifyArea,
  renderMaintainerReference,
  upsertMaintainerReference,
  significantTokens,
  compareSignificantTokens,
};
