/**
 * @file Tests for agentOriginLabel — verifies the parent-chain walk that
 * renders nested subagent attribution as "main › coder › explorer", so
 * tool events triggered by deeply nested subagents identify their full
 * lineage instead of collapsing to just the leaf agent.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { agentOriginLabel, type AgentInfo } from "../event-grouping";

function makeMap(entries: Array<[string, AgentInfo]>): Map<string, AgentInfo> {
  return new Map(entries);
}

describe("agentOriginLabel — parent chain walk", () => {
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
