/**
 * @file eventBus.ts
 * @description Implements a simple event bus for managing WebSocket messages and connection status in the agent dashboard application. It allows components to subscribe to real-time updates from the server and react to changes in WebSocket connectivity. The event bus maintains a list of handlers for incoming messages and connection status changes, providing a clean interface for publishing events and managing subscriptions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { WSMessage } from "./types";

/** Callback invoked with every message received from the dashboard WebSocket. */
type Handler = (msg: WSMessage) => void;
/** Callback invoked whenever the WebSocket connection state changes. */
type ConnectionHandler = (connected: boolean) => void;

const handlers = new Set<Handler>();
const connectionHandlers = new Set<ConnectionHandler>();
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
    handlers.add(handler);
    return () => handlers.delete(handler);
  },

  /** Broadcasts `msg` to every currently-subscribed {@link Handler}. Called by
   *  `useWebSocket` on each parsed inbound frame - not intended to be called
   *  directly by UI code. */
  publish(msg: WSMessage): void {
    handlers.forEach((handler) => handler(msg));
  },

  /** Current WebSocket connection state, as last reported via {@link setConnected}. */
  get connected(): boolean {
    return wsConnected;
  },

  /** Updates the shared connection flag and notifies every {@link onConnection}
   *  listener. Called by `useWebSocket` on socket open/close. */
  setConnected(value: boolean): void {
    wsConnected = value;
    connectionHandlers.forEach((handler) => handler(value));
  },

  /**
   * Registers a handler for connection-state transitions (e.g. to drive a
   * "reconnecting…" indicator).
   * @param handler Called with the new connected state on every change.
   * @returns An unsubscribe function.
   */
  onConnection(handler: ConnectionHandler): () => void {
    connectionHandlers.add(handler);
    return () => connectionHandlers.delete(handler);
  },
};
