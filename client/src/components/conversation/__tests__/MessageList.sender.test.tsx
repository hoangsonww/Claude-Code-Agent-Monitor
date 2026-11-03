/**
 * @file MessageList.sender.test.tsx
 * @description Verifies true transcript sender labels plus safe persisted-image
 * rendering, avoiding blanket user attribution and raw image-path exposure.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/__tests__/MessageList.sender.test.tsx
 * **Area:** client test
 * **Responsibility:**
 * Verifies true transcript sender labels plus safe persisted-image rendering, avoiding blanket user
 * attribution and raw image-path exposure.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../MessageList` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `msg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `falls back to type-based labels when sender is absent (legacy payloads)` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `labels each row by its sender, not blanket 'User'` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `MessageList — sender attribution` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `renders a persisted transcript image without exposing its source path` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/__tests__/MessageList.sender.test.tsx`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
