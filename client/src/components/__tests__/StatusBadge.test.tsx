/**
 * @file StatusBadge.test.tsx
 * @description Unit tests for the StatusBadge component, which includes AgentStatusBadge and SessionStatusBadge. These components are responsible for displaying the status of agents and sessions in the dashboard. The tests cover rendering of different statuses, application of pulse animation based on status, respect for explicit pulse overrides, and the awaiting-reason suffix (icon + short label + hover tooltip) that explains WHY a row is in the Waiting state. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/StatusBadge.test.tsx`
 *
 * Scope
 * Unit tests for the StatusBadge component, which includes AgentStatusBadge and SessionStatusBadge.
 * These components are responsible for displaying the status of agents and sessions in the
 * dashboard. The tests cover rendering of different statuses, application of pulse animation based
 * on status, respect for explicit pulse overrides, and the awaiting-reason suffix (icon + short
 * label + hover tooltip) that explains WHY a row is in the Waiting state. The tests use React
 * Testing Library and Vitest for assertions and mocking.
 *
 * Subjects and collaborators
 * - `../StatusBadge` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `AgentStatusBadge`
 * - `SessionStatusBadge`
 * - `awaiting-reason suffix`
 *
 * Protected behavior
 * - should render waiting status
 * - should render working status
 * - should render completed status
 * - should render error status
 * - should apply pulse animation for working status by default
 * - the legacy connected-status case now renders `working` and confirms that its dot pulses
 * - should apply pulse animation for waiting status by default
 * - should respect explicit pulse=false override
 * - should respect explicit pulse=true override
 * - should render waiting status with yellow dot and pulse by default
 * - should render active status
 * - should render abandoned status
 * - should render waiting status with pulsing yellow dot
 * - renders the reason label next to Waiting on AgentStatusBadge
 * - renders the reason label next to Waiting on SessionStatusBadge
 * - ignores the reason on non-waiting statuses
 * - renders no suffix when reason is null/omitted
 * - shows the full reason description in a tooltip on hover
 * - uses Codex wording for Codex waiting reasons
 * - marks urgent reasons with the hotter amber tint
 * - compact mode suppresses the inline chip but keeps the hover tooltip
 * - compact mode works on SessionStatusBadge too
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
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentStatusBadge, SessionStatusBadge } from "../StatusBadge";

describe("AgentStatusBadge", () => {
  it("should render waiting status", () => {
    render(<AgentStatusBadge status="waiting" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });

  it("should render working status", () => {
    render(<AgentStatusBadge status="working" />);
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("should render completed status", () => {
    render(<AgentStatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("should render error status", () => {
    render(<AgentStatusBadge status="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should apply pulse animation for working status by default", () => {
    const { container } = render(<AgentStatusBadge status="working" />);
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
  });

  it("should not apply pulse for connected status (now working - has pulse)", () => {
    const { container } = render(<AgentStatusBadge status="working" />);
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
  });

  it("should apply pulse animation for waiting status by default", () => {
    const { container } = render(<AgentStatusBadge status="waiting" />);
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
  });

  it("should respect explicit pulse=false override", () => {
    const { container } = render(<AgentStatusBadge status="working" pulse={false} />);
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).not.toBeInTheDocument();
  });

  it("should respect explicit pulse=true override", () => {
    const { container } = render(<AgentStatusBadge status="waiting" pulse={true} />);
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
  });

  it("should render waiting status with yellow dot and pulse by default", () => {
    const { container } = render(<AgentStatusBadge status="waiting" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
    expect(container.querySelector(".bg-yellow-400")).toBeInTheDocument();
  });
});

describe("SessionStatusBadge", () => {
  it("should render active status", () => {
    render(<SessionStatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("should render completed status", () => {
    render(<SessionStatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("should render error status", () => {
    render(<SessionStatusBadge status="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should render abandoned status", () => {
    render(<SessionStatusBadge status="abandoned" />);
    expect(screen.getByText("Abandoned")).toBeInTheDocument();
  });

  it("should render waiting status with pulsing yellow dot", () => {
    const { container } = render(<SessionStatusBadge status="waiting" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    const dot = container.querySelector(".animate-pulse-dot");
    expect(dot).toBeInTheDocument();
    expect(container.querySelector(".bg-yellow-400")).toBeInTheDocument();
  });
});

describe("awaiting-reason suffix", () => {
  it("renders the reason label next to Waiting on AgentStatusBadge", () => {
    render(<AgentStatusBadge status="waiting" reason="notification" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Needs input")).toBeInTheDocument();
  });

  it("renders the reason label next to Waiting on SessionStatusBadge", () => {
    render(<SessionStatusBadge status="waiting" reason="stop" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Turn done")).toBeInTheDocument();
  });

  it("ignores the reason on non-waiting statuses", () => {
    render(<AgentStatusBadge status="working" reason="notification" />);
    expect(screen.queryByText("Needs input")).not.toBeInTheDocument();
    render(<SessionStatusBadge status="active" reason="stop" />);
    expect(screen.queryByText("Turn done")).not.toBeInTheDocument();
  });

  it("renders no suffix when reason is null/omitted", () => {
    render(<AgentStatusBadge status="waiting" reason={null} />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Needs input")).not.toBeInTheDocument();
    expect(screen.queryByText("Turn done")).not.toBeInTheDocument();
  });

  it("shows the full reason description in a tooltip on hover", () => {
    const { container } = render(
      <AgentStatusBadge status="waiting" reason="interrupted" provider="claude" />
    );
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
    // Tip attaches its handlers to the wrapper element and portals the tooltip
    // body into document.body.
    fireEvent.mouseEnter(container.firstElementChild!, { clientX: 10, clientY: 10 });
    expect(screen.getByText(/The last turn was interrupted/)).toBeInTheDocument();
  });

  it("uses Codex wording for Codex waiting reasons", () => {
    const { container } = render(
      <SessionStatusBadge status="waiting" reason="stop" provider="codex" />
    );
    fireEvent.mouseEnter(container.firstElementChild!, { clientX: 10, clientY: 10 });
    expect(screen.getByText(/Codex finished its reply/)).toBeInTheDocument();
    expect(screen.queryByText(/Claude finished its reply/)).not.toBeInTheDocument();
  });

  it("marks urgent reasons with the hotter amber tint", () => {
    const { container } = render(<AgentStatusBadge status="waiting" reason="notification" />);
    expect(container.querySelector(".text-amber-300")).toBeInTheDocument();
    const { container: calm } = render(<AgentStatusBadge status="waiting" reason="stop" />);
    expect(calm.querySelector(".text-amber-300")).not.toBeInTheDocument();
  });

  it("compact mode suppresses the inline chip but keeps the hover tooltip", () => {
    const { container } = render(
      <AgentStatusBadge status="waiting" reason="notification" compact />
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Needs input")).not.toBeInTheDocument();
    fireEvent.mouseEnter(container.firstElementChild!, { clientX: 10, clientY: 10 });
    expect(screen.getByText(/Blocked on a permission prompt/)).toBeInTheDocument();
  });

  it("compact mode works on SessionStatusBadge too", () => {
    render(<SessionStatusBadge status="waiting" reason="stop" compact />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.queryByText("Turn done")).not.toBeInTheDocument();
  });
});
