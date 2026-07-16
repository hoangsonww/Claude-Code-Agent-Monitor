/**
 * @file StatusBadge.test.tsx
 * @description Unit tests for the StatusBadge component, which includes AgentStatusBadge and SessionStatusBadge. These components are responsible for displaying the status of agents and sessions in the dashboard. The tests cover rendering of different statuses, application of pulse animation based on status, respect for explicit pulse overrides, and the awaiting-reason suffix (icon + short label + hover tooltip) that explains WHY a row is in the Waiting state. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
    const { container } = render(<AgentStatusBadge status="waiting" reason="interrupted" />);
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
    // Tip attaches its handlers to the wrapper element and portals the tooltip
    // body into document.body.
    fireEvent.mouseEnter(container.firstElementChild!, { clientX: 10, clientY: 10 });
    expect(screen.getByText(/The last turn was interrupted/)).toBeInTheDocument();
  });

  it("marks urgent reasons with the hotter amber tint", () => {
    const { container } = render(<AgentStatusBadge status="waiting" reason="notification" />);
    expect(container.querySelector(".text-amber-300")).toBeInTheDocument();
    const { container: calm } = render(<AgentStatusBadge status="waiting" reason="stop" />);
    expect(calm.querySelector(".text-amber-300")).not.toBeInTheDocument();
  });
});
