/**
 * @file push.ts
 * @description Provides functions for managing push notifications in the agent dashboard application. It includes utilities for subscribing and unsubscribing to push notifications using the Push API and Service Workers. The module handles the conversion of VAPID public keys, manages push subscriptions, and communicates with the backend API to register or unregister push endpoints. This allows the application to send real-time notifications to users about important events or updates.
 *
 * ## Web Push in one paragraph
 * Web Push lets the server deliver a notification to this browser even when the dashboard
 * tab is closed, by going through the browser vendor's push service. Authentication uses
 * VAPID (Voluntary Application Server Identification): the server holds a key pair and
 * exposes its public key; the browser bakes that public key into the subscription so the
 * push service will only accept notifications signed by the matching private key.
 *
 * ## Subscription lifecycle handled here
 * 1. {@link subscribeToPush} - feature-detect Service Worker + Push support, wait for the
 *    active service worker, fetch the server's VAPID public key, ask the browser's
 *    `PushManager` to create a subscription bound to that key, then POST the resulting
 *    endpoint/keys to the backend so it can target this browser later.
 * 2. {@link unsubscribeFromPush} - tear the subscription down in the browser and DELETE it
 *    on the backend so no further deliveries are attempted to a dead endpoint.
 *
 * Both entry points are idempotent and fail-soft: they no-op on unsupported browsers and on
 * the "already in the desired state" case, so callers can invoke them freely (e.g. on every
 * app load, or on a settings toggle) without tracking prior state themselves.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// ===========================================================================
// VAPID key decoding
// ===========================================================================

/**
 * Decodes a URL-safe base64 VAPID public key (as served by
 * GET /api/push/vapid-public-key) into the raw byte buffer the Push API's
 * `applicationServerKey` option requires.
 * @param base64String URL-safe base64 string (`-`/`_` instead of `+`/`/`,
 *   `=` padding optional - this re-pads before decoding).
 * @returns The decoded bytes as an `ArrayBuffer`.
 * @remarks Why this dance is necessary: VAPID keys are transmitted in *URL-safe* base64
 *   (base64url) and usually unpadded, but the browser's `atob` only understands *standard*
 *   base64 with proper `=` padding. So we:
 *   1. Re-pad to a multiple of 4 chars - `(4 - len % 4) % 4` yields 0..3 `=` (the outer
 *      `% 4` collapses the "already aligned" case from 4 back to 0).
 *   2. Translate the URL-safe alphabet back to standard (`-`->`+`, `_`->`/`).
 *   3. `atob` to a binary string, then copy char codes into a `Uint8Array`.
 *   `.buffer` is returned because `applicationServerKey` accepts an `ArrayBuffer`/typed view.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  // 1. Compute the missing `=` padding so the length is a multiple of 4.
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  // 2. Re-pad and map the base64url alphabet (`-`/`_`) to standard base64 (`+`/`/`).
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  // 3. Decode to a binary string and copy each byte into the output buffer.
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index++) {
    outputArray[index] = rawData.charCodeAt(index); // each char code is one byte (0..255)
  }
  return outputArray.buffer;
}

// ===========================================================================
// Subscribe / unsubscribe
// ===========================================================================

/**
 * Subscribes the browser to Web Push notifications, if not already
 * subscribed. No-ops silently when the browser lacks Service Worker/Push API
 * support, or when a subscription already exists (idempotent - safe to call
 * on every app load / every time notifications are enabled in settings).
 * Fetches the server's VAPID public key, creates the push subscription via
 * the active service worker, then registers it with the backend so
 * `/api/push/send` can target this browser.
 * @returns A promise that resolves once the (possibly new) subscription is registered,
 *   or immediately when the environment/state makes subscribing unnecessary.
 * @remarks
 * - Feature-detects both `navigator.serviceWorker` and `window.PushManager`; on older or
 *   non-secure contexts (Push requires HTTPS/localhost) it simply returns.
 * - `serviceWorker.ready` resolves only once a service worker is active, so this must run
 *   after the SW registration has taken control.
 * - `userVisibleOnly: true` is mandatory in Chromium-based browsers: it promises every
 *   push will surface a user-visible notification (no silent pushes).
 * - The permission prompt is triggered implicitly by `pushManager.subscribe`; if the user
 *   denies it, the returned promise rejects and this function throws (callers decide how to
 *   surface that).
 * - `subscription.toJSON()` serializes the endpoint URL plus the `p256dh`/`auth` keys the
 *   backend needs to encrypt payloads for this browser.
 */
export async function subscribeToPush(): Promise<void> {
  // Bail on browsers without Service Worker or Push API (or insecure contexts).
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.ready; // wait for an active SW
  const existing = await registration.pushManager.getSubscription();
  if (existing) return; // already subscribed -> idempotent no-op

  // Fetch the server's VAPID public key and decode it for `applicationServerKey`.
  const res = await fetch("/api/push/vapid-public-key");
  const { publicKey } = await res.json();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // required by Chromium: every push must be user-visible
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Register the endpoint + keys with the backend so it can push to this browser.
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()), // { endpoint, keys: { p256dh, auth } }
  });
}

/**
 * Unsubscribes the browser from Web Push notifications, if currently
 * subscribed, and tells the backend to forget the endpoint (so it stops
 * attempting deliveries to it). No-ops silently when there's no active
 * subscription or the browser lacks Service Worker support.
 * @returns A promise that resolves once both the browser-side unsubscribe and the
 *   backend DELETE have completed (or immediately when there's nothing to remove).
 * @remarks Mirrors {@link subscribeToPush}. The endpoint is captured *before* calling
 *   `subscription.unsubscribe()` because the subscription object's `endpoint` is what the
 *   backend keys deliveries on - it's read first so the DELETE can identify the right row
 *   even though the subscription is torn down locally beforehand.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return; // no SW support -> nothing to do

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return; // not subscribed -> idempotent no-op

  const endpoint = subscription.endpoint; // capture before tearing down the subscription
  await subscription.unsubscribe(); // remove the browser-side subscription

  // Tell the backend to forget this endpoint so it stops attempting deliveries.
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}
