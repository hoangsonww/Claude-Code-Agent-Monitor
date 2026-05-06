import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUploads } from "../useUploads";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && typeof url === "string" && url.endsWith("/uploads")) {
      return new Response(JSON.stringify({ id: "u1", name: "a.txt", size: 2, kind: "text", path: "./.launcher-uploads/u1/a.txt" }), { status: 201 });
    }
    if (init?.method === "DELETE" && typeof url === "string" && url.includes("/uploads/")) {
      return new Response(null, { status: 204 });
    }
    return new Response("{}", { status: 200 });
  }));
});

describe("useUploads", () => {
  it("add() POSTs and appends to list", async () => {
    const { result } = renderHook(() => useUploads("/tmp/x"));
    await act(async () => {
      await result.current.add(new File(["hi"], "a.txt", { type: "text/plain" }));
    });
    await waitFor(() => expect(result.current.attachments).toHaveLength(1));
    expect(result.current.attachments[0]!.id).toBe("u1");
  });

  it("remove() DELETEs and removes from list", async () => {
    const { result } = renderHook(() => useUploads("/tmp/x"));
    await act(async () => {
      await result.current.add(new File(["hi"], "a.txt"));
    });
    await act(async () => {
      await result.current.remove("u1");
    });
    expect(result.current.attachments).toHaveLength(0);
  });

  it("error on add surfaces via error state", async () => {
    vi.mocked(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response(JSON.stringify({ error: "too big" }), { status: 413 }));
    const { result } = renderHook(() => useUploads("/tmp/x"));
    await act(async () => {
      await result.current.add(new File(["x".repeat(100)], "big.bin"));
    });
    expect(result.current.error).toMatch(/too big|413/);
  });
});
