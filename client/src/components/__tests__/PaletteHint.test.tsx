/**
 * @file PaletteHint.test.tsx
 * @description Tests the chord chip shown beside a page's own search field: that
 * it teaches the platform-correct chord, that it retires permanently once the
 * palette has been opened, and that it stays out of the accessibility tree — it
 * decorates an input, so it must not add a tab stop or a screen-reader
 * announcement in front of the field the user is trying to type into.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
