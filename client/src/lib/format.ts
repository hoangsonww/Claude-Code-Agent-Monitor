/**
 * @file format.ts
 * @description Provides utility functions for formatting dates, times, durations, and numbers in the agent dashboard application. It includes functions to parse ISO timestamp strings while normalizing UTC, format time and date-time strings for display, calculate and format durations between timestamps, and format large numbers with appropriate suffixes (K/M/B) for better readability. These utilities help ensure consistent and user-friendly presentation of temporal and numerical data throughout the application.
 *
 * ## Two cross-cutting concerns
 * 1. **UTC normalization.** The backend stores timestamps via SQLite's
 *    `datetime('now')`, which yields a naive `'YYYY-MM-DD HH:MM:SS'` string with no
 *    timezone. `new Date()` would interpret that as *local* time and silently shift it
 *    by the viewer's UTC offset. Every date helper here therefore routes its input
 *    through {@link parseDate}, which appends a `Z` when no timezone is present so the
 *    value is unambiguously UTC, then relies on `toLocale*` to render it back in the
 *    viewer's local zone. Timestamps that already carry a `Z` or `±HH:MM` offset are
 *    parsed as-is.
 * 2. **Locale awareness.** The dashboard ships four UI languages (English, Chinese,
 *    Vietnamese, Korean). {@link getCurrentLocale} maps the active i18next language to a
 *    BCP-47 tag (`en-US`, `zh-CN`, `vi-VN`, `ko-KR`) that the `Intl`/`toLocale*` APIs
 *    understand, so month names, AM/PM vs. 24-hour clocks, digit grouping and currency
 *    punctuation all follow the chosen language. Relative-time strings ("5m ago") are
 *    instead produced from translated i18next keys rather than `Intl.RelativeTimeFormat`.
 *
 * Number/cost helpers ({@link fmt}, {@link fmtCost}, {@link fmtCostFull}) guard against
 * non-finite and negative input, and abbreviate large magnitudes with K/M/B suffixes for
 * compact stat tiles while a full comma-grouped form is available for tooltips.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import i18n from "../i18n";

// ===========================================================================
// Timestamp parsing + locale resolution (shared internals)
// ===========================================================================

/**
 * Parse a timestamp string into a Date, normalizing UTC.
 * SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' (no timezone).
 * JS treats that as local time, causing offset bugs. This ensures
 * timestamps without a timezone indicator are treated as UTC.
 * @param iso An ISO-8601 string, or SQLite's space-separated `'YYYY-MM-DD HH:MM:SS'`.
 * @returns A `Date`. Callers that pass malformed input get an `Invalid Date` (whose
 *   `getTime()` is `NaN`); several formatters below guard for that explicitly.
 * @example
 *   parseDate("2026-04-18 08:49:13")     // treated as UTC (Z appended)
 *   parseDate("2026-04-18T08:49:13Z")    // parsed as-is
 *   parseDate("2026-04-18T08:49:13-04:00") // parsed as-is (explicit offset)
 */
function parseDate(iso: string): Date {
  // Already has timezone info (Z or +/- offset) - parse directly
  // (`/[+-]\d{2}:\d{2}$/` catches trailing `+04:00`-style offsets).
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso);
  }
  // No timezone - treat as UTC by appending Z
  // Handle both 'YYYY-MM-DD HH:MM:SS' and 'YYYY-MM-DDTHH:MM:SS' formats
  // (the single space -> "T" swap makes the SQLite form valid ISO before adding Z).
  return new Date(iso.replace(" ", "T") + "Z");
}

/** The four UI languages the dashboard localizes formatting for. */
type SupportedLanguage = "en" | "zh" | "vi" | "ko";

/**
 * Resolve the active i18next language down to one of the four {@link SupportedLanguage}
 * codes, defaulting to English for anything unrecognized.
 * @returns `"en" | "zh" | "vi" | "ko"`.
 * @remarks Reads `resolvedLanguage` first (the language i18next actually settled on after
 *   detection/fallback), then `language`, then `"en"`. The value is lowercased and its
 *   region subtag stripped (`split("-")[0]`), so `"en-US"`, `"zh-Hans-CN"` etc. collapse
 *   to their base language before the whitelist check.
 */
function getCurrentLanguage(): SupportedLanguage {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase().split("-")[0];
  if (language === "zh" || language === "vi" || language === "ko" || language === "en") {
    return language;
  }
  return "en"; // any other/undetected language -> English
}

/**
 * Maps the active i18next language to a `toLocaleString` BCP-47 locale tag,
 * so date/number formatting matches the UI's chosen language. Falls back to
 * "en-US" for any language not explicitly supported.
 * @returns One of `"zh-CN" | "vi-VN" | "ko-KR" | "en-US"`.
 * @remarks The region subtag matters: it drives clock convention (English/Korean use
 *   12-hour AM/PM here via the `hour: "2-digit"` options, Chinese/Vietnamese lean 24-hour),
 *   month-name localization, and digit-group/decimal separators used by {@link fmtCostFull}.
 */
export function getCurrentLocale(): string {
  const language = getCurrentLanguage();
  if (language === "zh") return "zh-CN"; // Simplified Chinese (mainland)
  if (language === "vi") return "vi-VN"; // Vietnamese
  if (language === "ko") return "ko-KR"; // Korean
  return "en-US"; // default: US English
}

// ===========================================================================
// Date / time formatters (all locale-aware, all UTC-normalized via parseDate)
// ===========================================================================

/**
 * Formats an ISO/SQLite timestamp as a locale-aware clock time, e.g. "8:49 AM".
 * @param iso Timestamp string (see {@link parseDate}).
 * @returns The time-of-day only, using the current locale's clock convention.
 */
export function formatTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formats an ISO/SQLite timestamp as "Apr 18, 8:49 AM" - the default compact
 * timestamp used across list rows.
 * @param iso Timestamp string (see {@link parseDate}).
 * @returns Abbreviated month + day + clock time in the current locale.
 * @remarks Deliberately omits the year to stay compact; use {@link formatDateTimeFull}
 *   when the year/seconds/timezone matter. Does not guard against invalid dates, so a
 *   malformed input renders as the locale's "Invalid Date" string.
 */
export function formatDateTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleString(getCurrentLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Date only, e.g. "Apr 18" - paired with formatTime as a small second line in
 * narrow list rows (timeline, activity feed) so the date is visible too.
 * @param iso Timestamp string (see {@link parseDate}).
 * @returns Abbreviated month + day, or `""` when the timestamp is unparseable
 *   (so an empty second line simply collapses rather than showing "Invalid Date").
 */
export function formatDateShort(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return ""; // hide rather than render garbage
  return d.toLocaleString(getCurrentLocale(), { month: "short", day: "numeric" });
}

/**
 * Fully detailed timestamp with weekday, full date, seconds, and timezone -
 * e.g. "Sat, Apr 18, 2026, 08:49:13 AM PDT". For detail panels.
 * @param iso Timestamp string (see {@link parseDate}).
 * @returns The fully-qualified localized timestamp, or the original `iso` string
 *   unchanged when it can't be parsed (preserving whatever the backend sent).
 * @remarks `timeZoneName: "short"` renders the viewer's local zone abbreviation (PDT,
 *   KST, …) - a reminder that the underlying value was normalized from UTC to local.
 */
export function formatDateTimeFull(iso: string): string {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return iso; // fall back to the raw string on bad input
  return d.toLocaleString(getCurrentLocale(), {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

// ===========================================================================
// Duration + relative-time formatters
// ===========================================================================

/**
 * Formats the elapsed time between two ISO/SQLite timestamps as "Nh Nm" /
 * "Nm Ns" / "Ns" (see {@link formatMs}). Negative spans (end before start,
 * e.g. clock skew) clamp to "0s".
 * @param start Earlier timestamp (see {@link parseDate}).
 * @param end Later timestamp (see {@link parseDate}).
 * @returns The formatted duration (delegated to {@link formatMs}).
 */
export function formatDuration(start: string, end: string): string {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return formatMs(ms);
}

/**
 * Formats a millisecond duration as the coarsest two-unit representation:
 * "Nh Nm" once >= 1 hour, "Nm Ns" once >= 1 minute, else "Ns".
 * @param ms Duration in milliseconds.
 * @returns A compact two-unit string; sub-second and negative inputs both render as `"0s"`.
 * @remarks Only ever shows the two most-significant units - hours never spill into days
 *   (a 26-hour span reads "26h 0m"), matching the dashboard's short session lifetimes.
 * @example
 *   formatMs(3_930_000) // "1h 5m"
 *   formatMs(65_000)    // "1m 5s"
 *   formatMs(4_000)     // "4s"
 *   formatMs(-10)       // "0s"
 */
export function formatMs(ms: number): string {
  if (ms < 0) return "0s"; // clamp negative spans (clock skew) to zero
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600); // whole hours
  const minutes = Math.floor((totalSec % 3600) / 60); // leftover whole minutes
  const seconds = totalSec % 60; // leftover whole seconds

  if (hours > 0) return `${hours}h ${minutes}m`; // >= 1h: hours + minutes
  if (minutes > 0) return `${minutes}m ${seconds}s`; // >= 1m: minutes + seconds
  return `${seconds}s`; // < 1m: seconds only
}

/**
 * Formats how long ago an ISO/SQLite timestamp was, as a translated relative
 * string ("just now", "5m ago", "3h ago", "2d ago") using {@link i18n}.
 * @param iso A past timestamp (see {@link parseDate}).
 * @returns A localized relative-time phrase; i18next handles pluralization via `count`.
 * @remarks Thresholds cascade seconds -> minutes -> hours -> days (days is the largest
 *   bucket, so a 40-day-old event reads "40d ago"). Under a minute collapses to the
 *   "just now" key. Uses translated keys, not `Intl.RelativeTimeFormat`, so the exact
 *   wording is controlled by the `common:time.*` translation resources.
 */
export function timeAgo(iso: string): string {
  const ms = Date.now() - parseDate(iso).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return i18n.t("common:time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return i18n.t("common:time.mAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("common:time.hAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return i18n.t("common:time.dAgo", { count: days });
}

// ===========================================================================
// String + number formatters
// ===========================================================================

/**
 * Truncates `str` to at most `max` characters, appending an ellipsis ("\u2026")
 * in place of the last character when truncation occurs.
 * @param str Source string.
 * @param max Maximum length of the returned string, *including* the ellipsis.
 * @returns `str` unchanged when it already fits; otherwise its first `max - 1`
 *   characters followed by a single "\u2026" so the result is exactly `max` chars long.
 * @remarks Counts UTF-16 code units, not grapheme clusters, so a `max` that lands inside
 *   a surrogate pair or combining sequence could split it - fine for the ASCII-ish labels
 *   this is used on.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026"; // reserve one slot for the ellipsis
}

/**
 * Format large numbers with B/M/K suffixes.
 * @param n The number to abbreviate (typically a token count or event tally).
 * @returns A compact magnitude string: `"1.2B"`, `"3.4M"`, `"5.6K"`, or the number
 *   verbatim below 1,000. Non-finite input (`NaN`/`±Infinity`) yields `"0"`.
 * @remarks Thresholds are checked largest-first so exactly one suffix applies. Values
 *   under 1,000 are returned unabbreviated via `String(n)` (no forced decimals), so
 *   `fmt(42)` is `"42"` and `fmt(999)` is `"999"`. One decimal place is kept for the
 *   abbreviated tiers (`toFixed(1)`). Negative numbers are passed through unabbreviated.
 * @example fmt(1_500) // "1.5K"   fmt(2_400_000) // "2.4M"   fmt(950) // "950"
 */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0"; // NaN / Infinity guard
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`; // billions
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; // millions
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`; // thousands
  return String(n); // < 1000: show as-is
}

/**
 * Format dollar amounts with K/M suffixes.
 * @param n A dollar amount (e.g. accumulated API spend).
 * @returns A compact currency string with two decimals: `"$1.23M"`, `"$4.56K"`, or
 *   `"$7.89"`. Non-finite *or negative* input yields `"$0.00"`.
 * @remarks Unlike {@link fmt}, negatives are clamped (a cost is never shown below zero)
 *   and the abbreviated tiers keep two decimals to preserve cents-level precision. Caps
 *   at the millions suffix - there is no billions tier for costs.
 * @example fmtCost(12_500) // "$12.50K"   fmtCost(3.5) // "$3.50"   fmtCost(-1) // "$0.00"
 */
export function fmtCost(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "$0.00"; // guard NaN/Infinity/negative
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`; // millions
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`; // thousands
  return `$${n.toFixed(2)}`; // < $1000: full cents
}

/**
 * Format dollar amounts with commas (for tooltips / full display).
 * @param n A dollar amount.
 * @param decimals Fixed number of fraction digits to show (default 2).
 * @returns The un-abbreviated amount with locale-aware digit grouping, e.g.
 *   `"$1,234,567.89"` (en-US) or the locale's equivalent separators. `"$0.00"` for
 *   non-finite/negative input.
 * @remarks Complements {@link fmtCost}: that one is compact for stat tiles, this one is
 *   exact for tooltips/detail views. Grouping and decimal marks come from
 *   {@link getCurrentLocale}, so the same value renders `1,234.50` in en-US and `1.234,50`
 *   in locales that swap the separators. `minimumFractionDigits === maximumFractionDigits`
 *   forces exactly `decimals` places (no trimming, no rounding drift beyond `toLocaleString`).
 */
export function fmtCostFull(n: number, decimals = 2): string {
  if (!Number.isFinite(n) || n < 0) return "$0.00"; // guard NaN/Infinity/negative
  return `$${n.toLocaleString(getCurrentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// ===========================================================================
// Model-name + path formatters
// ===========================================================================

/**
 * Strip the date suffix from a Claude model ID:
 * "claude-opus-4-7-20260101" → "opus-4-7". Returns the original string
 * when the pattern doesn't match, and null/undefined unchanged.
 * @param model A raw model identifier, or null/undefined.
 * @returns The captured `tier-major(-minor)` slug (e.g. `"opus-4-7"`), the original
 *   string if it isn't a `claude-…` id, or `null` for falsy input.
 * @remarks The capture group `([a-z]+-\d+(?:-\d+)?)` grabs the family plus a one- or
 *   two-segment version (`sonnet-4`, `opus-4-7`) but stops before the trailing
 *   `-YYYYMMDD` date. This is the terse form; {@link formatModelName} is the pretty one.
 */
export function shortModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.match(/claude-([a-z]+-\d+(?:-\d+)?)/i);
  return m?.[1] ?? model; // captured slug, else the input unchanged
}

/**
 * Lookup from a lowercased leading token to its display brand. Drives the
 * brand-specific formatting branches in {@link formatModelName}; a token absent
 * here just gets generic title-casing.
 */
const MODEL_BRANDS: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
};

/**
 * Human-friendly model name:
 *  "claude-opus-4-7-20260101" → "Claude Opus 4.7"
 *  "gpt-4o-mini"              → "GPT-4o Mini"
 *  Returns null for falsy input.
 * @param model A raw model id, optionally provider-prefixed and/or context-tagged.
 * @returns A display name, or `null` for falsy input.
 * @remarks Normalization runs in fixed stages:
 *   1. Drop any provider prefix before the last `/` (`anthropic/claude-…` -> `claude-…`).
 *   2. Peel a trailing bracketed context-window tag `[1m]`/`[200k]` off and remember it
 *      as a parenthesized upper-cased suffix (` (1M)`), re-appended at the very end.
 *   3. Strip a trailing `-YYYYMMDD` snapshot date and a trailing `-latest`.
 *   4. Split on `-` and branch by brand:
 *      - **GPT**: keep the brand glued to its version token (`GPT-4o`) and title-case the
 *        remaining words (`mini` -> `Mini`), because GPT versions read as one unit.
 *      - **Claude/Gemini/generic**: title-case each word, but join *runs of numeric
 *        segments* with dots so `4-7` becomes `4.7`; alphanumerics like `4o` pass through.
 * @example
 *   formatModelName("anthropic/claude-opus-4-7-20260101[1m]") // "Claude Opus 4.7 (1M)"
 *   formatModelName("gpt-4o-mini")                            // "GPT-4o Mini"
 *   formatModelName("gemini-1-5-pro")                         // "Gemini 1.5 Pro"
 */
export function formatModelName(model: string | null | undefined): string | null {
  if (!model) return null;

  // Strip provider prefix ("anthropic/claude-opus-4-7" → "claude-opus-4-7")
  let name = model.includes("/") ? model.split("/").pop()! : model;

  // Extract bracketed context-window tag like "[1m]" → suffix " (1M)"
  let ctxSuffix = "";
  const ctxMatch = name.match(/\[(\d+[mk])\]$/i);
  if (ctxMatch) {
    ctxSuffix = ` (${(ctxMatch[1] as string).toUpperCase()})`; // "[1m]" -> " (1M)"
    name = name.slice(0, -ctxMatch[0].length); // remove the bracketed tag from `name`
  }

  // Strip date suffix and "-latest"
  name = name.replace(/-\d{8}$/, "").replace(/-latest$/i, "");

  const parts: string[] = name.split("-");
  const first = parts[0] ?? name; // family/brand token (e.g. "claude", "gpt")
  const brand = MODEL_BRANDS[first.toLowerCase()]; // undefined if not a known brand

  // GPT-style names keep the brand hyphenated with the version token:
  // "gpt-4o-mini" → "GPT-4o Mini"
  if (brand === "GPT" && parts.length >= 2) {
    const versionToken = parts[1] as string; // e.g. "4o" - stays glued to the brand
    const rest = parts.slice(2); // trailing qualifiers, e.g. ["mini"]
    const suffix = rest
      // Numeric segments stay as-is; word segments get title-cased.
      .map((seg) => (/^\d+$/.test(seg) ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
      .join(" ");
    const base = suffix ? `${brand}-${versionToken} ${suffix}` : `${brand}-${versionToken}`;
    return base + ctxSuffix;
  }

  // Claude / Gemini / generic: title-case words, dot-join version digits
  // Seed with the known brand, or a title-cased first token when the brand is unknown.
  const result: string[] = [brand ?? first.charAt(0).toUpperCase() + first.slice(1)];

  let i = 1;
  while (i < parts.length) {
    const seg = parts[i] as string;
    if (/^\d+$/.test(seg)) {
      // Purely numeric segment: greedily absorb following numeric segments and
      // join them with dots so "4-7" -> "4.7", "1-5" -> "1.5".
      const ver = [seg];
      while (i + 1 < parts.length && /^\d+$/.test(parts[i + 1] as string)) {
        i++;
        ver.push(parts[i] as string);
      }
      result.push(ver.join("."));
    } else if (/^\d+\w+$/.test(seg)) {
      // Alphanumeric like "4o"/"3b": keep verbatim (don't title-case or split).
      result.push(seg);
    } else {
      // Plain word: title-case it ("opus" -> "Opus", "pro" -> "Pro").
      result.push(seg.charAt(0).toUpperCase() + seg.slice(1));
    }
    i++;
  }

  return result.join(" ") + ctxSuffix; // re-attach the context-window suffix, if any
}

/**
 * Last segment of a filesystem path. POSIX-only - fine for cwd display.
 * "/Users/dav/code/my-project" → "my-project".
 * @param p An absolute or relative POSIX path, or null/undefined.
 * @returns The final path segment, or `null` for falsy input.
 * @remarks Trailing slashes are stripped first (`/a/b/` -> `b`). A path with no `/`
 *   returns unchanged. The `|| trimmed` fallback guards the degenerate case where the
 *   input is just slashes (e.g. `"/"`), returning the trimmed value rather than `""`.
 *   Backslash-separated (Windows) paths are not handled.
 */
export function pathBasename(p: string | null | undefined): string | null {
  if (!p) return null;
  const trimmed = p.replace(/\/+$/, ""); // drop trailing slash(es)
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.slice(idx + 1) || trimmed;
}
