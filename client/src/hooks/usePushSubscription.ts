/**
 * @file usePushSubscription.ts
 * @description React hook that wraps the browser's push subscription state and
 * the dashboard's `/api/push/subscribe` endpoints. Designed for the mobile
 * PWA's `PushSubscribeButton` and any future surface that wants to expose
 * subscribe / unsubscribe controls.
 *
 * Status state machine:
 *   "loading"      — initial check before we know whether SW + PushManager exist
 *   "unsupported"  — the platform can't do web push at all (e.g. iOS Safari < 16.4)
 *   "denied"       — user previously chose Block in the OS prompt
 *   "supported"    — supported, no active subscription
 *   "subscribed"   — supported, an active subscription exists for this origin
 *
 * The hook is intentionally side-effect-light: we only call into
 * `Notification.requestPermission` and `pushManager.subscribe` from the
 * `subscribe()` action returned to callers, never on mount.
 */
import { useCallback, useEffect, useState } from "react";

export type PushStatus = "loading" | "supported" | "unsupported" | "denied" | "subscribed";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  // Return the underlying ArrayBuffer — TS's PushManager.subscribe overload
  // accepts BufferSource, and this matches the helper in client/src/lib/push.ts.
  return arr.buffer;
}

function platformSupports(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export interface UsePushSubscriptionResult {
  status: PushStatus;
  error: string | null;
  /** Trigger the OS permission prompt, register a subscription, POST it to the server. */
  subscribe: () => Promise<boolean>;
  /** Unregister the local subscription and DELETE it on the server. */
  unsubscribe: () => Promise<void>;
  /** Re-check current state (useful after returning from a settings page). */
  refresh: () => Promise<void>;
}

export function usePushSubscription(): UsePushSubscriptionResult {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!platformSupports()) {
      setStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") {
        setStatus("denied");
      } else if (sub) {
        setStatus("subscribed");
      } else {
        setStatus("supported");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("supported");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!platformSupports()) {
      setStatus("unsupported");
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      // Reuse an existing subscription if one is already registered for this
      // origin — pushManager.subscribe is idempotent at the browser level but
      // we still want to re-POST to the server in case the row was pruned.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch("/api/push/vapid-public-key");
        if (!res.ok) throw new Error(`vapid HTTP ${res.status}`);
        const { publicKey } = (await res.json()) as { publicKey?: string };
        if (!publicKey) throw new Error("VAPID public key not available");
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!r.ok) throw new Error(`subscribe HTTP ${r.status}`);
      setStatus("subscribed");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setError(null);
    if (!platformSupports()) {
      setStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("supported");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { status, error, subscribe, unsubscribe, refresh };
}
