/**
 * @file Sessions.providerFilter.test.tsx
 * @description Verifies that the Sessions provider filter follows the product
 * scope chosen in onboarding or Settings and forwards a selected stored
 * provider to the server-side session query.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Sessions.providerFilter.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Verifies that the Sessions provider filter follows the product scope chosen in onboarding or
 * Settings and forwards a selected stored provider to the server-side session query.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../Sessions` — repository-local contract consumed by this module; review its exports before
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
 * - `openProviderFilter` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `renderForScope` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `offers all stored providers in Both scope and queries the selected provider` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `offers Claude Code and Cursor inside the Claude-compatible scope` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `offers only Codex inside the Codex scope` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `Sessions provider filter` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Sessions.providerFilter.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { setProviderScope, type ProviderScope } from "../../lib/dataScope";
import { Sessions } from "../Sessions";

const { listSessions } = vi.hoisted(() => ({
  listSessions: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      facets: vi.fn().mockResolvedValue({ cwds: [], sources: ["local"], providers: [] }),
      list: listSessions,
    },
    remoteSources: {
      list: vi.fn().mockResolvedValue({ sources: [] }),
    },
    run: {
      list: vi.fn().mockResolvedValue({ runs: [], items: [] }),
    },
  },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    connected: true,
    onConnection: () => () => undefined,
    subscribe: () => () => undefined,
  },
}));

/** Render the Sessions page under one persisted global product scope. */
function renderForScope(scope: ProviderScope) {
  setProviderScope(scope);
  return render(
    <MemoryRouter initialEntries={["/sessions"]}>
      <Sessions />
    </MemoryRouter>
  );
}

/** Open the provider dropdown by its current all-providers label. */
function openProviderFilter() {
  fireEvent.click(screen.getByRole("button", { name: "All providers" }));
}

describe("Sessions provider filter", () => {
  beforeEach(() => {
    listSessions.mockReset().mockResolvedValue({ sessions: [], total: 0, limit: 10, offset: 0 });
  });

  it("offers Claude Code and Cursor inside the Claude-compatible scope", async () => {
    renderForScope("claude");
    openProviderFilter();

    expect(screen.getByRole("option", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cursor" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Codex" })).not.toBeInTheDocument();
  });

  it("offers only Codex inside the Codex scope", async () => {
    renderForScope("codex");
    openProviderFilter();

    expect(screen.getByRole("option", { name: "Codex" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Claude Code" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cursor" })).not.toBeInTheDocument();
  });

  it("offers all stored providers in Both scope and queries the selected provider", async () => {
    renderForScope("both");
    openProviderFilter();

    expect(screen.getByRole("option", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Codex" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Cursor" }));

    await waitFor(() => {
      expect(listSessions).toHaveBeenLastCalledWith(
        expect.objectContaining({ provider: "cursor" })
      );
    });
  });
});
