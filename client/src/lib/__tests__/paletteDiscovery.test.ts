/**
 * @file paletteDiscovery.test.ts
 * @description Guards the store behind the `Cmd/Ctrl+K` hints.
 *
 * The whole point of the hints is that they are temporary: they teach a
 * keyboard-only feature and then get out of the way permanently. Two failures
 * matter and both are silent — a hint that never disappears becomes permanent
 * chrome for a fact the user already knows, and a hint that never appears leaves
 * the palette undiscoverable, which is the bug this exists to fix. A storage
 * failure must therefore fall toward *showing* it.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/lib/__tests__/paletteDiscovery.test.ts`
 *
 * Scope
 * Guards the store behind the `Cmd/Ctrl+K` hints. The whole point of the hints is that they are
 * temporary: they teach a keyboard-only feature and then get out of the way permanently. Two
 * failures matter and both are silent — a hint that never disappears becomes permanent chrome for a
 * fact the user already knows, and a hint that never appears leaves the palette undiscoverable,
 * which is the bug this exists to fix. A storage failure must therefore fall toward showing it.
 *
 * Subjects and collaborators
 * - `../paletteDiscovery` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 *
 * Suite groups
 * - `paletteDiscovery`
 *
 * Protected behavior
 * - starts undiscovered, so the hints show
 * - records discovery and persists it
 * - notifies subscribers once, on the transition only
 * - stops notifying after unsubscribe
 * - still hides the hints for this session when storage cannot be written
 * - treats an unreadable store as undiscovered rather than throwing
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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  hasDiscoveredPalette,
  markPaletteDiscovered,
  resetPaletteDiscovery,
  subscribeToPaletteDiscovery,
} from "../paletteDiscovery";

beforeEach(() => {
  localStorage.clear();
  resetPaletteDiscovery();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("paletteDiscovery", () => {
  it("starts undiscovered, so the hints show", () => {
    expect(hasDiscoveredPalette()).toBe(false);
  });

  it("records discovery and persists it", () => {
    markPaletteDiscovered();
    expect(hasDiscoveredPalette()).toBe(true);
    expect(localStorage.getItem("ccam-palette-discovered")).toBe("1");
  });

  it("notifies subscribers once, on the transition only", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPaletteDiscovery(listener);

    markPaletteDiscovered();
    markPaletteDiscovered();
    markPaletteDiscovered();

    // Opening the palette repeatedly must not re-render every hint each time.
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    subscribeToPaletteDiscovery(listener)();
    markPaletteDiscovered();
    expect(listener).not.toHaveBeenCalled();
  });

  it("still hides the hints for this session when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    markPaletteDiscovered();
    // The in-memory flag holds; the worst case is the hint returning next visit,
    // which is the safe direction to fail in.
    expect(hasDiscoveredPalette()).toBe(true);
  });

  it("treats an unreadable store as undiscovered rather than throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => resetPaletteDiscovery()).not.toThrow();
    expect(hasDiscoveredPalette()).toBe(false);
  });
});
