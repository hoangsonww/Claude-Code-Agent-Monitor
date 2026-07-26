/**
 * @file PlanModal.test.tsx
 * @description Tests for the full-size plan popup: checklist rendering,
 * dimmed (not struck-through) checked items, the declared-done marker, per-item session
 * chips joined from the focus map (linking to the session and amber-tinted
 * when drifting), bug/feature detour badges (bucketed by item, or under an
 * "Unknown item" section when no item was current) with click-to-expand
 * detail, multiple plans in one popup, and close behavior (Escape, backdrop
 * click, close button).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanModal } from "../PlanModal";
import type { DetourFrame, Plan, PlanItem, Session, SessionFocus } from "../../lib/types";

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
    item_id: `id-${overrides.item_number ?? 1}`,
    item_number: 1,
    text: "First thing",
    acceptance: null,
    detail: null,
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

function makeDetourFrame(overrides: Partial<DetourFrame> = {}): DetourFrame {
  return {
    description: "Session mislabeled while a subagent works",
    pushed_at: "2026-06-10T11:05:00.000Z",
    prior_item: 2,
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

function renderModal(props: Partial<Parameters<typeof PlanModal>[0]> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <MemoryRouter>
      <PlanModal
        plans={[{ plan: makePlan(), items: ITEMS }]}
        sessions={[]}
        focusBySession={new Map()}
        onClose={onClose}
        {...props}
      />
    </MemoryRouter>
  );
  return { onClose, ...utils };
}

describe("PlanModal", () => {
  it("renders the full checklist, dimming (not striking through) checked items", () => {
    renderModal();
    const first = screen.getByText("First thing");
    expect(first).toBeInTheDocument();
    expect(first.className).not.toContain("line-through");
    expect(first.className).toContain("text-gray-400");
    expect(screen.getByText("Second thing").className).toContain("text-gray-100");
  });

  it("marks declared-done-but-unchecked items", () => {
    renderModal();
    expect(screen.getByText(/declared done/)).toBeInTheDocument();
  });

  it("chips active sessions onto their focused item, linking to the session", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([["sess-1", makeFocus()]]),
    });
    const chip = screen.getByText("Worker").closest("a") as HTMLAnchorElement;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute("href")).toBe("/sessions/sess-1");
    expect(chip.className).not.toContain("yellow");
  });

  it("tints drifting session chips amber", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([["sess-1", makeFocus({ drift: true })]]),
    });
    const line = screen.getByText("Worker").closest("button") as HTMLButtonElement;
    expect(line.className).toContain("yellow-500");
  });

  it("does not chip completed sessions", () => {
    renderModal({
      sessions: [makeSession({ status: "completed" })],
      focusBySession: new Map([["sess-1", makeFocus()]]),
    });
    expect(screen.queryByText("Worker")).not.toBeInTheDocument();
  });

  it("renders a bug badge next to the item a session declared it under", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([
        [
          "sess-1",
          makeFocus({
            detour_stack: [makeDetourFrame({ kind: "bug", title: "Waiting bug", prior_item: 2 })],
          }),
        ],
      ]),
    });
    const li = screen.getByText("Second thing").closest("li");
    expect(li?.textContent).toContain("Waiting bug");
  });

  it("renders a feature badge next to the item a session declared it under", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([
        [
          "sess-1",
          makeFocus({
            detour_stack: [makeDetourFrame({ kind: "feature", title: "Badges", prior_item: 1 })],
          }),
        ],
      ]),
    });
    const li = screen.getByText("First thing").closest("li");
    expect(li?.textContent).toContain("Badges");
  });

  it("buckets a detour with no prior item under Unknown item", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([
        [
          "sess-1",
          makeFocus({
            item_number: null,
            detour_stack: [makeDetourFrame({ kind: "bug", title: "Orphan bug", prior_item: null })],
          }),
        ],
      ]),
    });
    expect(screen.getByText("Unknown item")).toBeInTheDocument();
    expect(screen.getByText("Orphan bug")).toBeInTheDocument();
  });

  it("expands a badge to show its detail on click, and collapses on a second click", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([
        [
          "sess-1",
          makeFocus({
            detour_stack: [
              makeDetourFrame({
                kind: "bug",
                title: "Waiting bug",
                detail: "Full explanation here",
              }),
            ],
          }),
        ],
      ]),
    });
    expect(screen.queryByText("Full explanation here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Waiting bug"));
    expect(screen.getByText("Full explanation here")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Waiting bug"));
    expect(screen.queryByText("Full explanation here")).not.toBeInTheDocument();
  });

  it("renders a detour line (generic icon, no bug/feature title) for a plain (kind-less) detour", () => {
    renderModal({
      sessions: [makeSession()],
      focusBySession: new Map([["sess-1", makeFocus({ detour_stack: [makeDetourFrame()] })]]),
    });
    const li = screen.getByText("Second thing").closest("li");
    expect(li?.textContent).toContain("Session mislabeled while a subagent works");
  });

  it("flags a plan whose file went missing", () => {
    renderModal({
      plans: [{ plan: makePlan({ missing_at: "2026-06-10T09:00:00.000Z" }), items: ITEMS }],
    });
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("renders multiple plans as separate sections with a combined header count", () => {
    const secondItems = [makeItem({ item_number: 1, text: "Other repo's task" })];
    renderModal({
      plans: [
        { plan: makePlan(), items: ITEMS },
        { plan: makePlan({ cwd: "/repo2", title: "Second plan" }), items: secondItems },
      ],
    });
    expect(screen.getByText("Second plan")).toBeInTheDocument();
    expect(screen.getByText("Other repo's task")).toBeInTheDocument();
    expect(screen.getByText("Plans (2)")).toBeInTheDocument();
  });

  it("closes on close-button click", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not on panel click", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.click(screen.getByText("First thing"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
