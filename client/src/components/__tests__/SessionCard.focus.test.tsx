/**
 * @file SessionCard.focus.test.tsx
 * @description Tests for SessionCard's focus breadcrumb: rendered for active
 * sessions with a declared plan item OR an in-flight detour with no base
 * item (seeded through the shared focusStore via real eventBus pushes),
 * amber detour segments, the elapsed suffix, the drift pill, and absence
 * for completed sessions / no focus at all.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { eventBus } from "../../lib/eventBus";
import { focusStore } from "../../lib/focusStore";
import { SessionCard } from "../SessionCard";
import type { Session, SessionFocus, WSMessage } from "../../lib/types";

// No `plans` namespace on purpose: the focusStore's typeof guard must treat
// that as "nothing to hydrate" rather than crash (older-mock compatibility).
vi.mock("../../lib/api", () => ({
  api: {
    sessions: { transcript: vi.fn().mockResolvedValue({ messages: [] }) },
  },
}));

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-f1",
    name: "Focus session",
    status: "active",
    cwd: "/repo",
    model: null,
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

function seedFocus(overrides: Partial<SessionFocus> = {}) {
  const focus: SessionFocus = {
    session_id: "sess-f1",
    cwd: "/repo",
    item_number: 4,
    item_text: "Migrate auth",
    note: null,
    detour_stack: [],
    since: "2026-06-10T10:30:00.000Z",
    drift: null,
    drift_reason: null,
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
  eventBus.publish({
    type: "session_focus",
    data: focus,
    timestamp: new Date().toISOString(),
  } as WSMessage);
}

function renderCard(session: Session) {
  return render(
    <MemoryRouter>
      <SessionCard session={session} />
    </MemoryRouter>
  );
}

describe("SessionCard - focus breadcrumb", () => {
  beforeEach(() => {
    focusStore.__resetForTest();
  });

  it("renders the item breadcrumb for an active focused session", () => {
    seedFocus();
    renderCard(makeSession());
    expect(screen.getByText(/Item 4/)).toBeInTheDocument();
    expect(screen.getByText(/Migrate auth/)).toBeInTheDocument();
  });

  it("renders detour segments in amber with the elapsed suffix", () => {
    seedFocus({
      detour_stack: [
        { description: "npm conflict", pushed_at: "2026-06-10T11:10:00.000Z", prior_item: 4 },
      ],
    });
    renderCard(makeSession());
    const detour = screen.getByText(/npm conflict/);
    expect(detour.className).toContain("amber");
    expect(screen.getByText(/\(/)).toBeInTheDocument(); // elapsed "(Nm ...)" suffix
  });

  it("renders the breadcrumb for a detour with no base plan item", () => {
    seedFocus({
      item_number: null,
      item_text: null,
      detour_stack: [
        {
          description: "exploring caching approach",
          pushed_at: "2026-06-10T11:10:00.000Z",
          prior_item: null,
        },
      ],
    });
    renderCard(makeSession());
    expect(screen.queryByText(/Item 4/)).not.toBeInTheDocument();
    expect(screen.getByText(/exploring caching approach/)).toBeInTheDocument();
  });

  it("shows the drift pill when the auditor flagged the session", () => {
    seedFocus({ drift: true, drift_reason: "editing docker files" });
    renderCard(makeSession());
    expect(screen.getByText(/undeclared detour/)).toBeInTheDocument();
  });

  it("hides the breadcrumb for non-active sessions and when no focus exists", () => {
    seedFocus();
    renderCard(makeSession({ status: "completed", id: "sess-f1" }));
    expect(screen.queryByText(/Item 4/)).not.toBeInTheDocument();

    focusStore.__resetForTest();
    renderCard(makeSession({ id: "sess-f2", name: "No focus" }));
    expect(screen.queryByText(/Item/)).not.toBeInTheDocument();
  });
});
