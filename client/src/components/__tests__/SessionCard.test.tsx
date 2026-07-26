/**
 * @file SessionCard.test.tsx
 * @description Tests for SessionCard's hover-triggered "last message" preview:
 * only fetched (and only shown) for sessions in the Waiting state, extracts
 * the last assistant text block from the transcript tail, and covers the
 * loading/empty fallbacks plus the fetch-once-per-card behavior.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SessionCard } from "../SessionCard";
import type { Session, TranscriptMessage } from "../../lib/types";

const transcriptMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    sessions: {
      transcript: (...args: unknown[]) => transcriptMock(...args),
    },
  },
}));

function renderCard(session: Session) {
  return render(
    <MemoryRouter>
      <SessionCard session={session} />
    </MemoryRouter>
  );
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    name: "Test session",
    status: "active",
    cwd: "/repo/agent-monitor",
    model: "claude-opus-4-6",
    started_at: "2026-06-10T11:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

const waitingSession = makeSession({
  awaiting_input_since: "2026-06-10T11:05:00.000Z",
  awaiting_reason: "stop",
} as Partial<Session>);

function assistantMessage(text: string): TranscriptMessage {
  return {
    type: "assistant",
    sender: "assistant",
    timestamp: "2026-06-10T11:05:00.000Z",
    content: [{ type: "text", text }],
  };
}

describe("SessionCard - last message preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch a preview for a non-waiting session, even on hover", async () => {
    renderCard(makeSession({ status: "active" }));
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;
    fireEvent.mouseEnter(card);

    expect(transcriptMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Last message")).not.toBeInTheDocument();
  });

  it("fetches and shows the last assistant text on hover for a waiting session", async () => {
    transcriptMock.mockResolvedValue({
      messages: [assistantMessage("All done, want me to open a PR?")],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);

    expect(transcriptMock).toHaveBeenCalledWith("sess-1", { limit: 10 });
    await waitFor(() =>
      expect(screen.getByText("All done, want me to open a PR?")).toBeInTheDocument()
    );
  });

  it("hides the preview again on mouse leave", async () => {
    transcriptMock.mockResolvedValue({
      messages: [assistantMessage("Ready when you are.")],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);
    await screen.findByText("Ready when you are.");

    // Closing is debounced (~150ms) so the pointer has time to cross the gap
    // into the portaled popup itself without it vanishing mid-transit.
    fireEvent.mouseLeave(card);
    await waitFor(() => expect(screen.queryByText("Ready when you are.")).not.toBeInTheDocument());
  });

  it("only fetches once across repeated hovers", async () => {
    transcriptMock.mockResolvedValue({
      messages: [assistantMessage("Only fetch me once.")],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);
    await screen.findByText("Only fetch me once.");
    fireEvent.mouseLeave(card);
    fireEvent.mouseEnter(card);
    await screen.findByText("Only fetch me once.");

    expect(transcriptMock).toHaveBeenCalledTimes(1);
  });

  it("portals the popup to document.body rather than nesting it inside the card", async () => {
    transcriptMock.mockResolvedValue({
      messages: [assistantMessage("Portaled, not inline.")],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);
    const message = await screen.findByText("Portaled, not inline.");

    expect(card.contains(message)).toBe(false);
  });

  it("shrinks the popup to fit a narrow viewport instead of overflowing the screen edge", async () => {
    const narrowWidth = 375; // a phone-width viewport
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "clientWidth"
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: narrowWidth,
    });

    try {
      transcriptMock.mockResolvedValue({
        messages: [assistantMessage("Fits on a phone screen too.")],
        total: 1,
        has_more: false,
        last_line: 1,
        first_line: 1,
      });
      renderCard(waitingSession);
      const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

      fireEvent.mouseEnter(card);
      const message = await screen.findByText("Fits on a phone screen too.");
      const popup = message.closest("div.rounded-lg") as HTMLElement;

      const left = parseFloat(popup.style.left);
      const width = parseFloat(popup.style.width);
      // The old fixed 420px width would overflow a 375px viewport outright -
      // this is the actual bug fix, not just a style nicety.
      expect(width).toBeLessThan(420);
      expect(left + width).toBeLessThanOrEqual(narrowWidth);
      expect(left).toBeGreaterThanOrEqual(0);
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
      }
    }
  });

  it("widens the popup for a long message so there's less vertical scrolling to read it", async () => {
    // Plenty of room to grow into (a large-monitor-width viewport) so the
    // assertion is purely about the content-driven sizing, not a clamp.
    const originalClientWidth = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "clientWidth"
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 2560,
    });

    try {
      // Array(60).join, not .repeat(), so there's no trailing whitespace for
      // messageText()'s trim() to strip - keeps this string identical to
      // what actually ends up rendered. > 1400 chars either way.
      const longText = Array(60).fill("This is a long paragraph of prose.").join(" ");
      transcriptMock.mockResolvedValue({
        messages: [assistantMessage(longText)],
        total: 1,
        has_more: false,
        last_line: 1,
        first_line: 1,
      });
      renderCard(waitingSession);
      const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

      fireEvent.mouseEnter(card);
      const message = await screen.findByText(longText);
      const popup = message.closest("div.rounded-lg") as HTMLElement;

      expect(parseFloat(popup.style.width)).toBeGreaterThan(420);
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
      }
    }
  });

  it("stays open when the pointer moves from the card into the popup itself", async () => {
    transcriptMock.mockResolvedValue({
      messages: [assistantMessage("Still here.")],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);
    const message = await screen.findByText("Still here.");
    const popup = message.closest("div.rounded-lg") as HTMLElement;

    fireEvent.mouseLeave(card);
    fireEvent.mouseEnter(popup);

    // Give the (cleared) close timer a chance to have fired if it hadn't
    // actually been cancelled - the popup should still be showing.
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByText("Still here.")).toBeInTheDocument();

    fireEvent.mouseLeave(popup);
    await waitFor(() => expect(screen.queryByText("Still here.")).not.toBeInTheDocument());
  });

  it("falls back to an empty-state message when the last assistant turn has no text block", async () => {
    transcriptMock.mockResolvedValue({
      messages: [
        {
          type: "assistant",
          sender: "assistant",
          timestamp: "2026-06-10T11:05:00.000Z",
          content: [{ type: "tool_use", name: "Bash", id: "t1", input: {} }],
        },
      ],
      total: 1,
      has_more: false,
      last_line: 1,
      first_line: 1,
    });
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;

    fireEvent.mouseEnter(card);
    await screen.findByText("No recent message found");
  });

  it("applies the yellow border for a genuine Waiting session (reason=stop)", () => {
    renderCard(waitingSession);
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;
    expect(card.className).toContain("border-l-yellow-500/60");
  });

  it("applies the green active accent, not yellow, for a 'monitor' primary reason", () => {
    renderCard(
      makeSession({
        awaiting_input_since: "2026-06-10T11:05:00.000Z",
        awaiting_reason: "monitor",
      } as Partial<Session>)
    );
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    const card = screen.getByText("Test session").closest("div.card-hover") as HTMLElement;
    expect(card.className).toContain("border-l-emerald-500/50");
    expect(card.className).not.toContain("border-l-yellow-500/60");
  });
});
