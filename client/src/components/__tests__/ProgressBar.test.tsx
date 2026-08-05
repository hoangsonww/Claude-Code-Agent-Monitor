/**
 * @file Unit tests for ProgressBar — width from done/total, label, a11y attrs,
 * and the render-nothing contract when there is no denominator.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "../ProgressBar";

describe("ProgressBar", () => {
  it("renders a done/total label", () => {
    render(<ProgressBar done={3} total={5} />);
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("sets progressbar aria attributes", () => {
    render(<ProgressBar done={3} total={5} ariaLabel="Task 60% complete" />);
    const bar = screen.getByRole("progressbar", { name: "Task 60% complete" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
  });

  it("computes 60% fill width for 3/5", () => {
    const { container } = render(<ProgressBar done={3} total={5} />);
    const fill = container.querySelector('[style*="width"]');
    expect(fill).toHaveStyle({ width: "60%" });
  });

  it("clamps done to total", () => {
    render(<ProgressBar done={9} total={5} />);
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("renders nothing when total is 0", () => {
    const { container } = render(<ProgressBar done={0} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
