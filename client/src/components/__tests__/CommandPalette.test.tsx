/**
 * @file CommandPalette.test.tsx
 * @description Tests for the global Cmd/Ctrl+K launcher: hotkey open/close on
 * both platforms' modifiers, page filtering, keyboard navigation and selection,
 * debounced server-side session search (including graceful degradation when the
 * query fails), the programmatic open event used by the sidebar trigger, and
 * dismissal behavior.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const listSessions = vi.fn();

vi.mock("../../lib/api", () => ({
  api: { sessions: { list: (...args: unknown[]) => listSessions(...args) } },
}));

import { CommandPalette, openCommandPalette } from "../CommandPalette";

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname + useLocation().search}</span>;
}

function renderPalette() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CommandPalette />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Fire the platform-agnostic open shortcut. */
function pressHotkey(init: Partial<KeyboardEventInit> = { metaKey: true }) {
  fireEvent.keyDown(window, { key: "k", ...init });
}

beforeEach(() => {
  listSessions.mockReset();
  listSessions.mockResolvedValue({ sessions: [], total: 0, limit: 6, offset: 0 });
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

  it("opens from the programmatic event the sidebar trigger dispatches", () => {
    renderPalette();
    act(() => openCommandPalette());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lists every page when the query is empty", () => {
    renderPalette();
    pressHotkey();
    const options = screen.getAllByRole("option");
    // Nine sidebar routes plus the three quick actions.
    expect(options).toHaveLength(12);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
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

  it("reports no matches for a term nothing satisfies", () => {
    renderPalette();
    pressHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzzqqq" } });

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
