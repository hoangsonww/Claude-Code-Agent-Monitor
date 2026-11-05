/**
 * @file dataScope.test.ts
 * @description Unit tests for the global data-scope store (which source machines
 * and product providers the dashboard shows). Covers persistence, the
 * localStorage → query-param mapping consumed by the API layer, subscriber
 * notification, and malformed / empty input handling. Each case re-imports the
 * module so the singleton starts clean.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/dataScope.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the global data-scope store (which source machines and product providers the
 * dashboard shows). Covers persistence, the localStorage → query-param mapping consumed by the API
 * layer, subscriber notification, and malformed / empty input handling. Each case re-imports the
 * module so the singleton starts clean.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `freshModule` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STORAGE_KEY` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `'selected' with an empty selection degrades to local-only (never empty app)` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `activeSourcesParam maps each mode correctly` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `dataScope store` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `defaults to scope 'all' (no filter) when nothing is stored` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `getScope returns a stable reference between changes (for useSyncExternalStore)` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `maps Claude, Codex, and both to the correct global providers filter` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `notifies subscribers on change and stops after unsubscribe` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `persists to localStorage and reloads on next module init` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `sanitizes an unknown mode / non-array selected from storage` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `setScope copies the selected array (no external mutation leaks in)` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `tolerates malformed stored JSON and falls back to the default` — executable behavior named by
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/dataScope.test.ts` .
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
 * Path: `client/src/lib/__tests__/dataScope.test.ts`
 *
 * Scope
 * Unit tests for the global data-scope store (which source machines and product providers the
 * dashboard shows). Covers persistence, the localStorage → query-param mapping consumed by the API
 * layer, subscriber notification, and malformed / empty input handling. Each case re-imports the
 * module so the singleton starts clean.
 *
 * Subjects and collaborators
 * - The suite exercises behavior exposed directly by its package or test environment.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 *
 * Suite groups
 * - `dataScope store`
 *
 * Protected behavior
 * - defaults to scope 'all' (no filter) when nothing is stored
 * - activeSourcesParam maps each mode correctly
 * - maps Claude, Codex, and both to the correct global providers filter
 * - 'selected' with an empty selection degrades to local-only (never empty app)
 * - persists to localStorage and reloads on next module init
 * - notifies subscribers on change and stops after unsubscribe
 * - getScope returns a stable reference between changes (for useSyncExternalStore)
 * - setScope copies the selected array (no external mutation leaks in)
 * - tolerates malformed stored JSON and falls back to the default
 * - sanitizes an unknown mode / non-array selected from storage
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
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect, beforeEach, vi } from "vitest";

const STORAGE_KEY = "ccam-data-scope";

// Fresh module instance (resets the module-level `current`) with localStorage
// pre-seeded, so we can test load-from-storage behavior deterministically.
async function freshModule(seed?: unknown) {
  localStorage.clear();
  if (seed !== undefined) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  vi.resetModules();
  return import("../dataScope");
}

describe("dataScope store", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to scope 'all' (no filter) when nothing is stored", async () => {
    const m = await freshModule();
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
    expect(m.activeSourcesParam()).toBeNull();
  });

  it("activeSourcesParam maps each mode correctly", async () => {
    const m = await freshModule();
    m.setScope({ mode: "all", selected: [] });
    expect(m.activeSourcesParam()).toBeNull();
    m.setScope({ mode: "local", selected: [] });
    expect(m.activeSourcesParam()).toBe("local");
    m.setScope({ mode: "selected", selected: ["local", "src_abc"] });
    expect(m.activeSourcesParam()).toBe("local,src_abc");
  });

  it("maps Claude, Codex, and both to the correct global providers filter", async () => {
    const m = await freshModule();
    // Backward-compatible installs keep their existing Claude-only view.
    expect(m.activeProvidersParam()).toBe("claude");
    m.setProviderScope("codex");
    expect(m.activeProvidersParam()).toBe("codex");
    m.setProviderScope("both");
    expect(m.activeProvidersParam()).toBeNull();
    m.setProviderScope("claude");
    expect(m.activeProvidersParam()).toBe("claude");
  });

  it("'selected' with an empty selection degrades to local-only (never empty app)", async () => {
    const m = await freshModule();
    m.setScope({ mode: "selected", selected: [] });
    expect(m.activeSourcesParam()).toBe("local");
  });

  it("persists to localStorage and reloads on next module init", async () => {
    const m1 = await freshModule();
    m1.setScope({ mode: "selected", selected: ["src_1", "src_2"] });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      mode: "selected",
      selected: ["src_1", "src_2"],
    });
    // A fresh init (new tab) should read the persisted value back.
    const m2 = await import("../dataScope").then(async () => {
      vi.resetModules();
      return import("../dataScope");
    });
    expect(m2.getScope()).toEqual({ mode: "selected", selected: ["src_1", "src_2"] });
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const m = await freshModule();
    const cb = vi.fn();
    const unsub = m.subscribeScope(cb);
    m.setScope({ mode: "local", selected: [] });
    m.setScope({ mode: "all", selected: [] });
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    m.setScope({ mode: "local", selected: [] });
    expect(cb).toHaveBeenCalledTimes(2); // no further calls
  });

  it("getScope returns a stable reference between changes (for useSyncExternalStore)", async () => {
    const m = await freshModule();
    const a = m.getScope();
    const b = m.getScope();
    expect(a).toBe(b);
    m.setScope({ mode: "local", selected: [] });
    expect(m.getScope()).not.toBe(a);
  });

  it("setScope copies the selected array (no external mutation leaks in)", async () => {
    const m = await freshModule();
    const sel = ["src_1"];
    m.setScope({ mode: "selected", selected: sel });
    sel.push("src_2");
    expect(m.getScope().selected).toEqual(["src_1"]);
  });

  it("tolerates malformed stored JSON and falls back to the default", async () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    vi.resetModules();
    const m = await import("../dataScope");
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
  });

  it("sanitizes an unknown mode / non-array selected from storage", async () => {
    const m = await freshModule({ mode: "bogus", selected: "nope" });
    expect(m.getScope()).toEqual({ mode: "all", selected: [] });
  });
});
