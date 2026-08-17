/**
 * @file MultiSelect.test.tsx
 * @description Tests the searchable custom multi-select's filtering, multi-value
 * toggling, and long-label accessible rendering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MultiSelect } from "../MultiSelect";

const OPTIONS = [
  { value: "/work/agent-monitor", label: "/work/agent-monitor" },
  {
    value: "/work/very-long-project-directory-name",
    label: "/work/very-long-project-directory-name",
  },
  { value: "/work/website", label: "/work/website" },
];

function renderMultiSelect(value: string[] = []) {
  const onChange = vi.fn();
  render(
    <MultiSelect
      label="Project directories"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      allLabel="All projects"
      selectedCountLabel={(count) => `${count} projects`}
      searchPlaceholder="Filter projects..."
      emptyLabel="No matching projects"
      clearLabel="Clear"
    />
  );
  return onChange;
}

describe("MultiSelect", () => {
  it("filters options inside the open popover", () => {
    renderMultiSelect();
    fireEvent.click(screen.getByRole("button", { name: /project directories: all projects/i }));
    fireEvent.change(screen.getByPlaceholderText("Filter projects..."), {
      target: { value: "monitor" },
    });

    expect(screen.getByRole("checkbox", { name: "/work/agent-monitor" })).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "/work/very-long-project-directory-name" })
    ).not.toBeInTheDocument();
  });

  it("adds a project without closing the menu so another can be selected", () => {
    const onChange = renderMultiSelect(["/work/agent-monitor"]);
    fireEvent.click(
      screen.getByRole("button", { name: /project directories: \/work\/agent-monitor/i })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "/work/website" }));

    expect(onChange).toHaveBeenCalledWith(["/work/agent-monitor", "/work/website"]);
    expect(screen.getByRole("dialog", { name: "Project directories" })).toBeInTheDocument();
  });

  it("provides the full long project path as an accessible name", () => {
    renderMultiSelect();
    fireEvent.click(screen.getByRole("button", { name: /project directories: all projects/i }));

    expect(
      screen.getByRole("checkbox", { name: "/work/very-long-project-directory-name" })
    ).toBeInTheDocument();
  });

  it("links the trigger to its dialog and closes with Escape", () => {
    renderMultiSelect();
    const trigger = screen.getByRole("button", { name: /project directories: all projects/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Project directories" });
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Project directories" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
