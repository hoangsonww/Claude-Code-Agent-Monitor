/**
 * @file SplashScreen.test.tsx
 * @description Verifies provider-aware onboarding skips setup for ready
 * selections and offers installation only for selected providers whose
 * dashboard hooks are missing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/SplashScreen.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Verifies provider-aware onboarding skips setup for ready selections and offers installation only
 * for selected providers whose dashboard hooks are missing.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../SplashScreen` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `@testing-library/user-event` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `hookInfo` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `info` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `installHooks` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Named test contracts
 * - `ignores Claude readiness when Codex alone is selected` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `keeps setup available when hook status cannot be checked` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `offers Claude only when Both is selected and only Codex is installed` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `offers only the missing provider when Both is partially installed` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `shows setup when the selected provider is missing` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `skips setup for Both only when both providers are installed` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `skips setup when Claude Code is selected and its hooks are installed` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `skips setup when Codex is selected and its hooks are installed` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `SplashScreen` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `stays dismissed in a new tab, where sessionStorage is empty` — executable behavior named by
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/SplashScreen.test.tsx`
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
 * Path: `client/src/components/__tests__/SplashScreen.test.tsx`
 *
 * Scope
 * Verifies provider-aware onboarding skips setup for ready selections and offers installation only
 * for selected providers whose dashboard hooks are missing.
 *
 * Subjects and collaborators
 * - `../SplashScreen` — local module imported by this suite.
 * - `../../lib/api` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `userEvent` models complete browser interactions; await it so state updates settle before
 *   assertions.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 * - Mock boundary: `../../lib/api`.
 *
 * Suite groups
 * - `SplashScreen`
 *
 * Protected behavior
 * - skips setup when Claude Code is selected and its hooks are installed
 * - skips setup when Codex is selected and its hooks are installed
 * - skips setup for Both only when both providers are installed
 * - offers only the missing provider when Both is partially installed
 * - offers Claude only when Both is selected and only Codex is installed
 * - ignores Claude readiness when Codex alone is selected
 * - shows setup when the selected provider is missing
 * - keeps setup available when hook status cannot be checked
 * - stays dismissed in a new tab, where sessionStorage is empty
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplashScreen } from "../SplashScreen";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  api: {
    settings: {
      info: vi.fn(),
      installHooks: vi.fn(),
    },
  },
}));

const info = vi.mocked(api.settings.info);
const installHooks = vi.mocked(api.settings.installHooks);

function hookInfo(claudeInstalled: boolean, codexInstalled: boolean) {
  return {
    hooks: {
      installed: claudeInstalled || codexInstalled,
      path: "~/.claude/settings.json",
      hooks: {},
      providers: {
        claude: {
          installed: claudeInstalled,
          has_dashboard_hooks: claudeInstalled,
          path: "~/.claude/settings.json",
          hooks: {},
        },
        codex: {
          installed: codexInstalled,
          has_dashboard_hooks: codexInstalled,
          path: "~/.codex/hooks.json",
          hooks: {},
        },
      },
    },
  } as unknown as Awaited<ReturnType<typeof api.settings.info>>;
}

describe("SplashScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    info.mockResolvedValue(hookInfo(false, false));
  });

  it("skips setup when Claude Code is selected and its hooks are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));

    render(<SplashScreen />);
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("skips setup when Codex is selected and its hooks are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(false, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /codex beta/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skips setup for Both only when both providers are installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(info).toHaveBeenCalledTimes(1);
    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers only the missing provider when Both is partially installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));
    installHooks.mockResolvedValue({
      ok: true,
      results: {
        codex: {
          ok: true,
          output: ["Installed Codex lifecycle hooks."],
        },
      },
      hooks: {
        installed: true,
        providers: {
          codex: {
            installed: true,
            path: "~/.codex/hooks.json",
            hooks: {},
          },
        },
      },
    });

    render(<SplashScreen />);

    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Codex")).toBeVisible();
    expect(within(hookDialog).queryByText("Claude Code")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Install hooks" }));

    expect(installHooks).toHaveBeenCalledWith(["codex"]);
    expect(await screen.findByText("Installed Codex lifecycle hooks.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue to dashboard" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("offers Claude only when Both is selected and only Codex is installed", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(false, true));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /both/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Claude Code")).toBeVisible();
    expect(within(hookDialog).queryByText("Codex")).not.toBeInTheDocument();
  });

  it("ignores Claude readiness when Codex alone is selected", async () => {
    const user = userEvent.setup();
    info.mockResolvedValue(hookInfo(true, false));

    render(<SplashScreen />);
    await user.click(screen.getByRole("radio", { name: /codex beta/i }));
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    const hookDialog = await screen.findByRole("dialog", { name: "Set up live monitoring" });
    expect(within(hookDialog).getByText("Codex")).toBeVisible();
    expect(within(hookDialog).queryByText("Claude Code")).not.toBeInTheDocument();
  });

  it("shows setup when the selected provider is missing", async () => {
    const user = userEvent.setup();
    render(<SplashScreen />);

    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));
    expect(await screen.findByRole("dialog", { name: "Set up live monitoring" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "I have already installed hooks" }));

    expect(installHooks).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("provider-onboarding-shown-v2")).toBe("1");
  });

  it("keeps setup available when hook status cannot be checked", async () => {
    const user = userEvent.setup();
    info.mockRejectedValue(new Error("offline"));

    render(<SplashScreen />);
    await user.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(await screen.findByRole("dialog", { name: "Set up live monitoring" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not check your current hook setup"
    );
  });
  it("stays dismissed in a new tab, where sessionStorage is empty", () => {
    // ⌘/Ctrl-clicking a link opens a tab with fresh `sessionStorage` but the
    // same `localStorage`. Onboarding is a per-browser event, so only the
    // latter may gate it.
    localStorage.setItem("provider-onboarding-shown-v2", "1");
    sessionStorage.clear();

    const { container } = render(<SplashScreen />);

    expect(container).toBeEmptyDOMElement();
  });
});
