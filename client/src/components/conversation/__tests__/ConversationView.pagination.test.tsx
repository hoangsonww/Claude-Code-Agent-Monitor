/**
 * @file Verifies ConversationView history pagination and stable-id merging for
 * Cursor prompt-history refreshes triggered by session updates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/conversation/__tests__/ConversationView.pagination.test.tsx`
 *
 * Scope
 * Behavioral regression suite for `ConversationView.pagination.test.tsx`.
 *
 * Subjects and collaborators
 * - `../../../lib/types` — local module imported by this suite.
 * - `../ConversationView` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 * - Mock boundary: `../../../lib/api`.
 * - Mock boundary: `../../../lib/eventBus`.
 *
 * Suite groups
 * - `ConversationView history pagination`
 *
 * Protected behavior
 * - loads older messages when scrolling to the top
 * - merges Cursor prompt hand-off when session_updated arrives
 * - announces incremental id-less Claude and Codex messages away from the bottom
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TranscriptResult } from "../../../lib/types";

const mocks = vi.hoisted(() => ({
  transcript: vi.fn(),
  handlers: new Set<
    (message: { type: string; data: { id?: string; session_id?: string } }) => void
  >(),
}));

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
    subscribe: vi.fn(
      (
        handler: (message: { type: string; data: { id?: string; session_id?: string } }) => void
      ) => {
        mocks.handlers.add(handler);
        return () => mocks.handlers.delete(handler);
      }
    ),
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
  mocks.handlers.clear();
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

  it("merges Cursor prompt hand-off when session_updated arrives", async () => {
    mocks.transcript
      .mockResolvedValueOnce(
        result(
          [
            {
              id: "cursor-prompt:0",
              type: "user",
              sender: "user",
              timestamp: null,
              content: [{ type: "text", text: "Fix the live update" }],
            },
          ],
          1,
          1,
          false
        )
      )
      .mockResolvedValueOnce({
        ...result(
          [
            {
              id: "cursor-prompt:0",
              type: "user",
              sender: "user",
              timestamp: null,
              content: [{ type: "text", text: "Fix the live update" }],
            },
            {
              id: "cursor-jsonl:2",
              type: "assistant",
              sender: "assistant",
              timestamp: null,
              content: [{ type: "text", text: "Working on it" }],
            },
          ],
          1,
          2,
          false
        ),
        refresh: true,
      });

    render(<ConversationView sessionId="cursor-session" />);
    await screen.findByText("Fix the live update");
    for (const handler of mocks.handlers) {
      handler({ type: "session_updated", data: { id: "cursor-session" } });
    }

    await screen.findByText("Working on it");
    expect(screen.getAllByText("Fix the live update")).toHaveLength(1);
    expect(mocks.transcript).toHaveBeenLastCalledWith("cursor-session", {
      agent_id: undefined,
      after: 1,
      limit: 50,
    });
  });

  it("announces incremental id-less Claude and Codex messages away from the bottom", async () => {
    mocks.transcript
      .mockResolvedValueOnce(
        result(
          [
            {
              type: "assistant",
              sender: "assistant",
              timestamp: null,
              content: [{ type: "text", text: "Existing response" }],
            },
          ],
          1,
          1,
          false
        )
      )
      .mockResolvedValueOnce(
        result(
          [
            {
              type: "assistant",
              sender: "assistant",
              timestamp: null,
              content: [{ type: "text", text: "New id-less response" }],
            },
          ],
          2,
          2,
          false
        )
      );

    render(<ConversationView sessionId="claude-session" />);
    await screen.findByText("Existing response");

    const container = screen.getByTestId("transcript-scroll-container");
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(container);
    for (const handler of mocks.handlers) {
      handler({ type: "new_event", data: { session_id: "claude-session" } });
    }

    await screen.findByText("New id-less response");
    expect(screen.getByRole("button", { name: /new messages/i })).toBeInTheDocument();
  });
});
