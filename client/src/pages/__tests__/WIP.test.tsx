/**
 * @file WIP.test.tsx
 * @description Tests for the WIP queue page (`client/src/pages/WIP.tsx`) —
 * not yet built as of this test's authoring; see
 * `supporting/red-evidence.md`. Mounts the real `WIP` page with a mocked
 * `api` but the REAL, un-mocked `eventBus` singleton (the
 * `SessionCard.focus.test.tsx`/`Tabby.test.tsx` publish-then-assert pattern —
 * NOT the no-op `eventBus` mock in `screens.snapshot.test.tsx`/
 * `KanbanBoard.projectsView.test.tsx`, which never invokes a handler and
 * cannot drive a publish-then-assert test). Covers: live add/reorder/removal
 * via both `session_updated` status-flip AND `session_deleted` (two
 * independently-named cases — must NOT collapse into one, per
 * build-task-list.md Task 26 / test-plan.md's explicit warning that both
 * currently produce the same visible outcome), `project_updated`-driven
 * tiebreak reordering, the sidecar's drag-commit and initial-undragged-order
 * (the third priority-direction site `wipQueue.test.ts`'s pure coverage
 * cannot reach), a reload round-trip proving persistence isn't
 * optimistic-only, and column-fill WIRING ONLY (fake ResizeObserver;
 * exhaustive fill-math boundaries stay in `wipQueue.test.ts` per the
 * test-plan's explicit layer split).
 *
 * ASSUMED CONTRACT (this test's own design decisions, since no
 * implementation exists yet to consult — flagged for the implementer, not
 * dictated as final):
 *  - The queue's measured container carries `data-testid="wip-queue-container"`
 *    and is the element `WIP.tsx` calls `ResizeObserver#observe` on.
 *  - Each rendered column carries `data-testid="wip-queue-column"`.
 *  - The sidecar has a toggle button `data-testid="wip-sidecar-toggle"` and,
 *    once open, one `data-testid="wip-sidecar-project"` row per project.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WIP } from "../WIP";
import { eventBus } from "../../lib/eventBus";
import type { Project, Session, SessionDeletedPayload, WSMessage } from "../../lib/types";

// ── Mocked API (list/reorder only — this page never touches most of the
// surface KanbanBoard/Projects use) ─────────────────────────────────────────

const sessionsListMock = vi.fn();
const projectsListMock = vi.fn();
const reorderMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    sessions: { list: (...args: unknown[]) => sessionsListMock(...args) },
    projects: {
      list: (...args: unknown[]) => projectsListMock(...args),
      reorder: (...args: unknown[]) => reorderMock(...args),
    },
  },
}));

// ── Fake, controllable ResizeObserver — captures whatever element/callback
// WIP.tsx registers, lets the test drive both the callback's own
// contentRect.width AND the observed element's clientWidth (covers either
// implementation choice without dictating one). ─────────────────────────────

let capturedCallback: ResizeObserverCallback | null = null;
let capturedElement: Element | null = null;

class FakeResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    capturedCallback = callback;
  }
  observe(el: Element) {
    capturedElement = el;
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

function fireResize(width: number) {
  if (!capturedElement || !capturedCallback) {
    throw new Error("WIP.tsx never called ResizeObserver#observe on its queue container");
  }
  Object.defineProperty(capturedElement, "clientWidth", { configurable: true, value: width });
  act(() => {
    capturedCallback!(
      [{ target: capturedElement, contentRect: { width } } as unknown as ResizeObserverEntry],
      new FakeResizeObserver(() => {})
    );
  });
}

// ── Fixture data ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-x",
    name: "Session X",
    status: "active",
    cwd: "/repo/alpha",
    model: null,
    started_at: "2026-06-10T10:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-x",
    name: "Project X",
    paths: [],
    session_count: 1,
    active_count: 1,
    last_activity: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    priority: 0,
    ...overrides,
  } as Project;
}

const projectAlpha = makeProject({
  id: "proj-alpha",
  name: "Alpha",
  paths: [{ id: 1, cwd: "/repo/alpha" }],
  priority: 0,
});
const projectBeta = makeProject({
  id: "proj-beta",
  name: "Beta",
  paths: [{ id: 2, cwd: "/repo/beta" }],
  priority: 1,
});

const sessionAlphaOne = makeSession({
  id: "s-alpha-1",
  name: "Existing Alpha",
  cwd: "/repo/alpha",
  last_activity: "2026-06-10T10:00:00.000Z",
} as Partial<Session>);
const sessionBetaOne = makeSession({
  id: "s-beta-1",
  name: "Existing Beta",
  cwd: "/repo/beta",
  last_activity: "2026-06-10T09:00:00.000Z",
} as Partial<Session>);

function unassignedBucket() {
  return { cwds: [], session_count: 0, active_count: 0, last_activity: null };
}

// ── Render + ordering helpers ────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <WIP />
    </MemoryRouter>
  );
}

function orderOf(container: HTMLElement, text: string): number {
  const idx = container.textContent?.indexOf(text) ?? -1;
  if (idx === -1) throw new Error(`expected to find "${text}" in the rendered page`);
  return idx;
}

function openSidecar() {
  fireEvent.click(screen.getByTestId("wip-sidecar-toggle"));
}

function sidecarProjectRows(): HTMLElement[] {
  return screen.getAllByTestId("wip-sidecar-project");
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedCallback = null;
  capturedElement = null;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

  sessionsListMock.mockResolvedValue({ sessions: [sessionAlphaOne, sessionBetaOne], total: 2 });
  projectsListMock.mockResolvedValue({
    projects: [projectAlpha, projectBeta],
    unassigned: unassignedBucket(),
  });
  reorderMock.mockResolvedValue({
    projects: [
      { id: projectAlpha.id, priority: 0 },
      { id: projectBeta.id, priority: 1 },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WIP page — live session events", () => {
  it("session_created (active, non-awaiting) inserts the card in its correctly sorted position", async () => {
    const { container } = renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(500)); // force a single column so DOM order == queue order

    act(() => {
      eventBus.publish({
        type: "session_created",
        data: makeSession({
          id: "s-beta-2",
          name: "New Beta Session",
          cwd: "/repo/beta",
          last_activity: "2026-06-10T11:00:00.000Z",
        } as Partial<Session>),
        timestamp: "t",
      } as WSMessage);
    });

    await screen.findByText("New Beta Session");
    // Alpha (priority 0) still outranks both Beta sessions (priority 1); of
    // the two Beta sessions, the more recently active one ranks first.
    expect(orderOf(container, "Existing Alpha")).toBeLessThan(
      orderOf(container, "New Beta Session")
    );
    expect(orderOf(container, "New Beta Session")).toBeLessThan(
      orderOf(container, "Existing Beta")
    );
  });

  it("session_updated setting awaiting_input_since live-reorders the card to the top of its priority tier, with no list re-fetch", async () => {
    const { container } = renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(500));
    const sessionsCallsBefore = sessionsListMock.mock.calls.length;
    const projectsCallsBefore = projectsListMock.mock.calls.length;

    act(() => {
      eventBus.publish({
        type: "session_updated",
        data: {
          ...sessionBetaOne,
          awaiting_input_since: "2026-06-10T12:00:00.000Z",
          awaiting_reason: "stop",
        },
        timestamp: "t",
      } as WSMessage);
    });

    await waitFor(() =>
      expect(orderOf(container, "Existing Beta")).toBeLessThan(orderOf(container, "Existing Alpha"))
    );
    expect(sessionsListMock.mock.calls.length).toBe(sessionsCallsBefore);
    expect(projectsListMock.mock.calls.length).toBe(projectsCallsBefore);
  });

  it("session_updated flipping status off 'active' removes the card immediately, with no list re-fetch", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    const sessionsCallsBefore = sessionsListMock.mock.calls.length;
    const projectsCallsBefore = projectsListMock.mock.calls.length;

    act(() => {
      eventBus.publish({
        type: "session_updated",
        data: { ...sessionBetaOne, status: "completed" },
        timestamp: "t",
      } as WSMessage);
    });

    await waitFor(() => expect(screen.queryByText("Existing Beta")).not.toBeInTheDocument());
    expect(screen.getByText("Existing Alpha")).toBeInTheDocument();
    expect(sessionsListMock.mock.calls.length).toBe(sessionsCallsBefore);
    expect(projectsListMock.mock.calls.length).toBe(projectsCallsBefore);
  });

  // Deliberately its own, separately-named test from the status-flip case
  // above — both currently produce the same visible end state (card gone),
  // which is exactly why a lazy single test could pass while only ONE of
  // the two WS handlers is actually wired.
  it("session_deleted removes the card immediately, with no list re-fetch — independent of the status-flip path", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    const sessionsCallsBefore = sessionsListMock.mock.calls.length;
    const projectsCallsBefore = projectsListMock.mock.calls.length;

    act(() => {
      eventBus.publish({
        type: "session_deleted",
        data: { id: sessionBetaOne.id } as SessionDeletedPayload,
        timestamp: "t",
      } as WSMessage);
    });

    await waitFor(() => expect(screen.queryByText("Existing Beta")).not.toBeInTheDocument());
    expect(screen.getByText("Existing Alpha")).toBeInTheDocument();
    expect(sessionsListMock.mock.calls.length).toBe(sessionsCallsBefore);
    expect(projectsListMock.mock.calls.length).toBe(projectsCallsBefore);
  });

  it("project_updated with a new priority order reorders the queue live, with no session event firing", async () => {
    const { container } = renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(500));
    // Sanity: Alpha (priority 0) currently outranks Beta (priority 1).
    expect(orderOf(container, "Existing Alpha")).toBeLessThan(orderOf(container, "Existing Beta"));

    act(() => {
      eventBus.publish({
        type: "project_updated",
        data: {
          projects: [
            { id: projectBeta.id, priority: 0 },
            { id: projectAlpha.id, priority: 1 },
          ],
        },
        timestamp: "t",
      } as WSMessage);
    });

    await waitFor(() =>
      expect(orderOf(container, "Existing Beta")).toBeLessThan(orderOf(container, "Existing Alpha"))
    );
  });
});

describe("WIP page — priority sidecar", () => {
  it("the sidecar's initial, undragged display order matches the priority convention — priority 0 renders above priority 1", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    openSidecar();

    const rows = sidecarProjectRows();
    const alphaIndex = rows.findIndex((r) => r.textContent?.includes("Alpha"));
    const betaIndex = rows.findIndex((r) => r.textContent?.includes("Beta"));
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(betaIndex).toBeGreaterThanOrEqual(0);
    expect(alphaIndex).toBeLessThan(betaIndex);
  });

  it("committing a sidecar drag calls api.projects.reorder with the expected id order", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    openSidecar();

    const rows = sidecarProjectRows();
    const betaRow = rows.find((r) => r.textContent?.includes("Beta")) as HTMLElement;
    const alphaRow = rows.find((r) => r.textContent?.includes("Alpha")) as HTMLElement;

    fireEvent.dragStart(betaRow);
    fireEvent.dragOver(alphaRow);
    fireEvent.dragEnd(betaRow);

    await waitFor(() =>
      expect(reorderMock).toHaveBeenCalledWith([projectBeta.id, projectAlpha.id])
    );
  });

  it("after a drag commits, remounting against post-drag priority data renders the new order — persistence isn't optimistic-only", async () => {
    const { unmount } = renderPage();
    await screen.findByText("Existing Alpha");
    openSidecar();

    const rows = sidecarProjectRows();
    const betaRow = rows.find((r) => r.textContent?.includes("Beta")) as HTMLElement;
    const alphaRow = rows.find((r) => r.textContent?.includes("Alpha")) as HTMLElement;
    fireEvent.dragStart(betaRow);
    fireEvent.dragOver(alphaRow);
    fireEvent.dragEnd(betaRow);
    await waitFor(() => expect(reorderMock).toHaveBeenCalled());
    unmount();

    // Simulate the server's post-drag persisted state on the next mount —
    // NOT the same in-memory state the drag just optimistically produced.
    projectsListMock.mockResolvedValue({
      projects: [
        { ...projectBeta, priority: 0 },
        { ...projectAlpha, priority: 1 },
      ],
      unassigned: unassignedBucket(),
    });

    const { container } = renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(500));

    await waitFor(() =>
      expect(orderOf(container, "Existing Beta")).toBeLessThan(orderOf(container, "Existing Alpha"))
    );
  });
});

describe("WIP page — column-fill wiring (container width, not viewport)", () => {
  it("a 1200px container reports 3 columns", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(1200));
    await waitFor(() => expect(screen.getAllByTestId("wip-queue-column")).toHaveLength(3));
  });

  it("a 900px container reports 2 columns", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(900));
    await waitFor(() => expect(screen.getAllByTestId("wip-queue-column")).toHaveLength(2));
  });

  it("a 500px container reports 1 column", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(500));
    await waitFor(() => expect(screen.getAllByTestId("wip-queue-column")).toHaveLength(1));
  });

  it("a bare window resize event with no observer callback fires no column change — container width, not viewport, drives it", async () => {
    renderPage();
    await screen.findByText("Existing Alpha");
    act(() => fireResize(1200));
    await waitFor(() => expect(screen.getAllByTestId("wip-queue-column")).toHaveLength(3));

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 300 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Still 3 — a bare window resize (with no ResizeObserver callback firing)
    // must not drive the column count on its own.
    expect(screen.getAllByTestId("wip-queue-column")).toHaveLength(3);
  });
});
