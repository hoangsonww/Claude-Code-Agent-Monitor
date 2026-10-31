/**
 * @file EventDetail.test.tsx
 * @description Unit tests for the EventDetail component. Verifies the uniform
 * label/value row rendering: event-level fields appear first, payload keys
 * follow, scalars render inline, objects/arrays/multiline strings render in a
 * terminal-styled code view, and JSON parse failures fall back to showing the
 * raw data as a single row.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/EventDetail.test.tsx`
 *
 * Scope
 * Unit tests for the EventDetail component. Verifies the uniform label/value row rendering:
 * event-level fields appear first, payload keys follow, scalars render inline,
 * objects/arrays/multiline strings render in a terminal-styled code view, and JSON parse failures
 * fall back to showing the raw data as a single row.
 *
 * Subjects and collaborators
 * - `../EventDetail` — local module imported by this suite.
 * - `../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `EventDetail`
 *
 * Protected behavior
 * - renders event-level fields first: event_id, session_id, agent_id
 * - renders scalar payload fields with humanized i18n labels
 * - renders boolean values as pills
 * - renders Bash tool_input as a terminal block (command + description)
 * - renders multiline strings in a text code view
 * - does not duplicate session_id or agent_id from payload
 * - humanizes unknown payload keys instead of showing raw snake_case
 * - translates known payload keys (tool_use_id → Tool Use ID)
 * - falls back to a raw-payload row when JSON parsing fails
 * - handles null `data` gracefully without crashing
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
import { EventDetail } from "../EventDetail";
import type { DashboardEvent } from "../../lib/types";

const baseEvent: DashboardEvent = {
  id: 42,
  session_id: "sess-123",
  agent_id: "agent-abc",
  event_type: "PreToolUse",
  tool_name: "Bash",
  summary: "Using tool: Bash",
  data: JSON.stringify({
    cwd: "/tmp",
    permission_mode: "bypassPermissions",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "ls -la", description: "list files" },
    stop_hook_active: false,
  }),
  created_at: "2026-04-22T10:00:00.000Z",
};

describe("EventDetail", () => {
  it("renders event-level fields first: event_id, session_id, agent_id", () => {
    render(<EventDetail event={baseEvent} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("sess-123")).toBeInTheDocument();
    expect(screen.getByText("agent-abc")).toBeInTheDocument();
  });

  it("renders scalar payload fields with humanized i18n labels", () => {
    render(<EventDetail event={baseEvent} />);
    // Translated labels from common:eventDetail.* - never raw snake_case keys.
    expect(screen.getByText("Working directory")).toBeInTheDocument();
    expect(screen.getByText("/tmp")).toBeInTheDocument();
    expect(screen.getByText("Permission mode")).toBeInTheDocument();
    expect(screen.getByText("bypassPermissions")).toBeInTheDocument();
    expect(screen.getByText("Hook Event Name")).toBeInTheDocument();
  });

  it("renders boolean values as pills", () => {
    render(<EventDetail event={baseEvent} />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("renders Bash tool_input as a terminal block (command + description)", () => {
    render(<EventDetail event={baseEvent} />);
    expect(screen.getByText("Tool Input")).toBeInTheDocument();
    // Terminal renderer shows the raw command and the `# description` line,
    // not the pretty-printed JSON. Description appears both in the Summary
    // block and in the terminal - `getAllByText` allows both.
    expect(screen.getByText("ls -la")).toBeInTheDocument();
    expect(screen.getAllByText(/list files/).length).toBeGreaterThan(0);
  });

  it("renders multiline strings in a text code view", () => {
    const event = {
      ...baseEvent,
      data: JSON.stringify({ last_assistant_message: "line 1\nline 2\nline 3" }),
    };
    render(<EventDetail event={event} />);
    expect(screen.getByText("Last Assistant Message")).toBeInTheDocument();
    expect(screen.getByText(/line 1/)).toBeInTheDocument();
    expect(screen.getByText(/line 3/)).toBeInTheDocument();
  });

  it("does not duplicate session_id or agent_id from payload", () => {
    const event = {
      ...baseEvent,
      data: JSON.stringify({ session_id: "sess-123", agent_id: "agent-abc", cwd: "/tmp" }),
    };
    render(<EventDetail event={event} />);
    // "sess-123" should appear exactly once (from event-level row).
    expect(screen.getAllByText("sess-123")).toHaveLength(1);
    expect(screen.getAllByText("agent-abc")).toHaveLength(1);
  });

  it("humanizes unknown payload keys instead of showing raw snake_case", () => {
    const event = {
      ...baseEvent,
      // A key that's NOT in PAYLOAD_LABEL_KEYS should still get a tidy
      // Title-Cased label rather than appearing as `some_unknown_field`.
      data: JSON.stringify({ some_unknown_field: "hello" }),
    };
    render(<EventDetail event={event} />);
    expect(screen.getByText("Some Unknown Field")).toBeInTheDocument();
    expect(screen.queryByText("some_unknown_field")).not.toBeInTheDocument();
  });

  it("translates known payload keys (tool_use_id → Tool Use ID)", () => {
    const event = {
      ...baseEvent,
      data: JSON.stringify({ tool_use_id: "toolu_01ABC", tool_name: "Bash" }),
    };
    render(<EventDetail event={event} />);
    expect(screen.getByText("Tool Use ID")).toBeInTheDocument();
    expect(screen.getByText("Tool")).toBeInTheDocument();
    expect(screen.queryByText("tool_use_id")).not.toBeInTheDocument();
    expect(screen.queryByText("tool_name")).not.toBeInTheDocument();
  });

  it("falls back to a raw-payload row when JSON parsing fails", () => {
    const event = { ...baseEvent, data: "not-json-at-all" };
    render(<EventDetail event={event} />);
    expect(screen.getByText(/raw payload/i)).toBeInTheDocument();
    expect(screen.getByText(/not-json-at-all/)).toBeInTheDocument();
  });

  it("handles null `data` gracefully without crashing", () => {
    const event = { ...baseEvent, data: null };
    render(<EventDetail event={event} />);
    // Still renders event-level rows.
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("sess-123")).toBeInTheDocument();
  });
});
