// ─── Service Worker — Fuel/Axle Weight Calculator ────────────────────────────
// Bump CACHE_VERSION on every deploy to force cache refresh.

const CACHE_VERSION = "fuel-axle-v1";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/css/main.chunk.css",
  "/manifest.json",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fuel-axle-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for assets, network-first for navigation ───────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  const isGoogleFont =
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";

  if (!isGoogleFont && url.origin !== self.location.origin) return;

  // Navigation requests — network first, fall back to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // All other requests — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }
        const clone = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
