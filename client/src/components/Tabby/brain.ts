/**
 * @file brain.ts
 * @description Pure, framework-free core of the Tabby companion. Reduces the
 *   dashboard's live WebSocket stream into a small mood model and derives the
 *   current cat mood from that model plus the wall clock. Kept side-effect free
 *   so it can be unit-tested without React, timers, or the DOM. The React hook
 *   (`useTabbyBrain`) wires this to the event bus and to real timers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/brain.ts`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../../lib/types`
 *
 * ## Public surface
 * - `Mood` — exported API; see TSDoc on the symbol for behavior.
 * - `TabbyPulse` — exported API; see TSDoc on the symbol for behavior.
 * - `TabbyStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `TabbyState` — exported API; see TSDoc on the symbol for behavior.
 * - `HAPPY_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `WORRIED_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `STUCK_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `SLEEP_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `EXPENSIVE_MODEL_MS` — exported API; see TSDoc on the symbol for behavior.
 * - `FAILURE_EVENT_TYPES` — exported API; see TSDoc on the symbol for behavior.
 * - `initialTabbyState` — exported API; see TSDoc on the symbol for behavior.
 * - `statusOf` — exported API; see TSDoc on the symbol for behavior.
 * - `deriveMood` — exported API; see TSDoc on the symbol for behavior.
 * - `reduceTabby` — exported API; see TSDoc on the symbol for behavior.
 * - `checkExpensiveModel` — exported API; see TSDoc on the symbol for behavior.
 * - `seedSessions` — exported API; see TSDoc on the symbol for behavior.
 * - `clearErrors` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **Mood**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TabbyPulse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TabbyStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TabbyState**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **HAPPY_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WORRIED_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **STUCK_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SLEEP_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EXPENSIVE_MODEL_MS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **FAILURE_EVENT_TYPES**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **initialTabbyState**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **statusOf**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **deriveMood**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **reduceTabby**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **checkExpensiveModel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **seedSessions**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **clearErrors**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { WSMessage, Session, Agent, RunStatusPayload, DashboardEvent } from "../../lib/types";

/** All moods Tabby can express, highest priority first (see `deriveMood`). */
export type Mood =
  | "disconnected"
  | "worried"
  | "stuck"
  | "happy"
  | "thinking"
  | "watching"
  | "sleeping"
  | "idle";

/**
 * A one-shot signal describing what just happened, emitted by `reduceTabby`.
 * The hook turns pulses into transient speech bubbles. `null` means the message
 * was irrelevant or non-notable.
 */
export type TabbyPulse =
  | "session_done"
  | "session_start"
  | "subagent_spawn"
  | "waiting"
  | "error"
  | "run_done"
  | "expensive_model"
  | null;

export interface TabbyStatus {
  /** Active + waiting sessions (everything not finished/errored). */
  liveCount: number;
  /** Subset of liveCount currently blocked on user input. */
  waitingCount: number;
  errorCount: number;
  connected: boolean;
}

export interface TabbyState {
  connected: boolean;
  /** Latest status per session id we still care about. "waiting" = active but
   *  blocked on user input; counts as live for the status line. */
  sessions: Record<string, "active" | "error" | "waiting">;
  /** Epoch ms of the last meaningful activity; drives stuck/sleeping. */
  lastActivityAt: number;
  /** While `now < happyUntil`, mood can be `happy`. */
  happyUntil: number;
  /** While `now < worriedUntil`, mood can be `worried`. */
  worriedUntil: number;
  /** True while an Ask request is in flight (panel). */
  thinking: boolean;
  /** Epoch ms each live session first started reporting an expensive model
   *  (opus/fable), keyed by session id. Absent while the session isn't on
   *  one. Cleared when the model changes away or the session stops tracking. */
  expensiveModelSince: Record<string, number>;
  /** Session ids already nagged about their current expensive-model streak,
   *  so the periodic tick check fires the pulse once per streak, not every
   *  second past the threshold. Cleared alongside `expensiveModelSince`. */
  expensiveModelNagged: Record<string, boolean>;
}

// Tunable timing constants (ms).
export const HAPPY_MS = 4000;
export const WORRIED_MS = 4500;
export const STUCK_MS = 10 * 60_000;
export const SLEEP_MS = 3 * 60_000;
/** How long a session can run an expensive model (opus/fable) before Tabby
 *  nags about it. */
export const EXPENSIVE_MODEL_MS = 15 * 60_000;

/** Model families billed at the premium tier - matched by substring so any
 *  dated/tagged id ("claude-opus-4-8-20260101", "claude-fable-5") still hits.
 *  Duplicated from `lib/format.ts`'s `isExpensiveModel` rather than imported,
 *  so this module stays side-effect free and independently testable (see
 *  file header). */
function isExpensiveModel(model: string | null | undefined): boolean {
  if (!model) return false;
  const lower = model.toLowerCase();
  return lower.includes("opus") || lower.includes("fable");
}

/** Event types from the hook ingestion that represent a genuine failure. */
export const FAILURE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "error",
  "toolError",
  "agentError",
  "subagentError",
  "errorEvent",
  "errorReport",
  "errorBoundary",
  "crashReport",
  "diagnosticError",
]);

export function initialTabbyState(now: number): TabbyState {
  return {
    connected: true,
    sessions: {},
    lastActivityAt: now,
    happyUntil: 0,
    worriedUntil: 0,
    thinking: false,
    expensiveModelSince: {},
    expensiveModelNagged: {},
  };
}

export function statusOf(state: TabbyState): TabbyStatus {
  let liveCount = 0;
  let waitingCount = 0;
  let errorCount = 0;
  for (const s of Object.values(state.sessions)) {
    if (s === "active" || s === "waiting") {
      liveCount++;
      if (s === "waiting") waitingCount++;
    } else if (s === "error") errorCount++;
  }
  return { liveCount, waitingCount, errorCount, connected: state.connected };
}

/**
 * Pure mood resolver. Highest-priority matching state wins. `now` is injected
 * so callers (and tests) control the clock; transient windows (happy/worried)
 * and inactivity windows (stuck/sleeping) are evaluated against it.
 */
export function deriveMood(state: TabbyState, now: number): Mood {
  if (!state.connected) return "disconnected";
  if (now < state.worriedUntil) return "worried";

  const { liveCount } = statusOf(state);
  const silent = now - state.lastActivityAt;

  if (liveCount > 0 && silent > STUCK_MS) return "stuck";
  if (now < state.happyUntil) return "happy";
  if (state.thinking) return "thinking";
  if (liveCount > 0) return "watching";
  if (silent > SLEEP_MS) return "sleeping";
  return "idle";
}

/**
 * Fold a single WebSocket message into the Tabby state. Returns the next state
 * (new object) and a one-shot pulse describing what happened. Unknown or
 * irrelevant message types pass through unchanged with a `null` pulse.
 */
export function reduceTabby(
  state: TabbyState,
  msg: WSMessage,
  now: number
): { state: TabbyState; pulse: TabbyPulse } {
  switch (msg.type) {
    case "session_created":
    case "session_updated": {
      const s = msg.data as Session;
      if (!s || !s.id) return { state, pulse: null };
      const sessions = { ...state.sessions };
      let pulse: TabbyPulse = null;
      let happyUntil = state.happyUntil;
      let worriedUntil = state.worriedUntil;

      // Track how long this session has been on an expensive model so the
      // periodic tick (see `checkExpensiveModel`) can nag past EXPENSIVE_MODEL_MS.
      // Cleared as soon as it's no longer live on that model, so a model switch
      // or session end resets the clock rather than nagging about a stale streak.
      let expensiveModelSince = state.expensiveModelSince;
      let expensiveModelNagged = state.expensiveModelNagged;
      if (s.status === "active" && isExpensiveModel(s.model)) {
        if (!(s.id in expensiveModelSince)) {
          expensiveModelSince = { ...expensiveModelSince, [s.id]: now };
        }
      } else if (s.id in expensiveModelSince) {
        expensiveModelSince = { ...expensiveModelSince };
        delete expensiveModelSince[s.id];
        if (s.id in expensiveModelNagged) {
          expensiveModelNagged = { ...expensiveModelNagged };
          delete expensiveModelNagged[s.id];
        }
      }

      if (s.status === "active") {
        // "waiting" = active session blocked on user input (permission prompt
        // or sitting at a fresh prompt). Announce the transition once each way.
        const isWaiting = !!s.awaiting_input_since;
        const prev = sessions[s.id];
        if (isWaiting) {
          sessions[s.id] = "waiting";
          if (prev !== "waiting") pulse = "waiting";
        } else {
          sessions[s.id] = "active";
          if (prev === undefined) pulse = "session_start";
        }
      } else if (s.status === "error") {
        sessions[s.id] = "error";
        worriedUntil = now + WORRIED_MS;
        pulse = "error";
      } else if (s.status === "completed" || s.status === "abandoned") {
        const wasTracked = s.id in sessions;
        delete sessions[s.id];
        if (s.status === "completed") {
          happyUntil = now + HAPPY_MS;
          if (wasTracked) pulse = "session_done";
        }
      }

      return {
        state: {
          ...state,
          sessions,
          happyUntil,
          worriedUntil,
          lastActivityAt: now,
          expensiveModelSince,
          expensiveModelNagged,
        },
        pulse,
      };
    }

    case "agent_created": {
      const a = msg.data as Agent;
      if (a && a.status === "error") {
        return {
          state: { ...state, worriedUntil: now + WORRIED_MS, lastActivityAt: now },
          pulse: "error",
        };
      }
      // A freshly spawned subagent is worth announcing; the main agent landing
      // is already covered by session_start.
      const pulse: TabbyPulse = a && a.type === "subagent" ? "subagent_spawn" : null;
      return { state: { ...state, lastActivityAt: now }, pulse };
    }

    case "agent_updated": {
      const a = msg.data as Agent;
      if (a && a.status === "error") {
        return {
          state: { ...state, worriedUntil: now + WORRIED_MS, lastActivityAt: now },
          pulse: "error",
        };
      }
      return { state: { ...state, lastActivityAt: now }, pulse: null };
    }

    case "new_event": {
      const e = msg.data as DashboardEvent;
      const isFailure = !!e && FAILURE_EVENT_TYPES.has(e.event_type);
      return {
        state: {
          ...state,
          lastActivityAt: now,
          worriedUntil: isFailure ? now + WORRIED_MS : state.worriedUntil,
        },
        pulse: isFailure ? "error" : null,
      };
    }

    case "run_status": {
      const r = msg.data as RunStatusPayload;
      if (!r) return { state, pulse: null };
      // A run that finished cleanly (exit 0, or no exit code reported) → happy.
      if (r.status === "completed" && (r.exitCode == null || r.exitCode === 0)) {
        return {
          state: { ...state, happyUntil: now + HAPPY_MS, lastActivityAt: now },
          pulse: "run_done",
        };
      }
      // Errored, killed, or completed with a nonzero exit code → worried.
      if (
        r.status === "error" ||
        r.status === "killed" ||
        (r.status === "completed" && r.exitCode != null && r.exitCode !== 0)
      ) {
        return {
          state: { ...state, worriedUntil: now + WORRIED_MS, lastActivityAt: now },
          pulse: "error",
        };
      }
      // spawning / running → activity only.
      return { state: { ...state, lastActivityAt: now }, pulse: null };
    }

    case "run_stream":
      // Streaming output counts as activity but is not itself notable.
      return { state: { ...state, lastActivityAt: now }, pulse: null };

    default:
      return { state, pulse: null };
  }
}

/**
 * Wall-clock-only check (no WS message involved) for sessions that have been
 * sitting on an expensive model past `EXPENSIVE_MODEL_MS`. The hook re-runs
 * this on every tick alongside `deriveMood`, since nothing else may arrive
 * for the full 15 minutes to trigger the nag from `reduceTabby` alone.
 * Returns at most one pulse per call (the first unnagged session found) -
 * further sessions past threshold are caught on the next tick.
 */
export function checkExpensiveModel(
  state: TabbyState,
  now: number
): { state: TabbyState; pulse: TabbyPulse } {
  for (const [id, since] of Object.entries(state.expensiveModelSince)) {
    if (state.expensiveModelNagged[id]) continue;
    if (now - since >= EXPENSIVE_MODEL_MS) {
      return {
        state: {
          ...state,
          expensiveModelNagged: { ...state.expensiveModelNagged, [id]: true },
        },
        pulse: "expensive_model",
      };
    }
  }
  return { state, pulse: null };
}

/**
 * Hydrate session tracking from a REST snapshot (the same data the dashboard
 * fetches on load). Without this, the brain only learns about sessions from
 * live WS deltas that arrive *after* it mounts, so a freshly-loaded page shows
 * "0 live" even when sessions already exist. Merges in non-finished sessions;
 * never clears the error window. Live WS deltas continue to refine this.
 */
export function seedSessions(
  state: TabbyState,
  rows: ReadonlyArray<{ id: string; status: string; awaiting_input_since?: string | null }>,
  now: number
): TabbyState {
  const sessions = { ...state.sessions };
  for (const r of rows) {
    if (!r || !r.id) continue;
    if (r.status === "error") sessions[r.id] = "error";
    else if (r.status === "active") sessions[r.id] = r.awaiting_input_since ? "waiting" : "active";
    // completed / abandoned: leave untracked.
  }
  return { ...state, sessions, lastActivityAt: now };
}

/** Drop all errored sessions from tracking (used by "clear alerts"). */
export function clearErrors(state: TabbyState): TabbyState {
  const sessions: TabbyState["sessions"] = {};
  for (const [id, s] of Object.entries(state.sessions)) {
    if (s !== "error") sessions[id] = s;
  }
  return { ...state, sessions, worriedUntil: 0 };
}
