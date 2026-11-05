/**
 * @file Tests for agentOriginLabel - verifies the parent-chain walk that
 * renders nested subagent attribution as "main › coder › explorer", so
 * tool events triggered by deeply nested subagents identify their full
 * lineage instead of collapsing to just the leaf agent.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/agentOriginLabel.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Tests for agentOriginLabel - verifies the parent-chain walk that renders nested subagent
 * attribution as "main › coder › explorer", so tool events triggered by deeply nested subagents
 * identify their full lineage instead of collapsing to just the leaf agent.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../event-grouping` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `makeMap` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `agentOriginLabel - parent chain walk` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `breaks cleanly on a parent-chain cycle` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `falls back to 'main' for IDs ending in -main when no info is available` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `falls back to single-segment when the map is undefined (legacy callers)` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `handles Windows backslash paths` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `ignores a trailing slash` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `projectFromCwd - session-cwd fallback for the dir prefix` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `renders 'main › coder › explorer' for a 2-deep subagent` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `renders 'main › coder' for a direct child of main` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `returns 'main' for the main agent itself` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `returns null for null agentId regardless of map shape` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `returns null for null, undefined, or empty cwd` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `returns the last path segment of a POSIX cwd` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `uses subagent name when subagent_type is null` — executable behavior named by this suite;
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/agentOriginLabel.test.ts`
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
 * Path: `client/src/lib/__tests__/agentOriginLabel.test.ts`
 *
 * Scope
 * Behavioral regression suite for `agentOriginLabel.test.ts`.
 *
 * Subjects and collaborators
 * - `../event-grouping` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `agentOriginLabel - parent chain walk`
 * - `projectFromCwd - session-cwd fallback for the dir prefix`
 *
 * Protected behavior
 * - returns 'main' for the main agent itself
 * - renders 'main › coder' for a direct child of main
 * - renders 'main › coder › explorer' for a 2-deep subagent
 * - falls back to single-segment when the map is undefined (legacy callers)
 * - uses subagent name when subagent_type is null
 * - breaks cleanly on a parent-chain cycle
 * - returns null for null agentId regardless of map shape
 * - falls back to 'main' for IDs ending in -main when no info is available
 * - returns the last path segment of a POSIX cwd
 * - ignores a trailing slash
 * - handles Windows backslash paths
 * - returns null for null, undefined, or empty cwd
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

import { describe, it, expect } from "vitest";
import { agentOriginLabel, projectFromCwd, type AgentInfo } from "../event-grouping";

function makeMap(entries: Array<[string, AgentInfo]>): Map<string, AgentInfo> {
  return new Map(entries);
}

describe("agentOriginLabel - parent chain walk", () => {
  it("returns 'main' for the main agent itself", () => {
    const map = makeMap([
      ["sess-main", { type: "main", subagent_type: null, name: "Main", parent_agent_id: null }],
    ]);
    expect(agentOriginLabel("sess-main", map)).toBe("main");
  });

  it("renders 'main › coder' for a direct child of main", () => {
    const map = makeMap([
      ["sess-main", { type: "main", subagent_type: null, name: "Main", parent_agent_id: null }],
      [
        "sub-coder",
        {
          type: "subagent",
          subagent_type: "coder",
          name: "Coder",
          parent_agent_id: "sess-main",
        },
      ],
    ]);
    expect(agentOriginLabel("sub-coder", map)).toBe("main › coder");
  });

  it("renders 'main › coder › explorer' for a 2-deep subagent", () => {
    const map = makeMap([
      ["sess-main", { type: "main", subagent_type: null, name: "Main", parent_agent_id: null }],
      [
        "sub-coder",
        {
          type: "subagent",
          subagent_type: "coder",
          name: "Coder",
          parent_agent_id: "sess-main",
        },
      ],
      [
        "sub-explorer",
        {
          type: "subagent",
          subagent_type: "explorer",
          name: "Explorer",
          parent_agent_id: "sub-coder",
        },
      ],
    ]);
    expect(agentOriginLabel("sub-explorer", map)).toBe("main › coder › explorer");
  });

  it("falls back to single-segment when the map is undefined (legacy callers)", () => {
    const info: AgentInfo = {
      type: "subagent",
      subagent_type: "coder",
      name: "Coder",
      parent_agent_id: "sess-main",
    };
    expect(agentOriginLabel("sub-coder", info)).toBe("coder");
  });

  it("uses subagent name when subagent_type is null", () => {
    const map = makeMap([
      ["sess-main", { type: "main", subagent_type: null, name: "Main", parent_agent_id: null }],
      [
        "sub-1",
        {
          type: "subagent",
          subagent_type: null,
          name: "Helper",
          parent_agent_id: "sess-main",
        },
      ],
    ]);
    expect(agentOriginLabel("sub-1", map)).toBe("main › Helper");
  });

  it("breaks cleanly on a parent-chain cycle", () => {
    // Pathological: a → b → a. Should not loop forever.
    const map = makeMap([
      [
        "a",
        {
          type: "subagent",
          subagent_type: "a",
          name: "A",
          parent_agent_id: "b",
        },
      ],
      [
        "b",
        {
          type: "subagent",
          subagent_type: "b",
          name: "B",
          parent_agent_id: "a",
        },
      ],
    ]);
    const result = agentOriginLabel("a", map);
    expect(result).toBe("b › a");
  });

  it("returns null for null agentId regardless of map shape", () => {
    expect(agentOriginLabel(null, makeMap([]))).toBeNull();
    expect(agentOriginLabel(null, undefined)).toBeNull();
  });

  it("falls back to 'main' for IDs ending in -main when no info is available", () => {
    expect(agentOriginLabel("session-xyz-main", makeMap([]))).toBe("main");
  });
});

describe("projectFromCwd - session-cwd fallback for the dir prefix", () => {
  it("returns the last path segment of a POSIX cwd", () => {
    expect(projectFromCwd("/Users/dev/WebstormProjects/Claude-Code-Agent-Monitor")).toBe(
      "Claude-Code-Agent-Monitor"
    );
  });

  it("ignores a trailing slash", () => {
    expect(projectFromCwd("/Users/dev/my-app/")).toBe("my-app");
  });

  it("handles Windows backslash paths", () => {
    expect(projectFromCwd("C:\\Users\\dev\\my-app")).toBe("my-app");
  });

  it("returns null for null, undefined, or empty cwd", () => {
    expect(projectFromCwd(null)).toBeNull();
    expect(projectFromCwd(undefined)).toBeNull();
    expect(projectFromCwd("")).toBeNull();
  });
});
