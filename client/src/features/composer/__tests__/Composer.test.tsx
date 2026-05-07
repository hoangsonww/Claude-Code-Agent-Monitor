import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "../Composer";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && typeof url === "string" && url.endsWith("/spawn")) {
      return new Response(JSON.stringify({ id: "h-new", pid: 1, status: "running", startedAt: 1 }), { status: 200 });
    }
    if (init?.method === "POST" && typeof url === "string" && url.includes("/agents/") && url.endsWith("/message")) {
      return new Response(JSON.stringify({ messageId: "m1" }), { status: 200 });
    }
    if (typeof url === "string" && url.endsWith("/profiles")) return new Response(JSON.stringify([]), { status: 200 });
    if (typeof url === "string" && url.includes("/slash-commands")) return new Response(JSON.stringify({ builtin: [{ name: "help", description: "Show help", source: "builtin" }], skills: [], plugins: [], project: [] }), { status: 200 });
    if (typeof url === "string" && url.endsWith("/cwds")) return new Response(JSON.stringify([{ path: "/tmp", source: "manual", added_at: 1 }]), { status: 200 });
    return new Response("[]", { status: 200 });
  }));
});

describe("Composer", () => {
  it("renders status-bar chips, plus menu, mic, and inline submit", () => {
    render(<Composer sessionId="s1" sessionCwd="/tmp" />);
    expect(screen.getByRole("button", { name: /Permission mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Model and effort/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type \/ for commands/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Send$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add files, photos, or slash commands/i })).toBeInTheDocument();
  });

  it("inline Send icon is disabled when text is empty", () => {
    render(<Composer sessionId="s1" sessionCwd="/tmp" />);
    expect(screen.getByRole("button", { name: /^Send$/i })).toBeDisabled();
  });

  it("typing '/' opens the slash menu with built-in commands", async () => {
    render(<Composer sessionId="s1" sessionCwd="/tmp" />);
    const ta = screen.getByPlaceholderText(/Type \/ for commands/i);
    await userEvent.type(ta, "/he");
    // The slash menu shows /help via the built-in section
    expect(await screen.findByText("/help")).toBeInTheDocument();
  });
});
