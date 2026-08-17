/**
 * @file useTabbyBrain.ts
 * @description React hook that wires the pure Tabby brain to the live event bus
 *   and to real timers. It is the only unit that subscribes to `eventBus`. It
 *   exposes the derived mood, a status summary, the current speech bubble, and
 *   imperative controls (mute, clear alerts, set thinking) for the UI shell.
 * @author Son Nguyen <hoangson091104@gmail.com>
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

const BUBBLE_MS = 4500;
// Minimum gap between non-error bubbles, so a burst of activity doesn't spam.
const BUBBLE_THROTTLE_MS = 3000;

export interface TabbyBrain {
  mood: Mood;
  status: TabbyStatus;
  bubble: string | null;
  dismissBubble: () => void;
  muted: boolean;
  toggleMute: () => void;
  clearAlerts: () => void;
  setThinking: (v: boolean) => void;
}

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

  const mood = useMemo(() => deriveMood(state, tick), [state, tick]);
  const status = useMemo(() => statusOf(state), [state]);

  const dismissBubble = useCallback(() => {
    clearTimeout(bubbleTimer.current);
    setBubble(null);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    tabbyPrefs.setMuted(next);
    setMuted(next);
    if (next) dismissBubble();
  }, [dismissBubble]);

  const clearAlerts = useCallback(() => setState((prev) => clearErrors(prev)), []);

  const setThinking = useCallback(
    (v: boolean) => setState((prev) => (prev.thinking === v ? prev : { ...prev, thinking: v })),
    []
  );

  return { mood, status, bubble, dismissBubble, muted, toggleMute, clearAlerts, setThinking };
}
