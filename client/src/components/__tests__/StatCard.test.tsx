/**
 * @file StatCard.test.tsx
 * @description Unit tests for the StatCard component, which is a reusable React component that displays a statistic with a label, value, icon, and optional trend information. The tests cover rendering of the label, value (both numeric and string), trend information, and the icon. The tests also verify that custom accent colors are applied correctly. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/StatCard.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the StatCard component, which is a reusable React component that displays a
 * statistic with a label, value, icon, and optional trend information. The tests cover rendering of
 * the label, value (both numeric and string), trend information, and the icon. The tests also
 * verify that custom accent colors are applied correctly. The tests use React Testing Library and
 * Vitest for assertions and mocking.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../StatCard` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Named test contracts
 * - `should apply custom accent color` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should apply default accent color when not specified` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should not render trend when not provided` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `should render a skeleton placeholder when loading and hide the real value` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `should render label` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should render numeric value` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should render string value` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should render the icon` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should render trend when provided` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should swap from skeleton to value when loading flips false` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `StatCard` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/StatCard.test.tsx`
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
