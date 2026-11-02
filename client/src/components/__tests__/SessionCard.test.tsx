/**
 * @file SessionCard.test.tsx
 * @description Regression tests for the compact Kanban session card, including
 * preserving provider-native session titles, two-turn human task context,
 * no redundant ID badge, and hover titles for single-line truncated fields.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/SessionCard.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Regression tests for the compact Kanban session card, including preserving provider-native
 * session titles, two-turn human task context, no redundant ID badge, and hover titles for
 * single-line truncated fields.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/format` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../SessionCard` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
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
 * - `LocationProbe` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `makeSession` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useLocation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `clamps long titles to three lines and can render status as a dot` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `does not navigate before a transient Codex process has a durable session id` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `keeps a named Codex session title clean without a duplicate provider ID badge` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `keeps the full working directory and model available on hover` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `SessionCard` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `shows a renamed Codex session's latest prompt below its native title` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `shows the same bounded two-turn history for a Claude session` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/SessionCard.test.tsx`
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
 * Path: `client/src/components/__tests__/SessionCard.test.tsx`
 *
 * Scope
 * Regression tests for the compact Kanban session card, including preserving provider-native session
 * titles, two-turn human task context, no redundant ID badge, and hover titles for single-line
 * truncated fields.
 *
 * Subjects and collaborators
 * - `../SessionCard` — local module imported by this suite.
 * - `../../lib/types` — local module imported by this suite.
 * - `../../lib/format` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 *
 * Suite groups
 * - `SessionCard`
 *
 * Protected behavior
 * - keeps a named Codex session title clean without a duplicate provider ID badge
 * - shows a renamed Codex session's latest prompt below its native title
 * - shows the same bounded two-turn history for a Claude session
 * - does not navigate before a transient Codex process has a durable session id
 * - clamps long titles to three lines and can render status as a dot
 * - keeps the full working directory and model available on hover
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

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { SessionCard } from "../SessionCard";
import type { Session } from "../../lib/types";
import { formatModelName } from "../../lib/format";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "019fbe8f-b608-7c80-afec-ee65e2ebbe1c",
    name: "Ship real-time session discovery",
    status: "active",
    cwd: "/Users/dev/project",
    model: "gpt-5.6-terra",
    started_at: "2026-08-02T00:00:00.000Z",
    ended_at: null,
    metadata: null,
    agent_count: 1,
    cost: 54.85,
    provider: "codex",
    ...overrides,
  };
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("SessionCard", () => {
  it("keeps a named Codex session title clean without a duplicate provider ID badge", () => {
    render(
      <MemoryRouter>
        <SessionCard session={makeSession()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Ship real-time session discovery")).toBeInTheDocument();
    expect(screen.getByText("019fbe8f-b60")).toBeInTheDocument();
    expect(screen.queryByText("Codex · 019fbe8f")).not.toBeInTheDocument();
  });

  it("shows a renamed Codex session's latest prompt below its native title", () => {
    render(
      <MemoryRouter>
        <SessionCard
          session={makeSession({
            name: "hehe",
            prompt_preview:
              "Add live card context for renamed Codex sessions.\nKeep the follow-up concise.",
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("hehe")).toBeInTheDocument();
    expect(
      screen.getByText("Add live card context for renamed Codex sessions.")
    ).toBeInTheDocument();
    expect(screen.getByText("Keep the follow-up concise.")).toBeInTheDocument();
  });

  it("shows the same bounded two-turn history for a Claude session", () => {
    render(
      <MemoryRouter>
        <SessionCard
          session={makeSession({
            id: "claude-two-turn-context",
            name: "Remote sync investigation",
            provider: "claude",
            prompt_preview:
              "Investigate the remote sync delay.\nThen preserve the normal idle sweep.",
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Investigate the remote sync delay.")).toBeInTheDocument();
    expect(screen.getByText("Then preserve the normal idle sweep.")).toBeInTheDocument();
  });

  it("does not navigate before a transient Codex process has a durable session id", () => {
    const metadata = JSON.stringify({ transient: true, pre_identity_process: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/kanban"]}>
        <SessionCard
          session={makeSession({
            id: "codex-process:4312:abc123",
            name: "Codex session",
            metadata,
          })}
        />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Codex · codex-pr"));
    expect(screen.getByTestId("location")).toHaveTextContent("/kanban");
    expect(container.querySelector(".card-hover")?.className).toContain("cursor-default");
  });

  it("clamps long titles to three lines and can render status as a dot", () => {
    const name = "A very long session title ".repeat(8).trim();
    const { container } = render(
      <MemoryRouter>
        <SessionCard session={makeSession({ name })} statusDisplay="dot" />
      </MemoryRouter>
    );
    const title = screen.getByText(name);
    expect(title.className).toContain("line-clamp-3");
    expect(title).toHaveAttribute("title", name);
    expect(container.querySelector("[data-status-dot]")).not.toBeNull();
    expect(container.querySelector(".badge")).toBeNull();
  });

  it("keeps the full working directory and model available on hover", () => {
    const cwd = "/Users/dev/some/deeply/nested/monorepo/packages/service-with-a-long-name";
    render(
      <MemoryRouter>
        <SessionCard session={makeSession({ cwd })} />
      </MemoryRouter>
    );
    // Both lines are single-line truncated in a narrow Kanban column.
    expect(screen.getByText(cwd)).toHaveAttribute("title", cwd);
    const model = formatModelName("gpt-5.6-terra")!;
    expect(screen.getByText(model)).toHaveAttribute("title", model);
  });
});
