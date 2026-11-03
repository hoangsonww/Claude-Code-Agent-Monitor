/**
 * @file Sidebar.test.tsx
 * @description Unit tests for the Sidebar component, which is responsible for rendering the application's sidebar navigation. The tests cover rendering of the brand name, subtitle, navigation links, WebSocket connection status, and version number. The tests use React Testing Library and Vitest for assertions and mocking.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/Sidebar.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the Sidebar component, which is responsible for rendering the application's
 * sidebar navigation. The tests cover rendering of the brand name, subtitle, navigation links,
 * WebSocket connection status, and version number. The tests use React Testing Library and Vitest
 * for assertions and mocking.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../i18n` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../Sidebar` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `@testing-library/user-event` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `renderSidebar` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `should expose all five languages through the custom dropdown` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `should have correct navigation hrefs` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should render all navigation links` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should render the brand name` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `should render the subtitle` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should show "Disconnected" when WebSocket is not connected` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `should show "Live" when WebSocket is connected` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should show version number` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `should switch to Korean when Korean option is clicked` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should switch to Vietnamese when Vietnamese option is clicked` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `should use an icon-only trigger and an unconstrained floating menu when collapsed` —
 *   executable behavior named by this suite; preserve the observable contract or update the test
 *   with rationale.
 * - `Sidebar` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/Sidebar.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/__tests__/Sidebar.test.tsx`
 *
 * Scope
 * Unit tests for the Sidebar component, which is responsible for rendering the application's sidebar
 * navigation. The tests cover rendering of the brand name, subtitle, navigation links, WebSocket
 * connection status, and version number. The tests use React Testing Library and Vitest for
 * assertions and mocking.
 *
 * Subjects and collaborators
 * - `../Sidebar` — local module imported by this suite.
 * - `../../i18n` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `userEvent` models complete browser interactions; await it so state updates settle before
 *   assertions.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 *
 * Suite groups
 * - `Sidebar`
 *
 * Protected behavior
 * - should render the brand name
 * - should render the subtitle
 * - should render all navigation links
 * - should show "Live" when WebSocket is connected
 * - should show "Disconnected" when WebSocket is not connected
 * - should show version number
 * - should have correct navigation hrefs
 * - should expose all five languages through the custom dropdown
 * - should switch to Vietnamese when Vietnamese option is clicked
 * - should switch to Korean when Korean option is clicked
 * - should use an icon-only trigger and an unconstrained floating menu when collapsed
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

import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Sidebar } from "../Sidebar";
import i18n from "../../i18n";

function renderSidebar(wsConnected: boolean, collapsed = false) {
  return render(
    <MemoryRouter>
      <Sidebar wsConnected={wsConnected} collapsed={collapsed} onToggle={() => {}} />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("should render the brand name", () => {
    renderSidebar(true);
    expect(screen.getByText("Agent Dashboard")).toBeInTheDocument();
  });

  it("should render the subtitle", () => {
    renderSidebar(true);
    expect(screen.getByText("Claude Code Monitor")).toBeInTheDocument();
  });

  it("should render all navigation links", () => {
    renderSidebar(true);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Kanban Board")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Activity Feed")).toBeInTheDocument();
  });

  it('should show "Live" when WebSocket is connected', () => {
    renderSidebar(true);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it('should show "Disconnected" when WebSocket is not connected', () => {
    renderSidebar(false);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("should show version number", () => {
    // `__APP_VERSION__` is injected by Vite from the repo-root package.json
    // (see vite.config.ts) and replaced at transform time in tests too, so this
    // stays correct as the project version changes.
    renderSidebar(true);
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it("should have correct navigation hrefs", () => {
    renderSidebar(true);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/kanban");
    expect(hrefs).toContain("/sessions");
    expect(hrefs).toContain("/activity");
  });

  it("should expose all nine languages through the custom dropdown", async () => {
    const user = userEvent.setup();
    renderSidebar(true);

    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("option", { name: "Chinese 中文" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Vietnamese VI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Korean 한국어" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Spanish ES" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "French FR" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "German DE" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Portuguese PT" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Italian IT" })).toBeInTheDocument();
  });

  it("should switch to Vietnamese when Vietnamese option is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar(true);

    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("option", { name: "Vietnamese VI" }));

    await waitFor(() => {
      expect(screen.getByText("Tổng quan")).toBeInTheDocument();
      expect(screen.getByText("Bảng Kanban")).toBeInTheDocument();
    });
  });

  it("should switch to Korean when Korean option is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar(true);

    await user.click(screen.getByRole("button", { name: "English" }));
    await user.click(screen.getByRole("option", { name: "Korean 한국어" }));

    await waitFor(() => {
      expect(screen.getByText("대시보드")).toBeInTheDocument();
      expect(screen.getByText("칸반 보드")).toBeInTheDocument();
    });
  });

  it("should use an icon-only trigger and an unconstrained floating menu when collapsed", async () => {
    const user = userEvent.setup();
    renderSidebar(true, true);

    const trigger = screen.getByRole("button", { name: "Language" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    const menu = screen.getByRole("listbox", { name: "Language" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveClass("fixed");
    await user.click(screen.getByRole("option", { name: "Spanish ES" }));

    await waitFor(() => {
      expect(screen.getByTitle("Panel")).toBeInTheDocument();
      expect(screen.getByTitle("Tablero Kanban")).toBeInTheDocument();
    });
  });
});
