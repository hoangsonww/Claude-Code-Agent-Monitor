/**
 * @file Select.test.tsx
 * @description Tests keyboard navigation and ARIA relationships for the
 * themed custom select component used across dashboard filter forms.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Select } from "../Select";

const OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "duration", label: "Longest duration" },
  { value: "cost", label: "Highest cost" },
] as const;

describe("Select", () => {
  it("exposes its listbox relationship and selected option", () => {
    render(<Select value="recent" onChange={vi.fn()} options={[...OPTIONS]} />);

    const trigger = screen.getByRole("button", { name: "Most recent" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox", { name: "Most recent" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getByRole("option", { name: "Most recent" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("supports Home and End before choosing with Enter", () => {
    const onChange = vi.fn();
    render(<Select value="recent" onChange={onChange} options={[...OPTIONS]} />);

    const trigger = screen.getByRole("button", { name: "Most recent" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("cost");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Home" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("recent");
  });
});
