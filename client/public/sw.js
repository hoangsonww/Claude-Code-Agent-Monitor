/**
 * @description Service Worker for caching static assets and handling push notifications.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Bump this any time the SW logic changes - old clients will install the new
// SW, drop their existing caches in `activate`, and `skipWaiting` so the
// freshly-built bundle starts being served on the very next request.
const CACHE_NAME = "dashboard-v3";

self.addEventListener("install", () => {
  // No pre-cache: network-first below means the cache fills lazily, and
  // there's nothing to "warm" - the v1 SW was pre-caching `/`, which is
  // exactly the file most likely to go stale after a rebuild.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Skip API, WebSocket, and Vite HMR endpoints
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws") ||
    url.pathname.includes("__vite")
  )
    return;

  // Hashed bundles under /assets/ are immutable for a given URL - cache-first
  // is safe and fast. A new build emits new filenames, so stale entries simply
  // don't get re-requested.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (navigations, sw.js, manifest, icons, root /): network-first
  // with cache fallback. The user always gets the freshest UI while online and
  // a sensible fallback when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match("/")))
  );
});

// --- Push notifications (existing) ---

self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "Agent Monitor", body: "New notification" };
  const { title, ...options } = data;
  event.waitUntil(self.registration.showNotification(title, { silent: false, ...options }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Server-side turn notifications carry data.url (e.g. /sessions/<id>): open that page, reusing an
  // open dashboard window when there is one.
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.focus) {
          if (target && "navigate" in client) {
            return client.navigate(target).then((c) => (c || client).focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target || "/");
    })
  );
});
