/* STMS service worker.
 *
 * Privacy first: pages and /api responses are NEVER cached. They contain tenant data (NID, phone,
 * documents) and must not be left on a shared or lost phone. We only cache:
 *   - build assets under /_next/static (content-hashed, safe to keep forever)
 *   - icons and the offline page
 * When the network is down, page navigations fall back to /offline.
 *
 * Bump VERSION to force clients to drop old caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `stms-static-${VERSION}`;
const SHELL_CACHE = `stms-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, SHELL_CACHE]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

// The page asks a waiting worker to take over after the user accepts the "update available" prompt.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network only, never cached

  // Hashed build assets: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Page navigations: always from the network (never stored); offline page if that fails.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          return preloaded || (await fetch(req));
        } catch {
          return (await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })) || Response.error();
        }
      })(),
    );
    return;
  }

  // Icons / manifest: cache first from the shell cache.
  if (SHELL.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
