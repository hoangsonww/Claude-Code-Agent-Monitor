/**
 * @file SessionDetail.hookOnly.test.tsx
 * @description Tests the notice SessionDetail shows for a Codex session that
 * never persisted a rollout (`codex exec --ephemeral`). The server marks those
 * sessions `hook_only` in metadata; the page must explain the missing
 * transcript instead of showing the generic "transcript not found" warning.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/SessionDetail.hookOnly.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests the notice SessionDetail shows for a Codex session that never persisted a rollout (`codex
 * exec --ephemeral`). The server marks those sessions `hook_only` in metadata; the page must
 * explain the missing transcript instead of showing the generic "transcript not found" warning.
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
 * - `../SessionDetail` — repository-local contract consumed by this module; review its exports
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
 * - `agent` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `makeSession` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `mockSession` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `NOTICE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderPage` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `explains the missing transcript when the session is hook-only` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `SessionDetail - hook-only Codex sessions` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `stays quiet for an ordinary session backed by a rollout` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `tolerates metadata that is absent or unparseable` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/SessionDetail.hookOnly.test.tsx`
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
 * Path: `client/src/pages/__tests__/SessionDetail.hookOnly.test.tsx`
 *
 * Scope
 * Tests the notice SessionDetail shows for a Codex session that never persisted a rollout (`codex
 * exec --ephemeral`). The server marks those sessions `hook_only` in metadata; the page must explain
 * the missing transcript instead of showing the generic "transcript not found" warning.
 *
 * Subjects and collaborators
 * - `../SessionDetail` — local module imported by this suite.
 * - `../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 * - Mock boundary: `../../lib/api`.
 * - Mock boundary: `../../lib/eventBus`.
 *
 * Suite groups
 * - `SessionDetail - hook-only Codex sessions`
 *
 * Protected behavior
 * - explains the missing transcript when the session is hook-only
 * - stays quiet for an ordinary session backed by a rollout
 * - tolerates metadata that is absent or unparseable
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SessionDetail } from "../SessionDetail";
import type { Agent, DashboardEvent, Session } from "../../lib/types";

let mockSession: Session;

const agent: Agent = {
  id: "codex:sess-ephemeral",
  session_id: "sess-ephemeral",
  name: "Codex",
  type: "main",
  subagent_type: null,
  status: "completed",
  task: null,
  current_tool: null,
  started_at: "2026-08-26T10:00:00.000Z",
  ended_at: "2026-08-26T10:00:09.000Z",
  updated_at: "2026-08-26T10:00:09.000Z",
  parent_agent_id: null,
  metadata: null,
};

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      get: vi.fn(() =>
        Promise.resolve({ session: mockSession, agents: [agent], events: [] as DashboardEvent[] })
      ),
      transcripts: vi.fn(() => Promise.resolve({ transcripts: [] })),
      stats: vi.fn(() =>
        Promise.resolve({
          session_id: "sess-ephemeral",
          total_events: 0,
          events_by_type: [],
          tools_used: [],
          error_count: 0,
          first_event_at: null,
          last_event_at: null,
          agents: { total: 1, main: 1, subagent: 0, compaction: 0, by_status: {} },
          subagent_types: [],
          tokens: {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        })
      ),
    },
    pricing: { sessionCost: vi.fn(() => Promise.resolve({ total_cost: 0, breakdown: [] })) },
    events: {
      list: vi.fn(() =>
        Promise.resolve({ events: [] as DashboardEvent[], limit: 50, offset: 0, total: 0 })
      ),
      facets: vi.fn(() => Promise.resolve({ event_types: [], tool_names: [] })),
    },
  },
}));

vi.mock("../../lib/eventBus", () => ({ eventBus: { subscribe: vi.fn(() => () => {}) } }));

function makeSession(metadata: string | null): Session {
  return {
    id: "sess-ephemeral",
    name: "Reply only PASS",
    status: "completed",
    cwd: "/private/tmp",
    model: "gpt-5.6-sol",
    provider: "codex",
    started_at: "2026-08-26T10:00:00.000Z",
    ended_at: "2026-08-26T10:00:09.000Z",
    metadata,
  } as Session;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/sessions/sess-ephemeral"]}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

const NOTICE = /reconstructed from lifecycle hooks/i;

describe("SessionDetail - hook-only Codex sessions", () => {
  beforeEach(() => {
    mockSession = makeSession(null);
  });

  it("explains the missing transcript when the session is hook-only", async () => {
    mockSession = makeSession(JSON.stringify({ provider: "codex", hook_only: true }));
    renderPage();
    await waitFor(() => expect(screen.getByText(NOTICE)).toBeInTheDocument());
    expect(screen.getByText(/codex exec --ephemeral/i)).toBeInTheDocument();
  });

  it("stays quiet for an ordinary session backed by a rollout", async () => {
    mockSession = makeSession(JSON.stringify({ provider: "codex" }));
    renderPage();
    await screen.findByTestId("agent-tree");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("tolerates metadata that is absent or unparseable", async () => {
    mockSession = makeSession("{not json");
    renderPage();
    await screen.findByTestId("agent-tree");
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});
