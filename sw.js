const CACHE = "dispatch-pilot-v1";
const FILES = ["./", "./index.html", "./styles.css", "./app.js", "./scheduler.js", "./manifest.json"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
