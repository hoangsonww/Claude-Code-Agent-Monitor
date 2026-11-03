/**
 * @file MultiSelect.test.tsx
 * @description Tests the searchable custom multi-select's filtering, multi-value
 * toggling, and long-label accessible rendering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/MultiSelect.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests the searchable custom multi-select's filtering, multi-value toggling, and long-label
 * accessible rendering.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../MultiSelect` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `OPTIONS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderMultiSelect` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Named test contracts
 * - `adds a project without closing the menu so another can be selected` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `filters options inside the open popover` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `links the trigger to its dialog and closes with Escape` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `MultiSelect` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `provides the full long project path as an accessible name` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/MultiSelect.test.tsx`
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
 * Path: `client/src/components/__tests__/MultiSelect.test.tsx`
 *
 * Scope
 * Tests the searchable custom multi-select's filtering, multi-value toggling, and long-label
 * accessible rendering.
 *
 * Subjects and collaborators
 * - `../MultiSelect` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `MultiSelect`
 *
 * Protected behavior
 * - filters options inside the open popover
 * - adds a project without closing the menu so another can be selected
 * - provides the full long project path as an accessible name
 * - links the trigger to its dialog and closes with Escape
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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MultiSelect } from "../MultiSelect";

const OPTIONS = [
  { value: "/work/agent-monitor", label: "/work/agent-monitor" },
  {
    value: "/work/very-long-project-directory-name",
    label: "/work/very-long-project-directory-name",
  },
  { value: "/work/website", label: "/work/website" },
];

function renderMultiSelect(value: string[] = []) {
  const onChange = vi.fn();
  render(
    <MultiSelect
      label="Project directories"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      allLabel="All projects"
      selectedCountLabel={(count) => `${count} projects`}
      searchPlaceholder="Filter projects..."
      emptyLabel="No matching projects"
      clearLabel="Clear"
    />
  );
  return onChange;
}

describe("MultiSelect", () => {
  it("filters options inside the open popover", () => {
    renderMultiSelect();
    fireEvent.click(screen.getByRole("button", { name: /project directories: all projects/i }));
    fireEvent.change(screen.getByPlaceholderText("Filter projects..."), {
      target: { value: "monitor" },
    });

    expect(screen.getByRole("checkbox", { name: "/work/agent-monitor" })).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "/work/very-long-project-directory-name" })
    ).not.toBeInTheDocument();
  });

  it("adds a project without closing the menu so another can be selected", () => {
    const onChange = renderMultiSelect(["/work/agent-monitor"]);
    fireEvent.click(
      screen.getByRole("button", { name: /project directories: \/work\/agent-monitor/i })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "/work/website" }));

    expect(onChange).toHaveBeenCalledWith(["/work/agent-monitor", "/work/website"]);
    expect(screen.getByRole("dialog", { name: "Project directories" })).toBeInTheDocument();
  });

  it("provides the full long project path as an accessible name", () => {
    renderMultiSelect();
    fireEvent.click(screen.getByRole("button", { name: /project directories: all projects/i }));

    expect(
      screen.getByRole("checkbox", { name: "/work/very-long-project-directory-name" })
    ).toBeInTheDocument();
  });

  it("links the trigger to its dialog and closes with Escape", () => {
    renderMultiSelect();
    const trigger = screen.getByRole("button", { name: /project directories: all projects/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Project directories" });
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Project directories" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
