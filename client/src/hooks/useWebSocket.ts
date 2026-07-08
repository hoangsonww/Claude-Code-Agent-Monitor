/**
 * @file useWebSocket.ts
 * @description Defines a custom React hook for managing WebSocket connections in the agent dashboard application. The hook establishes a WebSocket connection to the server, handles incoming messages, manages connection status, and implements automatic reconnection logic. It provides a clean interface for components to receive real-time updates from the server and react to changes in connectivity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { WSMessage } from "../lib/types";
import { eventBus } from "../lib/eventBus";
import { dashboardToken } from "../lib/api";

/** Callback invoked with each parsed {@link WSMessage} the socket receives. */
type MessageHandler = (msg: WSMessage) => void;

/**
 * Owns the dashboard's single WebSocket connection: connects to `/ws` on the
 * current origin (matching the page's http/https scheme to ws/wss and
 * attaching the dashboard auth token when one is configured), forwards parsed
 * messages to `onMessage` and to the shared {@link eventBus}, and
 * auto-reconnects with capped exponential backoff on close - plus an
 * immediate reconnect attempt on tab focus/network-online/visibility-change
 * so the socket recovers quickly after a server restart or laptop sleep.
 * Guards against React 18 StrictMode's mount→cleanup→remount cycle opening a
 * duplicate socket (see the inline comment in `connect`).
 * @param onMessage Called with every message parsed from the socket; the
 *   latest reference is used even across reconnects (no stale closures).
 * @returns `{ connected }` - the current live connection state, for a status indicator.
 */
export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<MessageHandler>(onMessage);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  handlersRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    // Don't open a second socket if one is already alive or in flight.
    // Without this, React 18 StrictMode (mount → cleanup → remount in dev)
    // and the close→reconnect race could leave two sockets connected at the
    // same time. Both would receive every server broadcast, producing
    // duplicate stream_event deltas (doubled text, duplicate assistant
    // bubbles, doubled rate_limit_event rows).
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Pass the optional dashboard token (GHSA-gr74-4xfh-6jw9) on the WS upgrade
    // when one is configured; omitted entirely for the default loopback bind.
    const token = dashboardToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const ws = new WebSocket(`${protocol}//${host}/ws${query}`);

    ws.onopen = () => {
      if (mountedRef.current) {
        setConnected(true);
        eventBus.setConnected(true);
        reconnectAttempts.current = 0; // Reset on successful connection
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        handlersRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) {
        setConnected(false);
        eventBus.setConnected(false);
        // Exponential backoff capped low (0.5s, 1s, 2s, 3s max) so a server
        // restart is picked up within a few seconds rather than after a long
        // idle wait. The focus/online/visibility listeners below reconnect
        // instantly on top of this for the common "user comes back" case.
        const delay = Math.min(500 * Math.pow(2, reconnectAttempts.current), 3000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        // Detach handlers so a still-closing socket can't deliver a final
        // onmessage / onclose into the bus after the component is gone.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Reconnect *immediately* when the user/network signals the server is likely
  // back: tab refocus, regained network, or page becoming visible again. This
  // cancels any pending backoff timer and resets the attempt counter so we
  // don't sit out a long delay - e.g. after the dashboard server restarts, the
  // socket (and the Tabby eyes) recover the moment you look at the tab.
  useEffect(() => {
    const reconnectNow = () => {
      if (!mountedRef.current) return;
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return; // already connected / connecting
      }
      clearTimeout(reconnectTimer.current);
      reconnectAttempts.current = 0;
      connect();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };
    window.addEventListener("focus", reconnectNow);
    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", reconnectNow);
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [connect]);

  return { connected };
}
