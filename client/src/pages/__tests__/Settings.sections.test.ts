/**
 * @file Settings.sections.test.ts
 * @description Guards the coupling between the Settings page's in-page table of
 * contents and the sections it links to. `SETTINGS_SECTIONS` drives both the
 * TOC buttons and the `IntersectionObserver` scroll-spy, and each entry is
 * matched to the page body only by a bare `id` string. Adding a section but
 * forgetting its TOC entry hides it from navigation; adding a TOC entry but
 * forgetting the section produces a dead scroll target and a scroll-spy that
 * silently observes nothing. Neither shows up in a render snapshot, so this
 * asserts the two lists agree, in order.
 *
 * Reads the page source through Vite's `?raw` import rather than `node:fs`: the
 * client tsconfig is DOM-only, so a Node builtin here typechecks locally under
 * Vitest but breaks `tsc -b` in the production build.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Settings.sections.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Guards the coupling between the Settings page's in-page table of contents and the sections it
 * links to. `SETTINGS_SECTIONS` drives both the TOC buttons and the `IntersectionObserver`
 * scroll-spy, and each entry is matched to the page body only by a bare `id` string. Adding a
 * section but forgetting its TOC entry hides it from navigation; adding a TOC entry but forgetting
 * the section produces a dead scroll target and a scroll-spy that silently observes nothing.
 * Neither shows up in a render snapshot, so this asserts the two lists agree, in order. Reads the
 * page source through Vite's `?raw` import rather than `node:fs` : the client tsconfig is DOM-only,
 * so a Node builtin here typechecks locally under Vitest but breaks `tsc -b` in the production
 * build.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../Settings.tsx?raw` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `captures` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderedSectionIds` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `tocIds` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `gives every section the scroll-margin the sticky TOC needs` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `keeps the two lists in the same order, so the TOC matches the page` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `links every table-of-contents entry to a section that exists` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `lists every rendered section in the table of contents` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `Settings in-page navigation` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Settings.sections.test.ts`
 *   .
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
 * Path: `client/src/pages/__tests__/Settings.sections.test.ts`
 *
 * Scope
 * Guards the coupling between the Settings page's in-page table of contents and the sections it
 * links to. `SETTINGS_SECTIONS` drives both the TOC buttons and the `IntersectionObserver`
 * scroll-spy, and each entry is matched to the page body only by a bare `id` string. Adding a
 * section but forgetting its TOC entry hides it from navigation; adding a TOC entry but forgetting
 * the section produces a dead scroll target and a scroll-spy that silently observes nothing. Neither
 * shows up in a render snapshot, so this asserts the two lists agree, in order. Reads the page
 * source through Vite's `?raw` import rather than `node:fs`: the client tsconfig is DOM-only, so a
 * Node builtin here typechecks locally under Vitest but breaks `tsc -b` in the production build.
 *
 * Subjects and collaborators
 * - `../Settings.tsx?raw` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `Settings in-page navigation`
 *
 * Protected behavior
 * - links every table-of-contents entry to a section that exists
 * - lists every rendered section in the table of contents
 * - keeps the two lists in the same order, so the TOC matches the page
 * - gives every section the scroll-margin the sticky TOC needs
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

import { describe, it, expect } from "vitest";
// Vite's `?raw` suffix hands back the file's text. Preferred over node:fs here
// so the test typechecks under the client's DOM-only tsconfig, which carries no
// Node types.
import source from "../Settings.tsx?raw";

/** First capture group of every match, dropping any that did not capture. The
 *  client tsconfig sets `noUncheckedIndexedAccess`, so this narrows once here
 *  instead of asserting at each call site. */
function captures(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined);
}

/** Ids listed in the `SETTINGS_SECTIONS` table-of-contents array. */
function tocIds(): string[] {
  const start = source.indexOf("const SETTINGS_SECTIONS");
  expect(start, "SETTINGS_SECTIONS must exist").toBeGreaterThan(-1);
  const end = source.indexOf("\n];", start);
  expect(end, "SETTINGS_SECTIONS must be a closed array").toBeGreaterThan(start);

  const block = source.slice(start, end);
  return captures(block, /\bid:\s*"([^"]+)"/g);
}

/** Ids of the `<section id="...">` elements rendered in the page body. */
function renderedSectionIds(): string[] {
  return captures(source, /<section\s+id="([^"]+)"/g);
}

describe("Settings in-page navigation", () => {
  it("links every table-of-contents entry to a section that exists", () => {
    const rendered = new Set(renderedSectionIds());
    const missing = tocIds().filter((id) => !rendered.has(id));

    expect(missing, "TOC entries with no matching <section id>").toEqual([]);
  });

  it("lists every rendered section in the table of contents", () => {
    const toc = new Set(tocIds());
    const unlisted = renderedSectionIds().filter((id) => !toc.has(id));

    expect(unlisted, "sections missing a SETTINGS_SECTIONS entry").toEqual([]);
  });

  it("keeps the two lists in the same order, so the TOC matches the page", () => {
    // The scroll-spy highlights whichever observed section is nearest the top,
    // so a TOC ordered differently from the body reads as jumping around.
    expect(tocIds()).toEqual(renderedSectionIds());
  });

  it("gives every section the scroll-margin the sticky TOC needs", () => {
    // Without `scroll-mt-*`, jumping to a section parks it under the sticky
    // header and the heading is invisible.
    const withoutScrollMargin = [
      ...source.matchAll(/<section\s+id="([^"]+)"\s+className="([^"]*)"/g),
    ]
      .filter((match) => !/\bscroll-mt-/.test(match[2] ?? ""))
      .map((match) => match[1]);

    expect(withoutScrollMargin, "sections missing scroll-mt-*").toEqual([]);
  });
});
