/**
 * @file SessionReplay.navigation.test.tsx
 * @description Regression test for replay state leakage across route changes:
 * navigating from a longer session to a shorter one must reset the cursor to
 * the first event instead of leaving it past the new event range. React reuses
 * the page component instance when only :id changes, so playback state must be
 * explicitly reset on navigation.
 * @author Anton <antonpetnitsky@users.noreply.github.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { SessionReplay } from "../SessionReplay";
import { api } from "../../lib/api";
import type { Agent, Session, DashboardEvent } from "../../lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const LONG_EVENTS: DashboardEvent[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  session_id: "s-long",
  agent_id: null,
  event_type: "Stop",
  tool_name: null,
  summary: `event ${i + 1}`,
  data: null,
  created_at: new Date(Date.UTC(2026, 2, 5, 10, 0, i)).toISOString(),
}));

const SHORT_EVENTS: DashboardEvent[] = Array.from({ length: 3 }, (_, i) => ({
  id: i + 1,
  session_id: "s-short",
  agent_id: null,
  event_type: "Stop",
  tool_name: null,
  summary: `event ${i + 1}`,
  data: null,
  created_at: new Date(Date.UTC(2026, 2, 5, 11, 0, i)).toISOString(),
}));

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      get: vi.fn((id: string) =>
        Promise.resolve({
          session: {
            id,
            name: id === "s-long" ? "Long Session" : "Short Session",
            status: "completed",
            cwd: "/test",
            model: "claude-opus-4-6",
            started_at: "2026-03-05T10:00:00.000Z",
            ended_at: null,
            metadata: null,
          } satisfies Session,
          agents: [] as Agent[],
          events: id === "s-long" ? LONG_EVENTS : SHORT_EVENTS,
        })
      ),
    },
  },
}));

/** Keeps one Router instance alive so the SessionReplay element instance is
 *  reused across navigations - exactly the production behavior under test. */
function Harness({ target }: { target: string }) {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(`/replay/${target}`)}>go-{target}</button>
      <Routes>
        <Route path="/replay/:id" element={<SessionReplay />} />
      </Routes>
    </>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SessionReplay navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets the cursor when navigating from a longer to a shorter session", async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/replay/s-long"]}>
        <Harness target="s-long" />
      </MemoryRouter>
    );

    // Long session loaded: cursor starts on the first of 10 events.
    expect(await screen.findByText("1 / 10")).toBeTruthy();

    // Step forward four times -> cursor sits at event 5 of 10.
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    }
    expect(screen.getByText("5 / 10")).toBeTruthy();

    // Navigate to a much shorter session WITHOUT unmounting the page.
    rerender(
      <MemoryRouter initialEntries={["/replay/s-long"]}>
        <Harness target="s-short" />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("go-s-short"));

    // Cursor must be back at the first event of the new set, never past its end.
    expect(await screen.findByText("1 / 3")).toBeTruthy();
    expect(screen.queryByText("5 / 3")).toBeNull();
    await waitFor(() => {
      expect(vi.mocked(api.sessions.get)).toHaveBeenCalledWith("s-short");
    });
  });
});
