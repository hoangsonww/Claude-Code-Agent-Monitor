/**
 * @file EmptyState.test.tsx
 * @description Unit tests for the EmptyState component, which is a reusable React component that displays an empty state with an icon, title, description, and an optional action. The tests cover rendering of the title, description, icon, and action button when provided. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
