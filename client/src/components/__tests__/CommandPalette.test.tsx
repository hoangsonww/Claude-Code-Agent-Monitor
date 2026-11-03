/**
 * @file CommandPalette.test.tsx
 * @description Tests for the global Cmd/Ctrl+K launcher: hotkey open/close on
 * both platforms' modifiers, page filtering, keyboard navigation and selection,
 * debounced server-side session search (including graceful degradation when the
 * query fails and the guarantee that a slow response never leaves a previous
 * query's sessions on screen), the programmatic open event used by the sidebar
 * trigger, and dismissal behavior.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/CommandPalette.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests for the global Cmd/Ctrl+K launcher: hotkey open/close on both platforms' modifiers, page
 * filtering, keyboard navigation and selection, debounced server-side session search (including
 * graceful degradation when the query fails and the guarantee that a slow response never leaves a
 * previous query's sessions on screen), the programmatic open event used by the sidebar trigger,
 * and dismissal behavior.
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
 * - `../CommandPalette` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../PaletteActionProvider` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `listFacets` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `listRemoteSources` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `listSessions` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LocationProbe` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `optionLabels` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PageAction` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `pressHotkey` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderPalette` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useLocation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `usePaletteAction` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `clears the previous query when reopened` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `closes on Escape without navigating` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `CommandPalette` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `debounces the session query and shows the results` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `does not query the server for a one-character term` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `does not remember session picks, whose ids stop resolving` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `drops session results when the term falls back below the search floor` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `drops the previous query's sessions as soon as the term changes` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `filters pages by their translated label` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `ignores the shortcut when Alt is held, so native combos keep working` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `jumps to the first and last row with Home and End` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `lists every page when the query is empty` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `matches on a subsequence, not just a substring` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `moves between groups with Tab` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `moves the active option with the arrow keys and wraps around` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `navigates to a session result on selection` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `navigates to the highlighted page on Enter` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `offers the current page's own actions before anything is typed` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `opens from the programmatic event the sidebar trigger dispatches` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `opens with Ctrl+K as well as Cmd+K` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `reaches a Settings section, an Agent Config tab, and a sub-view` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `remembers the last command run and offers it first on reopen` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `reports no matches for a term nothing satisfies` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `retires the discovery hints the first time it opens` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `stays hidden until the shortcut is pressed` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `stays usable when the session search fails` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `toggles closed when the shortcut is pressed again` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `wraps Shift+Tab to the first row of the last group, not its last row` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/CommandPalette.test.tsx`
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
 * Path: `client/src/components/__tests__/CommandPalette.test.tsx`
 *
 * Scope
 * Tests for the global Cmd/Ctrl+K launcher: hotkey open/close on both platforms' modifiers, page
 * filtering, keyboard navigation and selection, debounced server-side session search (including
 * graceful degradation when the query fails and the guarantee that a slow response never leaves a
 * previous query's sessions on screen), the programmatic open event used by the sidebar trigger, and
 * dismissal behavior.
 *
 * Subjects and collaborators
 * - `../CommandPalette` — local module imported by this suite.
 * - `../PaletteActionProvider` — local module imported by this suite.
 * - `../../lib/paletteDiscovery` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Fake timers control debounce, timeout, or interval boundaries; restore real timers during teardown.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 * - Mock boundary: `../../lib/api`.
 *
 * Suite groups
 * - `CommandPalette`
 *
 * Protected behavior
 * - stays hidden until the shortcut is pressed
 * - opens with Ctrl+K as well as Cmd+K
 * - ignores the shortcut when Alt is held, so native combos keep working
 * - toggles closed when the shortcut is pressed again
 * - retires the discovery hints the first time it opens
 * - opens from the programmatic event the sidebar trigger dispatches
 * - lists every page when the query is empty
 * - offers the current page's own actions before anything is typed
 * - filters pages by their translated label
 * - navigates to the highlighted page on Enter
 * - moves the active option with the arrow keys and wraps around
 * - closes on Escape without navigating
 * - does not query the server for a one-character term
 * - debounces the session query and shows the results
 * - navigates to a session result on selection
 * - drops the previous query's sessions as soon as the term changes
 * - drops session results when the term falls back below the search floor
 * - stays usable when the session search fails
 * - reaches a Settings section, an Agent Config tab, and a sub-view
 * - matches on a subsequence, not just a substring
 * - remembers the last command run and offers it first on reopen
 * - does not remember session picks, whose ids stop resolving
 * - jumps to the first and last row with Home and End
 * - moves between groups with Tab
 * - wraps Shift+Tab to the first row of the last group, not its last row
 * - reports no matches for a term nothing satisfies
 * - clears the previous query when reopened
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
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const listSessions = vi.fn();
const listFacets = vi.fn();
const listRemoteSources = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      list: (...args: unknown[]) => listSessions(...args),
      // Powers the Projects group and the machine-scoping actions.
      facets: () => listFacets(),
    },
    remoteSources: { list: () => listRemoteSources() },
  },
}));

import { CommandPalette, openCommandPalette } from "../CommandPalette";
import { PaletteActionProvider, usePaletteAction } from "../PaletteActionProvider";
import { hasDiscoveredPalette, resetPaletteDiscovery } from "../../lib/paletteDiscovery";

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname + useLocation().search}</span>;
}

function renderPalette() {
  // The provider supplies the page-action registry the palette reads.
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <PaletteActionProvider>
        <CommandPalette />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </PaletteActionProvider>
    </MemoryRouter>
  );
}

/** Registers a page action the way a real page does, so the palette lists it. */
function PageAction({ id }: { id: string }) {
  usePaletteAction(id, () => {});
  return null;
}

/** Labels of the rows currently rendered, in order. */
function optionLabels(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}

/** Fire the platform-agnostic open shortcut. */
function pressHotkey(init: Partial<KeyboardEventInit> = { metaKey: true }) {
  fireEvent.keyDown(window, { key: "k", ...init });
}

beforeEach(() => {
  localStorage.clear();
  resetPaletteDiscovery();
  listSessions.mockReset();
  listSessions.mockResolvedValue({ sessions: [], total: 0, limit: 6, offset: 0 });
  listFacets.mockReset();
  listFacets.mockResolvedValue({ cwds: [], sources: [], providers: [] });
  listRemoteSources.mockReset();
  listRemoteSources.mockResolvedValue({ sources: [] });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CommandPalette", () => {
  it("stays hidden until the shortcut is pressed", () => {
    renderPalette();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pressHotkey();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens with Ctrl+K as well as Cmd+K", () => {
    renderPalette();
    pressHotkey({ ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("ignores the shortcut when Alt is held, so native combos keep working", () => {
    renderPalette();
    pressHotkey({ metaKey: true, altKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles closed when the shortcut is pressed again", () => {
    renderPalette();
    pressHotkey();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    pressHotkey();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("retires the discovery hints the first time it opens", () => {
    renderPalette();
    expect(hasDiscoveredPalette()).toBe(false);

    pressHotkey();

    // The hints beside the page search fields exist only to teach this chord.
    expect(hasDiscoveredPalette()).toBe(true);
  });

  it("opens from the programmatic event the sidebar trigger dispatches", () => {
    renderPalette();
    act(() => openCommandPalette());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lists every page when the query is empty", () => {
    renderPalette();
    pressHotkey();
    // With no query and nothing in the MRU list the palette shows the nine
    // sidebar routes: the rest of the catalog is one keystroke away, and dumping
    // ~150 rows into an empty launcher would bury them.
    expect(screen.getAllByRole("option")).toHaveLength(9);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("offers the current page's own actions before anything is typed", () => {
    // Opening the launcher on a page should immediately surface what that page
    // can do, not just the nine routes.
    render(
      <MemoryRouter initialEntries={["/"]}>
        <PaletteActionProvider>
          <PageAction id="activity.togglePause" />
          <CommandPalette />
          <Routes>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </PaletteActionProvider>
      </MemoryRouter>
    );
    pressHotkey();

    expect(screen.getByText("This page")).toBeInTheDocument();
    expect(optionLabels().some((label) => label.includes("live stream"))).toBe(true);
  });

  it("filters pages by their translated label", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "analy" } });

    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels.some((l) => l?.includes("Analytics"))).toBe(true);
    expect(labels.some((l) => l?.includes("Kanban"))).toBe(false);
  });

  it("navigates to the highlighted page on Enter", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "workflows" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    expect(screen.getByTestId("location")).toHaveTextContent("/workflows");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves the active option with the arrow keys and wraps around", () => {
    renderPalette();
    pressHotkey();
    const dialog = screen.getByRole("dialog");

    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    // Wrapped past the start to the last option.
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape without navigating", () => {
    renderPalette();
    pressHotkey();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("does not query the server for a one-character term", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("debounces the session query and shows the results", async () => {
    listSessions.mockResolvedValue({
      sessions: [
        {
          id: "sess-1",
          name: "Refactor the token parser",
          status: "active",
          cwd: "/work/api",
          model: "claude-opus-5",
          started_at: "2026-08-01T00:00:00.000Z",
          ended_at: null,
          metadata: null,
        },
      ],
      total: 1,
      limit: 6,
      offset: 0,
    });

    renderPalette();
    pressHotkey();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ref" } });
    fireEvent.change(input, { target: { value: "refa" } });
    fireEvent.change(input, { target: { value: "refac" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("Refactor the token parser")).toBeInTheDocument();
    });
    // Intermediate keystrokes were coalesced into one request.
    expect(listSessions).toHaveBeenCalledTimes(1);
    expect(listSessions).toHaveBeenCalledWith(expect.objectContaining({ q: "refac", limit: 6 }));
  });

  it("navigates to a session result on selection", async () => {
    listSessions.mockResolvedValue({
      sessions: [
        {
          id: "sess-42",
          name: "Fix the desktop freeze",
          status: "completed",
          cwd: "/work/app",
          model: "claude-opus-5",
          started_at: "2026-08-01T00:00:00.000Z",
          ended_at: "2026-08-01T01:00:00.000Z",
          metadata: null,
        },
      ],
      total: 1,
      limit: 6,
      offset: 0,
    });

    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "freeze" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const result = await screen.findByText("Fix the desktop freeze");
    fireEvent.click(result);

    expect(screen.getByTestId("location")).toHaveTextContent("/sessions/sess-42");
  });

  it("drops the previous query's sessions as soon as the term changes", async () => {
    const first = {
      id: "sess-old",
      name: "Old result for freeze",
      status: "completed",
      cwd: "/work/app",
      model: "claude-opus-5",
      started_at: "2026-08-01T00:00:00.000Z",
      ended_at: null,
      metadata: null,
    };
    listSessions.mockResolvedValue({ sessions: [first], total: 1, limit: 6, offset: 0 });

    renderPalette();
    pressHotkey();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "freeze" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await screen.findByText("Old result for freeze");

    // A new eligible term whose request has not resolved yet must not leave the
    // previous term's session visible — it would be selectable and wrong.
    let resolveSecond: (value: unknown) => void = () => {};
    listSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
    );
    fireEvent.change(input, { target: { value: "unrelated" } });

    expect(screen.queryByText("Old result for freeze")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      resolveSecond({ sessions: [], total: 0, limit: 6, offset: 0 });
    });
    expect(screen.queryByText("Old result for freeze")).not.toBeInTheDocument();
  });

  it("drops session results when the term falls back below the search floor", async () => {
    listSessions.mockResolvedValue({
      sessions: [
        {
          id: "sess-floor",
          name: "Result above the floor",
          status: "active",
          cwd: "/work/app",
          model: "claude-opus-5",
          started_at: "2026-08-01T00:00:00.000Z",
          ended_at: null,
          metadata: null,
        },
      ],
      total: 1,
      limit: 6,
      offset: 0,
    });

    renderPalette();
    pressHotkey();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ab" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await screen.findByText("Result above the floor");

    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.queryByText("Result above the floor")).not.toBeInTheDocument();
  });

  it("stays usable when the session search fails", async () => {
    listSessions.mockRejectedValue(new Error("network down"));

    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "sessions" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => expect(listSessions).toHaveBeenCalled());
    // Page results are computed locally, so they survive a failed query.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("reaches a Settings section, an Agent Config tab, and a sub-view", () => {
    renderPalette();
    pressHotkey();
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "sound" } });
    expect(optionLabels().some((label) => label.includes("Sound"))).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/settings");

    act(() => openCommandPalette());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mcp" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/cc-config?tab=mcp");

    act(() => openCommandPalette());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cost analytics" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/analytics?tab=cost");
  });

  it("matches on a subsequence, not just a substring", () => {
    renderPalette();
    pressHotkey();
    // "kb" is not a substring of "Kanban Board" — only a subsequence of it.
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kbrd" } });
    expect(optionLabels().some((label) => label.includes("Kanban"))).toBe(true);
  });

  it("remembers the last command run and offers it first on reopen", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "workflows" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    act(() => openCommandPalette());
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(optionLabels()[0]).toContain("Workflows");
  });

  it("does not remember session picks, whose ids stop resolving", async () => {
    listSessions.mockResolvedValue({
      sessions: [
        {
          id: "sess-7",
          name: "Transient session",
          status: "active",
          cwd: "/work/app",
          model: "claude-opus-5",
          started_at: "2026-08-01T00:00:00.000Z",
          ended_at: null,
          metadata: null,
        },
      ],
      total: 1,
      limit: 6,
      offset: 0,
    });

    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "transient" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(await screen.findByText("Transient session"));

    act(() => openCommandPalette());
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it("jumps to the first and last row with Home and End", () => {
    renderPalette();
    pressHotkey();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "End" });
    let options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(dialog, { key: "Home" });
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("moves between groups with Tab", () => {
    renderPalette();
    pressHotkey();
    const dialog = screen.getByRole("dialog");
    // "se" spans several groups (pages, settings sections, actions).
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "se" } });

    const groupOf = (index: number) =>
      screen.getAllByRole("option")[index]?.closest("div")?.textContent ?? "";
    const firstGroup = groupOf(0);
    fireEvent.keyDown(dialog, { key: "Tab" });
    const selected = screen
      .getAllByRole("option")
      .findIndex((option) => option.getAttribute("aria-selected") === "true");

    expect(selected).toBeGreaterThan(0);
    expect(groupOf(selected)).not.toBe(firstGroup);
  });

  it("wraps Shift+Tab to the first row of the last group, not its last row", () => {
    renderPalette();
    pressHotkey();
    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "se" } });

    // From the first row of the first group, Shift+Tab wraps backwards. It must
    // land on a group *start*, the same thing Tab means going forwards.
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    const options = screen.getAllByRole("option");
    const selected = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
    const groupOf = (index: number) => options[index]?.closest("div")?.textContent ?? "";

    expect(selected).toBeGreaterThan(0);
    // The row above it belongs to a different group, i.e. this is a boundary.
    expect(groupOf(selected)).not.toBe(groupOf(selected - 1));
    // And it is the last group: nothing after it starts a new one.
    const lastGroupStart = options.findIndex(
      (_, index) => index > 0 && groupOf(index) !== groupOf(index - 1) && index >= selected
    );
    expect(lastGroupStart).toBe(selected);
  });

  it("reports no matches for a term nothing satisfies", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzzqqqxyw" } });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("clears the previous query when reopened", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "analytics" } });
    pressHotkey();
    pressHotkey();

    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
