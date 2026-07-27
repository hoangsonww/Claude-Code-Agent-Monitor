/**
 * @file FocusActivityCard.test.tsx
 * @description Tests for `FocusActivityCard` — the new Focus report page's
 * activity list. Covers: the empty state; a basic item-kind row (item-number
 * prefix, single time figure when active === wall); a detour row with an
 * `inferred` tag and its reason line; the project-label prefix only
 * appearing when `showProjectLabel` is true AND the entry carries one; the
 * "+N more sessions" note when `contributions > 1`; and the collapse-after-5
 * show more/fewer toggle.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FocusActivityCard } from "../FocusActivityCard";
import type { FocusActivityEntry } from "../../lib/focusActivity";

function entry(overrides: Partial<FocusActivityEntry> = {}): FocusActivityEntry {
  return {
    key: "k",
    kind: "item",
    itemNumber: 1,
    label: "Some item",
    projectLabel: undefined,
    wallMs: 60_000,
    activeMs: 60_000,
    idleMs: 0,
    inferred: false,
    reason: null,
    contributions: 1,
    ...overrides,
  };
}

describe("FocusActivityCard", () => {
  it("renders the empty state when there are no entries", () => {
    render(<FocusActivityCard entries={[]} showProjectLabel={false} />);
    expect(screen.getByText("No focus history yet for this project's sessions")).toBeTruthy();
  });

  it("renders an item row with its item-number prefix and a single time figure when active === wall", () => {
    render(
      <FocusActivityCard
        entries={[
          entry({
            kind: "item",
            itemNumber: 8,
            label: "Quality Pass",
            wallMs: 3_600_000,
            activeMs: 3_600_000,
          }),
        ]}
        showProjectLabel={false}
      />
    );
    expect(screen.getByText("Item 8")).toBeTruthy();
    expect(screen.getByText("Quality Pass")).toBeTruthy();
    expect(screen.getByText("1h 0m")).toBeTruthy();
  });

  it("shows both wall-clock and active-time figures when they differ", () => {
    render(
      <FocusActivityCard
        entries={[entry({ wallMs: 3_600_000, activeMs: 1_800_000 })]}
        showProjectLabel={false}
      />
    );
    expect(screen.getByText(/Wall clock 1h 0m/)).toBeTruthy();
    expect(screen.getByText(/Total agent time 30m 0s/)).toBeTruthy();
  });

  it("shows an inferred tag and the reason line for an inferred detour", () => {
    render(
      <FocusActivityCard
        entries={[
          entry({
            kind: "detour",
            itemNumber: null,
            label: "Disk Space Monitoring",
            inferred: true,
            reason: "Added a disk space stats icon to the editor UI.",
          }),
        ]}
        showProjectLabel={false}
      />
    );
    expect(screen.getByText("Disk Space Monitoring")).toBeTruthy();
    expect(screen.getByText("inferred")).toBeTruthy();
    expect(screen.getByText("Added a disk space stats icon to the editor UI.")).toBeTruthy();
  });

  it("only shows the project label when showProjectLabel is true and the entry has one", () => {
    const { rerender } = render(
      <FocusActivityCard
        entries={[entry({ label: "Quality Pass", projectLabel: "Game" })]}
        showProjectLabel={false}
      />
    );
    expect(screen.queryByTestId("focus-activity-project-label")).toBeNull();

    rerender(
      <FocusActivityCard
        entries={[entry({ label: "Quality Pass", projectLabel: "Game" })]}
        showProjectLabel={true}
      />
    );
    expect(screen.getByTestId("focus-activity-project-label").textContent).toContain("Game");
  });

  it("does not show a project label when the entry has none, even with showProjectLabel true", () => {
    render(
      <FocusActivityCard
        entries={[entry({ label: "Quality Pass", projectLabel: undefined })]}
        showProjectLabel={true}
      />
    );
    expect(screen.queryByTestId("focus-activity-project-label")).toBeNull();
  });

  it("notes additional contributions past the dominant one", () => {
    render(<FocusActivityCard entries={[entry({ contributions: 3 })]} showProjectLabel={false} />);
    expect(screen.getByText("+2 more sessions")).toBeTruthy();
  });

  it("collapses past 5 entries and expands/collapses on show more/fewer", () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      entry({ key: `k${i}`, itemNumber: i + 1, label: `Task ${i + 1}`, wallMs: (7 - i) * 60_000 })
    );
    render(<FocusActivityCard entries={entries} showProjectLabel={false} />);

    expect(screen.getByText("Task 1")).toBeTruthy();
    expect(screen.getByText("Task 5")).toBeTruthy();
    expect(screen.queryByText("Task 6")).toBeNull();
    expect(screen.queryByText("Task 7")).toBeNull();

    fireEvent.click(screen.getByText("Show more (2 remaining)"));
    expect(screen.getByText("Task 6")).toBeTruthy();
    expect(screen.getByText("Task 7")).toBeTruthy();

    fireEvent.click(screen.getByText("Show fewer"));
    expect(screen.queryByText("Task 6")).toBeNull();
  });
});
