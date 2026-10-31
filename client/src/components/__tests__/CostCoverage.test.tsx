/**
 * @file CostCoverage.test.tsx
 * @description Checks complete and incomplete rate coverage, including an
 * unsupported tier of an otherwise known model, plus source/provider labels
 * and the rate table each product scope links to.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CostCoverage } from "../CostCoverage";
it("does not call a complete scoped estimate a subscription bill", () => {
  render(
    <MemoryRouter>
      <CostCoverage scope={{ mode: "all", selected: [], provider: "both" }} unpriced={[]} />
    </MemoryRouter>
  );
  expect(
    screen.getByText("API-equivalent estimate, not subscription charges.")
  ).toBeInTheDocument();
  expect(screen.getByText("Sources: All sources · Products: Both")).toHaveAttribute(
    "href",
    "/settings#remote-sources"
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("marks missing tier rates incomplete without calling the known model unknown", () => {
  render(
    <MemoryRouter>
      <CostCoverage
        scope={{ mode: "selected", selected: ["box"], provider: "codex" }}
        unpriced={[
          {
            model: "gpt-6-sol",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
          {
            model: "gpt-6-sol",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Incomplete estimate: some usage has no applicable rate (gpt-6-sol)."
  );
  expect(screen.getByText("Sources: Selected sources · Products: Codex")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review pricing" })).toHaveAttribute(
    "href",
    "/settings#gpt-pricing"
  );
});
it("labels an unset product scope as the Claude data it reads", () => {
  render(
    <MemoryRouter>
      <CostCoverage
        scope={{ mode: "local", selected: [] }}
        unpriced={[
          {
            model: "claude-x",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  expect(screen.getByText(/Products: Claude Code/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review pricing" })).toHaveAttribute(
    "href",
    "/settings#claude-pricing"
  );
});
