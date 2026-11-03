/**
 * @file fuzzy.ts
 * @description Subsequence matcher with positional scoring, used by the command
 * palette to rank results and to underline the characters that matched.
 *
 * ## Why not a plain substring filter
 * The palette now indexes well over a hundred commands — every page, every
 * Settings section, every Agent Config tab, every quick action — so exact
 * substring matching makes most of them unreachable without typing their exact
 * wording. Subsequence matching lets `sh` find "Keyboard **sh**ortcuts" and `cfg`
 * find "Agent **C**on**f**i**g**.
 *
 * ## Why not a library
 * A ranking function is the entire behavior of a launcher; owning it means the
 * weights can be tuned against this app's actual command names, and it keeps the
 * client bundle free of a dependency for ~60 lines of arithmetic.
 *
 * The weights favor, in order: a contiguous run, a match at a word boundary, and
 * an early match — which is what makes short queries land on the obvious command
 * instead of an incidental deep one.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/fuzzy.ts
 * **Area:** client library
 * **Responsibility:**
 * Subsequence matcher with positional scoring, used by the command palette to rank results and to
 * underline the characters that matched. ## Why not a plain substring filter The palette now
 * indexes well over a hundred commands — every page, every Settings section, every Agent Config
 * tab, every quick action — so exact substring matching makes most of them unreachable without
 * typing their exact wording. Subsequence matching lets `sh` find "Keyboard **sh**ortcuts" and
 * `cfg` find "Agent **C**on**f**i**g**. ## Why not a library A ranking function is the entire
 * behavior of a launcher; owning it means the weights can be tuned against this app's actual
 * command names, and it keeps the client bundle free of a dependency for ~60 lines of arithmetic.
 * The weights favor, in order: a contiguous run, a match at a word boundary, and an early match —
 * which is what makes short queries land on the obvious command instead of an incidental deep one.
 *
 * ## Architectural boundary
 * - Provides shared typed behavior or wire contracts consumed by multiple client screens and
 *   components.
 * - Keep functions deterministic and side effects explicit; central helpers amplify both correct
 *   behavior and regressions.
 * - Types mirroring server payloads must stay aligned with serializers, OpenAPI descriptions, and
 *   WebSocket messages.
 *
 * ## Public surface
 * - `foldText` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `fuzzyMatch` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `FuzzyMatch` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `fuzzyMatchFields` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `highlightSegments` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `BONUS_CONTIGUOUS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `BONUS_EXACT_SUBSTRING` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `BONUS_FIRST_CHAR` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `BONUS_PREFIX` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `BONUS_WORD_START` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `FoldedText` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `foldText` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `foldWithOffsets` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `fuzzyMatch` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FuzzyMatch` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fuzzyMatchFields` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `highlightSegments` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `isSeparator` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PENALTY_GAP` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Preserve null, undefined, zero, and empty distinctions when they carry different server or
 *   presentation meaning.
 * - Do not mutate caller-owned collections in formatters, mergers, grouping helpers, or selectors.
 * - Keep stable sorting and tie-breakers explicit so live updates do not reorder equal records
 *   unpredictably.
 * - Use exhaustive checks for discriminated unions when new providers, messages, or statuses can be
 *   added.
 * - Keep URL construction encoded and route through shared auth/source-scope behavior.
 * - Return errors with enough context for the UI to explain the failed action without leaking
 *   secrets.
 * - Avoid browser globals at module evaluation time unless the module is deliberately browser-only
 *   and tested as such.
 * - Keep formatting locale-aware where the chosen UI language, not the browser default, owns the
 *   output.
 * - Document non-obvious thresholds, unit conversions, and compatibility fallbacks beside their
 *   definitions.
 * - Add table-driven tests for boundary values because library helpers often serve many visually
 *   unrelated screens.
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
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/fuzzy.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `client/src/lib/fuzzy.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `FuzzyMatch` — exported API; see TSDoc on the symbol for behavior.
 * - `foldText` — exported API; see TSDoc on the symbol for behavior.
 * - `fuzzyMatch` — exported API; see TSDoc on the symbol for behavior.
 * - `fuzzyMatchFields` — exported API; see TSDoc on the symbol for behavior.
 * - `highlightSegments` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **FuzzyMatch**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **foldText**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **fuzzyMatch**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **fuzzyMatchFields**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **highlightSegments**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Result of a successful match. `indices` are positions in the original text. */
export interface FuzzyMatch {
  /** Match quality; higher is better. Only comparable between results for the same query. */
  score: number;
  /** Positions of the matched characters in the original text, for highlighting. */
  indices: number[];
}

/** Score added when a matched character directly follows the previous match. */
const BONUS_CONTIGUOUS = 8;
/**
 * Score added when a matched character starts a word (follows a space, `-`, `_`, `/`, `.`, or `:`).
 */
const BONUS_WORD_START = 12;
/** Score added when the first query character matches the very first character of the text. */
const BONUS_FIRST_CHAR = 16;
/** Score subtracted per skipped character between matches, capped at 10 per gap. */
const PENALTY_GAP = 1;
/** Score added when the whole query appears as a contiguous substring. */
const BONUS_EXACT_SUBSTRING = 40;
/** Extra score when that contiguous substring is at the very start of the text. */
const BONUS_PREFIX = 30;

/**
 * Characters after which the next character counts as starting a word.
 *
 * @param char - Preceding character.
 * @returns True for space, `-`, `_`, `/`, `.`, and `:`.
 */
function isSeparator(char: string): boolean {
  return (
    char === " " || char === "-" || char === "_" || char === "/" || char === "." || char === ":"
  );
}

/** Folded text plus, for each folded position, the index it came from. */
interface FoldedText {
  /** Text after case folding and diacritic stripping. */
  text: string;
  /** `offsets[i]` is the index in the original string that produced `text[i]`. */
  offsets: number[];
}

/**
 * Fold case and strip diacritics so `analitica` still matches "Analítica" and a
 * Vietnamese label is reachable from an unaccented keyboard — while recording
 * where each folded character came from.
 *
 * The offset map is not optional bookkeeping. Normalization is not
 * length-preserving for every script: a Hangul syllable decomposes into two or
 * three jamo that are *not* combining marks, so they survive the strip and every
 * later character shifts right. Highlighting with folded offsets would then
 * underline the wrong characters in exactly the locales this app ships in.
 * Folding per character keeps the mapping exact, at the cost of one pass.
 *
 * @param value - Original text.
 * @returns The folded text with an offset map back to `value`.
 */
function foldWithOffsets(value: string): FoldedText {
  let text = "";
  const offsets: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const folded = (value[i] ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    for (const char of folded) {
      text += char;
      offsets.push(i);
    }
  }
  return { text, offsets };
}

/**
 * Fold case and strip diacritics so `analitica` still matches "Analítica" and a
 * Vietnamese label is reachable from an unaccented keyboard.
 *
 * @param value - Text to fold.
 * @returns Lowercased text without diacritics.
 */
export function foldText(value: string): string {
  return foldWithOffsets(value).text;
}

/**
 * Score `text` against `query`.
 *
 * @param text  The candidate label (original casing; indices refer to it).
 * @param query What the user typed. An empty query matches with score 0.
 * @returns The match, or `null` when `query` is not a subsequence of `text`.
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatch | null {
  if (!query) return { score: 0, indices: [] };

  const { text: haystack, offsets } = foldWithOffsets(text);
  const needle = foldText(query);
  if (needle.length > haystack.length) return null;

  // Scoring runs on folded positions (that is where the text is comparable);
  // `indices` are mapped back to the original so highlighting lines up.
  const indices: number[] = [];
  let score = 0;
  let searchFrom = 0;
  let previousIndex = -2;

  for (let n = 0; n < needle.length; n += 1) {
    const char = needle[n];
    if (char === undefined) break;
    const found = haystack.indexOf(char, searchFrom);
    if (found === -1) return null;

    if (found === previousIndex + 1) score += BONUS_CONTIGUOUS;
    if (found === 0) score += BONUS_FIRST_CHAR;
    else if (isSeparator(haystack[found - 1] ?? "")) score += BONUS_WORD_START;

    // Gaps cost, but never enough to push a real match below a weaker one that
    // simply happened to be shorter.
    if (previousIndex >= 0) score -= Math.min(found - previousIndex - 1, 10) * PENALTY_GAP;

    const original = offsets[found] ?? found;
    // Two folded characters can map to one original character (a decomposed
    // syllable), so skip the repeat rather than emit a duplicate index.
    if (indices[indices.length - 1] !== original) indices.push(original);
    previousIndex = found;
    searchFrom = found + 1;
  }

  const exactAt = haystack.indexOf(needle);
  if (exactAt === 0) score += BONUS_EXACT_SUBSTRING + BONUS_PREFIX;
  else if (exactAt > 0) score += BONUS_EXACT_SUBSTRING;

  // Shorter labels win ties: with equal evidence, the more specific command is
  // the one whose name has less unmatched noise in it.
  score -= Math.min(haystack.length, 60) / 10;

  return { score, indices };
}

/**
 * Match against several fields, keeping the best score but only ever returning
 * highlight indices for the primary field — underlining characters in a label
 * the user cannot see would be worse than not underlining at all.
 *
 * @param primary   The visible label; the only source of `indices`.
 * @param secondary Extra searchable text (route, keywords, project path).
 */
export function fuzzyMatchFields(
  primary: string,
  secondary: string[],
  query: string
): FuzzyMatch | null {
  const direct = fuzzyMatch(primary, query);
  if (direct) return direct;
  for (const field of secondary) {
    const match = fuzzyMatch(field, query);
    // Secondary hits rank below any primary hit; the offset is larger than the
    // spread the scorer can produce, so ordering between the two tiers is total.
    if (match) return { score: match.score - 1000, indices: [] };
  }
  return null;
}

/**
 * Split `text` into runs, flagging which are part of the match.
 *
 * @param text - Original text.
 * @param indices - Positions of matched characters in `text`.
 * @returns Consecutive runs with a flag marking matched runs.
 */
export function highlightSegments(
  text: string,
  indices: number[]
): { text: string; match: boolean }[] {
  if (indices.length === 0) return [{ text, match: false }];
  const flags = new Set(indices);
  const segments: { text: string; match: boolean }[] = [];
  let current = "";
  let currentMatch = flags.has(0);
  for (let i = 0; i < text.length; i += 1) {
    const isMatch = flags.has(i);
    if (isMatch !== currentMatch && current) {
      segments.push({ text: current, match: currentMatch });
      current = "";
    }
    currentMatch = isMatch;
    current += text[i] ?? "";
  }
  if (current) segments.push({ text: current, match: currentMatch });
  return segments;
}
