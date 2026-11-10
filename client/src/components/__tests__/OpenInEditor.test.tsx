/**
 * @file OpenInEditor.test.tsx
 * @description Tests editor setup, default selection, folder links, storage sync,
 * disabled remote sessions, and isolation from enclosing session-card navigation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { EditorSettings } from "../EditorSettings";
import { OpenInEditor } from "../OpenInEditor";
import { SessionCard } from "../SessionCard";
import { saveEditorPrefs } from "../../lib/editors";
import type { Session } from "../../lib/types";

const session: Session = {
  id: "test-session",
  name: "Test project",
  cwd: "/Users/dev/my project",
  source: "local",
  status: "active",
  model: null,
  started_at: "2026-11-10T00:00:00Z",
  ended_at: null,
  metadata: null,
};
function LocationProbe() {
  return (
    <span data-testid="location">
      {useLocation().pathname}
      {useLocation().hash}
    </span>
  );
}
beforeEach(() => localStorage.clear());

describe("editor folder launcher", () => {
  it("links to editor setup when nothing is configured", () => {
    render(
      <MemoryRouter>
        <OpenInEditor session={session} />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("link", { name: "Configure editors" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#editors");
  });

  it("adds editors, changes the default, and repairs removal immediately", () => {
    render(
      <MemoryRouter>
        <EditorSettings />
        <OpenInEditor session={session} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
    expect(screen.getByRole("link", { name: "Open in VS Code" })).toHaveAttribute(
      "href",
      "vscode://file/Users/dev/my%20project/"
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Choose editor" }), {
      target: { value: "cursor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cursor" }));
    expect(screen.getByRole("link", { name: "Open in Cursor" })).toHaveAttribute(
      "href",
      "cursor://file/Users/dev/my%20project/"
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Cursor" }));
    expect(screen.getByRole("link", { name: "Open in VS Code" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove VS Code" }));
    expect(screen.getByRole("link", { name: "Configure editors" })).toBeInTheDocument();
  });

  it("can choose another editor without changing the saved default or navigating the card", () => {
    saveEditorPrefs({ enabled: ["vscode", "cursor"], defaultId: "vscode" });
    render(
      <MemoryRouter>
        <SessionCard session={session} />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Choose editor" }), {
      target: { value: "cursor" },
    });
    const link = screen.getByRole("link", { name: "Open in Cursor" });
    // Prevent jsdom from attempting native protocol navigation; bubbling still reaches the card.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    expect(JSON.parse(localStorage.getItem("ccam-editors")!).defaultId).toBe("vscode");
    fireEvent.click(screen.getByText("Test project"));
    expect(screen.getByTestId("location")).toHaveTextContent("/sessions/test-session");
  });

  it("updates mounted controls for another tab's storage changes", () => {
    render(
      <MemoryRouter>
        <OpenInEditor session={session} />
      </MemoryRouter>
    );
    act(() => {
      localStorage.setItem(
        "ccam-editors",
        JSON.stringify({ enabled: ["cursor"], defaultId: "cursor" })
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "ccam-editors" }));
    });
    expect(screen.getByRole("link", { name: "Open in Cursor" })).toBeInTheDocument();
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.getByRole("link", { name: "Configure editors" })).toBeInTheDocument();
  });

  it.each([
    { ...session, source: "remote-machine" },
    { ...session, cwd: null },
  ])("disables unavailable sessions", (unavailable) => {
    saveEditorPrefs({ enabled: ["vscode"], defaultId: "vscode" });
    render(
      <MemoryRouter>
        <OpenInEditor session={unavailable} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Open in Editor" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reports storage failure without claiming an editor was added", () => {
    render(<EditorSettings />);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save editors");
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
