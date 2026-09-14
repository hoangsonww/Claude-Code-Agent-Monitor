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
