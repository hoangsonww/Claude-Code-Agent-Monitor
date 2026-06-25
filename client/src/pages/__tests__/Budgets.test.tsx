/**
 * @file Budgets.test.tsx
 * @description Tests for the Budgets page: empty state, populated budget cards
 * with live spend/progress, and opening the create form.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Budgets } from "../Budgets";
import type { Budget } from "../../lib/types";

let mockBudgets: Budget[] = [];
const listMock = vi.fn(() =>
  Promise.resolve({ budgets: mockBudgets, generated_at: "2026-06-05T00:00:00.000Z" })
);

vi.mock("../../lib/api", () => ({
  api: {
    budgets: {
      list: () => listMock(),
      create: vi.fn(() => Promise.resolve({ budget: {} })),
      update: vi.fn(() => Promise.resolve({ budget: {} })),
      remove: vi.fn(() => Promise.resolve({ ok: true })),
    },
  },
}));

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: vi.fn(() => () => {}),
    onConnection: vi.fn(() => () => {}),
    connected: false,
  },
}));

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    period: "monthly",
    limit_usd: 100,
    enabled: true,
    label: "Personal cap",
    alert_thresholds: [80, 100],
    period_start: "2026-06-01T00:00:00.000Z",
    period_end: "2026-07-01T00:00:00.000Z",
    period_key: "2026-06",
    spent: 85,
    remaining: 15,
    pct: 85,
    status: "warning",
    fired_thresholds: [80],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Budgets />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockBudgets = [];
  listMock.mockClear();
});

describe("Budgets page", () => {
  it("renders the empty state when there are no budgets", async () => {
    renderPage();
    expect(await screen.findByText("No budgets yet")).toBeInTheDocument();
  });

  it("renders a budget card with spend, percentage and label", async () => {
    mockBudgets = [makeBudget()];
    renderPage();

    expect(await screen.findByText("Personal cap")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    // Warning status badge (85% is past the 80% warn threshold, below 100%).
    expect(screen.getByText("Warning")).toBeInTheDocument();
    // Fired threshold chip + armed threshold chip both render.
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("opens the create form when clicking New budget", async () => {
    renderPage();
    await screen.findByText("No budgets yet");

    const newButtons = screen.getAllByText("New budget");
    fireEvent.click(newButtons[0] as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Limit (USD)")).toBeInTheDocument();
    });
    expect(screen.getByText("Alert thresholds")).toBeInTheDocument();
  });
});
