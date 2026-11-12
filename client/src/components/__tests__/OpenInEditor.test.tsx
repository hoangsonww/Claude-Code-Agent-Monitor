/**
 * @file OpenInEditor.test.tsx
 * @description Tests editor setup, default selection, folder links, storage sync,
 * disabled remote sessions, isolation from enclosing card navigation, and the
 * Dashboard's opt-in main-agent card control.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/OpenInEditor.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Tests editor setup, default selection, folder links, storage sync, disabled remote sessions,
 * isolation from enclosing card navigation, and the Dashboard's opt-in main-agent card control.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/editors` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../AgentCard` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../EditorSettings` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../OpenInEditor` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../SessionCard` — repository-local contract consumed by this module; review its exports before
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
 * - `LocationProbe` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `session` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useLocation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `adds editors, changes the default, and repairs removal immediately` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `can choose another editor without changing the saved default or navigating the card` —
 *   executable behavior named by this suite; preserve the observable contract or update the test
 *   with rationale.
 * - `editor folder launcher` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `lets global shortcuts reach the window while the editor link has focus` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `links to editor setup when nothing is configured` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `opens a dashboard main-agent card's folder only where the card opts in` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `reports storage failure without claiming an editor was added` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `updates mounted controls for another tab's storage changes` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/OpenInEditor.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { AgentCard } from "../AgentCard";
import { EditorSettings } from "../EditorSettings";
import { OpenInEditor } from "../OpenInEditor";
import { SessionCard } from "../SessionCard";
import { saveEditorPrefs } from "../../lib/editors";
import type { Agent, Session } from "../../lib/types";

const session: Session = {
  id: "test-session",
  name: "Test project",
  cwd: "/Users/dev/my project",
  source: "local",
  status: "active",
  model: null,
  started_at: "2026-11-10T00:00:00Z",
  ended_at: null,
  metadata: null,
};
function LocationProbe() {
  return (
    <span data-testid="location">
      {useLocation().pathname}
      {useLocation().hash}
    </span>
  );
}
beforeEach(() => localStorage.clear());

describe("editor folder launcher", () => {
  it("links to editor setup when nothing is configured", () => {
    render(
      <MemoryRouter>
        <OpenInEditor session={session} />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("link", { name: "Configure editors" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings#editors");
  });

  it("adds editors, changes the default, and repairs removal immediately", () => {
    render(
      <MemoryRouter>
        <EditorSettings />
        <OpenInEditor session={session} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
    expect(screen.getByRole("link", { name: "Open in VS Code" })).toHaveAttribute(
      "href",
      "vscode://file/Users/dev/my%20project/"
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Choose editor" }), {
      target: { value: "cursor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cursor" }));
    expect(screen.getByRole("link", { name: "Open in Cursor" })).toHaveAttribute(
      "href",
      "cursor://file/Users/dev/my%20project/"
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Cursor" }));
    expect(screen.getByRole("link", { name: "Open in VS Code" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove VS Code" }));
    expect(screen.getByRole("link", { name: "Configure editors" })).toBeInTheDocument();
  });

  it("can choose another editor without changing the saved default or navigating the card", () => {
    saveEditorPrefs({ enabled: ["vscode", "cursor"], defaultId: "vscode" });
    render(
      <MemoryRouter>
        <SessionCard session={session} />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Choose editor" }), {
      target: { value: "cursor" },
    });
    const link = screen.getByRole("link", { name: "Open in Cursor" });
    // Prevent jsdom from attempting native protocol navigation; bubbling still reaches the card.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    expect(JSON.parse(localStorage.getItem("ccam-editors")!).defaultId).toBe("vscode");
    fireEvent.click(screen.getByText("Test project"));
    expect(screen.getByTestId("location")).toHaveTextContent("/sessions/test-session");
  });

  it("opens a dashboard main-agent card's folder only where the card opts in", () => {
    saveEditorPrefs({ enabled: ["vscode"], defaultId: "vscode" });
    const main: Agent = {
      id: "test-session-main",
      session_id: session.id,
      name: "Main Agent",
      type: "main",
      subagent_type: null,
      status: "working",
      task: null,
      current_tool: null,
      started_at: "2026-11-10T00:00:00Z",
      ended_at: null,
      updated_at: "2026-11-10T00:00:00Z",
      parent_agent_id: null,
      metadata: null,
    };
    const { unmount } = render(
      <MemoryRouter>
        <AgentCard agent={main} session={session} showEditor />
        <AgentCard
          agent={{ ...main, id: "sub", type: "subagent", subagent_type: "Explore" }}
          session={session}
          showEditor
        />
        <LocationProbe />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: "Open in VS Code" });
    expect(link).toHaveAttribute("href", "vscode://file/Users/dev/my%20project/");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    unmount();

    render(
      <MemoryRouter>
        <AgentCard agent={main} session={session} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("link", { name: "Open in VS Code" })).not.toBeInTheDocument();
  });

  it("lets global shortcuts reach the window while the editor link has focus", () => {
    saveEditorPrefs({ enabled: ["vscode"], defaultId: "vscode" });
    const onKeyDown = vi.fn();
    window.addEventListener("keydown", onKeyDown);
    try {
      render(
        <MemoryRouter>
          <OpenInEditor session={session} />
        </MemoryRouter>
      );
      fireEvent.keyDown(screen.getByRole("link", { name: "Open in VS Code" }), {
        key: "k",
        ctrlKey: true,
      });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onKeyDown);
    }
  });

  it("updates mounted controls for another tab's storage changes", () => {
    render(
      <MemoryRouter>
        <OpenInEditor session={session} />
      </MemoryRouter>
    );
    act(() => {
      localStorage.setItem(
        "ccam-editors",
        JSON.stringify({ enabled: ["cursor"], defaultId: "cursor" })
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "ccam-editors" }));
    });
    expect(screen.getByRole("link", { name: "Open in Cursor" })).toBeInTheDocument();
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.getByRole("link", { name: "Configure editors" })).toBeInTheDocument();
  });

  it.each([
    { ...session, source: "remote-machine" },
    { ...session, cwd: null },
  ])("disables unavailable sessions", (unavailable) => {
    saveEditorPrefs({ enabled: ["vscode"], defaultId: "vscode" });
    render(
      <MemoryRouter>
        <OpenInEditor session={unavailable} />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Open in Editor" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reports storage failure without claiming an editor was added", () => {
    render(<EditorSettings />);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Add editor" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Could not save editors");
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
