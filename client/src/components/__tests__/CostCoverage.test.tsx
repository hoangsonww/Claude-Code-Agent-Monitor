/**
 * @file CostCoverage.test.tsx
 * @description Checks complete and incomplete rate coverage, including an
 * unsupported tier of an otherwise known model, plus source/provider labels
 * and the rate table each product scope links to.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/__tests__/CostCoverage.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Checks complete and incomplete rate coverage, including an unsupported tier of an otherwise known
 * model, plus source/provider labels and the rate table each product scope links to.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../CostCoverage` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../Tip` — repository-local contract consumed by this module; review its exports before
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
 * ## Named test contracts
 * - `does not call a complete scoped estimate a subscription bill` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `labels an unset product scope as the Claude data it reads` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `lets forward keyboard focus leave the portaled pricing links` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `links each missing provider to its own pricing editor` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `marks missing tier rates incomplete without calling the known model unknown` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `measures the info panel at a neutral origin before edge-aware placement` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `moves keyboard focus from the info trigger into its portaled pricing link` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `treats numeric zero as rich tooltip content` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/__tests__/CostCoverage.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { afterEach, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { CostCoverage, CostEstimateInfo } from "../CostCoverage";
import { Tip } from "../Tip";

afterEach(() => vi.restoreAllMocks());
it("does not call a complete scoped estimate a subscription bill", () => {
  render(
    <MemoryRouter>
      <CostCoverage scope={{ mode: "all", selected: [], provider: "both" }} unpriced={[]} />
    </MemoryRouter>
  );
  expect(
    screen.getByText("API-equivalent estimate, not subscription charges.")
  ).toBeInTheDocument();
  expect(screen.getByText("Sources: All sources · Products: Both")).toHaveAttribute(
    "href",
    "/settings#remote-sources"
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("marks missing tier rates incomplete without calling the known model unknown", () => {
  render(
    <MemoryRouter>
      <CostCoverage
        scope={{ mode: "selected", selected: ["box"], provider: "codex" }}
        unpriced={[
          {
            provider: "codex",
            model: "gpt-6-sol",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
          {
            provider: "codex",
            model: "gpt-6-sol",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Incomplete estimate: some usage has no applicable rate (gpt-6-sol)."
  );
  expect(screen.getByText("Sources: Selected sources · Products: Codex")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review pricing" })).toHaveAttribute(
    "href",
    "/settings#gpt-pricing"
  );
});
it("links each missing provider to its own pricing editor", () => {
  render(
    <MemoryRouter>
      <CostCoverage
        scope={{ mode: "all", selected: [], provider: "both" }}
        unpriced={[
          {
            provider: "cursor",
            model: "cursor-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
          {
            provider: "codex",
            model: "gpt-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  expect(screen.getByRole("link", { name: "Cursor" })).toHaveAttribute(
    "href",
    "/settings#cursor-pricing"
  );
  expect(screen.getByRole("link", { name: "Codex" })).toHaveAttribute(
    "href",
    "/settings#gpt-pricing"
  );
});
it("moves keyboard focus from the info trigger into its portaled pricing link", () => {
  render(
    <MemoryRouter>
      <CostEstimateInfo
        scope={{ mode: "all", selected: [], provider: "codex" }}
        unpriced={[
          {
            provider: "codex",
            model: "gpt-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  const trigger = screen.getByLabelText("About API cost estimate");
  fireEvent.focus(trigger);
  expect(screen.getByRole("tooltip")).toHaveStyle({ maxHeight: "70vh", overflowY: "auto" });
  fireEvent.keyDown(trigger, { key: "Tab" });
  const pricingLink = document.querySelector<HTMLElement>('a[href="/settings#gpt-pricing"]')!;
  expect(pricingLink).toHaveFocus();
  fireEvent.keyDown(pricingLink, { key: "Tab", shiftKey: true });
  expect(trigger).toHaveFocus();
  fireEvent.keyDown(trigger, { key: "Tab" });
  expect(pricingLink).toHaveFocus();
  fireEvent.keyDown(pricingLink, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
it("lets forward keyboard focus leave the portaled pricing links", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <CostEstimateInfo
        scope={{ mode: "all", selected: [], provider: "both" }}
        unpriced={[
          {
            provider: "cursor",
            model: "cursor-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
          {
            provider: "codex",
            model: "gpt-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
      <button type="button">After cost information</button>
    </MemoryRouter>
  );
  const trigger = screen.getByLabelText("About API cost estimate");
  fireEvent.focus(trigger);
  fireEvent.keyDown(trigger, { key: "Tab" });
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/settings#"]'));
  expect(links).toHaveLength(2);
  const [firstLink, secondLink] = links as [HTMLAnchorElement, HTMLAnchorElement];
  expect(firstLink).toHaveFocus();
  secondLink.focus();
  await user.tab();
  expect(screen.getByRole("button", { name: "After cost information" })).toHaveFocus();
});
it("measures the info panel at a neutral origin before edge-aware placement", () => {
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(768);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    return this.style.left === "0px" ? 360 : 260;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  render(
    <MemoryRouter>
      <CostEstimateInfo
        scope={{ mode: "all", selected: [], provider: "codex" }}
        unpriced={[
          {
            provider: "codex",
            model: "gpt-preview",
            input_tokens: 1,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  const trigger = screen.getByLabelText("About API cost estimate");
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    left: 980,
    width: 16,
    bottom: 40,
  } as DOMRect);

  fireEvent.focus(trigger);

  expect(screen.getByRole("tooltip")).toHaveStyle({ left: "616px", visibility: "visible" });
});
it("treats numeric zero as rich tooltip content", () => {
  render(
    <Tip content={0}>
      <span>metric</span>
    </Tip>
  );
  fireEvent.focus(screen.getByText("metric").parentElement!);
  expect(screen.getByRole("tooltip")).toHaveTextContent("0");
});
it("labels an unset product scope as the Claude data it reads", () => {
  render(
    <MemoryRouter>
      <CostCoverage
        scope={{ mode: "local", selected: [] }}
        unpriced={[
          {
            model: "claude-x",
            input_tokens: 1,
            output_tokens: 1,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        ]}
      />
    </MemoryRouter>
  );
  expect(screen.getByText(/Products: Claude Code/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review pricing" })).toHaveAttribute(
    "href",
    "/settings#claude-pricing"
  );
});
