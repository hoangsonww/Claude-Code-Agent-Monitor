/**
 * @file Verifies ConversationView requests the preceding transcript page when
 * the scroll container reaches its top boundary.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TranscriptResult } from "../../../lib/types";

const mocks = vi.hoisted(() => ({ transcript: vi.fn() }));

vi.mock("../../../lib/api", () => ({
  api: {
    sessions: {
      transcripts: vi.fn().mockResolvedValue({ transcripts: [] }),
      transcript: mocks.transcript,
    },
  },
}));

vi.mock("../../../lib/eventBus", () => ({
  eventBus: {
    subscribe: vi.fn(() => () => {}),
    onConnection: vi.fn(() => () => {}),
  },
}));

import { ConversationView } from "../ConversationView";

function result(
  messages: TranscriptResult["messages"],
  firstLine: number,
  lastLine: number,
  hasMore: boolean
) {
  return { messages, total: 100, first_line: firstLine, last_line: lastLine, has_more: hasMore };
}

afterEach(() => {
  mocks.transcript.mockReset();
});

describe("ConversationView history pagination", () => {
  it("loads older messages when scrolling to the top", async () => {
    mocks.transcript
      .mockResolvedValueOnce(
        result(
          [
            {
              type: "assistant",
              sender: "assistant",
              timestamp: "2026-08-01T12:00:00.000Z",
              content: [{ type: "text", text: "Newest message" }],
            },
          ],
          101,
          150,
          true
        )
      )
      .mockResolvedValueOnce(
        result(
          [
            {
              type: "user",
              sender: "user",
              timestamp: "2026-08-01T11:00:00.000Z",
              content: [{ type: "text", text: "Older message" }],
            },
          ],
          51,
          100,
          false
        )
      );

    render(<ConversationView sessionId="codex-session" />);
    await screen.findByText("Newest message");

    const container = screen.getByTestId("transcript-scroll-container");
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    fireEvent.scroll(container);

    await waitFor(() => {
      expect(mocks.transcript).toHaveBeenCalledTimes(2);
    });
    expect(mocks.transcript).toHaveBeenLastCalledWith("codex-session", {
      agent_id: undefined,
      before: 101,
      limit: 50,
    });
    expect(screen.getByText("Older message")).toBeInTheDocument();
  });
});
