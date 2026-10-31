/**
 * @file PaginatedLegend.test.tsx
 * @description Verifies chart legends remain unpaginated when labels fit and
 * expose every longer-list label through accessible page controls.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/PaginatedLegend.test.tsx`
 *
 * Scope
 * Verifies chart legends remain unpaginated when labels fit and expose every longer-list label
 * through accessible page controls.
 *
 * Subjects and collaborators
 * - `../PaginatedLegend` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `userEvent` models complete browser interactions; await it so state updates settle before
 *   assertions.
 *
 * Suite groups
 * - `PaginatedLegend`
 *
 * Protected behavior
 * - renders every label without controls when all labels fit
 * - pages longer legends without spilling every label at once
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

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
