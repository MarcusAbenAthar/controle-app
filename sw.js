const CACHE_NAME = 'controle-diario-v1';
const APP_SHELL = [
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith('controle-diario-') &&
              cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;
      if (request.mode === 'navigate') {
        return caches.match(new URL('./index.html', self.registration.scope));
      }
      return Response.error();
    }),
  );
});
