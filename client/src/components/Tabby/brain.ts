/**
 * @file brain.ts
 * @description Pure, framework-free core of the Tabby companion. Reduces the
 *   dashboard's live WebSocket stream into a small mood model and derives the
 *   current cat mood from that model plus the wall clock. Kept side-effect free
 *   so it can be unit-tested without React, timers, or the DOM. The React hook
 *   (`useTabbyBrain`) wires this to the event bus and to real timers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/brain.ts
 * **Area:** client Tabby component
 * **Responsibility:**
 * Pure, framework-free core of the Tabby companion. Reduces the dashboard's live WebSocket stream
 * into a small mood model and derives the current cat mood from that model plus the wall clock.
 * Kept side-effect free so it can be unit-tested without React, timers, or the DOM. The React hook
 * (`useTabbyBrain`) wires this to the event bus and to real timers.
 *
 * ## Architectural boundary
 * - Provides the optional Tabby companion layer without becoming a dependency of core monitoring
 *   workflows.
 * - Intent recognition, state transitions, positioning, and rendering remain separable so
 *   decoration cannot block data views.
 * - Reduced-motion, hidden, and disabled states are first-class outcomes rather than exceptional
 *   branches.
 *
 * ## Local dependency edges
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Public surface
 * - `clearErrors` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `deriveMood` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `FAILURE_EVENT_TYPES` (variable) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `HAPPY_MS` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `initialTabbyState` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `Mood` (type) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `reduceTabby` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `seedSessions` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SLEEP_MS` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `statusOf` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `STUCK_MS` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `TabbyPulse` (type) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `TabbyState` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TabbyStatus` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `WORRIED_MS` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `clearErrors` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `deriveMood` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FAILURE_EVENT_TYPES` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `HAPPY_MS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `initialTabbyState` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `Mood` (type) — top-level declaration that helps orient code review and focused test selection.
 * - `reduceTabby` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `seedSessions` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SLEEP_MS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `statusOf` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STUCK_MS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyPulse` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyState` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyStatus` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `WORRIED_MS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep companion reactions deterministic for a given event/state input when tests assert a
 *   specific response.
 * - Bound timers, animation frames, listeners, and persisted position state; clean them up on
 *   unmount.
 * - Respect reduced-motion preferences and never require animation to communicate dashboard status.
 * - Keep the companion out of keyboard focus order unless an element performs an actual interactive
 *   action.
 * - Constrain dragging and restored coordinates to the current viewport after resizes or display
 *   changes.
 * - Avoid coupling core API requests or monitoring state transitions to companion visibility.
 * - Keep quips and intent vocabulary aligned with the localization decision already established by
 *   the module.
 * - Do not let decorative overlays cover destructive confirmations, navigation, or primary session
 *   controls.
 * - Prefer explicit state-machine transitions over intersecting booleans that allow impossible
 *   poses.
 * - Test cleanup with fake timers where time drives behavior, then restore timer globals after each
 *   case.
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
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/brain.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
 * - `FAILURE_EVENT_TYPES` — exported API; see TSDoc on the symbol for behavior.
 * - `initialTabbyState` — exported API; see TSDoc on the symbol for behavior.
 * - `statusOf` — exported API; see TSDoc on the symbol for behavior.
 * - `deriveMood` — exported API; see TSDoc on the symbol for behavior.
 * - `reduceTabby` — exported API; see TSDoc on the symbol for behavior.
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
  | null;

/**
 * Counts shown in Tabby's panel and status line, derived from {@link TabbyState} by {@link
 * statusOf}.
 */
export interface TabbyStatus {
  /** Active + waiting sessions (everything not finished/errored). */
  liveCount: number;
  /** Subset of liveCount currently blocked on user input. */
  waitingCount: number;
  /** Sessions whose latest known status is error. */
  errorCount: number;
  /** Whether the dashboard WebSocket is connected. */
  connected: boolean;
}

/**
 * Everything Tabby remembers between WebSocket messages. Updated only by {@link reduceTabby}, so
 * mood changes stay pure and testable.
 */
export interface TabbyState {
  /** Whether the dashboard WebSocket is connected; when false the mood is always `disconnected`. */
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
}

/**
 * How long Tabby stays happy after a Run Agent run finishes cleanly, in milliseconds. The timing
 * constants below are tunable.
 */
export const HAPPY_MS = 4000;
/**
 * How long Tabby stays worried after a failure, in milliseconds. Worried outranks every mood except
 * disconnected.
 */
export const WORRIED_MS = 4500;
/** Silence, while sessions are live, after which Tabby looks stuck: 10 minutes. */
export const STUCK_MS = 10 * 60_000;
/** Silence, with nothing live, after which Tabby falls asleep: 3 minutes. */
export const SLEEP_MS = 3 * 60_000;

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

/**
 * Starting state for Tabby: connected, no known sessions, activity stamped at `now`, and no happy
 * or worried window.
 *
 * @param now - Current time in epoch milliseconds.
 * @returns A fresh state.
 */
export function initialTabbyState(now: number): TabbyState {
  return {
    connected: true,
    sessions: {},
    lastActivityAt: now,
    happyUntil: 0,
    worriedUntil: 0,
    thinking: false,
  };
}

/**
 * Count live, waiting, and errored sessions in the state. Waiting sessions also count as live.
 *
 * @param state - Tabby state.
 * @returns The counts plus the connection flag.
 */
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
 *
 * @param state - Current state.
 * @param now - Current time in epoch milliseconds.
 * @returns The mood to show.
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
 *
 * @param state - Current state.
 * @param msg - Incoming WebSocket message.
 * @param now - Current time in epoch milliseconds.
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
        state: { ...state, sessions, happyUntil, worriedUntil, lastActivityAt: now },
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
 * Hydrate session tracking from a REST snapshot (the same data the dashboard
 * fetches on load). Without this, the brain only learns about sessions from
 * live WS deltas that arrive *after* it mounts, so a freshly-loaded page shows
 * "0 live" even when sessions already exist. Merges in non-finished sessions;
 * never clears the error window. Live WS deltas continue to refine this.
 *
 * @param state - Current state.
 * @param rows - Sessions from the REST list.
 * @param now - Current time in epoch milliseconds.
 * @returns The state with those sessions tracked.
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

/**
 * Drop all errored sessions from tracking (used by "clear alerts").
 *
 * @param state - Current state.
 * @returns The state without errored sessions and without the worried window.
 */
export function clearErrors(state: TabbyState): TabbyState {
  const sessions: TabbyState["sessions"] = {};
  for (const [id, s] of Object.entries(state.sessions)) {
    if (s !== "error") sessions[id] = s;
  }
  return { ...state, sessions, worriedUntil: 0 };
}
