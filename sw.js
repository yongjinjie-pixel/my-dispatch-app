const BUILD = "20260716-2";
const CACHE_PREFIX = "dispatch-pilot-";
const CACHE = `${CACHE_PREFIX}${BUILD}`;
const shellUrl = (file) => new URL(file, self.registration.scope).href;
const FILES = [
  shellUrl("./"), shellUrl("./index.html"), shellUrl(`./styles.css?v=${BUILD}`),
  shellUrl(`./app.js?v=${BUILD}`), shellUrl("./scheduler.js"), shellUrl(`./manifest.json?v=${BUILD}`),
  shellUrl("./icon-192.png"), shellUrl("./icon-512.png"),
];

self.addEventListener("install", (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES);
  await self.skipWaiting();
})()));

self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request, { cache: "reload" });
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (_) {
      const cache = await caches.open(CACHE);
      return (await cache.match(event.request)) || (event.request.mode === "navigate" ? await cache.match(shellUrl("./index.html")) : Response.error());
    }
  })());
});
