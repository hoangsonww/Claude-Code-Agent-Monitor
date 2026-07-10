/**
 * @file sw.js
 * @description Service worker for the project landing page — precaches the shell (index, favicon, OG image, manifest) and manages cache lifecycle for offline support.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const CACHE_NAME = "landing-v1";
const PRECACHE = ["./", "./index.html", "./favicon.svg", "./og-image.svg", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    // Network-first for HTML
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  // Cache-first for assets, lazy-cache on miss
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});
