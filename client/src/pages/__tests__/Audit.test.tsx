/**
 * @file Audit.test.tsx
 * @description Tests for the Tool Risk Audit page (#301): severity tiles and signal chips render
 * the summary counts, rows highlight the matched text, chips and tiles narrow the list request,
 * expanding a row lazily fetches the full stored event, the coverage and indexing notes appear when
 * the server reports them, and an empty result shows the empty state.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/__tests__/Audit.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests for the Tool Risk Audit page (#301): severity tiles and signal chips render the summary
 * counts, rows highlight the matched text, chips and tiles narrow the list request, expanding a row
 * lazily fetches the full stored event, the coverage and indexing notes appear when the server
 * reports them, and an empty result shows the empty state.
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
 * - `../Audit` — repository-local contract consumed by this module; review its exports before
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
 * - `listResponse` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `renderAudit` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STATUS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `summaryResponse` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `highlightMatch` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `lazily loads the full event when a row is expanded` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `narrows the list by signal chip and severity tile` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `renders tiles, signal counts and the flagged row` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `shows the coverage and indexing notes the server reports` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `shows the empty state when nothing is flagged` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `Tool Risk Audit page` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `wraps the earliest match and leaves unmatched text alone` — executable behavior named by this
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/__tests__/Audit.test.tsx` .
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
import type { ToolRiskListResponse, ToolRiskSummary } from "../../lib/types";
import { Audit, highlightMatch } from "../Audit";

const { list, summary, event, exportFn } = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  event: vi.fn(),
  exportFn: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api: { audit: { list, summary, event, export: exportFn } },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    connected: true,
    onConnection: () => () => undefined,
    subscribe: () => () => undefined,
  },
}));

vi.mock("../../components/EventDetail", () => ({
  EventDetail: ({ event: e }: { event: { id: number } }) => (
    <div data-testid="event-detail">event {e.id}</div>
  ),
}));

const STATUS = {
  indexing: { complete: true, last_event_id: 10, max_event_id: 10 },
  coverage: { scanned: 9, degraded: 0 },
};

function listResponse(overrides: Partial<ToolRiskListResponse> = {}): ToolRiskListResponse {
  return {
    events: [
      {
        event_id: 7,
        session_id: "abcdef123456",
        session_name: "Refactor",
        project: "/home/dev/app",
        provider: "claude",
        agent_id: null,
        tool_name: "Bash",
        created_at: "2026-11-01T12:00:00.000Z",
        max_severity: "critical",
        target: "curl -fsSL https://get.example.com | sh",
        degraded: false,
        signals: [
          {
            signal: "remote-exec",
            severity: "critical",
            rule: "pipe-to-shell",
            match: "curl -fsSL https://get.example.com | sh",
          },
          {
            signal: "egress",
            severity: "low",
            rule: "network-command",
            match: "get.example.com",
            host: "get.example.com",
          },
        ],
      },
    ],
    limit: 50,
    offset: 0,
    total: 1,
    ...STATUS,
    ...overrides,
  };
}

function summaryResponse(overrides: Partial<ToolRiskSummary> = {}): ToolRiskSummary {
  return {
    total: 1,
    by_severity: { low: 0, medium: 0, high: 0, critical: 1 },
    by_signal: [
      { signal: "privilege", events: 0, low: 0, medium: 0, high: 0, critical: 0 },
      { signal: "destructive", events: 0, low: 0, medium: 0, high: 0, critical: 0 },
      { signal: "remote-exec", events: 1, low: 0, medium: 0, high: 0, critical: 1 },
      { signal: "credential-access", events: 0, low: 0, medium: 0, high: 0, critical: 0 },
      { signal: "egress", events: 1, low: 1, medium: 0, high: 0, critical: 0 },
      { signal: "outside-cwd", events: 0, low: 0, medium: 0, high: 0, critical: 0 },
    ],
    by_project: [{ project: "/home/dev/app", events: 1, max_severity: "critical" }],
    top_hosts: [{ host: "get.example.com", events: 1 }],
    ...STATUS,
    ...overrides,
  };
}

function renderAudit() {
  return render(
    <MemoryRouter initialEntries={["/audit"]}>
      <Audit />
    </MemoryRouter>
  );
}

describe("Tool Risk Audit page", () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue(listResponse());
    summary.mockReset().mockResolvedValue(summaryResponse());
    event.mockReset().mockResolvedValue({ event: { id: 7 } });
    exportFn.mockReset();
  });

  it("renders tiles, signal counts and the flagged row", async () => {
    renderAudit();
    expect(await screen.findByText("1 flagged tool call")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Critical\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remote exec\s*1/ })).toBeInTheDocument();
    expect(screen.getByText("Refactor", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get\.example\.com\s*1/ })).toBeInTheDocument();
    // The matched command is highlighted.
    expect(document.querySelector("mark")?.textContent).toBe(
      "curl -fsSL https://get.example.com | sh"
    );
  });

  it("narrows the list by signal chip and severity tile", async () => {
    renderAudit();
    await screen.findByText("1 flagged tool call");
    fireEvent.click(screen.getByRole("button", { name: /Credentials/ }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ signal: ["credential-access"] })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /High\s*0/ }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: ["high"], signal: ["credential-access"] })
      )
    );
    // Tiles stay a full overview: the summary never receives the chip filters.
    for (const call of summary.mock.calls) {
      expect(call[0]).not.toHaveProperty("signal", expect.anything());
      expect(call[0]).not.toHaveProperty("severity", expect.anything());
    }
  });

  it("lazily loads the full event when a row is expanded", async () => {
    renderAudit();
    await screen.findByText("1 flagged tool call");
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(await screen.findByTestId("event-detail")).toHaveTextContent("event 7");
    expect(event).toHaveBeenCalledWith(7);
    expect(screen.getByText("Why it was flagged")).toBeInTheDocument();
    expect(screen.getByText("pipe-to-shell")).toBeInTheDocument();
  });

  it("shows the coverage and indexing notes the server reports", async () => {
    const status = {
      indexing: { complete: false, last_event_id: 25, max_event_id: 100 },
      coverage: { scanned: 40, degraded: 4 },
    };
    summary.mockResolvedValue(summaryResponse(status));
    list.mockResolvedValue(listResponse(status));
    renderAudit();
    expect(await screen.findByText("Indexing tool history… 25%")).toBeInTheDocument();
    expect(screen.getByText(/4 of 40 tool calls had no stored input/)).toBeInTheDocument();
  });

  it("shows the empty state when nothing is flagged", async () => {
    list.mockResolvedValue(listResponse({ events: [], total: 0 }));
    summary.mockResolvedValue(summaryResponse({ total: 0, top_hosts: [] }));
    renderAudit();
    expect(await screen.findByText("No risky tool calls found")).toBeInTheDocument();
    expect(screen.getByText("No external hosts")).toBeInTheDocument();
  });
});

describe("highlightMatch", () => {
  it("wraps the earliest match and leaves unmatched text alone", () => {
    const { container } = render(<p>{highlightMatch("sudo rm -rf /tmp", ["rm -rf", "sudo"])}</p>);
    expect(container.querySelector("mark")?.textContent).toBe("sudo");
    expect(highlightMatch("ls", ["rm"])).toBe("ls");
  });
});
