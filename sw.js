// Change this version number (e.g., v2, v3) whenever you want to force an update
const CACHE_NAME = 'dispatch-pilot-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// Force immediate activation when a new script is found
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Clean up old caches automatically
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First strategy: Always check the internet first for updates. Fallback to cache if offline.
self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the network request works, save a copy to cache and return it
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // If internet fails/offline, use cache
  );
});
