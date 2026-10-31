/**
 * @file Tests for agentOriginLabel - verifies the parent-chain walk that
 * renders nested subagent attribution as "main › coder › explorer", so
 * tool events triggered by deeply nested subagents identify their full
 * lineage instead of collapsing to just the leaf agent.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
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
