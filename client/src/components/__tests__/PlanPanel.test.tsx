/**
 * @file PlanPanel.test.tsx
 * @description Tests for the AGENT-PLAN.md checklist panel: progress count,
 * expand/collapse, checked-item strike-through, the declared-done marker,
 * per-item session chips joined from the focus map (linking to the session
 * and amber-tinted when drifting), and the missing-file badge.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanPanel } from "../PlanPanel";
import type { Plan, PlanItem, Session, SessionFocus } from "../../lib/types";

vi.mock("../../lib/api", () => ({ api: {} }));

function makePlan(overrides: Partial<Plan> = {}): Omit<Plan, "items"> {
  return {
    cwd: "/repo",
    title: "Auth migration",
    file_path: "/repo/AGENT-PLAN.md",
    item_count: 3,
    missing_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    cwd: "/repo",
    item_number: 1,
    text: "First thing",
    acceptance: null,
    checked: 0,
    position: 0,
    declared_done_at: null,
    declared_done_session: null,
    updated_at: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    name: "Worker",
    status: "active",
    cwd: "/repo",
    model: null,
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

function makeFocus(overrides: Partial<SessionFocus> = {}): SessionFocus {
  return {
    session_id: "sess-1",
    cwd: "/repo",
    item_number: 2,
    item_text: "Second thing",
    note: null,
    detour_stack: [],
    since: "2026-06-10T11:00:00.000Z",
    drift: null,
    drift_reason: null,
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
}

const ITEMS = [
  makeItem({ item_number: 1, text: "First thing", checked: 1 }),
  makeItem({ item_number: 2, text: "Second thing", position: 1 }),
  makeItem({
    item_number: 3,
    text: "Third thing",
    position: 2,
    declared_done_at: "2026-06-10T10:00:00.000Z",
    declared_done_session: "sess-9",
  }),
];

function renderPanel(props: Partial<Parameters<typeof PlanPanel>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PlanPanel
        plan={makePlan()}
        items={ITEMS}
        sessions={[]}
        focusBySession={new Map()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("PlanPanel", () => {
  it("shows title and progress, collapsed by default", () => {
    renderPanel();
    expect(screen.getByText("Auth migration")).toBeInTheDocument();
    expect(screen.getByText("1/3 complete")).toBeInTheDocument();
    expect(screen.queryByText("First thing")).not.toBeInTheDocument();
  });

  it("expands on click, striking through checked items", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Auth migration"));
    const first = screen.getByText("First thing");
    expect(first).toBeInTheDocument();
    expect(first.className).toContain("line-through");
    expect(screen.getByText("Second thing").className).not.toContain("line-through");
  });

  it("marks declared-done-but-unchecked items", () => {
    renderPanel({ defaultExpanded: true });
    expect(screen.getByText(/declared done/)).toBeInTheDocument();
  });

  it("chips active sessions onto their focused item, linking to the session", () => {
    renderPanel({
      defaultExpanded: true,
      sessions: [makeSession()],
      focusBySession: new Map([["sess-1", makeFocus()]]),
    });
    const chip = screen.getByText("Worker").closest("a") as HTMLAnchorElement;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute("href")).toBe("/sessions/sess-1");
    expect(chip.className).not.toContain("yellow");
  });

  it("tints drifting session chips amber", () => {
    renderPanel({
      defaultExpanded: true,
      sessions: [makeSession()],
      focusBySession: new Map([["sess-1", makeFocus({ drift: true })]]),
    });
    const chip = screen.getByText("Worker").closest("a") as HTMLAnchorElement;
    expect(chip.className).toContain("yellow-500");
  });

  it("does not chip completed sessions", () => {
    renderPanel({
      defaultExpanded: true,
      sessions: [makeSession({ status: "completed" })],
      focusBySession: new Map([["sess-1", makeFocus()]]),
    });
    expect(screen.queryByText("Worker")).not.toBeInTheDocument();
  });

  it("flags a plan whose file went missing", () => {
    renderPanel({ plan: makePlan({ missing_at: "2026-06-10T09:00:00.000Z" }) });
    expect(screen.getByText("!")).toBeInTheDocument();
  });
});
