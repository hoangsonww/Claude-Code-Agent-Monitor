/**
 * @file push.ts
 * @description Provides functions for managing push notifications in the agent dashboard application. It includes utilities for subscribing and unsubscribing to push notifications using the Push API and Service Workers. The module handles the conversion of VAPID public keys, manages push subscriptions, and communicates with the backend API to register or unregister push endpoints. This allows the application to send real-time notifications to users about important events or updates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Decodes a URL-safe base64 VAPID public key (as served by
 * GET /api/push/vapid-public-key) into the raw byte buffer the Push API's
 * `applicationServerKey` option requires.
 * @param base64String URL-safe base64 string (`-`/`_` instead of `+`/`/`,
 *   `=` padding optional - this re-pads before decoding).
 * @returns The decoded bytes as an `ArrayBuffer`.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index++) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray.buffer;
}

/**
 * Subscribes the browser to Web Push notifications, if not already
 * subscribed. No-ops silently when the browser lacks Service Worker/Push API
 * support, or when a subscription already exists (idempotent - safe to call
 * on every app load / every time notifications are enabled in settings).
 * Fetches the server's VAPID public key, creates the push subscription via
 * the active service worker, then registers it with the backend so
 * `/api/push/send` can target this browser.
 */
export async function subscribeToPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return;

  const res = await fetch("/api/push/vapid-public-key");
  const { publicKey } = await res.json();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}

/**
 * Unsubscribes the browser from Web Push notifications, if currently
 * subscribed, and tells the backend to forget the endpoint (so it stops
 * attempting deliveries to it). No-ops silently when there's no active
 * subscription or the browser lacks Service Worker support.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}
