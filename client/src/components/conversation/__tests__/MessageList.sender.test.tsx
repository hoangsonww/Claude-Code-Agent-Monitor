/**
 * @file MessageList.sender.test.tsx
 * @description Verifies the transcript renders each message under its TRUE
 * sender label — User / Assistant / Main agent / System — instead of labeling
 * every `type:"user"` line "User" (reported transcript mis-attribution).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageList } from "../MessageList";
import type { TranscriptMessage } from "../../../lib/types";

function msg(partial: Partial<TranscriptMessage>): TranscriptMessage {
  return {
    type: "user",
    timestamp: "2026-06-26T08:14:00.000Z",
    content: [{ type: "text", text: "hello" }],
    ...partial,
  } as TranscriptMessage;
}

describe("MessageList — sender attribution", () => {
  it("labels each row by its sender, not blanket 'User'", () => {
    const messages: TranscriptMessage[] = [
      msg({ sender: "user", content: [{ type: "text", text: "spin up a team" }] }),
      msg({
        type: "assistant",
        sender: "assistant",
        content: [{ type: "text", text: "on it" }],
      }),
      msg({
        sender: "system",
        content: [{ type: "text", text: "<task-notification>\n<task-id>x</task-id>\n" }],
      }),
      msg({ sender: "orchestrator", content: [{ type: "text", text: "Light research task…" }] }),
    ];
    render(<MessageList messages={messages} loading={false} />);

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Main agent")).toBeInTheDocument();
  });

  it("falls back to type-based labels when sender is absent (legacy payloads)", () => {
    const messages: TranscriptMessage[] = [
      msg({ content: [{ type: "text", text: "hi there" }] }), // no sender → "User"
      msg({ type: "assistant", content: [{ type: "text", text: "hello" }] }), // → "Assistant"
    ];
    render(<MessageList messages={messages} loading={false} />);
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });
});
