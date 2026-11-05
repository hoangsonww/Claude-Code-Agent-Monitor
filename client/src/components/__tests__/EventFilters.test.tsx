/**
 * @file EventFilters.test.tsx
 * @description Smoke tests for the EventFilters toolbar. Verifies that the
 * toolbar renders its inputs, emits debounced text search changes, toggles
 * selected chips, fires the clear-all handler, and fetches facet options on
 * mount via the events API (mocked).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/EventFilters.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Smoke tests for the EventFilters toolbar. Verifies that the toolbar renders its inputs, emits
 * debounced text search changes, toggles selected chips, fires the clear-all handler, and fetches
 * facet options on mount via the events API (mocked).
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../EventFilters` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
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
 * - `debounces text search by 300ms` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `EventFilters` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `fetches facets on mount and opens the event-type dropdown` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `isEmptyFilters treats EMPTY_FILTERS as empty` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders the search input with a translated placeholder` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `shows the clear-all button only when filters are non-empty` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `toggles an event_type chip and emits the updated array` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/EventFilters.test.tsx`
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
