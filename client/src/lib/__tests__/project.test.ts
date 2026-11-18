/**
 * @file project.test.ts
 * @description Tests for folding git worktrees into their project.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import { groupByProject, projectName, projectRoot, worktreeName } from "../project";

describe("project helpers", () => {
  it("folds Claude Code worktrees into the repository", () => {
    const wt = "C:\\Users\\me\\Desktop\\shop\\.claude\\worktrees\\agent-a63d31";
    expect(projectRoot(wt)).toBe("C:\\Users\\me\\Desktop\\shop");
    expect(projectName(wt)).toBe("shop");
    expect(worktreeName(wt)).toBe("agent-a63d31");
  });

  it("handles POSIX paths, nested folders and .worktrees", () => {
    expect(projectRoot("/home/me/api/.worktrees/fix-1/server")).toBe("/home/me/api");
    expect(projectName("/home/me/api/.claude/worktrees/x")).toBe("api");
  });

  it("leaves ordinary directories alone", () => {
    expect(projectRoot("/home/me/api")).toBe("/home/me/api");
    expect(worktreeName("/home/me/api")).toBeNull();
    expect(projectName("/home/me/worktrees/api")).toBe("api");
  });

  it("folds orchestrator worktrees and scratch folders", () => {
    expect(projectName("C:\\Users\\me\\.ao\\data\\worktrees\\vocal\\orch\\x")).toBe("vocal");
    expect(projectName("C:\\Data\\scratch-workspaces\\a\\b\\scratch-2026-10-18-a4fd21")).toBe(
      "scratch"
    );
  });

  it("groups directories by project name, scratch last", () => {
    const g = groupByProject([
      "/r/web/.claude/worktrees/a",
      "/tmp/scratch-workspaces/x/scratch-1",
      "/r/api",
      "/r/web",
      "/home/me/.ao/data/worktrees/Web/w2",
      "/r/web/.claude/worktrees/b",
    ]);
    expect([...g.keys()]).toEqual(["api", "web", "scratch"]);
    expect(g.get("web")?.dirs).toHaveLength(4);
  });
});
