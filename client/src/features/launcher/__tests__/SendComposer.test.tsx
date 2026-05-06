import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendComposer } from "../SendComposer";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && typeof url === "string" && url.endsWith("/spawn")) {
        return new Response(JSON.stringify({ id: "h2", pid: 1, status: "running", startedAt: 1 }), { status: 200 });
      }
      if (
        init?.method === "POST" &&
        typeof url === "string" &&
        url.includes("/agents/") &&
        url.endsWith("/message")
      ) {
        return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
      }
      if (typeof url === "string" && url.endsWith("/profiles")) return new Response(JSON.stringify([]), { status: 200 });
      if (typeof url === "string" && url.endsWith("/cwds")) {
        return new Response(JSON.stringify([{ path: "/tmp", source: "manual", added_at: 1 }]), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }),
  );
});

describe("SendComposer", () => {
  it("uses sendMessage when sessionLiveHandleId is provided", async () => {
    render(<SendComposer sessionId="s1" sessionLiveHandleId="h1" sessionCwd="/tmp" />);
    await userEvent.type(screen.getByPlaceholderText(/message/i), "hi");
    await userEvent.click(screen.getByRole("button", { name: /^Send$/i }));
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/agents/h1/message"))).toBe(true);
  });

  it("uses spawn(--resume) when no live handle", async () => {
    render(<SendComposer sessionId="s1" sessionCwd="/tmp" />);
    await userEvent.type(screen.getByPlaceholderText(/message/i), "go");
    await userEvent.click(screen.getByRole("button", { name: /^Send$/i }));
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const spawn = calls.find((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/spawn"));
    expect(spawn).toBeTruthy();
    const body = JSON.parse((spawn![1] as RequestInit).body as string);
    expect(body.resumeSessionId).toBe("s1");
  });

  it("renders a Stop button only when live", () => {
    const { rerender } = render(<SendComposer sessionId="s1" sessionCwd="/tmp" />);
    expect(screen.queryByRole("button", { name: /^Stop$/i })).not.toBeInTheDocument();
    rerender(<SendComposer sessionId="s1" sessionLiveHandleId="h1" sessionCwd="/tmp" />);
    expect(screen.getByRole("button", { name: /^Stop$/i })).toBeInTheDocument();
  });
});
