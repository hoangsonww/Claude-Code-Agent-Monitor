/**
 * @file useTabbyBrain.ts
 * @description React hook that wires the pure Tabby brain to the live event bus
 *   and to real timers. It is the only unit that subscribes to `eventBus`. It
 *   exposes the derived mood, a status summary, the current speech bubble, and
 *   imperative controls (mute, clear alerts, set thinking) for the UI shell.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/useTabbyBrain.ts
 * **Area:** client Tabby component
 * **Responsibility:**
 * React hook that wires the pure Tabby brain to the live event bus and to real timers. It is the
 * only unit that subscribes to `eventBus` . It exposes the derived mood, a status summary, the
 * current speech bubble, and imperative controls (mute, clear alerts, set thinking) for the UI
 * shell.
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
 * - `../../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./brain` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./prefs` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./quips` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `TabbyBrain` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `useTabbyBrain` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `BUBBLE_MS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `BUBBLE_THROTTLE_MS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `TabbyBrain` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `useTabbyBrain` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/useTabbyBrain.ts`
 *   .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/useTabbyBrain.ts`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome. React hook: isolates side effects and subscription wiring so presentational components stay declarative.
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
 * - `../../lib/eventBus`
 * - `../../lib/api`
 * - `../../lib/types`
 * - `./brain`
 * - `./quips`
 * - `./prefs`
 *
 * ## Public surface
 * - `TabbyBrain` — exported API; see TSDoc on the symbol for behavior.
 * - `useTabbyBrain` — exported API; see TSDoc on the symbol for behavior.
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
 * **TabbyBrain**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **useTabbyBrain**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eventBus } from "../../lib/eventBus";
import { api } from "../../lib/api";
import type { WSMessage } from "../../lib/types";
import {
  initialTabbyState,
  reduceTabby,
  deriveMood,
  statusOf,
  clearErrors,
  seedSessions,
  type Mood,
  type TabbyState,
  type TabbyStatus,
} from "./brain";
import { pickQuip } from "./quips";
import { tabbyPrefs } from "./prefs";

/** How long a speech bubble stays up before it hides itself, in milliseconds. */
const BUBBLE_MS = 4500;
/**
 * Minimum gap between non-error speech bubbles, so a burst of activity does not spam. Error bubbles
 * always show.
 */
const BUBBLE_THROTTLE_MS = 3000;

/** What {@link useTabbyBrain} gives the Tabby widget. */
export interface TabbyBrain {
  /** Current mood, which drives the avatar's animation. */
  mood: Mood;
  /** Live counts for the panel. */
  status: TabbyStatus;
  /** Text of the current speech bubble, or null when none is showing. */
  bubble: string | null;
  /** Hides the current bubble early. */
  dismissBubble: () => void;
  /** Whether speech bubbles are muted; the preference is shared with Settings and other tabs. */
  muted: boolean;
  /** Toggles mute. */
  toggleMute: () => void;
  /** Forgets errored sessions and ends the worried mood, resetting the error count. */
  clearAlerts: () => void;
  /** Marks an Ask request as in flight, which shows the thinking mood. */
  setThinking: (v: boolean) => void;
}

/**
 * Tabby's live brain. Seeds session counts from the REST sessions list on mount, then folds every
 * WebSocket message through `reduceTabby`, turning the resulting pulses into speech bubbles
 * (throttled, except errors). A clock tick re-evaluates timed moods such as stuck and sleeping
 * without needing new events, and mute stays in sync across the Settings page and other tabs.
 * Starts optimistically connected so the eyes are live from the first frame.
 *
 * @returns Mood, counts, bubble, and controls.
 */
export function useTabbyBrain(): TabbyBrain {
  const now0 = Date.now();
  // Start optimistically connected (idle, open eyes) so the cursor-tracking
  // eyes are live from the first frame instead of after the WebSocket finishes
  // its initial handshake. onConnection below corrects this if it's truly down.
  const [state, setState] = useState<TabbyState>(() => ({
    ...initialTabbyState(now0),
    connected: true,
  }));
  const [tick, setTick] = useState(now0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => tabbyPrefs.getMuted());

  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBubbleAt = useRef(0);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Keep mute in sync with the Settings page / other tabs.
  useEffect(() => tabbyPrefs.subscribe(() => setMuted(tabbyPrefs.getMuted())), []);

  /**
   * Show a speech bubble unless muted. Non-forced bubbles are throttled to one per 3 seconds; error
   * bubbles are forced through.
   */
  const showBubble = useCallback((text: string, force: boolean) => {
    if (!text) return;
    if (mutedRef.current) return;
    const t = Date.now();
    if (!force && t - lastBubbleAt.current < BUBBLE_THROTTLE_MS) return;
    lastBubbleAt.current = t;
    clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  // Seed from the REST snapshot on mount so counts are accurate immediately -
  // the brain otherwise only learns about sessions from WS deltas that arrive
  // after it mounts, showing "0 live" on a fresh load even when sessions exist.
  // Pull a generous page of non-finished sessions; live WS deltas refine it.
  useEffect(() => {
    let cancelled = false;
    api.sessions
      .list({ status: "active", limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setState((prev) => seedSessions(prev, res.sessions, Date.now()));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to the live stream and connection status.
  useEffect(() => {
    const unsubMsg = eventBus.subscribe((msg: WSMessage) => {
      const t = Date.now();
      setState((prev) => {
        const { state: next, pulse } = reduceTabby(prev, msg, t);
        if (pulse) showBubble(pickQuip(pulse), pulse === "error");
        return next;
      });
    });
    const unsubConn = eventBus.onConnection((connected) => {
      setState((prev) => ({ ...prev, connected }));
    });
    return () => {
      unsubMsg();
      unsubConn();
    };
  }, [showBubble]);

  // Advance the clock so timed moods (stuck/sleeping, and exit from
  // happy/worried) re-evaluate without needing a new event.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  /** Current mood, re-evaluated on every state change and clock tick. */
  const mood = useMemo(() => deriveMood(state, tick), [state, tick]);
  /** Live counts for the panel. */
  const status = useMemo(() => statusOf(state), [state]);

  /** Hide the current bubble. */
  const dismissBubble = useCallback(() => {
    clearTimeout(bubbleTimer.current);
    setBubble(null);
  }, []);

  /** Toggle mute, persist it, and hide any bubble when muting. */
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    tabbyPrefs.setMuted(next);
    setMuted(next);
    if (next) dismissBubble();
  }, [dismissBubble]);

  /** Forget errored sessions and end the worried mood. */
  const clearAlerts = useCallback(() => setState((prev) => clearErrors(prev)), []);

  /** Mark an Ask request as in flight, skipping the update when nothing changes. */
  const setThinking = useCallback(
    (v: boolean) => setState((prev) => (prev.thinking === v ? prev : { ...prev, thinking: v })),
    []
  );

  return { mood, status, bubble, dismissBubble, muted, toggleMute, clearAlerts, setThinking };
}
