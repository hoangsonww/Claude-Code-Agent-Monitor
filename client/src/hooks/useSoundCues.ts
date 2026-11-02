/**
 * @file useSoundCues.ts
 * @description React hook that turns dashboard activity into subtle audio cues.
 * Subscribes to the in-memory `eventBus` (WebSocket fan-out) and the socket's
 * connection state, mapping each interesting message to a synthesized cue from
 * `lib/sound`. Also installs a single delegated pointer listener that plays a
 * near-silent tick when the user activates a button, link, or tab - one
 * listener at the root instead of an `onClick` in every component. Mount once
 * at the app root; all gating, throttling, and preference reads live in
 * `lib/sound`, so toggling a Settings switch takes effect immediately.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/hooks/useSoundCues.ts
 * **Area:** client hook
 * **Responsibility:**
 * React hook that turns dashboard activity into subtle audio cues. Subscribes to the in-memory
 * `eventBus` (WebSocket fan-out) and the socket's connection state, mapping each interesting
 * message to a synthesized cue from `lib/sound` . Also installs a single delegated pointer listener
 * that plays a near-silent tick when the user activates a button, link, or tab - one listener at
 * the root instead of an `onClick` in every component. Mount once at the app root; all gating,
 * throttling, and preference reads live in `lib/sound` , so toggling a Settings switch takes effect
 * immediately.
 *
 * ## Architectural boundary
 * - Owns a reusable React side-effect or stateful subscription while exposing a small declarative
 *   interface.
 * - The hook is responsible for setup, freshness, cleanup, and race handling; consumers should not
 *   duplicate that lifecycle.
 * - Shared transport and API semantics remain in library modules rather than being hidden inside
 *   component-specific closures.
 *
 * ## Local dependency edges
 * - `../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/sound` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `useSoundCues` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `INTERACTIVE_SELECTOR` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `MAX_TRACKED_SESSIONS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `useSoundCues` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 *
 * ## Area invariants
 * - List every reactive dependency honestly or use stable refs intentionally with an explanatory
 *   comment.
 * - Clean up timers, sockets, observers, media objects, DOM listeners, and event-bus subscriptions
 *   on every exit path.
 * - Prevent stale async completions from updating state after unmount, reconnection, or parameter
 *   changes.
 * - Keep StrictMode mount-cleanup-remount behavior free of duplicate subscriptions and duplicate
 *   messages.
 * - Use functional state updates when the next value depends on the previous value across
 *   asynchronous callbacks.
 * - Keep callbacks stable only when consumers benefit; unnecessary memoization makes dependency
 *   contracts harder to audit.
 * - Surface recoverable status to consumers rather than swallowing failures into a permanently
 *   stale state.
 * - Do not expose mutable internal refs as if they were stable public state.
 * - Keep browser-only globals inside effect or capability checks so tests and non-browser tooling
 *   can load the module.
 * - Test mount, update, cleanup, failure, and retry behavior with the narrowest realistic
 *   dependency boundary.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/hooks/useSoundCues.ts` .
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
 * **Path:** `client/src/hooks/useSoundCues.ts`
 * **Purpose:** React hook: isolates side effects and subscription wiring so presentational components stay declarative.
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
 * - `../lib/eventBus`
 * - `../lib/sound`
 * - `../lib/types`
 *
 * ## Public surface
 * - `useSoundCues` — exported API; see TSDoc on the symbol for behavior.
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
 * **useSoundCues**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect } from "react";
import { eventBus } from "../lib/eventBus";
import { installSoundUnlock, playCue, unlockSound } from "../lib/sound";
import type { WSMessage, Session, Agent, DashboardEvent } from "../lib/types";

/** Selector for elements whose activation earns an interaction tick. Limited to
 *  genuine controls so that plain text clicks and drags stay silent. */
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], summary, input[type="checkbox"], input[type="radio"]';

/** Upper bound on the per-session status map backing the error-cue dedup. */
const MAX_TRACKED_SESSIONS = 500;

/**
 * Wires dashboard events to audio cues for the lifetime of the component.
 * Takes no props and returns nothing - mount it once, next to
 * {@link useNotifications}, in the app root.
 */
export function useSoundCues() {
  useEffect(() => {
    const removeUnlock = installSoundUnlock();

    // Delegated interaction tick. Uses `pointerdown` on the capture phase so
    // the cue lands with the press rather than after a handler runs (and still
    // fires for controls that stop propagation).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const control = target.closest(INTERACTIVE_SELECTOR);
      if (!control) return;
      if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") {
        return;
      }
      // This handler runs on the capture phase, ahead of installSoundUnlock's
      // bubble-phase listener, so unlock here or the very first tick is lost.
      unlockSound();
      playCue("click");
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });

    // A session that stays in the error state keeps emitting `session_updated`.
    // Remember the last status per session so the cue marks the transition into
    // `error` rather than replaying once per cooldown window while it sits there.
    const lastStatus = new Map<string, string>();

    const unsubscribeConnection = eventBus.onConnection((connected) => {
      playCue(connected ? "connected" : "disconnected");
    });

    const unsubscribeMessages = eventBus.subscribe((msg: WSMessage) => {
      switch (msg.type) {
        case "session_created":
          playCue("sessionStart");
          break;
        case "session_updated": {
          const session = msg.data as Session;
          const previous = lastStatus.get(session.id);
          if (session.status !== previous) {
            // Bound the map so a long-lived tab tracking many sessions cannot
            // grow it without limit; the oldest insertion is the first key.
            if (!lastStatus.has(session.id) && lastStatus.size >= MAX_TRACKED_SESSIONS) {
              const oldest = lastStatus.keys().next().value;
              if (oldest !== undefined) lastStatus.delete(oldest);
            }
            lastStatus.set(session.id, session.status);
            if (session.status === "error") playCue("sessionError");
          }
          break;
        }
        case "agent_created": {
          const agent = msg.data as Agent;
          if (agent.type === "subagent") playCue("subagentSpawn");
          break;
        }
        case "new_event": {
          const event = msg.data as DashboardEvent;
          if (event.event_type === "Stop" || event.event_type === "SessionEnd") {
            playCue("sessionComplete");
          } else if (event.event_type === "Notification") {
            playCue("notification");
          }
          break;
        }
      }
    });

    return () => {
      removeUnlock();
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      unsubscribeConnection();
      unsubscribeMessages();
      lastStatus.clear();
    };
  }, []);
}
