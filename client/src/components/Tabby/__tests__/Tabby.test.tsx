/**
 * @file Tabby.test.tsx
 * @description Render tests for the Tabby companion component — mounting, mood rendering, the ⌘B panel toggle, and accessibility attributes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
