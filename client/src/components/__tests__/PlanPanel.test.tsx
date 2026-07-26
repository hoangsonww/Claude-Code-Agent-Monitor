/**
 * @file PlanPanel.test.tsx
 * @description Tests for the AGENT-PLAN.md summary strip: title, progress
 * count, the missing-file badge, and that a click fires `onOpen` (the actual
 * checklist renders in PlanModal — see PlanModal.test.tsx).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanPanel } from "../PlanPanel";
import type { Plan, PlanItem } from "../../lib/types";

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
  const item_number = overrides.item_number ?? 1;
  return {
    cwd: "/repo",
    item_id: `id-${item_number}`,
    item_number,
    parent_item_id: null,
    display_number: item_number == null ? "" : String(item_number),
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

const ITEMS = [
  makeItem({ item_number: 1, text: "First thing", checked: 1 }),
  makeItem({ item_number: 2, text: "Second thing", position: 1 }),
  makeItem({ item_number: 3, text: "Third thing", position: 2 }),
];

function renderPanel(props: Partial<Parameters<typeof PlanPanel>[0]> = {}) {
  const onOpen = vi.fn();
  const utils = render(<PlanPanel plan={makePlan()} items={ITEMS} onOpen={onOpen} {...props} />);
  return { onOpen, ...utils };
}

describe("PlanPanel", () => {
  it("shows title and progress", () => {
    renderPanel();
    expect(screen.getByText("Auth migration")).toBeInTheDocument();
    expect(screen.getByText("1/3 complete")).toBeInTheDocument();
  });

  it("fires onOpen when clicked", () => {
    const { onOpen } = renderPanel();
    fireEvent.click(screen.getByText("Auth migration"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("flags a plan whose file went missing", () => {
    renderPanel({ plan: makePlan({ missing_at: "2026-06-10T09:00:00.000Z" }) });
    expect(screen.getByText("!")).toBeInTheDocument();
  });
});
