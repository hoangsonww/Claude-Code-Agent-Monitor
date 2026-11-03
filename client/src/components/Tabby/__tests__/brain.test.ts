/**
 * @file brain.test.ts
 * @description Unit tests for the Tabby state brain — initial state, mood transitions driven by dashboard events, and status derivation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/__tests__/brain.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the Tabby state brain — initial state, mood transitions driven by dashboard
 * events, and status derivation.
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
 * - `../brain` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `agentCreatedMsg` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `agentMsg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `eventMsg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `runStatusMsg` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `sessionMsg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `T0` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `waitingMsg` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `a newly created subagent emits subagent_spawn, a main agent does not` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `agent error triggers worried via pulse` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `any handled message refreshes lastActivityAt` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `clearErrors` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `counts a waiting session as both live and waiting` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `counts errored sessions and emits error pulse` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `deriveMood priority` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `disconnected outranks everything` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `drops errored sessions but keeps active ones` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `failure event types set worried, normal events do not` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `happy is transient then falls back to idle when nothing live` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `hydrates live/waiting/errored counts from a REST snapshot` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `idle by default` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `ignores unrelated message types without mutating` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `reduceTabby counts and pulses` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `run_status completed exit 0 is happy, nonzero/error/killed is worried` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `seedSessions` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `session_done pulse only when the session was tracked` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `session_start pulse only on first active transition` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `sleeping after SLEEP_MS of no activity and nothing live` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `statusOf waiting` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `stuck when a live session goes silent past STUCK_MS` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `thinking shows when set and nothing higher applies` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `tracks live count accurately across transitions` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `waiting transition emits a waiting pulse once and still counts as live` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `watching when a session is live and recent` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `worried outranks stuck` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `WORRIED_MS is a positive window` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/__tests__/brain.test.ts`
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
 * Path: `client/src/components/Tabby/__tests__/brain.test.ts`
 *
 * Scope
 * Unit tests for the Tabby state brain — initial state, mood transitions driven by dashboard events,
 * and status derivation.
 *
 * Subjects and collaborators
 * - `../brain` — local module imported by this suite.
 * - `../../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `deriveMood priority`
 * - `reduceTabby counts and pulses`
 * - `seedSessions`
 * - `statusOf waiting`
 * - `clearErrors`
 *
 * Protected behavior
 * - disconnected outranks everything
 * - worried outranks stuck
 * - stuck when a live session goes silent past STUCK_MS
 * - happy is transient then falls back to idle when nothing live
 * - thinking shows when set and nothing higher applies
 * - watching when a session is live and recent
 * - sleeping after SLEEP_MS of no activity and nothing live
 * - idle by default
 * - tracks live count accurately across transitions
 * - counts errored sessions and emits error pulse
 * - session_start pulse only on first active transition
 * - session_done pulse only when the session was tracked
 * - agent error triggers worried via pulse
 * - a newly created subagent emits subagent_spawn, a main agent does not
 * - waiting transition emits a waiting pulse once and still counts as live
 * - failure event types set worried, normal events do not
 * - run_status completed exit 0 is happy, nonzero/error/killed is worried
 * - any handled message refreshes lastActivityAt
 * - ignores unrelated message types without mutating
 * - hydrates live/waiting/errored counts from a REST snapshot
 * - counts a waiting session as both live and waiting
 * - drops errored sessions but keeps active ones
 * - WORRIED_MS is a positive window
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
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect } from "vitest";
import {
  initialTabbyState,
  reduceTabby,
  deriveMood,
  statusOf,
  clearErrors,
  seedSessions,
  HAPPY_MS,
  WORRIED_MS,
  STUCK_MS,
  SLEEP_MS,
  type TabbyState,
} from "../brain";
import type {
  WSMessage,
  Session,
  Agent,
  DashboardEvent,
  RunStatusPayload,
} from "../../../lib/types";

const T0 = 1_000_000;

function sessionMsg(id: string, status: Session["status"], ts = T0): WSMessage {
  return { type: "session_updated", data: { id, status } as Session, timestamp: String(ts) };
}
function agentMsg(status: Agent["status"]): WSMessage {
  return { type: "agent_updated", data: { status } as Agent, timestamp: String(T0) };
}
function agentCreatedMsg(type: Agent["type"], status: Agent["status"] = "working"): WSMessage {
  return { type: "agent_created", data: { type, status } as Agent, timestamp: String(T0) };
}
function waitingMsg(id: string): WSMessage {
  return {
    type: "session_updated",
    data: { id, status: "active", awaiting_input_since: "2026-05-29T00:00:00Z" } as Session,
    timestamp: String(T0),
  };
}
function eventMsg(event_type: string): WSMessage {
  return { type: "new_event", data: { event_type } as DashboardEvent, timestamp: String(T0) };
}
function runStatusMsg(d: Partial<RunStatusPayload>): WSMessage {
  return { type: "run_status", data: d as RunStatusPayload, timestamp: String(T0) };
}

describe("deriveMood priority", () => {
  it("disconnected outranks everything", () => {
    const s: TabbyState = { ...initialTabbyState(T0), connected: false, worriedUntil: T0 + 9999 };
    expect(deriveMood(s, T0)).toBe("disconnected");
  });

  it("worried outranks stuck", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0)); // live
    s = { ...s, lastActivityAt: T0 - STUCK_MS - 1, worriedUntil: T0 + 100 };
    expect(deriveMood(s, T0)).toBe("worried");
  });

  it("stuck when a live session goes silent past STUCK_MS", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    expect(deriveMood(s, T0 + STUCK_MS + 1)).toBe("stuck");
  });

  it("happy is transient then falls back to idle when nothing live", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    ({ state: s } = reduceTabby(s, sessionMsg("a", "completed"), T0)); // no longer live
    expect(deriveMood(s, T0 + 10)).toBe("happy");
    expect(deriveMood(s, T0 + HAPPY_MS + 1)).toBe("idle");
  });

  it("thinking shows when set and nothing higher applies", () => {
    const s = { ...initialTabbyState(T0), thinking: true };
    expect(deriveMood(s, T0)).toBe("thinking");
  });

  it("watching when a session is live and recent", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    expect(deriveMood(s, T0 + 1000)).toBe("watching");
  });

  it("sleeping after SLEEP_MS of no activity and nothing live", () => {
    const s = initialTabbyState(T0);
    expect(deriveMood(s, T0 + SLEEP_MS + 1)).toBe("sleeping");
  });

  it("idle by default", () => {
    expect(deriveMood(initialTabbyState(T0), T0)).toBe("idle");
  });
});

describe("reduceTabby counts and pulses", () => {
  it("tracks live count accurately across transitions", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    ({ state: s } = reduceTabby(s, sessionMsg("b", "active"), T0));
    expect(statusOf(s).liveCount).toBe(2);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "completed"), T0));
    expect(statusOf(s).liveCount).toBe(1);
  });

  it("counts errored sessions and emits error pulse", () => {
    let s = initialTabbyState(T0);
    const r = reduceTabby(s, sessionMsg("a", "error"), T0);
    s = r.state;
    expect(r.pulse).toBe("error");
    expect(statusOf(s).errorCount).toBe(1);
    expect(deriveMood(s, T0)).toBe("worried");
  });

  it("session_start pulse only on first active transition", () => {
    let s = initialTabbyState(T0);
    const r1 = reduceTabby(s, sessionMsg("a", "active"), T0);
    expect(r1.pulse).toBe("session_start");
    const r2 = reduceTabby(r1.state, sessionMsg("a", "active"), T0);
    expect(r2.pulse).toBe(null);
  });

  it("session_done pulse only when the session was tracked", () => {
    let s = initialTabbyState(T0);
    const untracked = reduceTabby(s, sessionMsg("ghost", "completed"), T0);
    expect(untracked.pulse).toBe(null);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    const done = reduceTabby(s, sessionMsg("a", "completed"), T0);
    expect(done.pulse).toBe("session_done");
  });

  it("agent error triggers worried via pulse", () => {
    const r = reduceTabby(initialTabbyState(T0), agentMsg("error"), T0);
    expect(r.pulse).toBe("error");
    expect(deriveMood(r.state, T0)).toBe("worried");
  });

  it("a newly created subagent emits subagent_spawn, a main agent does not", () => {
    expect(reduceTabby(initialTabbyState(T0), agentCreatedMsg("subagent"), T0).pulse).toBe(
      "subagent_spawn"
    );
    expect(reduceTabby(initialTabbyState(T0), agentCreatedMsg("main"), T0).pulse).toBe(null);
  });

  it("waiting transition emits a waiting pulse once and still counts as live", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0)); // active
    const first = reduceTabby(s, waitingMsg("a"), T0);
    expect(first.pulse).toBe("waiting");
    expect(statusOf(first.state).liveCount).toBe(1);
    // A repeat waiting update does not re-announce.
    const second = reduceTabby(first.state, waitingMsg("a"), T0);
    expect(second.pulse).toBe(null);
  });

  it("failure event types set worried, normal events do not", () => {
    const fail = reduceTabby(initialTabbyState(T0), eventMsg("toolError"), T0);
    expect(fail.pulse).toBe("error");
    const ok = reduceTabby(initialTabbyState(T0), eventMsg("postToolUse"), T0);
    expect(ok.pulse).toBe(null);
    expect(ok.state.worriedUntil).toBe(0);
  });

  it("run_status completed exit 0 is happy, nonzero/error/killed is worried", () => {
    const good = reduceTabby(
      initialTabbyState(T0),
      runStatusMsg({ status: "completed", exitCode: 0 }),
      T0
    );
    expect(good.pulse).toBe("run_done");
    expect(deriveMood(good.state, T0)).toBe("happy");
    const bad = reduceTabby(
      initialTabbyState(T0),
      runStatusMsg({ status: "completed", exitCode: 1 }),
      T0
    );
    expect(bad.pulse).toBe("error");
    const err = reduceTabby(initialTabbyState(T0), runStatusMsg({ status: "error" }), T0);
    expect(err.pulse).toBe("error");
    const killed = reduceTabby(initialTabbyState(T0), runStatusMsg({ status: "killed" }), T0);
    expect(killed.pulse).toBe("error");
    const running = reduceTabby(initialTabbyState(T0), runStatusMsg({ status: "running" }), T0);
    expect(running.pulse).toBe(null);
  });

  it("any handled message refreshes lastActivityAt", () => {
    const s = { ...initialTabbyState(T0), lastActivityAt: T0 - 99999 };
    const { state } = reduceTabby(s, eventMsg("postToolUse"), T0 + 5);
    expect(state.lastActivityAt).toBe(T0 + 5);
  });

  it("ignores unrelated message types without mutating", () => {
    const s = initialTabbyState(T0);
    const r = reduceTabby(s, { type: "import.progress", data: {} as never, timestamp: "x" }, T0);
    expect(r.state).toBe(s);
    expect(r.pulse).toBe(null);
  });
});

describe("seedSessions", () => {
  it("hydrates live/waiting/errored counts from a REST snapshot", () => {
    const s = seedSessions(
      initialTabbyState(T0),
      [
        { id: "a", status: "active" },
        { id: "b", status: "active", awaiting_input_since: "2026-05-29T00:00:00Z" },
        { id: "c", status: "error" },
        { id: "d", status: "completed" }, // ignored
      ],
      T0
    );
    const st = statusOf(s);
    expect(st.liveCount).toBe(2); // a + b
    expect(st.waitingCount).toBe(1); // b
    expect(st.errorCount).toBe(1); // c
  });
});

describe("statusOf waiting", () => {
  it("counts a waiting session as both live and waiting", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, waitingMsg("a"), T0));
    expect(statusOf(s)).toMatchObject({ liveCount: 1, waitingCount: 1, errorCount: 0 });
  });
});

describe("clearErrors", () => {
  it("drops errored sessions but keeps active ones", () => {
    let s = initialTabbyState(T0);
    ({ state: s } = reduceTabby(s, sessionMsg("a", "active"), T0));
    ({ state: s } = reduceTabby(s, sessionMsg("b", "error"), T0));
    s = clearErrors(s);
    expect(statusOf(s).errorCount).toBe(0);
    expect(statusOf(s).liveCount).toBe(1);
    expect(s.worriedUntil).toBe(0);
  });
});

// Reference the imported constant so it is exercised and tsc-clean.
it("WORRIED_MS is a positive window", () => {
  expect(WORRIED_MS).toBeGreaterThan(0);
});
