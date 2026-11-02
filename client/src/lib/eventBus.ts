/**
 * @file eventBus.ts
 * @description Implements a simple event bus for managing WebSocket messages and connection status in the agent dashboard application. It allows components to subscribe to real-time updates from the server and react to changes in WebSocket connectivity. The event bus maintains a list of handlers for incoming messages and connection status changes, providing a clean interface for publishing events and managing subscriptions.
 *
 * ## Design
 * This is a module-level singleton (there is exactly one bus per browser tab) built on
 * two `Set`s of callbacks. It exists to break the one-to-many coupling between the single
 * WebSocket connection and the many UI components that care about it:
 *   - The producer side is the `useWebSocket` hook, which owns the actual socket and calls
 *     {@link eventBus.publish} for every inbound frame and {@link eventBus.setConnected}
 *     on open/close.
 *   - The consumer side is any component that calls {@link eventBus.subscribe} (for message
 *     data) or {@link eventBus.onConnection} (for a connectivity indicator), typically from
 *     a `useEffect`, and calls the returned unsubscribe function on cleanup.
 *
 * ## Why `Set` (not array)?
 * A `Set` gives O(1) add/delete and, crucially, natural idempotency: subscribing the same
 * handler reference twice registers it once, and the returned disposer removes exactly that
 * reference. Handlers are notified in insertion order (Set iteration order).
 *
 * ## Delivery semantics
 * Dispatch is synchronous and fire-and-forget: {@link eventBus.publish} iterates the current
 * handler set and calls each in turn. There is no error isolation, so a handler that throws
 * will abort the remaining handlers for that message - subscribers should keep their work
 * cheap and defensive. There is also no buffering: a message published while nobody is
 * subscribed is simply dropped.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/eventBus.ts
 * **Area:** client library
 * **Responsibility:**
 * Implements a simple event bus for managing WebSocket messages and connection status in the agent
 * dashboard application. It allows components to subscribe to real-time updates from the server and
 * react to changes in WebSocket connectivity. The event bus maintains a list of handlers for
 * incoming messages and connection status changes, providing a clean interface for publishing
 * events and managing subscriptions. ## Design This is a module-level singleton (there is exactly
 * one bus per browser tab) built on two `Set` s of callbacks. It exists to break the one-to-many
 * coupling between the single WebSocket connection and the many UI components that care about it: -
 * The producer side is the `useWebSocket` hook, which owns the actual socket and calls {@link
 * eventBus.publish} for every inbound frame and {@link eventBus.setConnected} on open/close. - The
 * consumer side is any component that calls {@link eventBus.subscribe} (for message data) or {@link
 * eventBus.onConnection} (for a connectivity indicator), typically from a `useEffect` , and calls
 * the returned unsubscribe function on cleanup. ## Why `Set` (not array)? A `Set` gives O(1)
 * add/delete and, crucially, natural idempotency: subscribing the same handler reference twice
 * registers it once, and the returned disposer removes exactly that reference. Handlers are
 * notified in insertion order (Set iteration order). ## Delivery semantics Dispatch is synchronous
 * and fire-and-forget: {@link eventBus.publish} iterates the current handler set and calls each in
 * turn. There is no error isolation, so a handler that throws will abort the remaining handlers for
 * that message - subscribers should keep their work cheap and defensive. There is also no
 * buffering: a message published while nobody is subscribed is simply dropped.
 *
 * ## Architectural boundary
 * - Provides shared typed behavior or wire contracts consumed by multiple client screens and
 *   components.
 * - Keep functions deterministic and side effects explicit; central helpers amplify both correct
 *   behavior and regressions.
 * - Types mirroring server payloads must stay aligned with serializers, OpenAPI descriptions, and
 *   WebSocket messages.
 *
 * ## Local dependency edges
 * - `./types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Public surface
 * - `eventBus` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ConnectionHandler` (type) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `connectionHandlers` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `eventBus` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Handler` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `handlers` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `wsConnected` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Preserve null, undefined, zero, and empty distinctions when they carry different server or
 *   presentation meaning.
 * - Do not mutate caller-owned collections in formatters, mergers, grouping helpers, or selectors.
 * - Keep stable sorting and tie-breakers explicit so live updates do not reorder equal records
 *   unpredictably.
 * - Use exhaustive checks for discriminated unions when new providers, messages, or statuses can be
 *   added.
 * - Keep URL construction encoded and route through shared auth/source-scope behavior.
 * - Return errors with enough context for the UI to explain the failed action without leaking
 *   secrets.
 * - Avoid browser globals at module evaluation time unless the module is deliberately browser-only
 *   and tested as such.
 * - Keep formatting locale-aware where the chosen UI language, not the browser default, owns the
 *   output.
 * - Document non-obvious thresholds, unit conversions, and compatibility fallbacks beside their
 *   definitions.
 * - Add table-driven tests for boundary values because library helpers often serve many visually
 *   unrelated screens.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/eventBus.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/lib/eventBus.ts`
 * **Purpose:** In-memory pub/sub bus bridging `useWebSocket` to any page without prop drilling.
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
 * - `./types`
 *
 * ## Public surface
 * - `eventBus` — exported API; see TSDoc on the symbol for behavior.
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
 * **eventBus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { WSMessage } from "./types";

/** Callback invoked with every message received from the dashboard WebSocket. */
type Handler = (msg: WSMessage) => void;
/** Callback invoked whenever the WebSocket connection state changes. */
type ConnectionHandler = (connected: boolean) => void;

// --- Module-private subscription state (the single source of truth per tab) ---
/** All active message subscribers; iterated on every {@link eventBus.publish}. */
const handlers = new Set<Handler>();
/** All active connection-state subscribers; iterated on every {@link eventBus.setConnected}. */
const connectionHandlers = new Set<ConnectionHandler>();
/** Latest known socket state; the backing store for the {@link eventBus.connected} getter. */
let wsConnected = false;

/**
 * Process-wide pub/sub singleton that decouples the single WebSocket
 * connection (owned by `useWebSocket`, which calls {@link publish}/
 * {@link setConnected}) from the many components that want to react to
 * server pushes or show a connection indicator. Any number of components can
 * {@link subscribe}/{@link onConnection} independently of whether they're
 * mounted at the same time as the socket itself.
 */
export const eventBus = {
  /**
   * Registers a handler for every {@link WSMessage} the socket receives.
   * @param handler Called synchronously with each message, in subscription order.
   * @returns An unsubscribe function; call it (e.g. in a `useEffect` cleanup)
   *   to stop receiving messages and avoid a memory leak.
   */
  subscribe(handler: Handler): () => void {
    handlers.add(handler); // idempotent: re-adding the same reference is a no-op
    return () => handlers.delete(handler); // disposer removes exactly this handler
  },

  /** Broadcasts `msg` to every currently-subscribed {@link Handler}. Called by
   *  `useWebSocket` on each parsed inbound frame - not intended to be called
   *  directly by UI code. Dispatch is synchronous and in subscription order; a
   *  throwing handler aborts delivery to the handlers after it.
   *
   * @param msg - Message to deliver to every subscriber.
   */
  publish(msg: WSMessage): void {
    handlers.forEach((handler) => handler(msg)); // notify each subscriber in turn
  },

  /** Current WebSocket connection state, as last reported via {@link setConnected}. */
  get connected(): boolean {
    return wsConnected;
  },

  /** Updates the shared connection flag and notifies every {@link onConnection}
   *  listener. Called by `useWebSocket` on socket open/close.
   *
   * @param value - Whether the WebSocket is connected.
   */
  setConnected(value: boolean): void {
    wsConnected = value; // update the shared flag first so late reads see the new state
    connectionHandlers.forEach((handler) => handler(value)); // then fan out the transition
  },

  /**
   * Registers a handler for connection-state transitions (e.g. to drive a
   * "reconnecting…" indicator).
   * @param handler Called with the new connected state on every change.
   * @returns An unsubscribe function.
   * @remarks The handler fires only on subsequent {@link eventBus.setConnected} calls, not
   *   immediately with the current value - read {@link eventBus.connected} once up front if
   *   the initial state matters.
   */
  onConnection(handler: ConnectionHandler): () => void {
    connectionHandlers.add(handler); // idempotent add (Set semantics)
    return () => connectionHandlers.delete(handler); // disposer for useEffect cleanup
  },
};
