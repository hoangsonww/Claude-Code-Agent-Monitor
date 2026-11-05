/**
 * @file Render + interaction tests for WorkflowRunsPanel (controlled mode):
 * empty state, collapsed header, expand → phase chips + per-agent table +
 * results (phase markers excluded), phase-filter toggling, per-result expand to
 * full content, and the running-run indicator.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/__tests__/WorkflowRunsPanel.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Render + interaction tests for WorkflowRunsPanel (controlled mode): empty state, collapsed
 * header, expand → phase chips + per-agent table + results (phase markers excluded), phase-filter
 * toggling, per-result expand to full content, and the running-run indicator.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../WorkflowRunsPanel` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `buttonByText` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `makeRun` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderPanel` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `runHeader` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `expands a result row to its full, un-truncated content` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `expands to phase chips + per-agent rows, excluding phase markers` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `filters rows by phase when a phase chip is clicked, then clears` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `marks a running workflow as running` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `renders a collapsed run header; the agent table is hidden until expanded` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `shows the empty state with no runs` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `WorkflowRunsPanel` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/__tests__/WorkflowRunsPanel.test.tsx`
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
 * Path: `client/src/components/workflows/__tests__/WorkflowRunsPanel.test.tsx`
 *
 * Scope
 * Behavioral regression suite for `WorkflowRunsPanel.test.tsx`.
 *
 * Subjects and collaborators
 * - `../WorkflowRunsPanel` — local module imported by this suite.
 * - `../../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 *
 * Suite groups
 * - `WorkflowRunsPanel`
 *
 * Protected behavior
 * - shows the empty state with no runs
 * - renders a collapsed run header; the agent table is hidden until expanded
 * - expands to phase chips + per-agent rows, excluding phase markers
 * - filters rows by phase when a phase chip is clicked, then clears
 * - expands a result row to its full, un-truncated content
 * - marks a running workflow as running
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
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { WorkflowRunsPanel } from "../WorkflowRunsPanel";
import type { WorkflowRun } from "../../../lib/types";

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    run_id: "wf_x",
    session_id: "s1",
    task_id: null,
    name: "review-changes",
    status: "completed",
    default_model: "claude-opus-4-8",
    started_at: "2026-06-14T00:00:00.000Z",
    ended_at: "2026-06-14T00:00:05.000Z",
    duration_ms: 5000,
    agent_count: 3,
    total_tokens: 48000,
    total_tool_calls: 9,
    phases: [{ title: "Scout" }, { title: "Verify" }],
    progress: [
      { type: "workflow_phase", index: 1, title: "Scout" },
      {
        type: "workflow_agent",
        agentId: "a1",
        label: "scout:starship",
        phaseTitle: "Scout",
        state: "done",
        tokens: 20000,
        toolCalls: 5,
        durationMs: 1000,
        lastToolName: "Read",
        resultPreview: '{"claim":"SCOUTCLAIM about starship"}',
      },
      {
        type: "workflow_agent",
        agentId: "a2",
        label: "verify:starship",
        phaseTitle: "Verify",
        state: "done",
        tokens: 18000,
        toolCalls: 3,
        durationMs: 900,
        resultPreview: '{"verdict":"confirmed","note":"VERIFYNOTE"}',
      },
      {
        type: "workflow_agent",
        agentId: "a3",
        label: "scout:starlink",
        phaseTitle: "Scout",
        state: "running",
        tokens: 1000,
        toolCalls: 1,
      },
    ],
    script_path: null,
    journal_path: null,
    source: "journal",
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:05.000Z",
    ...overrides,
  };
}

const renderPanel = (runs: WorkflowRun[]) =>
  render(
    <MemoryRouter>
      <WorkflowRunsPanel runs={runs} hideSessionLink />
    </MemoryRouter>
  );

const runHeader = () => screen.getByRole("button", { name: /review-changes/ });
const buttonByText = (text: string) =>
  screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === text);

describe("WorkflowRunsPanel", () => {
  it("shows the empty state with no runs", () => {
    renderPanel([]);
    expect(screen.getByText(/No dynamic workflows yet/i)).toBeInTheDocument();
  });

  it("renders a collapsed run header; the agent table is hidden until expanded", () => {
    renderPanel([makeRun()]);
    expect(screen.getByText("review-changes")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-8")).toBeInTheDocument();
    // collapsed → inner agents not rendered yet
    expect(screen.queryByText("scout:starship")).not.toBeInTheDocument();
  });

  it("expands to phase chips + per-agent rows, excluding phase markers", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    // 3 workflow_agent entries → present; the workflow_phase marker is NOT a row
    expect(screen.getAllByText("scout:starship").length).toBeGreaterThan(0);
    expect(screen.getAllByText("verify:starship").length).toBeGreaterThan(0);
    expect(screen.getByText("scout:starlink")).toBeInTheDocument();
    // phase filter chips exist as buttons
    expect(buttonByText("Scout")).toBeTruthy();
    expect(buttonByText("Verify")).toBeTruthy();
  });

  it("filters rows by phase when a phase chip is clicked, then clears", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    fireEvent.click(buttonByText("Scout")!);
    // Verify-phase agent is filtered out everywhere; Scout agents remain
    expect(screen.queryByText("verify:starship")).not.toBeInTheDocument();
    expect(screen.getByText("scout:starlink")).toBeInTheDocument();
    // clicking the same chip again clears the filter → Verify agent returns
    fireEvent.click(buttonByText("Scout")!);
    expect(screen.getAllByText("verify:starship").length).toBeGreaterThan(0);
  });

  it("expands a result row to its full, un-truncated content", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    // collapsed result shows the humanized excerpt, not the raw JSON keys
    expect(screen.queryByText(/confirmed/)).not.toBeInTheDocument();
    const resultBtn = screen
      .getAllByRole("button")
      .find((b) => /verify:starship/.test(b.textContent || "") && b.getAttribute("aria-expanded"));
    fireEvent.click(resultBtn!);
    // full content (pretty-printed JSON) now visible → the "verdict" key shows
    expect(screen.getByText(/confirmed/)).toBeInTheDocument();
  });

  it("marks a running workflow as running", () => {
    renderPanel([makeRun({ status: "running", name: "live-run" })]);
    const header = screen.getByRole("button", { name: /live-run/ });
    expect(within(header).getByText("Running")).toBeInTheDocument();
  });
});
