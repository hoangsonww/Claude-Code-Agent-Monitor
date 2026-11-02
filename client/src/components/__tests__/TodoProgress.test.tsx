/**
 * @file Component tests for compact and detailed task-progress surfaces,
 * including accessible tooltip triggers and subagent ownership rendering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/TodoProgress.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Component tests for compact and detailed task-progress surfaces, including accessible tooltip
 * triggers and subagent ownership rendering.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../todoProgress` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../TodoProgressIndicator` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../TodoProgressPanel` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `@testing-library/user-event` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `items` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `snapshot` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `summary` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `opens the detailed tooltip on hover and keyboard focus` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `pages long task lists ten rows at a time` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `renders nothing for an empty task summary` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `renders progress, source confidence, tasks, and owner breakdown` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `taskSourceLabel` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `TodoProgressIndicator` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `TodoProgressPanel` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `uses the caller's localized fallback when source metadata is absent` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/TodoProgress.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/TodoProgress.test.tsx`
 *
 * Scope
 * Behavioral regression suite for `TodoProgress.test.tsx`.
 *
 * Subjects and collaborators
 * - `../../lib/types` — local module imported by this suite.
 * - `../TodoProgressIndicator` — local module imported by this suite.
 * - `../TodoProgressPanel` — local module imported by this suite.
 * - `../todoProgress` — local module imported by this suite.
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
 * - `TodoProgressIndicator`
 * - `taskSourceLabel`
 * - `TodoProgressPanel`
 *
 * Protected behavior
 * - opens the detailed tooltip on hover and keyboard focus
 * - renders nothing for an empty task summary
 * - uses the caller's localized fallback when source metadata is absent
 * - renders progress, source confidence, tasks, and owner breakdown
 * - pages long task lists ten rows at a time
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
