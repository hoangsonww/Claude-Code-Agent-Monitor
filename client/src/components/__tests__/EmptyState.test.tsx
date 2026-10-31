/**
 * @file EmptyState.test.tsx
 * @description Unit tests for the EmptyState component, which is a reusable React component that displays an empty state with an icon, title, description, and an optional action. The tests cover rendering of the title, description, icon, and action button when provided. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/EmptyState.test.tsx`
 *
 * Scope
 * Unit tests for the EmptyState component, which is a reusable React component that displays an
 * empty state with an icon, title, description, and an optional action. The tests cover rendering of
 * the title, description, icon, and action button when provided. The tests use React Testing Library
 * and Vitest for assertions and mocking.
 *
 * Subjects and collaborators
 * - `../EmptyState` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `EmptyState`
 *
 * Protected behavior
 * - should render title
 * - should render description
 * - should render the icon
 * - should render action when provided
 * - should not render action when not provided
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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
import { Bot } from "lucide-react";

describe("EmptyState", () => {
  it("should render title", () => {
    render(
      <EmptyState icon={Bot} title="No agents" description="Start a session to see agents." />
    );
    expect(screen.getByText("No agents")).toBeInTheDocument();
  });

  it("should render description", () => {
    render(
      <EmptyState icon={Bot} title="No agents" description="Start a session to see agents." />
    );
    expect(screen.getByText("Start a session to see agents.")).toBeInTheDocument();
  });

  it("should render the icon", () => {
    const { container } = render(<EmptyState icon={Bot} title="Title" description="Desc" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should render action when provided", () => {
    render(
      <EmptyState icon={Bot} title="Title" description="Desc" action={<button>Retry</button>} />
    );
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should not render action when not provided", () => {
    render(<EmptyState icon={Bot} title="Title" description="Desc" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
