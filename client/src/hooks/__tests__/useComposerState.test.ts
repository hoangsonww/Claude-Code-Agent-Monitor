import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useComposerState } from "../useComposerState";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && typeof url === "string" && url.endsWith("/spawn")) {
      return new Response(JSON.stringify({ id: "h-new", pid: 1, status: "running", startedAt: 1 }), { status: 200 });
    }
    if (init?.method === "POST" && typeof url === "string" && url.includes("/agents/") && url.endsWith("/message")) {
      return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
    }
    if (init?.method === "POST" && typeof url === "string" && url.includes("/agents/") && url.endsWith("/respawn")) {
      return new Response(JSON.stringify({ id: "h-respawn", pid: 2, status: "running", startedAt: 2 }), { status: 200 });
    }
    if (typeof url === "string" && url.endsWith("/profiles")) return new Response(JSON.stringify([]), { status: 200 });
    if (typeof url === "string" && url.includes("/slash-commands")) return new Response(JSON.stringify({ builtin: [], skills: [], plugins: [], project: [] }), { status: 200 });
    return new Response("[]", { status: 200 });
  }));
});

describe("useComposerState", () => {
  it("send to live handle calls /agents/:id/message when model/mode unchanged", async () => {
    const { result } = renderHook(() => useComposerState({ sessionId: "s1", sessionLiveHandleId: "h1", sessionCwd: "/tmp", mode: "resume" }));
    act(() => result.current.setText("hello"));
    await act(async () => {
      await result.current.send();
    });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/agents/h1/message"))).toBe(true);
  });

  it("send when not live calls /spawn with resumeSessionId in resume mode", async () => {
    const { result } = renderHook(() => useComposerState({ sessionId: "s1", sessionCwd: "/tmp", mode: "resume" }));
    act(() => result.current.setText("hi"));
    await act(async () => {
      await result.current.send();
    });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const spawn = calls.find((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/spawn"));
    expect(spawn).toBeTruthy();
    expect(JSON.parse((spawn![1] as RequestInit).body as string).resumeSessionId).toBe("s1");
  });

  it("changing model on a live handle triggers /respawn and surfaces new handle id via callback", async () => {
    const onLiveHandleChange = vi.fn();
    const { result } = renderHook(() =>
      useComposerState({ sessionId: "s1", sessionLiveHandleId: "h1", sessionCwd: "/tmp", mode: "resume", onLiveHandleChange }),
    );
    act(() => result.current.setText("queued text"));
    await act(async () => {
      await result.current.setModel("opus");
    });
    expect(onLiveHandleChange).toHaveBeenCalledWith("h-respawn");
  });

  it("attachments append paths into the sent message", async () => {
    const { result } = renderHook(() => useComposerState({ sessionId: "s1", sessionLiveHandleId: "h1", sessionCwd: "/tmp", mode: "resume" }));
    act(() => {
      result.current.setText("look at this");
      result.current.addAttachmentForTest({ id: "u1", name: "a.txt", size: 2, kind: "text", path: "./.launcher-uploads/u1/a.txt" });
    });
    await act(async () => {
      await result.current.send();
    });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls.find((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/agents/h1/message"));
    const body = JSON.parse((msg![1] as RequestInit).body as string);
    expect(body.text).toContain("look at this");
    expect(body.text).toContain("./.launcher-uploads/u1/a.txt");
  });
});
