/**
 * @file SessionDetail.hookOnly.test.tsx
 * @description Tests the notice SessionDetail shows for a Codex session that
 * never persisted a rollout (`codex exec --ephemeral`). The server marks those
 * sessions `hook_only` in metadata; the page must explain the missing
 * transcript instead of showing the generic "transcript not found" warning.
 * @author Son Nguyen <hoangson091104@gmail.com>
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
