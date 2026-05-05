/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * @file sw.ts
 * @description Service worker source for the dashboard PWA. Combines workbox
 * precache + runtime caching with the dashboard's push-notification handlers
 * (originally in public/sw.js, restored here after the migration to
 * vite-plugin-pwa's injectManifest strategy).
 */

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// Precache all static assets — manifest is injected at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Runtime caching for the dashboard's read-heavy API endpoints. Mobile users
// on flaky networks see cached results within 60s of staleness; live updates
// continue to flow over the existing WebSocket.
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/api/sessions") ||
    url.pathname.startsWith("/api/agents"),
  new NetworkFirst({
    cacheName: "api-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 })],
  })
);

// === Push notification handlers (recovered from original public/sw.js) ===
// Required by server/routes/push.js — without these listeners the dashboard's
// web push subscription wouldn't surface notifications.

self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "Agent Monitor", body: "New notification" };
  const { title, ...options } = data;
  event.waitUntil(
    self.registration.showNotification(title, { silent: false, ...options })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return (client as WindowClient).focus();
        }
      }
    })
  );
});

// Skip waiting + claim so updates take effect on next page load.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
