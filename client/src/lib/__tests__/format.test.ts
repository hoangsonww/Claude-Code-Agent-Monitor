/**
 * @file format.test.ts
 * @description Unit tests for the format utility functions to ensure correct formatting of durations, time ago, truncation, and locale-aware date/time in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/format.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the format utility functions to ensure correct formatting of durations, time ago,
 * truncation, and locale-aware date/time in the agent dashboard application.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `fmt` — executable behavior named by this suite; preserve the observable contract or update the
 *   test with rationale.
 * - `fmtCost` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `formatDuration` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `formatModelName` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `formatMs` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `formats Claude model names with version dots` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `formats Gemini model names` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `formats GPT model names with hyphenated brand-version` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `handles context-window [1m] tag` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `locale-aware date formatting` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `returns null for falsy input` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should compute duration between two ISO strings` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should format billions with B suffix` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should format date-time using the active locale` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should format hours and minutes` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should format millions with M suffix` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should format minutes and seconds` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should format seconds only` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should format small costs with dollar sign` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should format thousands with K suffix` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should format time using the active locale` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should handle empty string` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should handle long durations` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should handle max of 1` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should handle zero duration` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should map selected language to the expected locale` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should return "just now" for recent times` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `should return 0s for negative values` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should return 0s for zero` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should return days ago` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should return hours ago` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should return minutes ago` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should return raw number below 1000` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should return string unchanged when exactly max length` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should return string unchanged when shorter than max` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should truncate and add ellipsis when longer than max` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should truncate sub-second precision` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `strips -latest suffix` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `strips date suffixes` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `strips provider prefix` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `timeAgo` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `title-cases unknown models` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `truncate` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
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
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/format.test.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/lib/__tests__/format.test.ts`
 *
 * Scope
 * Unit tests for the format utility functions to ensure correct formatting of durations, time ago,
 * truncation, and locale-aware date/time in the agent dashboard application.
 *
 * Subjects and collaborators
 * - `../format` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Fake timers control debounce, timeout, or interval boundaries; restore real timers during teardown.
 *
 * Suite groups
 * - `formatMs`
 * - `formatDuration`
 * - `timeAgo`
 * - `locale-aware date formatting`
 * - `truncate`
 * - `fmt`
 * - `fmtCost`
 * - `formatModelName`
 *
 * Protected behavior
 * - should return 0s for negative values
 * - should return 0s for zero
 * - should format seconds only
 * - should format minutes and seconds
 * - should format hours and minutes
 * - should truncate sub-second precision
 * - should compute duration between two ISO strings
 * - should handle zero duration
 * - should handle long durations
 * - should return "just now" for recent times
 * - should return minutes ago
 * - should return hours ago
 * - should return days ago
 * - should map selected language to the expected locale
 * - should format date-time using the active locale
 * - should format time using the active locale
 * - should return string unchanged when shorter than max
 * - should return string unchanged when exactly max length
 * - should truncate and add ellipsis when longer than max
 * - should handle max of 1
 * - should handle empty string
 * - should return raw number below 1000
 * - should format thousands with K suffix
 * - should format millions with M suffix
 * - should format billions with B suffix
 * - should format small costs with dollar sign
 * - returns null for falsy input
 * - formats Claude model names with version dots
 * - strips date suffixes
 * - strips -latest suffix
 * - handles context-window [1m] tag
 * - formats GPT model names with hyphenated brand-version
 * - formats Gemini model names
 * - strips provider prefix
 * - title-cases unknown models
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect, vi, afterEach } from "vitest";
import i18n from "i18next";
import {
  formatMs,
  formatDuration,
  timeAgo,
  truncate,
  fmt,
  fmtCost,
  formatDateTime,
  formatTime,
  getCurrentLocale,
  formatModelName,
} from "../format";

describe("formatMs", () => {
  it("should return 0s for negative values", () => {
    expect(formatMs(-1000)).toBe("0s");
    expect(formatMs(-1)).toBe("0s");
  });

  it("should return 0s for zero", () => {
    expect(formatMs(0)).toBe("0s");
  });

  it("should format seconds only", () => {
    expect(formatMs(1000)).toBe("1s");
    expect(formatMs(5000)).toBe("5s");
    expect(formatMs(59000)).toBe("59s");
  });

  it("should format minutes and seconds", () => {
    expect(formatMs(60000)).toBe("1m 0s");
    expect(formatMs(90000)).toBe("1m 30s");
    expect(formatMs(125000)).toBe("2m 5s");
    expect(formatMs(3599000)).toBe("59m 59s");
  });

  it("should format hours and minutes", () => {
    expect(formatMs(3600000)).toBe("1h 0m");
    expect(formatMs(5400000)).toBe("1h 30m");
    expect(formatMs(7260000)).toBe("2h 1m");
  });

  it("should truncate sub-second precision", () => {
    expect(formatMs(1500)).toBe("1s");
    expect(formatMs(999)).toBe("0s");
  });
});

describe("formatDuration", () => {
  it("should compute duration between two ISO strings", () => {
    const start = "2026-03-05T10:00:00.000Z";
    const end = "2026-03-05T10:05:30.000Z";
    expect(formatDuration(start, end)).toBe("5m 30s");
  });

  it("should handle zero duration", () => {
    const t = "2026-03-05T10:00:00.000Z";
    expect(formatDuration(t, t)).toBe("0s");
  });

  it("should handle long durations", () => {
    const start = "2026-03-05T10:00:00.000Z";
    const end = "2026-03-05T12:30:00.000Z";
    expect(formatDuration(start, end)).toBe("2h 30m");
  });
});

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return "just now" for recent times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T10:00:30Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("just now");
  });

  it("should return minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T10:05:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("5m ago");
  });

  it("should return hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T13:00:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("3h ago");
  });

  it("should return days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T10:00:00Z"));
    expect(timeAgo("2026-03-05T10:00:00Z")).toBe("2d ago");
  });
});

describe("locale-aware date formatting", () => {
  it("should map selected language to the expected locale", async () => {
    await i18n.changeLanguage("zh");
    expect(getCurrentLocale()).toBe("zh-CN");

    await i18n.changeLanguage("vi");
    expect(getCurrentLocale()).toBe("vi-VN");

    await i18n.changeLanguage("ko");
    expect(getCurrentLocale()).toBe("ko-KR");

    await i18n.changeLanguage("es");
    expect(getCurrentLocale()).toBe("es-ES");

    await i18n.changeLanguage("en");
    expect(getCurrentLocale()).toBe("en-US");
  });

  it("should format date-time using the active locale", async () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("formatted-datetime");
    await i18n.changeLanguage("vi");

    expect(formatDateTime("2026-03-05T10:00:00.000Z")).toBe("formatted-datetime");
    expect(spy).toHaveBeenCalledWith(
      "vi-VN",
      expect.objectContaining({
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  });

  it("should format time using the active locale", async () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("formatted-time");
    await i18n.changeLanguage("zh");

    expect(formatTime("2026-03-05T10:00:00.000Z")).toBe("formatted-time");
    expect(spy).toHaveBeenCalledWith(
      "zh-CN",
      expect.objectContaining({
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  });
});

describe("truncate", () => {
  it("should return string unchanged when shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should return string unchanged when exactly max length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should truncate and add ellipsis when longer than max", () => {
    expect(truncate("hello world", 8)).toBe("hello w\u2026");
  });

  it("should handle max of 1", () => {
    expect(truncate("hello", 1)).toBe("\u2026");
  });

  it("should handle empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("fmt", () => {
  it("should return raw number below 1000", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(999)).toBe("999");
  });

  it("should format thousands with K suffix", () => {
    expect(fmt(1000)).toBe("1.0K");
    expect(fmt(1957)).toBe("2.0K");
    expect(fmt(21986)).toBe("22.0K");
  });

  it("should format millions with M suffix", () => {
    expect(fmt(1_000_000)).toBe("1.0M");
    expect(fmt(1_009_500_000)).toBe("1.0B");
  });

  it("should format billions with B suffix", () => {
    expect(fmt(1_000_000_000)).toBe("1.0B");
    expect(fmt(2_500_000_000)).toBe("2.5B");
  });
});

describe("fmtCost", () => {
  it("should format small costs with dollar sign", () => {
    expect(fmtCost(0)).toBe("$0.00");
    expect(fmtCost(833.97)).toBe("$833.97");
    expect(fmtCost(999.99)).toBe("$999.99");
  });

  it("should format thousands with K suffix", () => {
    expect(fmtCost(1000)).toBe("$1.00K");
    expect(fmtCost(2500.5)).toBe("$2.50K");
  });

  it("should format millions with M suffix", () => {
    expect(fmtCost(1_000_000)).toBe("$1.00M");
  });
});

describe("formatModelName", () => {
  it("returns null for falsy input", () => {
    expect(formatModelName(null)).toBeNull();
    expect(formatModelName(undefined)).toBeNull();
    expect(formatModelName("")).toBeNull();
  });

  it("formats Claude model names with version dots", () => {
    expect(formatModelName("claude-opus-4-7")).toBe("Claude Opus 4.7");
    expect(formatModelName("claude-sonnet-4-5")).toBe("Claude Sonnet 4.5");
    expect(formatModelName("claude-haiku-3-5")).toBe("Claude Haiku 3.5");
  });

  it("strips date suffixes", () => {
    expect(formatModelName("claude-opus-4-7-20260101")).toBe("Claude Opus 4.7");
    expect(formatModelName("claude-sonnet-4-5-20250514")).toBe("Claude Sonnet 4.5");
  });

  it("strips -latest suffix", () => {
    expect(formatModelName("claude-sonnet-4-5-latest")).toBe("Claude Sonnet 4.5");
  });

  it("handles context-window [1m] tag", () => {
    expect(formatModelName("claude-opus-4-7[1m]")).toBe("Claude Opus 4.7 (1M)");
    expect(formatModelName("claude-opus-4-7-20260101[1m]")).toBe("Claude Opus 4.7 (1M)");
  });

  it("formats GPT model names with hyphenated brand-version", () => {
    expect(formatModelName("gpt-4o")).toBe("GPT-4o");
    expect(formatModelName("gpt-4o-mini")).toBe("GPT-4o Mini");
    expect(formatModelName("gpt-4-turbo")).toBe("GPT-4 Turbo");
  });

  it("formats Gemini model names", () => {
    expect(formatModelName("gemini-1-5-pro")).toBe("Gemini 1.5 Pro");
  });

  it("strips provider prefix", () => {
    expect(formatModelName("anthropic/claude-opus-4-7")).toBe("Claude Opus 4.7");
  });

  it("title-cases unknown models", () => {
    expect(formatModelName("o1-mini")).toBe("O1 Mini");
    expect(formatModelName("o1-preview")).toBe("O1 Preview");
  });
});
