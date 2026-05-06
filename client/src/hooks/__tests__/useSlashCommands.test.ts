import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSlashCommands } from "../useSlashCommands";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    builtin: [{ name: "help", description: "Show help", source: "builtin" }, { name: "clear", description: "Clear", source: "builtin" }],
    skills: [{ name: "code-review", description: "Reviews diff", source: "skill" }],
    plugins: [],
    project: [{ name: "deploy", description: "Deploy", source: "project" }],
  }), { status: 200 })));
});

describe("useSlashCommands", () => {
  it("loads catalog on mount and exposes filter() that searches all sections", async () => {
    const { result } = renderHook(() => useSlashCommands("/tmp"));
    await waitFor(() => expect(result.current.catalog?.builtin.length).toBeGreaterThan(0));
    const filtered = result.current.filter("re");
    // "review" matches code-review by name and "Reviews" by description
    expect(filtered.skills.length).toBe(1);
  });

  it("filter() returns empty groups for sections that match nothing", async () => {
    const { result } = renderHook(() => useSlashCommands("/tmp"));
    await waitFor(() => expect(result.current.catalog).not.toBeNull());
    const filtered = result.current.filter("zzz_nonexistent_zzz");
    expect(filtered.builtin).toHaveLength(0);
    expect(filtered.skills).toHaveLength(0);
    expect(filtered.plugins).toHaveLength(0);
    expect(filtered.project).toHaveLength(0);
  });
});
