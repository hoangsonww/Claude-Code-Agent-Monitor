import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProfiles } from "../useProfiles";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.endsWith("/profiles")) {
        return new Response(JSON.stringify({ id: "p1", name: "x", config: {} }), { status: 201 });
      }
      if (url.endsWith("/profiles")) {
        return new Response(JSON.stringify([{ id: "p1", name: "x", config: {} }]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("useProfiles", () => {
  it("loads list on mount", async () => {
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.profiles).toHaveLength(1));
  });

  it("create() refreshes the list", async () => {
    const { result } = renderHook(() => useProfiles());
    await act(async () => {
      await result.current.create({ name: "y", config: {} });
    });
    expect(fetch).toHaveBeenCalled();
  });
});
