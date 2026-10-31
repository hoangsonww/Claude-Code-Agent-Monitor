/**
 * @file Select.test.tsx
 * @description Tests keyboard navigation and ARIA relationships for the
 * themed custom select component used across dashboard filter forms.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/Select.test.tsx`
 *
 * Scope
 * Tests keyboard navigation and ARIA relationships for the themed custom select component used
 * across dashboard filter forms.
 *
 * Subjects and collaborators
 * - `../Select` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `Select`
 *
 * Protected behavior
 * - exposes its listbox relationship and selected option
 * - supports Home and End before choosing with Enter
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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Select } from "../Select";

const OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "duration", label: "Longest duration" },
  { value: "cost", label: "Highest cost" },
] as const;

describe("Select", () => {
  it("exposes its listbox relationship and selected option", () => {
    render(<Select value="recent" onChange={vi.fn()} options={[...OPTIONS]} />);

    const trigger = screen.getByRole("button", { name: "Most recent" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox", { name: "Most recent" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getByRole("option", { name: "Most recent" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("supports Home and End before choosing with Enter", () => {
    const onChange = vi.fn();
    render(<Select value="recent" onChange={onChange} options={[...OPTIONS]} />);

    const trigger = screen.getByRole("button", { name: "Most recent" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("cost");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Home" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("recent");
  });
});
