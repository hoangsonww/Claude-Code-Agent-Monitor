/**
 * @file StatCard.test.tsx
 * @description Unit tests for the StatCard component, which is a reusable React component that displays a statistic with a label, value, icon, and optional trend information. The tests cover rendering of the label, value (both numeric and string), trend information, and the icon. The tests also verify that custom accent colors are applied correctly. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/StatCard.test.tsx`
 *
 * Scope
 * Unit tests for the StatCard component, which is a reusable React component that displays a
 * statistic with a label, value, icon, and optional trend information. The tests cover rendering of
 * the label, value (both numeric and string), trend information, and the icon. The tests also verify
 * that custom accent colors are applied correctly. The tests use React Testing Library and Vitest
 * for assertions and mocking.
 *
 * Subjects and collaborators
 * - `../StatCard` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `StatCard`
 *
 * Protected behavior
 * - should render label
 * - should render numeric value
 * - should render string value
 * - should render trend when provided
 * - should not render trend when not provided
 * - should render the icon
 * - should apply custom accent color
 * - should apply default accent color when not specified
 * - should render a skeleton placeholder when loading and hide the real value
 * - should swap from skeleton to value when loading flips false
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
import { StatCard } from "../StatCard";
import { Activity } from "lucide-react";

describe("StatCard", () => {
  it("should render label", () => {
    render(<StatCard label="Total Sessions" value={42} icon={Activity} />);
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
  });

  it("should render numeric value", () => {
    render(<StatCard label="Events" value={156} icon={Activity} />);
    expect(screen.getByText("156")).toBeInTheDocument();
  });

  it("should render string value", () => {
    render(<StatCard label="Status" value="-" icon={Activity} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("should render trend when provided", () => {
    render(<StatCard label="Sessions" value={10} icon={Activity} trend="3 active" />);
    expect(screen.getByText("3 active")).toBeInTheDocument();
  });

  it("should not render trend when not provided", () => {
    render(<StatCard label="Sessions" value={10} icon={Activity} />);
    expect(screen.queryByText("active")).not.toBeInTheDocument();
  });

  it("should render the icon", () => {
    const { container } = render(<StatCard label="Test" value={0} icon={Activity} />);
    // Lucide renders as SVG
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should apply custom accent color", () => {
    const { container } = render(
      <StatCard label="Test" value={0} icon={Activity} accentColor="text-emerald-400" />
    );
    const svg = container.querySelector("svg");
    expect(svg?.className?.baseVal ?? svg?.getAttribute("class")).toContain("text-emerald-400");
  });

  it("should apply default accent color when not specified", () => {
    const { container } = render(<StatCard label="Test" value={0} icon={Activity} />);
    const svg = container.querySelector("svg");
    expect(svg?.className?.baseVal ?? svg?.getAttribute("class")).toContain("text-accent");
  });

  it("should render a skeleton placeholder when loading and hide the real value", () => {
    const { container } = render(<StatCard label="Total" value="" icon={Activity} loading />);
    // value text should NOT appear so users never see a flash of "-" or 0
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    // skeleton primitive renders an aria-busy node
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("should swap from skeleton to value when loading flips false", () => {
    const { rerender } = render(<StatCard label="Total" value="" icon={Activity} loading />);
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    rerender(<StatCard label="Total" value={42} icon={Activity} loading={false} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
