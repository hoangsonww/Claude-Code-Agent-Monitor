/**
 * @file MessageList.sender.test.tsx
 * @description Verifies true transcript sender labels plus safe persisted-image
 * rendering, avoiding blanket user attribution and raw image-path exposure.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/conversation/__tests__/MessageList.sender.test.tsx`
 *
 * Scope
 * Verifies true transcript sender labels plus safe persisted-image rendering, avoiding blanket user
 * attribution and raw image-path exposure.
 *
 * Subjects and collaborators
 * - `../MessageList` — local module imported by this suite.
 * - `../../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 *
 * Suite groups
 * - `MessageList — sender attribution`
 *
 * Protected behavior
 * - labels each row by its sender, not blanket 'User'
 * - falls back to type-based labels when sender is absent (legacy payloads)
 * - renders a persisted transcript image without exposing its source path
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

  it("renders a persisted transcript image without exposing its source path", () => {
    render(
      <MessageList
        loading={false}
        messages={[
          msg({
            content: [
              { type: "image", src: "data:image/png;base64,AA==", alt: "Attached image" },
              { type: "text", text: "Please review this contrast." },
            ],
          }),
        ]}
      />
    );

    const image = screen.getByRole("img", { name: "Attached image" });
    expect(image).toHaveAttribute("src", "data:image/png;base64,AA==");
    expect(screen.getByText("Please review this contrast.")).toBeInTheDocument();
  });
});
