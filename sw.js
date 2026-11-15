// 오프라인에서도 앱 화면이 열리도록 기본 파일을 캐시합니다.
const CACHE = 'nneow-v3';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './cloud.js',
  './assets/vendor/firebase-app-compat.js',
  './assets/vendor/firebase-auth-compat.js',
  './assets/vendor/firebase-firestore-compat.js',
  './manifest.webmanifest',
  './assets/fonts/WantedSansVariable.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon.png',
  './assets/icons/logo.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // 날씨 API 등은 그대로 네트워크
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
