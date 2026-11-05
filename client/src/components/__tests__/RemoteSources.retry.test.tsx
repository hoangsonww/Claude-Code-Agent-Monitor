/**
 * @file Verifies failed-sync diagnostics remain visible while a retry is active,
 * then clear after a successful attempt without requiring another manual test.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/RemoteSources.retry.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Verifies failed-sync diagnostics remain visible while a retry is active, then clear after a
 * successful attempt without requiring another manual test.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../RemoteSources` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `mocks` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `shows the last failure during checking and removes it after success` — executable behavior
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/RemoteSources.retry.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { RemoteSources } from "../RemoteSources";
import { eventBus } from "../../lib/eventBus";
const mocks = vi.hoisted(() => ({ list: vi.fn(), facets: vi.fn() }));
vi.mock("../../lib/api", () => ({
  api: { remoteSources: { list: mocks.list }, sessions: { facets: mocks.facets } },
}));
it("shows the last failure during checking and removes it after success", async () => {
  const source = {
    id: "src_retry",
    label: "Box",
    host: "test.invalid",
    enabled: true,
    status: "syncing",
    claude_status: "syncing",
    codex_status: "syncing",
    last_error: "SSH timeout",
    session_count: 20,
    last_sync_counts: { imported: 0, sessions_tagged: 20 },
  };
  mocks.list.mockResolvedValue({ sources: [source] });
  mocks.facets.mockResolvedValue({ sources: ["local", "src_retry"] });
  render(<RemoteSources />);
  expect(await screen.findByRole("status")).toHaveTextContent("Retrying. Last error: SSH timeout");
  mocks.list.mockResolvedValue({
    sources: [
      { ...source, status: "ok", claude_status: "ok", codex_status: "ok", last_error: null },
    ],
  });
  act(() =>
    eventBus.publish({
      type: "remote_source.status",
      data: { id: source.id, status: "ok" },
      timestamp: new Date().toISOString(),
    })
  );
  await waitFor(() => expect(screen.queryByText(/SSH timeout/)).not.toBeInTheDocument());
});
