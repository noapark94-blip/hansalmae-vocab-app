const CACHE_NAME = 'hansalmae-supabase-v22-custom-learning-icons';

const REQUIRED_ASSETS = [
  './',
  './index.html',
  './design-v1.css',
  './design-v2-mobile-nav.css',
  './design-v3-test-rewards.css',
  './ui-icons.css',
  './ui-icons.js',
  './teacher-modern.css',
  './fonts/PretendardVariable.woff2',
  './manifest.json',
  './config.js',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
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

self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_error) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || '한살매 보카', {
    body: data.body || '새로운 알림이 도착했습니다.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'hansalmae-notification',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: data.url || './?push=teacher-exams', examId: data.examId || '' }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || './?push=teacher-exams',
    self.location.origin
  ).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
    for (const client of clientList) {
      if ('focus' in client) {
        client.postMessage({ type: 'OPEN_TEACHER_EXAMS' });
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
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
