/**
 * @file Component tests for compact and detailed task-progress surfaces,
 * including accessible tooltip triggers and subagent ownership rendering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SessionTodoSnapshot, SessionTodoSummary } from "../../lib/types";
import { TodoProgressIndicator } from "../TodoProgressIndicator";
import { TodoProgressPanel } from "../TodoProgressPanel";
import { taskSourceLabel } from "../todoProgress";

const items = [
  {
    id: "task-1",
    text: "Inspect code",
    status: "completed" as const,
    sourceStatus: "completed",
    order: 0,
    agentId: "main-1",
    agentType: "main",
    description: null,
  },
  {
    id: "task-2",
    text: "Implement tracker",
    status: "in_progress" as const,
    sourceStatus: "in_progress",
    order: 1,
    agentId: "reviewer-1",
    agentType: "reviewer",
    description: "Build the two task progress surfaces",
  },
  {
    id: "task-3",
    text: "Add API tests",
    status: "completed" as const,
    sourceStatus: "completed",
    order: 2,
    agentId: "main-1",
    agentType: "main",
    description: null,
  },
  {
    id: "task-4",
    text: "Add UI tests",
    status: "completed" as const,
    sourceStatus: "completed",
    order: 3,
    agentId: "main-1",
    agentType: "main",
    description: null,
  },
  {
    id: "task-5",
    text: "Update documentation",
    status: "completed" as const,
    sourceStatus: "completed",
    order: 4,
    agentId: "reviewer-1",
    agentType: "reviewer",
    description: null,
  },
  {
    id: "task-6",
    text: "Run validation",
    status: "pending" as const,
    sourceStatus: "pending",
    order: 5,
    agentId: "main-1",
    agentType: "main",
    description: null,
  },
  {
    id: "task-7",
    text: "Review the final diff",
    status: "pending" as const,
    sourceStatus: "pending",
    order: 6,
    agentId: "reviewer-1",
    agentType: "reviewer",
    description: null,
  },
];

const summary: SessionTodoSummary = {
  total: 7,
  completed: 4,
  inProgress: 1,
  pending: 2,
  cancelled: 0,
  unknown: 0,
  percentComplete: 57,
  activeText: "Implement tracker",
  sourceTool: "TaskList",
  updatedAt: "2026-08-07T10:00:00.000Z",
  previewItems: items,
  overflowCount: 5,
  ownerBreakdown: [
    { agentId: "main-1", agentType: "main", completed: 3, total: 4 },
    { agentId: "reviewer-1", agentType: "reviewer", completed: 1, total: 3 },
  ],
};

const snapshot: SessionTodoSnapshot = {
  ...summary,
  provider: "claude",
  source: "mixed",
  sourceLine: 42,
  explanation: "Tracking implementation",
  confidence: "partial",
  items,
  includesSubagents: true,
};

describe("TodoProgressIndicator", () => {
  it("opens the detailed tooltip on hover and keyboard focus", () => {
    render(<TodoProgressIndicator progress={summary} />);

    const trigger = screen.getByRole("button", { name: "Task progress: 4 of 7 complete" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");

    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("id");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveTextContent("4 / 7 complete · 57%");
    expect(tooltip).toHaveTextContent("Current: Implement tracker");
    expect(tooltip).toHaveTextContent("reviewer");
    expect(tooltip).toHaveTextContent("+5 more tasks in Session Detail");

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Claude TaskList");
  });

  it("renders nothing for an empty task summary", () => {
    const { container } = render(
      <TodoProgressIndicator
        progress={{
          ...summary,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          percentComplete: null,
          previewItems: [],
          overflowCount: 0,
        }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("taskSourceLabel", () => {
  it("uses the caller's localized fallback when source metadata is absent", () => {
    expect(taskSourceLabel(null, "Estado de tareas")).toBe("Estado de tareas");
  });
});

describe("TodoProgressPanel", () => {
  it("renders progress, source confidence, tasks, and owner breakdown", () => {
    render(<TodoProgressPanel snapshot={snapshot} />);

    expect(screen.getByText("Task Progress")).toBeInTheDocument();
    expect(screen.getByText("Claude TaskList")).toBeInTheDocument();
    expect(screen.getByText("Includes subagents")).toBeInTheDocument();
    expect(screen.getByText("Derived from task lifecycle events")).toBeInTheDocument();
    expect(screen.getByText("Inspect code")).toBeInTheDocument();
    expect(screen.getByText("Implement tracker")).toBeInTheDocument();
    expect(screen.getByText("Review the final diff")).toBeInTheDocument();
    expect(screen.getAllByText("reviewer").length).toBeGreaterThan(0);
    expect(screen.getByText("4 / 7 complete")).toBeInTheDocument();
  });

  it("pages long task lists ten rows at a time", async () => {
    const user = userEvent.setup();
    const paginatedItems = Array.from({ length: 12 }, (_, index) => ({
      id: `page-task-${index + 1}`,
      text: `Page task ${index + 1}`,
      status: "pending" as const,
      sourceStatus: "pending",
      order: index,
      agentId: "main-1",
      agentType: "main",
      description: null,
    }));

    render(
      <TodoProgressPanel
        snapshot={{
          ...snapshot,
          total: 12,
          completed: 0,
          inProgress: 0,
          pending: 12,
          percentComplete: 0,
          activeText: null,
          items: paginatedItems,
          ownerBreakdown: [{ agentId: "main-1", agentType: "main", completed: 0, total: 12 }],
        }}
      />
    );

    expect(screen.getByText("Page task 1")).toBeVisible();
    expect(screen.getByText("Page task 10")).toBeVisible();
    expect(screen.queryByText("Page task 11")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1-10 of 12")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText("Page task 1")).not.toBeInTheDocument();
    expect(screen.getByText("Page task 11")).toBeVisible();
    expect(screen.getByText("Page task 12")).toBeVisible();
    expect(screen.getByText("Showing 11-12 of 12")).toBeVisible();
  });
});
