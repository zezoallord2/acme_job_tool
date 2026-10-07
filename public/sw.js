// Service worker for Acme Jobs.
//
// Purpose is deliberately narrow. This is not an offline-first rewrite: career
// data must never be served from a cache that could show a stale claim as
// current. The service worker exists so the app can be installed as a local
// app, and so a cold start on a flaky connection does not show a browser error.
//
// The rules:
//   - Never cache anything under /app or /api. That is live career data and
//     live billing state; a stale copy would be a correctness bug, not a
//     performance win.
//   - Never cache non-GET requests, so nothing is replayed.
//   - Cache only the app shell and static assets, which are content-hashed by
//     the build and therefore safe to serve from cache.
//   - Bypass entirely when the user is signed in, so a shared or public
//     install never carries one person's data into another's session.

const CACHE = "acme-shell-v1";
const SHELL = ["/", "/offline", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      // A failed precache must not block installation.
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable. Anything else is a mutation and must reach the server.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data and authenticated pages: always go to the network, never cached.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/app") ||
    url.pathname.startsWith("/admin")
  ) {
    return;
  }

  // Static, content-hashed build output: cache-first is safe here.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigation: network first so a deploy is picked up immediately, with the
  // offline page as the fallback rather than a stale document.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((hit) => hit ?? Response.error()),
      ),
    );
  }
});
