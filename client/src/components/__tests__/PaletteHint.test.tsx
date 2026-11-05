/**
 * @file PaletteHint.test.tsx
 * @description Tests the chord chip shown beside a page's own search field: that
 * it teaches the platform-correct chord, that it retires permanently once the
 * palette has been opened, and that it stays out of the accessibility tree — it
 * decorates an input, so it must not add a tab stop or a screen-reader
 * announcement in front of the field the user is trying to type into.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/PaletteHint.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests the chord chip shown beside a page's own search field: that it teaches the platform-correct
 * chord, that it retires permanently once the palette has been opened, and that it stays out of the
 * accessibility tree — it decorates an input, so it must not add a tab stop or a screen-reader
 * announcement in front of the field the user is trying to type into.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/paletteDiscovery` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../PaletteHint` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `withPlatform` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `disappears the moment the palette is opened, without a remount` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `never returns once discovered` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `PaletteHint` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `renders the platform's own modifier` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `shows the chord until the palette has been opened` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `stays out of the accessibility tree and out of the way of clicks` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/PaletteHint.test.tsx`
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
 * Path: `client/src/components/__tests__/PaletteHint.test.tsx`
 *
 * Scope
 * Tests the chord chip shown beside a page's own search field: that it teaches the platform-correct
 * chord, that it retires permanently once the palette has been opened, and that it stays out of the
 * accessibility tree — it decorates an input, so it must not add a tab stop or a screen-reader
 * announcement in front of the field the user is trying to type into.
 *
 * Subjects and collaborators
 * - `../PaletteHint` — local module imported by this suite.
 * - `../../lib/paletteDiscovery` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 *
 * Suite groups
 * - `PaletteHint`
 *
 * Protected behavior
 * - shows the chord until the palette has been opened
 * - disappears the moment the palette is opened, without a remount
 * - never returns once discovered
 * - renders the platform's own modifier
 * - stays out of the accessibility tree and out of the way of clicks
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
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PaletteHint } from "../PaletteHint";
import { markPaletteDiscovered, resetPaletteDiscovery } from "../../lib/paletteDiscovery";

beforeEach(() => {
  localStorage.clear();
  resetPaletteDiscovery();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Pretend to be a given platform for the duration of one assertion. */
function withPlatform(platform: string, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(navigator, "platform");
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(navigator, "platform", original);
  }
}

describe("PaletteHint", () => {
  it("shows the chord until the palette has been opened", () => {
    const { container } = render(<PaletteHint />);
    expect(container.textContent).toMatch(/K$/);
  });

  it("disappears the moment the palette is opened, without a remount", () => {
    const { container } = render(<PaletteHint />);
    expect(container).not.toBeEmptyDOMElement();

    act(() => markPaletteDiscovered());

    expect(container).toBeEmptyDOMElement();
  });

  it("never returns once discovered", () => {
    markPaletteDiscovered();
    const { container } = render(<PaletteHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the platform's own modifier", () => {
    withPlatform("MacIntel", () => {
      const { container, unmount } = render(<PaletteHint />);
      expect(container.textContent).toBe("⌘K");
      unmount();
    });
    withPlatform("Win32", () => {
      const { container, unmount } = render(<PaletteHint />);
      expect(container.textContent).toBe("Ctrl K");
      unmount();
    });
  });

  it("stays out of the accessibility tree and out of the way of clicks", () => {
    const { container } = render(<PaletteHint />);
    const chip = container.querySelector("kbd")!;

    // It annotates a search input; announcing it or catching a click aimed at
    // the field would both be worse than saying nothing.
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip.className).toContain("pointer-events-none");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
