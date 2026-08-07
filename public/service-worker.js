const CACHE_NAME = 'hansalmae-supabase-v8-complete-backup';

const REQUIRED_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './config.js',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './images/hsm-ball.png'
];

const OPTIONAL_ASSETS = [
  './teacher.html',
  './images/emblems/title-chick.png',
  './images/emblems/title-collector.png',
  './images/emblems/title-predator.png',
  './images/emblems/title-holic.png',
  './images/emblems/title-slayer.png',
  './images/emblems/title-madman.png',
  './images/emblems/title-dictionary.png',
  './images/emblems/achievement-king.png',
  './images/emblems/achievement-success.png',
  './images/emblems/achievement-madness-max.png',
  './images/emblems/achievement-conqueror.png',
  './images/emblems/achievement-teacher-blessing.png',
  './images/emblems/achievement-reborn.png',
  './images/emblems/achievement-vocab-trainer.png',
  './images/emblems/achievement-wrong-hunter.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(REQUIRED_ASSETS).then(function () {
      return Promise.all(OPTIONAL_ASSETS.map(function (asset) {
        return cache.add(asset).catch(function () { return null; });
      }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; })
      .map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('.supabase.co')) return;
  const acceptsHtml = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (acceptsHtml) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(function (response) {
      if (!response || !response.ok) {
        throw new Error('HTML 응답 오류: ' + (response ? response.status : 'NO_RESPONSE'));
      }
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        return url.pathname.endsWith('/teacher.html') ? caches.match('./teacher.html') : caches.match('./index.html');
      });
    }));
    return;
  }
  event.respondWith(caches.match(request).then(function (cached) {
    const networkRequest = fetch(request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || networkRequest;
  }));
});
