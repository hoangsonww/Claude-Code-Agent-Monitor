/**
 * @file PaginatedLegend.test.tsx
 * @description Verifies chart legends remain unpaginated when labels fit and
 * expose every longer-list label through accessible page controls.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginatedLegend } from "../PaginatedLegend";

function renderLegend(labels: string[], pageSize = 3) {
  return render(
    <PaginatedLegend
      items={labels}
      pageSize={pageSize}
      getKey={(label) => label}
      renderItem={(label) => <span>{label}</span>}
    />
  );
}

describe("PaginatedLegend", () => {
  it("renders every label without controls when all labels fit", () => {
    renderLegend(["Alpha", "Beta", "Gamma"]);

    expect(screen.getByText("Alpha")).toBeVisible();
    expect(screen.getByText("Beta")).toBeVisible();
    expect(screen.getByText("Gamma")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("pages longer legends without spilling every label at once", async () => {
    const user = userEvent.setup();
    renderLegend(["Alpha", "Beta", "Gamma", "Delta", "Epsilon"], 3);

    expect(screen.getByText("Alpha")).toBeVisible();
    expect(screen.getByText("Gamma")).toBeVisible();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1-3 of 5")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeVisible();
    expect(screen.getByText("Epsilon")).toBeVisible();
    expect(screen.getByText("Showing 4-5 of 5")).toBeVisible();
  });
});
