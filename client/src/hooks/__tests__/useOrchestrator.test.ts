import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrchestrator } from "../useOrchestrator";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && typeof url === "string" && url.endsWith("/spawn")) {
        return new Response(JSON.stringify({ id: "h1", pid: 9, status: "running", startedAt: 1 }), { status: 200 });
      }
      if (
        init?.method === "POST" &&
        typeof url === "string" &&
        url.includes("/agents/") &&
        url.endsWith("/message")
      ) {
        return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

describe("useOrchestrator (extended)", () => {
  it("spawn() posts the new shape", async () => {
    const { result } = renderHook(() => useOrchestrator());
    let r: Awaited<ReturnType<typeof result.current.spawn>> = null;
    await act(async () => {
      r = await result.current.spawn({ prompt: "hi", cwd: "/tmp", profileId: "p1" });
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((r as { id: string } | null)!.id).toBe("h1");
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const spawnCall = calls.find((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/spawn"));
    expect(spawnCall).toBeTruthy();
    expect(JSON.parse((spawnCall![1] as RequestInit).body as string)).toMatchObject({ prompt: "hi", cwd: "/tmp", profileId: "p1" });
  });

  it("sendMessage() posts to /agents/:id/message", async () => {
    const { result } = renderHook(() => useOrchestrator());
    const box: { r: { messageId: string } | null } = { r: null };
    await act(async () => {
      box.r = await result.current.sendMessage("h1", "follow-up");
    });
    expect(box.r?.messageId).toBe("m1");
  });
});
