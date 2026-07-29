/**
 * @file WipSessionCard.test.tsx
 * @description Tests for the WIP queue's card fork
 * (`client/src/components/WipSessionCard.tsx`) — not yet built as of this
 * test's authoring; see `supporting/red-evidence.md`. Wraps the real,
 * unmodified `SessionCard`, layering a distinct, assertable project-name
 * header resolved via the shared `projectLookup.projectForSession` (per the
 * "fork, don't edit" / "reuse, don't re-derive" mandates — see
 * technical-plan.md §5), with an explicit "no project" state when the
 * session's cwd resolves to nothing. Reuses `SessionCard.test.tsx`'s fixture
 * conventions and re-asserts the same badge/waiting-reason text already
 * covered there, as proof the fork composes `SessionCard` rather than
 * reimplementing it. Per the test-plan, this does NOT assert a specific
 * className/font-weight for the prominence treatment — only presence of a
 * distinct project-name element.
 *
 * ASSUMED CONTRACT (this test's own design decision, since no implementation
 * exists yet to consult): `WipSessionCard` accepts `{ session, projectIndex,
 * onClick? }` and renders a project-name element carrying
 * `data-testid="wip-session-card-project"` (present with the resolved
 * project's name, or an explicit non-empty "no project" string when the
 * session's cwd resolves to nothing).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WipSessionCard } from "../WipSessionCard";
import { buildCwdProjectIndex } from "../../lib/projectLookup";
import type { Project, Session } from "../../lib/types";

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      transcript: vi.fn().mockResolvedValue({ messages: [] }),
    },
  },
}));

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-wip-1",
    name: "WIP session",
    status: "active",
    cwd: "/repo/agent-monitor",
    model: "claude-opus-4-6",
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-wip-1",
    name: "Agent Monitor",
    paths: [{ id: 1, cwd: "/repo/agent-monitor" }],
    session_count: 1,
    active_count: 1,
    last_activity: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    priority: 0,
    ...overrides,
  } as Project;
}

function renderCard(session: Session, projects: Project[], onClick?: () => void) {
  const projectIndex = buildCwdProjectIndex(projects);
  return render(
    <MemoryRouter>
      <WipSessionCard session={session} projectIndex={projectIndex} onClick={onClick} />
    </MemoryRouter>
  );
}

describe("WipSessionCard", () => {
  it("renders the resolved project's name in a distinct, assertable wrapper element when cwd resolves to a project", () => {
    renderCard(makeSession(), [makeProject()]);

    const heading = screen.getByTestId("wip-session-card-project");
    expect(heading).toHaveTextContent("Agent Monitor");
  });

  it("renders an explicit 'no project' state (not a blank/omitted header) when the session's cwd resolves to nothing", () => {
    renderCard(makeSession({ cwd: "/repo/unmapped" }), []);

    const heading = screen.getByTestId("wip-session-card-project");
    expect(heading.textContent?.trim()).not.toBe("");
    expect(screen.queryByText("Agent Monitor")).not.toBeInTheDocument();
  });

  it("composes the real SessionCard — the session title still renders", () => {
    renderCard(makeSession(), [makeProject()]);
    expect(screen.getByText("WIP session")).toBeInTheDocument();
  });

  it("composes the real SessionCard — the yellow Waiting accent SessionCard.test.tsx asserts for a genuine (reason=stop) wait still applies", () => {
    const waitingSession = makeSession({
      awaiting_input_since: "2026-06-10T11:05:00.000Z",
      awaiting_reason: "stop",
    } as Partial<Session>);
    renderCard(waitingSession, [makeProject()]);

    const card = screen.getByText("WIP session").closest("div.card-hover") as HTMLElement;
    expect(card.className).toContain("border-l-yellow-500/60");
  });

  it("composes the real SessionCard — the 'Monitor' primary-reason label SessionCard.test.tsx asserts still appears", () => {
    const monitorSession = makeSession({
      awaiting_input_since: "2026-06-10T11:05:00.000Z",
      awaiting_reason: "monitor",
    } as Partial<Session>);
    renderCard(monitorSession, [makeProject()]);

    expect(screen.getByText("Monitor")).toBeInTheDocument();
  });

  it("forwards click behavior identically to bare SessionCard — a custom onClick fires instead of navigating", () => {
    const onClick = vi.fn();
    renderCard(makeSession(), [makeProject()], onClick);

    fireEvent.click(screen.getByText("WIP session"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
