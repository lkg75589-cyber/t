const VERSION = 'madrasati-pwa-v3';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(APP_FILES.map(async path => {
      try { await cache.add(new Request(new URL(path, self.registration.scope), {cache:'reload'})); }
      catch (error) { console.warn('Could not precache app file:', path, error); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('madrasati-pwa-') && key !== SHELL && key !== RUNTIME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scopeURL = new URL(self.registration.scope);
  if (url.origin === scopeURL.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put(new URL('./index.html', self.registration.scope), fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(new URL('./index.html', self.registration.scope))) || Response.error();
      }
    })());
    return;
  }
  // Cache only small application libraries, not model weights (Transformers.js has its own model cache).
  if (['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok && response.type !== 'opaque') {
        const length = Number(response.headers.get('content-length') || 0);
        if (!length || length < 25 * 1024 * 1024) cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })());
  }
});
