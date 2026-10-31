/**
 * @file Tabby.test.tsx
 * @description Render tests for the Tabby companion component — mounting, mood rendering, the hover greeting state, the ⌘B panel toggle, and accessibility attributes.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
