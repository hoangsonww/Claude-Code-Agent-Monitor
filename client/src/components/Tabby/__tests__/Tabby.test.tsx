/**
 * @file Tabby.test.tsx
 * @description Render tests for the Tabby companion component — mounting, mood rendering, the hover greeting state, the ⌘B panel toggle, and accessibility attributes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/__tests__/Tabby.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Render tests for the Tabby companion component — mounting, mood rendering, the hover greeting
 * state, the ⌘B panel toggle, and accessibility attributes.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../Tabby` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
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
 * - `renderTabby` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `sessionMsg` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `a sub-threshold pointer move is treated as a tap, not a drag` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `a tap (no movement) still opens the panel` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `dragging snaps to an edge, persists position, and does not open the panel` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `greets a hovering pointer without scaling the draggable button` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `opens the panel on click and answers a local status question` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `reflects the live count in the panel status` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders the avatar button by default` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `respects the enabled preference` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `restores a persisted left-edge position on mount` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `shows an error badge when a session errors` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `Tabby widget` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `toggles open/closed with Cmd/Ctrl+B and closes with Esc` — executable behavior named by this
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/__tests__/Tabby.test.tsx`
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
 * Path: `client/src/components/Tabby/__tests__/Tabby.test.tsx`
 *
 * Scope
 * Render tests for the Tabby companion component — mounting, mood rendering, the hover greeting
 * state, the ⌘B panel toggle, and accessibility attributes.
 *
 * Subjects and collaborators
 * - `../Tabby` — local module imported by this suite.
 * - `../../../lib/eventBus` — local module imported by this suite.
 * - `../../../lib/types` — local module imported by this suite.
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
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 *
 * Suite groups
 * - `Tabby widget`
 *
 * Protected behavior
 * - renders the avatar button by default
 * - greets a hovering pointer without scaling the draggable button
 * - opens the panel on click and answers a local status question
 * - toggles open/closed with Cmd/Ctrl+B and closes with Esc
 * - shows an error badge when a session errors
 * - reflects the live count in the panel status
 * - respects the enabled preference
 * - a tap (no movement) still opens the panel
 * - dragging snaps to an edge, persists position, and does not open the panel
 * - a sub-threshold pointer move is treated as a tap, not a drag
 * - restores a persisted left-edge position on mount
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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Tabby } from "../Tabby";
import { eventBus } from "../../../lib/eventBus";
import type { WSMessage, Session } from "../../../lib/types";

function renderTabby() {
  return render(
    <MemoryRouter>
      <Tabby />
    </MemoryRouter>
  );
}

const sessionMsg = (id: string, status: Session["status"]): WSMessage => ({
  type: "session_updated",
  data: { id, status } as Session,
  timestamp: "t",
});

beforeEach(() => {
  localStorage.clear();
  eventBus.setConnected(true);
  // Freeze timers so the brain's 1s heartbeat tick can't fire a state update
  // outside act() mid-assertion. We never advance them in these tests.
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Tabby widget", () => {
  it("renders the avatar button by default", () => {
    renderTabby();
    expect(screen.getByRole("button", { name: /open tabby companion/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /tabby/i })).toBeInTheDocument();
  });

  it("greets a hovering pointer without scaling the draggable button", () => {
    renderTabby();
    const button = screen.getByRole("button", { name: /open tabby companion/i });
    const cat = screen.getByRole("img", { name: /tabby/i });

    fireEvent.mouseEnter(button);
    expect(cat).toHaveAttribute("data-hovered", "1");

    fireEvent.mouseLeave(button);
    expect(cat).toHaveAttribute("data-hovered", "0");
  });

  it("opens the panel on click and answers a local status question", () => {
    renderTabby();
    fireEvent.click(screen.getByRole("button", { name: /open tabby companion/i }));
    const panel = screen.getByRole("dialog", { name: /tabby companion/i });
    expect(panel).toBeInTheDocument();

    const input = within(panel).getByLabelText(/ask tabby/i);
    fireEvent.change(input, { target: { value: "status" } });
    fireEvent.submit(input.closest("form")!);
    expect(within(panel).getByText(/live ·/i)).toBeInTheDocument();
  });

  it("toggles open/closed with Cmd/Ctrl+B and closes with Esc", () => {
    renderTabby();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "b", metaKey: true });
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error badge when a session errors", () => {
    renderTabby();
    act(() => {
      eventBus.publish(sessionMsg("a", "error"));
    });
    const btn = screen.getByRole("button", { name: /open tabby companion/i });
    expect(within(btn).getByText("1")).toBeInTheDocument();
  });

  it("reflects the live count in the panel status", () => {
    renderTabby();
    act(() => {
      eventBus.publish(sessionMsg("a", "active"));
      eventBus.publish(sessionMsg("b", "active"));
    });
    fireEvent.click(screen.getByRole("button", { name: /open tabby companion/i }));
    const panel = screen.getByRole("dialog", { name: /tabby companion/i });
    // The "live" stat chip shows value 2 next to its label.
    const liveChip = within(panel).getByText("live").closest("div")!;
    expect(within(liveChip).getByText("2")).toBeInTheDocument();
  });

  it("respects the enabled preference", () => {
    localStorage.setItem("agent-dashboard-tabby-enabled", "false");
    renderTabby();
    expect(screen.queryByRole("button", { name: /open tabby companion/i })).not.toBeInTheDocument();
  });

  it("a tap (no movement) still opens the panel", () => {
    renderTabby();
    const btn = screen.getByRole("button", { name: /open tabby companion/i });
    act(() => {
      fireEvent.pointerDown(btn, { clientX: 990, clientY: 700, button: 0 });
      fireEvent.pointerUp(btn, { clientX: 990, clientY: 700 });
    });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: /tabby companion/i })).toBeInTheDocument();
  });

  it("dragging snaps to an edge, persists position, and does not open the panel", () => {
    renderTabby();
    const btn = screen.getByRole("button", { name: /open tabby companion/i });
    // Default dock is bottom-right. Drag far to the left past the threshold.
    act(() => {
      fireEvent.pointerDown(btn, { clientX: 990, clientY: 700, button: 0 });
      fireEvent.pointerMove(btn, { clientX: 80, clientY: 300 });
      fireEvent.pointerUp(btn, { clientX: 80, clientY: 300 });
    });
    // The synthetic click that follows a drag must be swallowed.
    fireEvent.click(btn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem("agent-dashboard-tabby-pos") || "{}");
    expect(saved.side).toBe("left");
    expect(typeof saved.y).toBe("number");
  });

  it("a sub-threshold pointer move is treated as a tap, not a drag", () => {
    renderTabby();
    const btn = screen.getByRole("button", { name: /open tabby companion/i });
    act(() => {
      fireEvent.pointerDown(btn, { clientX: 990, clientY: 700, button: 0 });
      fireEvent.pointerMove(btn, { clientX: 992, clientY: 701 }); // < 5px threshold
      fireEvent.pointerUp(btn, { clientX: 992, clientY: 701 });
    });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: /tabby companion/i })).toBeInTheDocument();
    // No position was persisted because no real drag happened.
    expect(localStorage.getItem("agent-dashboard-tabby-pos")).toBeNull();
  });

  it("restores a persisted left-edge position on mount", () => {
    localStorage.setItem("agent-dashboard-tabby-pos", JSON.stringify({ side: "left", y: 0.2 }));
    renderTabby();
    const btn = screen.getByRole("button", { name: /open tabby companion/i }) as HTMLElement;
    // Left-docked → inline left equals the edge margin (16px).
    expect(btn.style.left).toBe("16px");
  });
});
