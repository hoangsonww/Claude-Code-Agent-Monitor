/**
 * @file EventFilters.test.tsx
 * @description Smoke tests for the EventFilters toolbar. Verifies that the
 * toolbar renders its inputs, emits debounced text search changes, toggles
 * selected chips, fires the clear-all handler, and fetches facet options on
 * mount via the events API (mocked).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/EventFilters.test.tsx`
 *
 * Scope
 * Smoke tests for the EventFilters toolbar. Verifies that the toolbar renders its inputs, emits
 * debounced text search changes, toggles selected chips, fires the clear-all handler, and fetches
 * facet options on mount via the events API (mocked).
 *
 * Subjects and collaborators
 * - `../EventFilters` — local module imported by this suite.
 * - `../../lib/api` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - Fake timers control debounce, timeout, or interval boundaries; restore real timers during teardown.
 * - Network boundaries are replaced with deterministic responses; no test depends on an external
 *   service.
 *
 * Suite groups
 * - `EventFilters`
 *
 * Protected behavior
 * - isEmptyFilters treats EMPTY_FILTERS as empty
 * - renders the search input with a translated placeholder
 * - fetches facets on mount and opens the event-type dropdown
 * - debounces text search by 300ms
 * - toggles an event_type chip and emits the updated array
 * - shows the clear-all button only when filters are non-empty
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { EventFilters, EMPTY_FILTERS, isEmptyFilters } from "../EventFilters";
import type { EventFiltersValue } from "../EventFilters";
import { api } from "../../lib/api";

describe("EventFilters", () => {
  beforeEach(() => {
    vi.spyOn(api.events, "facets").mockResolvedValue({
      event_types: ["PreToolUse", "PostToolUse", "Stop"],
      tool_names: ["Bash", "Edit"],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isEmptyFilters treats EMPTY_FILTERS as empty", () => {
    expect(isEmptyFilters(EMPTY_FILTERS)).toBe(true);
    expect(isEmptyFilters({ ...EMPTY_FILTERS, q: "curl" })).toBe(false);
  });

  it("renders the search input with a translated placeholder", () => {
    render(<EventFilters value={EMPTY_FILTERS} onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/search summary/i)).toBeInTheDocument();
  });

  it("fetches facets on mount and opens the event-type dropdown", async () => {
    render(<EventFilters value={EMPTY_FILTERS} onChange={() => {}} />);
    await waitFor(() => expect(api.events.facets).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /event type/i }));
    expect(await screen.findByText("PreToolUse")).toBeInTheDocument();
    expect(screen.getByText("Stop")).toBeInTheDocument();
  });

  it("debounces text search by 300ms", async () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<EventFilters value={EMPTY_FILTERS} onChange={onChange} />);
      fireEvent.change(screen.getByPlaceholderText(/search summary/i), {
        target: { value: "curl" },
      });
      expect(onChange).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: "curl" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles an event_type chip and emits the updated array", async () => {
    const onChange = vi.fn();
    render(<EventFilters value={EMPTY_FILTERS} onChange={onChange} />);
    await waitFor(() => expect(api.events.facets).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /event type/i }));
    const option = await screen.findByText("PreToolUse");
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ event_type: ["PreToolUse"] }));
  });

  it("shows the clear-all button only when filters are non-empty", () => {
    const withFilter: EventFiltersValue = { ...EMPTY_FILTERS, q: "curl" };
    const onChange = vi.fn();
    const { rerender } = render(<EventFilters value={EMPTY_FILTERS} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();

    rerender(<EventFilters value={withFilter} onChange={onChange} />);
    const clear = screen.getByRole("button", { name: /clear filters/i });
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});
