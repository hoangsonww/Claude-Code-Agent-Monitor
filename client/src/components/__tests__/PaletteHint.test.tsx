/**
 * @file PaletteHint.test.tsx
 * @description Tests the chord chip shown beside a page's own search field: that
 * it teaches the platform-correct chord, that it retires permanently once the
 * palette has been opened, and that it stays out of the accessibility tree — it
 * decorates an input, so it must not add a tab stop or a screen-reader
 * announcement in front of the field the user is trying to type into.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
