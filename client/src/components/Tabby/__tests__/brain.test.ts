/**
 * @file brain.test.ts
 * @description Unit tests for the Tabby state brain — initial state, mood transitions driven by dashboard events, and status derivation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
