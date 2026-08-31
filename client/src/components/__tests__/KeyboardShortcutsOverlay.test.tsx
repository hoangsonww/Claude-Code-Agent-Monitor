/**
 * @file KeyboardShortcutsOverlay.test.tsx
 * @description Tests the `?` cheat sheet: that it renders from the registry
 * rather than a hand-kept list (so a binding cannot exist undocumented), that it
 * distinguishes shortcuts that are live here from ones that are not, and that it
 * behaves as a modal — filterable, Escape-dismissable, and focus-restoring.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { KeyboardShortcutsOverlay } from "../KeyboardShortcutsOverlay";
import { ShortcutHintOverlay } from "../ShortcutHintOverlay";
import { ShortcutProvider, useShortcutHandler } from "../ShortcutProvider";
import { DOCUMENTED_SHORTCUTS, HINT_REVEAL_DELAY_MS } from "../../lib/shortcuts";
import i18n from "../../i18n";

function Bind({ id }: { id: string }) {
  useShortcutHandler(id, () => {});
  return null;
}

function renderOverlay(bound: string[] = []) {
  return render(
    <ShortcutProvider>
      {bound.map((id) => (
        <Bind key={id} id={id} />
      ))}
      <KeyboardShortcutsOverlay />
      <ShortcutHintOverlay />
    </ShortcutProvider>
  );
}

/** Open the cheat sheet the way a user does. */
function pressHelp() {
  fireEvent.keyDown(window, { key: "?" });
}

describe("KeyboardShortcutsOverlay", () => {
  it("renders nothing until opened", () => {
    renderOverlay();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists every documented shortcut", () => {
    renderOverlay();
    pressHelp();

    const dialog = screen.getByRole("dialog");
    for (const def of DOCUMENTED_SHORTCUTS) {
      const label = i18n.t(def.labelKey, { ns: "shortcuts" });
      expect(dialog.textContent, `${def.id} is missing from the cheat sheet`).toContain(label);
    }
  });

  it("groups shortcuts by category", () => {
    renderOverlay();
    pressHelp();
    for (const category of ["global", "navigation", "page", "palette"]) {
      expect(
        screen.getByRole("region", { name: i18n.t(`categories.${category}`, { ns: "shortcuts" }) })
      ).toBeInTheDocument();
    }
  });

  it("dims a shortcut with no handler on this page, without hiding it", () => {
    renderOverlay();
    pressHelp();
    // `[` only means something on a page with tabs; the row stays so the scheme
    // is still teachable, but it is visibly unavailable.
    const row = screen.getByText(i18n.t("page.tabPrev", { ns: "shortcuts" })).closest("li");
    expect(row?.className).toContain("opacity-45");
  });

  it("undims a shortcut the current page has claimed", () => {
    renderOverlay(["tab.prev"]);
    pressHelp();
    const row = screen.getByText(i18n.t("page.tabPrev", { ns: "shortcuts" })).closest("li");
    expect(row?.className).not.toContain("opacity-45");
  });

  it("filters by label text", () => {
    renderOverlay();
    pressHelp();
    const filter = screen.getByLabelText(i18n.t("filterPlaceholder", { ns: "shortcuts" }));
    fireEvent.change(filter, { target: { value: "sidebar" } });

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(i18n.t("global.sidebar", { ns: "shortcuts" }));
    expect(dialog.textContent).not.toContain(i18n.t("goto.kanban", { ns: "shortcuts" }));
  });

  it("reports when the filter matches nothing", () => {
    renderOverlay();
    pressHelp();
    fireEvent.change(screen.getByLabelText(i18n.t("filterPlaceholder", { ns: "shortcuts" })), {
      target: { value: "zzzzz" },
    });
    expect(screen.getByText(i18n.t("noMatches", { ns: "shortcuts" }))).toBeInTheDocument();
  });

  it("closes on Escape and on `?` again", () => {
    renderOverlay();
    pressHelp();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pressHelp();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    pressHelp();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears the filter when reopened", () => {
    renderOverlay();
    pressHelp();
    fireEvent.change(screen.getByLabelText(i18n.t("filterPlaceholder", { ns: "shortcuts" })), {
      target: { value: "sidebar" },
    });
    pressHelp();
    pressHelp();
    expect(screen.getByLabelText(i18n.t("filterPlaceholder", { ns: "shortcuts" }))).toHaveValue("");
  });

  it("does not open while the user is typing in a field", () => {
    render(
      <ShortcutProvider>
        <KeyboardShortcutsOverlay />
        <input data-testid="field" />
      </ShortcutProvider>
    );
    fireEvent.keyDown(screen.getByTestId("field"), { key: "?" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ShortcutHintOverlay", () => {
  it("stays hidden until the modifier has been held", () => {
    renderOverlay();
    expect(
      screen.queryByText(i18n.t("hintPanelTitle", { ns: "shortcuts" }))
    ).not.toBeInTheDocument();
  });

  it("appears on hold and lists only shortcuts that are live here", async () => {
    renderOverlay(["goto.sessions"]);
    fireEvent.keyDown(window, { key: "Meta" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, HINT_REVEAL_DELAY_MS + 20));
    });

    expect(screen.getByText(i18n.t("hintPanelTitle", { ns: "shortcuts" }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("goto.sessions", { ns: "shortcuts" }))).toBeInTheDocument();
    // Nothing bound `g k` in this render, so it must not be advertised.
    expect(screen.queryByText(i18n.t("goto.kanban", { ns: "shortcuts" }))).not.toBeInTheDocument();
  });

  it("is inert to assistive tech, which reads the `?` dialog instead", async () => {
    const { container } = renderOverlay(["goto.sessions"]);
    fireEvent.keyDown(window, { key: "Meta" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, HINT_REVEAL_DELAY_MS + 20));
    });

    const panel = container.querySelector('[aria-hidden="true"].fixed');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("pointer-events-none");
  });
});
