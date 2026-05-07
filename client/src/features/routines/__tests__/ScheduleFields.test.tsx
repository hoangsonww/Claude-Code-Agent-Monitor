import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleFields } from "../ScheduleFields";

describe("ScheduleFields", () => {
  it("renders the manual tab by default and shows the manual hint", () => {
    render(<ScheduleFields value={{ type: "manual" }} onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Manual/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText(/only runs when triggered manually/i)).toBeInTheDocument();
  });

  it("emits a fresh shape when switching from Manual to Daily", async () => {
    const onChange = vi.fn();
    render(<ScheduleFields value={{ type: "manual" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /Daily/i }));
    expect(onChange).toHaveBeenCalledWith({ type: "daily", hour: 9, minute: 0 });
  });

  it("Hourly minute boundary clamps to 59 when out-of-range value typed", () => {
    const onChange = vi.fn();
    render(<ScheduleFields value={{ type: "hourly", minute: 0 }} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: /minute/i });
    // The component is controlled, so we exercise its clamp() by firing a
    // single React-synthetic input event with an out-of-range value. The
    // handler should call onChange with minute clamped to 59.
    fireEvent.change(input, { target: { value: "75" } });
    expect(onChange).toHaveBeenCalledWith({ type: "hourly", minute: 59 });
  });

  it("Weekly emits the dow when the dropdown changes", async () => {
    const onChange = vi.fn();
    render(
      <ScheduleFields value={{ type: "weekly", hour: 10, minute: 0, dow: 1 }} onChange={onChange} />,
    );
    // Open the day-of-week combobox (only one in the rendered DOM) and pick Fri.
    const comboboxes = screen.getAllByRole("combobox");
    const last = comboboxes[comboboxes.length - 1];
    if (!last) throw new Error("expected at least one combobox");
    await userEvent.click(last);
    await userEvent.click(screen.getByRole("option", { name: "Friday" }));
    expect(onChange).toHaveBeenCalledWith({ type: "weekly", hour: 10, minute: 0, dow: 5 });
  });
});
