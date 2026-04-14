/**
 * @file StatCard.test.tsx
 * @description Unit tests for the StatCard component, which is a reusable React component that displays a statistic with a label, value, icon, and optional trend information. The tests cover rendering of the label, value (both numeric and string), trend information, and the icon. The tests also verify that custom accent colors are applied correctly. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
});
