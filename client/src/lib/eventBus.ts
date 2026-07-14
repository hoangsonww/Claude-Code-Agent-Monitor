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
   *  throwing handler aborts delivery to the handlers after it. */
  publish(msg: WSMessage): void {
    handlers.forEach((handler) => handler(msg)); // notify each subscriber in turn
  },

  /** Current WebSocket connection state, as last reported via {@link setConnected}. */
  get connected(): boolean {
    return wsConnected;
  },

  /** Updates the shared connection flag and notifies every {@link onConnection}
   *  listener. Called by `useWebSocket` on socket open/close. */
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
