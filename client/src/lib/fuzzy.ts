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

/** Result of a successful match. `indices` are positions in the original text. */
export interface FuzzyMatch {
  score: number;
  indices: number[];
}

const BONUS_CONTIGUOUS = 8;
const BONUS_WORD_START = 12;
const BONUS_FIRST_CHAR = 16;
const PENALTY_GAP = 1;
const BONUS_EXACT_SUBSTRING = 40;
const BONUS_PREFIX = 30;

/** Characters after which the next character counts as starting a word. */
function isSeparator(char: string): boolean {
  return (
    char === " " || char === "-" || char === "_" || char === "/" || char === "." || char === ":"
  );
}

/** Folded text plus, for each folded position, the index it came from. */
interface FoldedText {
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

/** Split `text` into runs, flagging which are part of the match. */
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
